"""
Markdown translation module using existing translation services.

This module provides functionality to translate markdown content while preserving
formatting, using the same translation providers configured for PDF translation.
"""

import logging
import re
from typing import Optional, Callable, Dict, Any
import httpx
from .babeldoc import (
    _clean_str, _config_value, _config_bool, _clean_kwargs, _coerce_int
)
from ..config import get_settings
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
        return _translate_with_openai(text, lang_from, lang_to, api_key, base_url, model)
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
    model: str
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

        prompt = f"Translate the following text from {source_name} to {target_name}. Preserve all markdown formatting:\n\n{text}"

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
                        {"role": "system", "content": "You are a professional translator. Translate the text while preserving all markdown formatting."},
                        {"role": "user", "content": prompt}
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

        # Split markdown into blocks
        blocks = _split_markdown_blocks(markdown_content)

        if progress_callback:
            await progress_callback({
                "overall_progress": 20,
                "stage": "开始翻译文本块",
                "status": "translating"
            })

        # Translate text blocks
        translated_blocks = []
        total_text_blocks = sum(1 for block_type, _ in blocks if block_type == 'text')
        translated_count = 0

        for block_type, content in blocks:
            if block_type == 'code':
                # Preserve code blocks as-is
                translated_blocks.append(content)
            else:
                # Translate text blocks
                try:
                    translated_text = _translate_text_with_service(
                        content,
                        service,
                        lang_from,
                        lang_to,
                        model_config
                    )
                    translated_blocks.append(translated_text)
                    translated_count += 1

                    if progress_callback and total_text_blocks > 0:
                        progress = 20 + int((translated_count / total_text_blocks) * 70)
                        await progress_callback({
                            "overall_progress": progress,
                            "stage": f"翻译中 ({translated_count}/{total_text_blocks})",
                            "status": "translating"
                        })
                except Exception as e:
                    logger.error(f"Failed to translate block: {str(e)}")
                    # On error, keep original text
                    translated_blocks.append(content)

        # Reassemble translated markdown
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
