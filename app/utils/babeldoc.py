from pathlib import Path
from typing import Optional
import os
from pdf2zh_next import (
    SettingsModel,
    BasicSettings,
    TranslationSettings,
    PDFSettings,
    do_translate_async_stream,
    GoogleSettings,
    DeepLSettings,
    OpenAISettings,
    OllamaSettings,
    AzureOpenAISettings,
)
from ..config import get_settings


async def translate_pdf(
    input_path: str,
    output_dir: str,
    service: str = "google",
    lang_from: str = "en",
    lang_to: str = "zh",
    model: Optional[str] = None,
    threads: int = 4,
    model_config: Optional[dict] = None
) -> tuple[bool, Optional[str], Optional[str]]:
    """使用 pdf2zh-next 翻译 PDF

    Returns:
        (success, error_message, output_file_path)
    """
    try:
        settings = get_settings()

        # 从 model_config 获取自定义 endpoint
        custom_endpoint = model_config.get('endpoint') if model_config else None

        # 创建基础配置
        basic_settings = BasicSettings(
            input_files={Path(input_path)},
            debug=False
        )

        # 创建翻译配置
        translation_settings = TranslationSettings(
            lang_in=lang_from,
            lang_out=lang_to,
            output=Path(output_dir),
            pool_max_workers=threads
        )

        # 创建 PDF 配置
        pdf_settings = PDFSettings()

        # 根据服务类型创建引擎配置，优先使用前端传来的 endpoint
        engine_settings = None
        if service == "google":
            engine_settings = GoogleSettings()
        elif service == "deepl":
            engine_settings = DeepLSettings()
            endpoint = custom_endpoint or settings.deepl_api_url
            if endpoint:
                os.environ["DEEPL_API_URL"] = endpoint
        elif service == "openai":
            engine_settings = OpenAISettings(model=model or "gpt-4")
            endpoint = custom_endpoint or settings.openai_api_base
            if endpoint:
                os.environ["OPENAI_API_BASE"] = endpoint
        elif service == "ollama":
            engine_settings = OllamaSettings(model=model or "gemma2")
            endpoint = custom_endpoint or settings.ollama_host
            if endpoint:
                os.environ["OLLAMA_HOST"] = endpoint
        elif service == "azure-openai":
            engine_settings = AzureOpenAISettings(model=model or "gpt-4")
            endpoint = custom_endpoint or settings.azure_openai_endpoint
            if endpoint:
                os.environ["AZURE_OPENAI_ENDPOINT"] = endpoint
        else:
            # 默认使用 Google
            engine_settings = GoogleSettings()

        # 组合完整配置
        settings_model = SettingsModel(
            basic=basic_settings,
            translation=translation_settings,
            pdf=pdf_settings,
            **{service: engine_settings}
        )

        # 执行翻译
        output_file = None
        async for event in do_translate_async_stream(settings_model, Path(input_path)):
            if event["type"] == "finish":
                result = event["translate_result"]
                # 优先返回双语版本，否则返回单语版本
                output_file = result.dual_pdf_path or result.mono_pdf_path
                return True, None, str(output_file) if output_file else None
            elif event["type"] == "error":
                error_msg = event.get("error", "Unknown error")
                return False, error_msg, None

        return False, "翻译未完成", None

    except Exception as e:
        return False, f"翻译错误: {str(e)}", None
