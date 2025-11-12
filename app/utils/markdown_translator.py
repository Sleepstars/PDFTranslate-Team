"""
Markdown translation module using existing translation services.

This module provides functionality to translate markdown content while preserving
formatting, using the same translation providers configured for PDF translation.
"""

import logging
import asyncio
import re
from typing import Optional, Callable, Dict, Any, List, Tuple
import httpx
from .babeldoc import (
    _clean_str, _config_value, _config_bool, _clean_kwargs, _coerce_int
)
from ..config import get_settings
from .provider_limiter import acquire as acquire_provider_slot
import os

logger = logging.getLogger(__name__)

# Type alias for progress callback
ProgressCallback = Callable[[dict], None]


class MarkdownTranslationError(Exception):
    """Exception raised for markdown translation errors."""
    pass


def _split_markdown_blocks(markdown: str) -> list[tuple[str, str]]:
    """
    Split markdown into translatable text blocks and non-translatable code blocks.

    Returns:
        List of tuples (block_type, content) where block_type is 'text' or 'code'
    """
    blocks = []
    current_pos = 0

    # Pattern to match code blocks (```...```)
    code_block_pattern = re.compile(r'```[\s\S]*?```', re.MULTILINE)

    for match in code_block_pattern.finditer(markdown):
        # Add text before code block
        if match.start() > current_pos:
            text_content = markdown[current_pos:match.start()]
            if text_content.strip():
                blocks.append(('text', text_content))

        # Add code block
        blocks.append(('code', match.group()))
        current_pos = match.end()

    # Add remaining text
    if current_pos < len(markdown):
        remaining = markdown[current_pos:]
        if remaining.strip():
            blocks.append(('text', remaining))

    return blocks


def _split_text_into_chunks_by_paragraphs(text: str, max_chars: int) -> List[str]:
    """
    Split a plain text section into chunks by paragraph boundaries (blank lines),
    trying to keep each chunk under max_chars. Preserves original paragraph
    separators when re-joining chunk translations.

    Strategy:
    - Split with a capturing group on blank-line separators so we keep them.
    - Accumulate tokens until adding the next would exceed max_chars, then start
      a new chunk.
    - If a single token exceeds max_chars (very long paragraph), hard-split it
      by character length as a fallback to ensure progress.
    """
    if not text:
        return [""]

    # Capture separators to preserve formatting upon reassembly
    tokens = re.split(r"(\n\s*\n+)", text)
    chunks: List[str] = []
    current: List[str] = []
    current_len = 0

    def flush_current():
        nonlocal current, current_len
        if current:
            chunks.append("".join(current))
            current = []
            current_len = 0

    for tok in tokens:
        if not tok:
            continue
        tlen = len(tok)

        # If the token itself is oversized, slice it to fit
        if tlen > max_chars:
            # First, flush what we have
            flush_current()
            # Hard chunk this token
            start = 0
            while start < tlen:
                end = min(start + max_chars, tlen)
                chunks.append(tok[start:end])
                start = end
            continue

        # Normal accumulation with boundary check
        if current_len + tlen > max_chars and current:
            flush_current()
        current.append(tok)
        current_len += tlen

    flush_current()
    return chunks if chunks else [text]


def _split_paragraphs_with_separators(text: str) -> List[Tuple[str, str]]:
    """
    Tokenize text into a list of (kind, content) where kind is 'para' or 'sep'.
    Separators are blank-line runs including the newlines themselves so formatting is preserved.
    """
    if not text:
        return [("para", "")]
    tokens = re.split(r"(\n\s*\n+)", text)
    result: List[Tuple[str, str]] = []
    for tok in tokens:
        if tok is None or tok == "":
            continue
        if re.fullmatch(r"\n\s*\n+", tok):
            result.append(("sep", tok))
        else:
            result.append(("para", tok))
    return result or [("para", text)]


def _slice_text_hard(text: str, max_chars: int) -> List[str]:
    """Hard-slice a long text into <= max_chars pieces, preserving order."""
    if len(text) <= max_chars:
        return [text]
    out: List[str] = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        out.append(text[start:end])
        start = end
    return out


async def _translate_piece_async(
    part: str,
    service: str,
    lang_from: str,
    lang_to: str,
    model_config: Dict[str, Any],
    provider_key: Optional[str],
    provider_limit: int,
) -> str:
    """Run blocking translate call in a thread for concurrency under asyncio."""
    if provider_key:
        async with acquire_provider_slot(provider_key, provider_limit):
            return await asyncio.to_thread(
                _translate_text_with_service,
                part,
                service,
                lang_from,
                lang_to,
                model_config,
            )
    # fallback: no provider key provided
    return await asyncio.to_thread(
        _translate_text_with_service,
        part,
        service,
        lang_from,
        lang_to,
        model_config,
    )


