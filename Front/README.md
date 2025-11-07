# PDFTranslate Team Frontend

基于 Next.js 16 (App Router + React Server Components) 的翻译管理界面，通过调用后端 FastAPI 服务来完成登录、翻译任务排队与状态监控。

## 功能
- 邮箱/密码登录页，登录后才能访问仪表盘
- 任务看板：创建翻译任务、查看进度、重试/取消、下载占位 PDF
- React Query 轮询 `/tasks`，实时刷新模拟的异步 BabelDOC Worker 状态
- 统一 HTTP Client/Server Helper，方便将 Cookie 转发给后端

## 快速开始
```bash
# 推荐：在仓库根目录运行 pixi
pixi run install-frontend
pixi run dev-frontend # 默认监听 3000 端口

# 或使用 npm 手动运行
cd Front && npm install && npm run dev
```

在开发或部署前请确认后端已运行，并设置以下环境变量：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | 浏览器访问的后端地址 | `http://localhost:8000/api` |
| `API_BASE_URL` | Next.js 服务端 fetch 使用的后端地址 | `http://localhost:8000/api` |

运行 `npm run build && npm start` 会使用生产模式，请确保上述变量在构建阶段（`NEXT_PUBLIC_*`）与运行阶段（`API_BASE_URL`）均已设置。

## 目录结构
```
app/                # App Router 页面/布局（登录、Dashboard）
components/         # UI 组件（Query Provider、任务面板、登出按钮等）
lib/http/           # 客户端/服务端共用的 HTTP helper
lib/auth/session.ts # 服务器端调用后端 /auth/me
lib/tasks/          # 任务类型定义 + 客户端/服务端请求封装
```

## BabelDOC 接入思路
前端层面已支持传递 `documentName/sourceLang/targetLang/engine/notes` 等参数，只需在后端实际调用 BabelDOC 或 PDFMathTranslate 即可；当后端具备新的任务字段时，可以在 `lib/tasks/types.ts` 中补充类型并扩展表单。

## 下一步建议
- 加入文件上传与任务详情页，展示 BabelDOC 输出
- 与真实后台鉴权系统/Team 管理联动
- 通过 WebSocket/SSE 订阅任务状态，减少轮询请求

更多整体架构与部署说明请参考仓库根目录 `README.md`。
