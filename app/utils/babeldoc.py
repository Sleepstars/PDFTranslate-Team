from pathlib import Path
from typing import Any, Optional, Awaitable, Callable, Dict
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
    DeepSeekSettings,
    ZhipuSettings,
    SiliconFlowSettings,
    TencentSettings,
    GeminiSettings,
    GrokSettings,
    GroqSettings,
)
from ..config import get_settings

ProgressCallback = Callable[[dict], Awaitable[None]]


def _clean_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, bytes):
        value = value.decode("utf-8", errors="ignore")
    value = str(value).strip()
    return value or None


def _config_value(
    preferred: Optional[str],
    *,
    env_var: Optional[str] = None,
    fallback: Optional[str] = None,
) -> Optional[str]:
    for candidate in (
        _clean_str(preferred),
        _clean_str(os.getenv(env_var)) if env_var else None,
        _clean_str(fallback),
    ):
        if candidate:
            return candidate
    return None


def _config_bool(value: Any) -> Optional[bool]:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes", "on"}:
            return True
        if lowered in {"false", "0", "no", "off"}:
            return False
    return None


def _clean_kwargs(**kwargs: Any) -> dict[str, Any]:
    return {key: val for key, val in kwargs.items() if val is not None}


def _coerce_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


async def translate_pdf(
    input_path: str,
    output_dir: str,
    service: str = "google",
    lang_from: str = "en",
    lang_to: str = "zh",
    model: Optional[str] = None,
    threads: int = 4,
    model_config: Optional[dict] = None,
    progress_callback: Optional[ProgressCallback] = None,
) -> tuple[bool, Optional[str], Dict[str, Optional[str]]]:
    """使用 pdf2zh-next 翻译 PDF

    Returns:
        (success, error_message, {"mono": mono_path, "dual": dual_path, "glossary": glossary_path})
    """
    try:
        settings = get_settings()
        service = (service or "google").lower()
        result_paths: Dict[str, Optional[str]] = {
            "mono": None,
            "dual": None,
            "glossary": None,
        }

        # 从 model_config 获取配置参数
        model_config = model_config or {}
        custom_endpoint = _clean_str(
            model_config.get("endpoint")
            or model_config.get("base_url")
            or model_config.get("url")
        )
        custom_host = _clean_str(model_config.get("host"))
        custom_api_key = _clean_str(model_config.get("api_key"))
        custom_deployment = _clean_str(
            model_config.get("deployment") or model_config.get("deployment_name")
        )
        custom_secret_id = _clean_str(model_config.get("secret_id"))
        custom_secret_key = _clean_str(model_config.get("secret_key"))
        custom_model = (
            _clean_str(model_config.get("model"))
            or _clean_str(model)
            or _clean_str(settings.babeldoc_model)
        )
        custom_api_version = _clean_str(model_config.get("api_version"))
        max_concurrency = _coerce_int(
            model_config.get("max_concurrency"),
            threads or settings.babeldoc_threads or 4,
        )
        if max_concurrency < 1:
            max_concurrency = 4

        # 创建基础配置
        # basic.input_files is intended for CLI batch mode; keep it empty to avoid warnings
        basic_settings = BasicSettings(
            input_files=set(),
            debug=False
        )

        # 创建翻译配置
        translation_settings = TranslationSettings(
            lang_in=lang_from,
            lang_out=lang_to,
            output=str(Path(output_dir)),
            pool_max_workers=max_concurrency
        )

        # 创建 PDF 配置
        pdf_settings = PDFSettings()

        # 根据服务类型创建引擎配置，优先使用前端传来的配置
        engine_settings = GoogleSettings()
        if service == "google":
            engine_settings = GoogleSettings()
        elif service == "deepl":
            deepl_key = _config_value(custom_api_key, env_var="DEEPL_AUTH_KEY")
            if deepl_key:
                os.environ["DEEPL_AUTH_KEY"] = deepl_key
            endpoint = _config_value(
                custom_endpoint,
                env_var="DEEPL_API_URL",
                fallback=settings.deepl_api_url,
            )
            if endpoint:
                os.environ["DEEPL_API_URL"] = endpoint
            engine_settings = DeepLSettings(**_clean_kwargs(deepl_auth_key=deepl_key))
        elif service == "openai":
            openai_key = _config_value(custom_api_key, env_var="OPENAI_API_KEY")
            if openai_key:
                os.environ["OPENAI_API_KEY"] = openai_key
            base_url = _config_value(
                custom_endpoint,
                env_var="OPENAI_API_BASE",
                fallback=settings.openai_api_base,
            )
            if base_url:
                os.environ["OPENAI_API_BASE"] = base_url
            openai_kwargs = _clean_kwargs(
                openai_model=custom_model,
                openai_api_key=openai_key,
                openai_base_url=base_url,
                openai_timeout=_clean_str(model_config.get("timeout")),
                openai_temperature=_clean_str(model_config.get("temperature")),
                openai_reasoning_effort=_clean_str(
                    model_config.get("reasoning_effort")
                ),
                openai_enable_json_mode=_config_bool(
                    model_config.get("enable_json_mode")
                    or model_config.get("json_mode")
                ),
                openai_send_temprature=_config_bool(
                    model_config.get("send_temperature")
                ),
                openai_send_reasoning_effort=_config_bool(
                    model_config.get("send_reasoning_effort")
                ),
            )
            engine_settings = OpenAISettings(**openai_kwargs)
        elif service == "ollama":
            ollama_host = _config_value(
                custom_host or custom_endpoint,
                env_var="OLLAMA_HOST",
                fallback=settings.ollama_host,
            )
            if ollama_host:
                os.environ["OLLAMA_HOST"] = ollama_host
            num_predict = (
                _coerce_int(model_config.get("num_predict"), 2000)
                if model_config.get("num_predict") is not None
                else None
            )
            engine_settings = OllamaSettings(
                **_clean_kwargs(
                    ollama_model=custom_model,
                    ollama_host=ollama_host,
                    num_predict=num_predict,
                )
            )
        elif service in {"azure-openai", "azure_openai"}:
            azure_key = _config_value(custom_api_key, env_var="AZURE_OPENAI_API_KEY")
            if azure_key:
                os.environ["AZURE_OPENAI_API_KEY"] = azure_key
            azure_base = _config_value(
                custom_endpoint,
                env_var="AZURE_OPENAI_ENDPOINT",
                fallback=settings.azure_openai_endpoint,
            )
            if azure_base:
                os.environ["AZURE_OPENAI_ENDPOINT"] = azure_base
            azure_model_name = _clean_str(custom_deployment) or custom_model
            if azure_model_name:
                os.environ["AZURE_OPENAI_DEPLOYMENT"] = azure_model_name
            engine_settings = AzureOpenAISettings(
                **_clean_kwargs(
                    azure_openai_model=azure_model_name,
                    azure_openai_api_key=azure_key,
                    azure_openai_base_url=azure_base,
                    azure_openai_api_version=custom_api_version,
                )
            )
        elif service == "gemini":
            gemini_key = _config_value(custom_api_key, env_var="GEMINI_API_KEY")
            if gemini_key:
                os.environ["GEMINI_API_KEY"] = gemini_key
            engine_settings = GeminiSettings(
                **_clean_kwargs(
                    gemini_model=custom_model,
                    gemini_api_key=gemini_key,
                    gemini_enable_json_mode=_config_bool(
                        model_config.get("enable_json_mode")
                    ),
                )
            )
        elif service == "deepseek":
            deepseek_key = _config_value(custom_api_key, env_var="DEEPSEEK_API_KEY")
            if deepseek_key:
                os.environ["DEEPSEEK_API_KEY"] = deepseek_key
            engine_settings = DeepSeekSettings(
                **_clean_kwargs(
                    deepseek_model=custom_model,
                    deepseek_api_key=deepseek_key,
                    deepseek_enable_json_mode=_config_bool(
                        model_config.get("enable_json_mode")
                    ),
                )
            )
        elif service == "zhipu":
            zhipu_key = _config_value(custom_api_key, env_var="ZHIPU_API_KEY")
            if zhipu_key:
                os.environ["ZHIPU_API_KEY"] = zhipu_key
            engine_settings = ZhipuSettings(
                **_clean_kwargs(
                    zhipu_model=custom_model,
                    zhipu_api_key=zhipu_key,
                    zhipu_enable_json_mode=_config_bool(
                        model_config.get("enable_json_mode")
                    ),
                )
            )
        elif service == "siliconflow":
            siliconflow_key = _config_value(
                custom_api_key, env_var="SILICONFLOW_API_KEY"
            )
            if siliconflow_key:
                os.environ["SILICONFLOW_API_KEY"] = siliconflow_key
            siliconflow_base = _config_value(
                custom_endpoint,
                env_var="SILICONFLOW_BASE_URL",
            )
            if siliconflow_base:
                os.environ["SILICONFLOW_BASE_URL"] = siliconflow_base
            engine_settings = SiliconFlowSettings(
                **_clean_kwargs(
                    siliconflow_model=custom_model,
                    siliconflow_api_key=siliconflow_key,
                    siliconflow_base_url=siliconflow_base,
                    siliconflow_enable_thinking=_config_bool(
                        model_config.get("enable_thinking")
                    ),
                    siliconflow_send_enable_thinking_param=_config_bool(
                        model_config.get("send_enable_thinking_param")
                    ),
                )
            )
        elif service == "tencent":
            secret_id = _config_value(custom_secret_id, env_var="TENCENT_SECRET_ID")
            secret_key = _config_value(custom_secret_key, env_var="TENCENT_SECRET_KEY")
            if secret_id:
                os.environ["TENCENT_SECRET_ID"] = secret_id
            if secret_key:
                os.environ["TENCENT_SECRET_KEY"] = secret_key
            engine_settings = TencentSettings(
                **_clean_kwargs(
                    tencentcloud_secret_id=secret_id,
                    tencentcloud_secret_key=secret_key,
                )
            )
        elif service == "grok":
            grok_key = _config_value(custom_api_key, env_var="GROK_API_KEY")
            if grok_key:
                os.environ["GROK_API_KEY"] = grok_key
            engine_settings = GrokSettings(
                **_clean_kwargs(
                    grok_model=custom_model,
                    grok_api_key=grok_key,
                    grok_enable_json_mode=_config_bool(
                        model_config.get("enable_json_mode")
                    ),
                )
            )
        elif service == "groq":
            groq_key = _config_value(custom_api_key, env_var="GROQ_API_KEY")
            if groq_key:
                os.environ["GROQ_API_KEY"] = groq_key
            engine_settings = GroqSettings(
                **_clean_kwargs(
                    groq_model=custom_model,
                    groq_api_key=groq_key,
                    groq_enable_json_mode=_config_bool(
                        model_config.get("enable_json_mode")
                    ),
                )
            )
        else:
            # 默认使用 Google
            engine_settings = GoogleSettings()

        # 组合完整配置
        settings_model = SettingsModel(
            basic=basic_settings,
            translation=translation_settings,
            pdf=pdf_settings,
            translate_engine_settings=engine_settings,
        )

        # 执行翻译
        async for event in do_translate_async_stream(settings_model, Path(input_path)):
            event_type = event.get("type")
            if event_type in {"progress_start", "progress_update", "progress_end"}:
                if progress_callback:
                    await progress_callback(event)
                continue

            if event_type == "finish":
                result = event["translate_result"]
                result_paths["dual"] = (
                    str(result.dual_pdf_path) if result.dual_pdf_path else None
                )
                result_paths["mono"] = (
                    str(result.mono_pdf_path) if result.mono_pdf_path else None
                )
                if getattr(result, "auto_extracted_glossary_path", None):
                    result_paths["glossary"] = str(result.auto_extracted_glossary_path)
                return True, None, result_paths
            elif event_type == "error":
                error_msg = event.get("error", "Unknown error")
                return False, error_msg, result_paths

        return False, "翻译未完成", result_paths

    except Exception as e:
        return False, f"翻译错误: {str(e)}", result_paths