def _translate_text_with_service(
    text: str,
    service: str,
    lang_from: str,
    lang_to: str,
    model_config: Dict[str, Any]
) -> str:
    """
    Translate text using the specified translation service.

    This function uses direct API calls to translation services,
    similar to how pdf2zh-next handles translation.
    """
    settings = get_settings()
    service = service.lower()

    # Extract common config
    custom_api_key = _clean_str(model_config.get("api_key"))
    custom_endpoint = _clean_str(
        model_config.get("endpoint") or model_config.get("base_url")
    )
    custom_model = _clean_str(model_config.get("model"))

    if service == "google":
        return _translate_with_google(text, lang_from, lang_to)
    elif service == "deepl":
        api_key = _config_value(custom_api_key, env_var="DEEPL_AUTH_KEY")
        endpoint = _config_value(
            custom_endpoint,
            env_var="DEEPL_API_URL",
            fallback=settings.deepl_api_url or "https://api-free.deepl.com/v2/translate"
        )
        return _translate_with_deepl(text, lang_from, lang_to, api_key, endpoint)
    elif service == "openai":
        api_key = _config_value(custom_api_key, env_var="OPENAI_API_KEY")
        base_url = _config_value(
            custom_endpoint,
            env_var="OPENAI_API_BASE",
            fallback=settings.openai_api_base or "https://api.openai.com/v1"
        )
        model = custom_model or "gpt-3.5-turbo"
        return _translate_with_openai(text, lang_from, lang_to, api_key, base_url, model, model_config)
    elif service in {"deepseek", "zhipu", "groq", "grok", "siliconflow"}:
        vendor_defaults = {
            "deepseek": {
                "env_key": "DEEPSEEK_API_KEY",
                "base_env": "DEEPSEEK_API_BASE",
                "default_base": "https://api.deepseek.com/v1",
                "default_model": "deepseek-chat",
            },
            "zhipu": {
                "env_key": "ZHIPU_API_KEY",
                "base_env": "ZHIPU_API_BASE",
                "default_base": "https://open.bigmodel.cn/api/paas/v4",
                "default_model": "glm-4-flash",
            },
            "groq": {
                "env_key": "GROQ_API_KEY",
                "base_env": "GROQ_API_BASE",
                "default_base": "https://api.groq.com/openai/v1",
                "default_model": "mixtral-8x7b-32768",
            },
            "grok": {
                "env_key": "GROK_API_KEY",
                "base_env": "GROK_API_BASE",
                "default_base": "https://api.x.ai/v1",
                "default_model": "grok-1",
            },
            "siliconflow": {
                "env_key": "SILICONFLOW_API_KEY",
                "base_env": "SILICONFLOW_BASE_URL",
                "default_base": "https://api.siliconflow.cn/v1",
                "default_model": None,
            },
        }
        defaults = vendor_defaults[service]
        api_key = _config_value(custom_api_key, env_var=defaults["env_key"])
        base_url = _config_value(
            custom_endpoint,
            env_var=defaults.get("base_env"),
            fallback=defaults.get("default_base"),
        )
        model = custom_model or defaults.get("default_model") or "gpt-3.5-turbo"

        missing = []
        if not api_key:
            missing.append("api_key")
        if not base_url:
            missing.append("endpoint/base_url")
        if missing:
            raise MarkdownTranslationError(
                f"{service} configuration missing: {', '.join(missing)}"
            )
        return _translate_with_openai(
            text, lang_from, lang_to, api_key, base_url, model, model_config
        )
    else:
        # For other services, fall back to Google
        logger.warning(f"Service {service} not directly supported for markdown translation, using Google")
        return _translate_with_google(text, lang_from, lang_to)


def _translate_with_google(text: str, lang_from: str, lang_to: str) -> str:
    """Translate using Google Translate (free, no API key required)."""
    try:
        from googletrans import Translator
        translator = Translator()
        result = translator.translate(text, src=lang_from, dest=lang_to)
        return result.text
    except Exception as e:
        logger.error(f"Google translation failed: {str(e)}")
        raise MarkdownTranslationError(f"Google translation failed: {str(e)}")


def _translate_with_deepl(
    text: str,
    lang_from: str,
    lang_to: str,
    api_key: Optional[str],
    endpoint: str
) -> str:
    """Translate using DeepL API."""
    if not api_key:
        raise MarkdownTranslationError("DeepL API key not configured")

    try:
        import httpx

        # DeepL language code mapping
        lang_map = {
            "en": "EN",
            "zh": "ZH",
            "ja": "JA",
            "ko": "KO",
            "fr": "FR",
            "de": "DE",
            "es": "ES"
        }

        source_lang = lang_map.get(lang_from, lang_from.upper())
        target_lang = lang_map.get(lang_to, lang_to.upper())

        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                endpoint,
                headers={"Authorization": f"DeepL-Auth-Key {api_key}"},
                data={
                    "text": text,
                    "source_lang": source_lang,
                    "target_lang": target_lang
                }
            )
            response.raise_for_status()
            result = response.json()
            return result["translations"][0]["text"]
    except Exception as e:
        logger.error(f"DeepL translation failed: {str(e)}")
        raise MarkdownTranslationError(f"DeepL translation failed: {str(e)}")


