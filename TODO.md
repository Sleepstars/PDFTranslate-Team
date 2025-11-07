# 项目待办

## 技术目标（已完成）
- [x] **前端**：Next.js 16 UI，封装后端 API Client/Server Helper，覆盖登录与翻译任务管理。
- [x] **后端**：FastAPI 服务，提供登录、任务 CRUD、异步任务模拟及 BabelDOC 接入占位。
- [x] **DevOps**：Dockerfile + docker-compose 组合部署说明。

## 实施顺序
1. [x] 迁移前端到 `Front/`，并重写与后端交互的 HTTP 层。
2. [x] 在根目录搭建 FastAPI（Session、任务管理、BabelDOC mock Worker）。
3. [x] 提供 Docker Compose（前端、后端），串联环境变量与网络。
4. [x] 更新多份 README，记录安装运行步骤与扩展指南。

> 注：由于当前仓库尚未接入真实持久化与 BabelDOC 服务，所有任务/会话均以内存保存，部署时请替换为数据库与真实翻译 Worker。
