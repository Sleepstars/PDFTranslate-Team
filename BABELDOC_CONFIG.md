# BabelDoc 翻译配置指南

## 概述

项目现在已集成真实的 BabelDoc (pdf2zh) 翻译功能，支持队列处理用户上传的 PDF 文件。

## 功能特性

✅ **支持文件上传**: 用户可通过网页上传 PDF 文件
✅ **队列处理**: Redis 任务队列，支持优先级
✅ **多翻译引擎**: Google、DeepL、OpenAI、Ollama 等
✅ **可配置参数**: 网页端可配置模型和线程数
✅ **自动存储**: S3 存储输入/输出文件，自动过期删除

## 翻译引擎配置

### 1. Google Translate (默认，免费)

```bash
PDF_APP_BABELDOC_SERVICE=google
```

无需额外配置，开箱即用。

### 2. DeepL

```bash
PDF_APP_BABELDOC_SERVICE=deepl
# 需要设置环境变量
export DEEPL_AUTH_KEY=your_api_key
```

### 3. DeepLX (免费 DeepL)

```bash
PDF_APP_BABELDOC_SERVICE=deeplx
export DEEPLX_ENDPOINT=http://localhost:1188/translate
```

### 4. OpenAI

```bash
PDF_APP_BABELDOC_SERVICE=openai
PDF_APP_BABELDOC_MODEL=gpt-4
export OPENAI_API_KEY=your_api_key
```

### 5. Azure OpenAI

```bash
PDF_APP_BABELDOC_SERVICE=azure-openai
PDF_APP_BABELDOC_MODEL=gpt-4
export AZURE_OPENAI_API_KEY=your_api_key
export AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
export AZURE_OPENAI_DEPLOYMENT=your-deployment-name
```

### 6. Ollama (本地模型)

```bash
PDF_APP_BABELDOC_SERVICE=ollama
PDF_APP_BABELDOC_MODEL=gemma2
export OLLAMA_HOST=http://localhost:11434
```

### 7. Tencent

```bash
PDF_APP_BABELDOC_SERVICE=tencent
export TENCENTCLOUD_SECRET_ID=your_secret_id
export TENCENTCLOUD_SECRET_KEY=your_secret_key
```

## 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PDF_APP_BABELDOC_SERVICE` | 翻译服务 | `google` |
| `PDF_APP_BABELDOC_LANG_FROM` | 源语言（全局默认） | `en` |
| `PDF_APP_BABELDOC_LANG_TO` | 目标语言（全局默认） | `zh` |
| `PDF_APP_BABELDOC_MODEL` | 模型名称（可选） | `` |
| `PDF_APP_BABELDOC_THREADS` | 并发线程数 | `4` |

## 网页端配置

用户在创建翻译任务时可以配置：

### 基础配置
- **上传 PDF**: 选择要翻译的 PDF 文件
- **源语言**: 如 `en`, `zh`, `ja` 等
- **目标语言**: 如 `zh`, `en`, `ja` 等
- **翻译引擎**: 从下拉菜单选择
- **优先级**: 正常/高

### 高级配置（可展开）
- **模型名称**: 仅 OpenAI/Ollama 等需要，如 `gpt-4`, `gemma2`
- **并发线程数**: 1-16，推荐 4-8

## 工作流程

```
1. 用户上传 PDF → 2. 存储到 S3 → 3. 加入 Redis 队列
                                              ↓
6. 生成预签名 URL ← 5. 上传到 S3 ← 4. BabelDoc 翻译
```

### 详细步骤

1. **文件上传**: 前端通过 FormData 上传 PDF
2. **S3 存储**: 后端将文件存储到 S3 (`uploads/{user_id}/{task_id}/input.pdf`)
3. **任务入队**: 任务 ID 加入 Redis 队列
4. **异步处理**:
   - 从 S3 下载输入文件到临时目录
   - 调用 `pdf2zh` 命令行工具翻译
   - 上传翻译结果到 S3 (`outputs/{user_id}/{task_id}/output.pdf`)
   - 生成预签名下载 URL（24小时有效）
5. **状态更新**: 实时更新任务状态和进度
6. **自动清理**: 7天后自动删除 S3 文件

## Docker Compose 配置

在 `docker-compose.yml` 中添加环境变量：

```yaml
backend:
  environment:
    # BabelDoc 配置
    PDF_APP_BABELDOC_SERVICE: google
    PDF_APP_BABELDOC_THREADS: 4

    # 如使用 OpenAI
    OPENAI_API_KEY: ${OPENAI_API_KEY}

    # 如使用 DeepL
    DEEPL_AUTH_KEY: ${DEEPL_AUTH_KEY}
```

## 性能优化

### 1. 调整线程数