def _translate_with_openai(
    text: str,
    lang_from: str,
    lang_to: str,
    api_key: Optional[str],
    base_url: str,
    model: str,
    model_config: Optional[Dict[str, Any]] = None,
) -> str:
    """Translate using OpenAI API."""
    if not api_key:
        raise MarkdownTranslationError("OpenAI API key not configured")

    try:
        import httpx

        # Language name mapping
        lang_names = {
            "en": "English",
            "zh": "Chinese",
            "ja": "Japanese",
            "ko": "Korean",
            "fr": "French",
            "de": "German",
            "es": "Spanish"
        }

        source_name = lang_names.get(lang_from, lang_from)
        target_name = lang_names.get(lang_to, lang_to)

        # Build system prompt per spec
        to_name = target_name
        cfg = model_config or {}
        title_prompt = _clean_str(
            cfg.get("title_prompt") or cfg.get("titlePrompt") or cfg.get("title")
        ) or ""
        summary_prompt = _clean_str(
            cfg.get("summary_prompt") or cfg.get("summaryPrompt") or cfg.get("summary")
        ) or ""
        terms_prompt = _clean_str(
            cfg.get("terms_prompt") or cfg.get("termsPrompt") or cfg.get("terms")
        ) or ""

        extras = ""
        if title_prompt:
            extras += f"\n{title_prompt}"
        if summary_prompt:
            extras += f"\n{summary_prompt}"
        if terms_prompt:
            extras += f"\n{terms_prompt}"

        system_prompt = (
            f"You are a professional {to_name} native translator who needs to fluently translate text into {to_name}.\n\n"
            "## Translation Rules\n"
            "1. Output only the translated content, without explanations or additional content (such as \"Here's the translation:\" or \"Translation as follows:\")\n"
            "2. The returned translation must maintain exactly the same number of paragraphs and format as the original text\n"
            "3. If the text contains HTML or Markdown tags, consider where the tags should be placed in the translation while maintaining fluency\n"
            "4. For content that should not be translated (such as proper nouns, code, etc.), keep the original text.\n"
            "5. If input contains %%, use %% in your output, if input has no %%, don't use %% in your output"
            f"{extras}\n\n"
            "## OUTPUT FORMAT:\n"
            "- **Single paragraph input** → Output translation directly (no separators, no extra text)\n\n"
            "### Single paragraph Input:\n"
            "Single paragraph content\n\n"
            "### Single paragraph Output:\n"
            "Direct translation without separators"
        )

        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{base_url.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": text}
                    ],
                    "temperature": 0.3
                }
            )
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"OpenAI translation failed: {str(e)}")
        raise MarkdownTranslationError(f"OpenAI translation failed: {str(e)}")


