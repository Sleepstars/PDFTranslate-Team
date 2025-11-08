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

        # 从 model_config 获取配置参数
        model_config = model_config or {}
        custom_endpoint = model_config.get('endpoint')
        custom_api_key = model_config.get('api_key')
        custom_deployment = model_config.get('deployment')
        custom_secret_id = model_config.get('secret_id')
        custom_secret_key = model_config.get('secret_key')

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

        # 根据服务类型创建引擎配置，优先使用前端传来的配置
        engine_settings = None
        if service == "google":
            engine_settings = GoogleSettings()
        elif service == "deepl":
            engine_settings = DeepLSettings()
            # Set API key
            if custom_api_key:
                os.environ["DEEPL_AUTH_KEY"] = custom_api_key
            # Set endpoint
            endpoint = custom_endpoint or settings.deepl_api_url
            if endpoint:
                os.environ["DEEPL_API_URL"] = endpoint
        elif service == "openai":
            engine_settings = OpenAISettings(model=model or "gpt-4")
            # Set API key
            if custom_api_key:
                os.environ["OPENAI_API_KEY"] = custom_api_key
            # Set endpoint
            endpoint = custom_endpoint or settings.openai_api_base
            if endpoint:
                os.environ["OPENAI_API_BASE"] = endpoint
        elif service == "ollama":
            engine_settings = OllamaSettings(model=model or "gemma2")
            # Set endpoint
            endpoint = custom_endpoint or settings.ollama_host
            if endpoint:
                os.environ["OLLAMA_HOST"] = endpoint
        elif service == "azure-openai":
            engine_settings = AzureOpenAISettings(model=model or "gpt-4")
            # Set API key
            if custom_api_key:
                os.environ["AZURE_OPENAI_API_KEY"] = custom_api_key
            # Set endpoint
            endpoint = custom_endpoint or settings.azure_openai_endpoint
            if endpoint:
                os.environ["AZURE_OPENAI_ENDPOINT"] = endpoint
            # Set deployment
            if custom_deployment:
                os.environ["AZURE_OPENAI_DEPLOYMENT"] = custom_deployment
        elif service == "gemini":
            # Gemini uses GoogleSettings with API key
            if custom_api_key:
                os.environ["GEMINI_API_KEY"] = custom_api_key
            engine_settings = GoogleSettings()  # pdf2zh-next may use GoogleSettings for Gemini
        elif service == "deepseek":
            if custom_api_key:
                os.environ["DEEPSEEK_API_KEY"] = custom_api_key
            engine_settings = OpenAISettings(model=model or "deepseek-chat")
        elif service == "zhipu":
            if custom_api_key:
                os.environ["ZHIPU_API_KEY"] = custom_api_key
            engine_settings = OpenAISettings(model=model or "glm-4")
        elif service == "siliconflow":
            if custom_api_key:
                os.environ["SILICONFLOW_API_KEY"] = custom_api_key
            engine_settings = OpenAISettings(model=model or "Qwen/Qwen2-7B-Instruct")
        elif service == "tencent":
            if custom_secret_id:
                os.environ["TENCENT_SECRET_ID"] = custom_secret_id
            if custom_secret_key:
                os.environ["TENCENT_SECRET_KEY"] = custom_secret_key
            engine_settings = GoogleSettings()  # Tencent may use custom settings
        elif service == "grok":
            if custom_api_key:
                os.environ["GROK_API_KEY"] = custom_api_key
            engine_settings = OpenAISettings(model=model or "grok-1")
        elif service == "groq":
            if custom_api_key:
                os.environ["GROQ_API_KEY"] = custom_api_key
            engine_settings = OpenAISettings(model=model or "llama2-70b-4096")
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