```bash
# 小文件（<10页）
PDF_APP_BABELDOC_THREADS=2

# 中等文件（10-50页）
PDF_APP_BABELDOC_THREADS=4

# 大文件（>50页）
PDF_APP_BABELDOC_THREADS=8
```

### 2. 使用本地模型

使用 Ollama 可避免 API 限流和费用：

```bash
# 安装 Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 下载模型
ollama pull gemma2

# 配置
PDF_APP_BABELDOC_SERVICE=ollama
PDF_APP_BABELDOC_MODEL=gemma2
```

### 3. 队列优先级

高优先级任务会优先处理：

```python
# 前端设置
priority: 'high'  # 或 'normal'
```

## 故障排查

### 1. pdf2zh 未安装

```bash
# 错误信息
BabelDoc 未安装，请运行: pip install pdf2zh

# 解决方案
docker-compose exec backend pip install pdf2zh
```

### 2. API Key 未配置

```bash
# 错误信息
OpenAI API key not found

# 解决方案
export OPENAI_API_KEY=your_key
# 或在 docker-compose.yml 中添加
```

### 3. 翻译失败

查看后端日志：

```bash
docker-compose logs -f backend
```

常见原因：
- API 限流
- 网络问题
- PDF 格式不支持
- 内存不足

### 4. 文件下载失败

检查 S3 配置：

```bash
# 测试 MinIO 连接
curl http://localhost:9000/minio/health/live

# 查看 bucket
docker-compose exec backend python -c "
from app.s3_client import s3_client
print(s3_client.s3.list_objects_v2(Bucket='pdftranslate'))
"
```

## API 使用示例

### 创建翻译任务

```javascript
const formData = new FormData();
formData.append('file', pdfFile);
formData.append('documentName', 'paper.pdf');
formData.append('sourceLang', 'en');
formData.append('targetLang', 'zh');
formData.append('engine', 'google');
formData.append('priority', 'normal');
formData.append('modelConfig', JSON.stringify({
  model: '',
  threads: 4
}));

const response = await fetch('/api/tasks', {
  method: 'POST',
  credentials: 'include',
  body: formData
});
```

### 查询任务状态

```bash
curl -X GET http://localhost:8000/api/tasks/{task_id} \
  -H "Cookie: pdftranslate_session=xxx"
```

### 下载翻译结果

```bash
# 使用返回的 outputUrl
curl -o translated.pdf "{outputUrl}"
```

## 生产环境建议

### 1. 使用专业翻译服务

```bash
# DeepL (质量最好)
PDF_APP_BABELDOC_SERVICE=deepl
DEEPL_AUTH_KEY=your_pro_key

# 或 OpenAI (支持更多语言)
PDF_APP_BABELDOC_SERVICE=openai
PDF_APP_BABELDOC_MODEL=gpt-4
OPENAI_API_KEY=your_key
```

### 2. 增加并发处理

```bash
# 增加线程数
PDF_APP_BABELDOC_THREADS=8

# 或部署多个 worker
docker-compose up --scale backend=3
```

### 3. 监控和告警

```python
# 监控任务队列长度
redis-cli LLEN tasks:normal
redis-cli LLEN tasks:high

# 监控失败任务
SELECT COUNT(*) FROM translation_tasks WHERE status='failed';
```

### 4. 成本控制

```bash
# 使用免费服务
PDF_APP_BABELDOC_SERVICE=google  # 免费但有限流

# 或本地模型
PDF_APP_BABELDOC_SERVICE=ollama
PDF_APP_BABELDOC_MODEL=gemma2  # 完全免费
```

## 支持的语言

BabelDoc 支持 100+ 种语言，常用的包括：

- `en` - English
- `zh` - 中文
- `ja` - 日本語
- `ko` - 한국어
- `fr` - Français
- `de` - Deutsch
- `es` - Español
- `ru` - Русский
- `ar` - العربية

完整列表见：https://github.com/Byaidu/PDFMathTranslate

## 常见问题

**Q: 可以同时处理多个任务吗？**
A: 可以，任务会进入队列依次处理。可以部署多个 worker 并发处理。

**Q: 翻译需要多长时间？**
A: 取决于文件大小和翻译服务：
- Google: 10-30秒/页
- OpenAI: 5-15秒/页
- Ollama: 20-60秒/页（取决于硬件）

**Q: 支持哪些 PDF 格式？**
A: 支持标准 PDF，包括扫描版（需 OCR）和文本版。

**Q: 如何保护 API Key？**
A: 使用环境变量，不要写入代码。生产环境使用 secrets 管理。

**Q: 文件会永久保存吗？**
A: 不会，默认 7 天后自动删除。可通过 `PDF_APP_S3_FILE_TTL_DAYS` 配置。