async def translate_markdown(
    markdown_content: str,
    service: str,
    lang_from: str,
    lang_to: str,
    model_config: Optional[dict] = None,
    progress_callback: Optional[ProgressCallback] = None,
    provider_key: Optional[str] = None,
    provider_max_concurrency: Optional[int] = None,
) -> tuple[bool, Optional[str], Optional[str]]:
    """
    Translate markdown content using configured translation services.

    This function preserves markdown formatting by:
    1. Splitting content into text and code blocks
    2. Only translating text blocks
    3. Preserving code blocks as-is
    4. Reassembling the translated content

    Args:
        markdown_content: The markdown text to translate
        service: Translation service name (google, deepl, openai, etc.)
        lang_from: Source language code (e.g., "en")
        lang_to: Target language code (e.g., "zh")
        model_config: Optional configuration dict with API keys, endpoints, etc.
        progress_callback: Optional callback for progress updates

    Returns:
        Tuple of (success, error_message, translated_markdown)
        - success: True if translation succeeded
        - error_message: Error message if failed, None if succeeded
        - translated_markdown: Translated text if succeeded, None if failed

    Example:
        >>> success, error, translated = await translate_markdown(
        ...     markdown_content="# Hello World\\nThis is a test.",
        ...     service="google",
        ...     lang_from="en",
        ...     lang_to="zh"
        ... )
    """
    try:
        model_config = model_config or {}

        if progress_callback:
            await progress_callback({
                "overall_progress": 10,
                "stage": "分析Markdown结构",
                "status": "analyzing"
            })

        # Split markdown into blocks (text/code)
        blocks = _split_markdown_blocks(markdown_content)

        # Determine max chars per request (allows override via model_config)
        max_chars = _coerce_int(
            model_config.get("max_chars_per_request")
            or model_config.get("maxCharsPerRequest"),
            4000,
        )
        if max_chars < 500:
            max_chars = 500

        # Determine per-paragraph local concurrency (within a block)
        max_concurrency = _coerce_int(
            model_config.get("max_concurrent_requests")
            or model_config.get("maxConcurrentRequests"),
            4,
        )
        if max_concurrency < 1:
            max_concurrency = 1

        # Global provider concurrency limit
        provider_limit = _coerce_int(provider_max_concurrency, 4)
        if provider_limit < 1:
            provider_limit = 1

        # Pre-count total translation units (each short paragraph = 1; long paragraph sliced = N slices)
        total_units = 0
        tokenized_blocks: List[Optional[List[Tuple[str, str]]]] = []
        for block_type, content in blocks:
            if block_type == 'text':
                tokens = _split_paragraphs_with_separators(content)
                tokenized_blocks.append(tokens)
                for kind, piece in tokens:
                    if kind == 'para':
                        units = max(1, (len(piece) + max_chars - 1) // max_chars)
                        total_units += units
            else:
                tokenized_blocks.append(None)

        if progress_callback:
            await progress_callback({
                "overall_progress": 20,
                "stage": "开始翻译文本块",
                "status": "translating"
            })

        translated_blocks: List[str] = []
        units_done = 0

        # Iterate blocks, translating text while preserving code blocks
        for (block_type, content), tokens in zip(blocks, tokenized_blocks):
            if block_type == 'code':
                translated_blocks.append(content)
                continue

            # tokens: List[(kind, content)]
            block_out_parts: List[Optional[str]] = [None] * len(tokens)
            if not tokens:
                translated_blocks.append("")
                continue

            para_sem = asyncio.Semaphore(max_concurrency)
            translate_tasks: List[asyncio.Task] = []

            async def translate_para_at_index(i: int, para_text: str):
                nonlocal units_done
                async with para_sem:
                    if len(para_text) <= max_chars:
                        try:
                            t = await _translate_piece_async(
                                para_text, service, lang_from, lang_to, model_config, provider_key, provider_limit
                            )
                            block_out_parts[i] = t
                        except Exception as e:
                            logger.error(f"Failed to translate paragraph: {str(e)}")
                            block_out_parts[i] = para_text
                        finally:
                            units_done += 1
                            if progress_callback and total_units > 0:
                                progress = 20 + int((units_done / total_units) * 70)
                                await progress_callback({
                                    "overall_progress": progress,
                                    "stage": f"翻译中 ({units_done}/{total_units})",
                                    "status": "translating",
                                })
                    else:
                        slices = _slice_text_hard(para_text, max_chars)
                        slice_results: List[Optional[str]] = [None] * len(slices)
                        slice_sem = asyncio.Semaphore(max_concurrency)

                        async def slice_worker(idx: int, text_part: str):
                            nonlocal units_done
                            async with slice_sem:
                                try:
                                    res = await _translate_piece_async(
                                        text_part, service, lang_from, lang_to, model_config, provider_key, provider_limit
                                    )
                                    slice_results[idx] = res
                                except Exception as e:
                                    logger.error(f"Failed to translate slice: {str(e)}")
                                    slice_results[idx] = text_part
                                finally:
                                    units_done += 1
                                    if progress_callback and total_units > 0:
                                        progress = 20 + int((units_done / total_units) * 70)
                                        await progress_callback({
                                            "overall_progress": progress,
                                            "stage": f"翻译中 ({units_done}/{total_units})",
                                            "status": "translating",
                                        })

                        tasks = [asyncio.create_task(slice_worker(si, s)) for si, s in enumerate(slices)]
                        await asyncio.gather(*tasks)
                        block_out_parts[i] = "".join(x if x is not None else "" for x in slice_results)

            for idx, (kind, piece) in enumerate(tokens):
                if kind == 'sep':
                    block_out_parts[idx] = piece
                else:  # 'para'
                    translate_tasks.append(asyncio.create_task(translate_para_at_index(idx, piece)))

            if translate_tasks:
                await asyncio.gather(*translate_tasks)

            translated_blocks.append(''.join(p if p is not None else '' for p in block_out_parts))

        # Reassemble full markdown
        translated_markdown = ''.join(translated_blocks)

        if progress_callback:
            await progress_callback({
                "overall_progress": 100,
                "stage": "翻译完成",
                "status": "completed"
            })

        return True, None, translated_markdown

    except MarkdownTranslationError as e:
        logger.error(f"Markdown translation failed: {str(e)}")
        return False, str(e), None
    except Exception as e:
        logger.error(f"Unexpected error during markdown translation: {str(e)}")
        return False, f"Unexpected error: {str(e)}", None
