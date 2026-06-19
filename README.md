# Meadow Agent 麦豆

Meadow Agent（麦豆）是一个面向老年人的中文语音陪伴、情绪识别与买菜助手 MVP。它用 FastAPI 后端签发 OpenAI Realtime API 临时凭证，前端通过 WebRTC 进行中文语音对话；买菜链路先使用 `MockGroceryAdapter`，不接真实平台、不做真实支付、不操控第三方 App。

## 功能范围

- 中文老人端语音 UI：开始说话、停止、再说一遍、取消。
- OpenAI Realtime API WebRTC：标准 `OPENAI_API_KEY` 只存在后端。
- 买菜工具链：搜索候选项、生成订单预览、签发确认 token、提交 mock 订单。
- 确认 token：短期有效、一次性使用，并绑定 `user_id + preview_id`。
- 情绪识别骨架：浏览器本地 MediaPipe Face Landmarker + blendshape 规则分类 + 3-5 秒平滑。
- 隐私约束：不保存原始音频、视频；情绪事件只发送标签、置信度、效价、唤醒度和 `raw_video_saved=false`。

## 目录结构

```text
.
├─ backend/
│  ├─ app/
│  │  ├─ api/
│  │  ├─ providers/
│  │  └─ services/
│  └─ tests/
├─ web/
│  ├─ public/
│  └─ src/
├─ .env.example
├─ AGENTS.md
├─ docker-compose.yml
└─ README.md
```

## WSL2 Ubuntu 22.04 准备

```bash
sudo apt update
sudo apt install -y build-essential git curl python3 python3-venv python3-pip postgresql-client redis-tools
```

建议安装 Node.js 22：

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
```

## 环境变量

```bash
cp .env.example .env
```

编辑 `.env`，把 `OPENAI_API_KEY` 放在根目录或 `backend/.env` 中。不要把标准 API key 放进 `web/`，也不要写进前端代码。

本地开发时也可以打开网页右上角“配置”侧边栏输入 OpenAI API Key。

## 启动 PostgreSQL 和 Redis

```bash
docker compose up -d
```

当前 MVP 主要使用内存状态，PostgreSQL 和 Redis 先作为后续持久化与缓存依赖预留。

## 后端安装与启动

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

健康检查：

```bash
curl http://localhost:8000/api/health
```

## 前端安装与启动

```bash
cd web
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

浏览器打开：

```text
http://localhost:5173
```

前端开发服务器会把 `/api` 代理到 `http://localhost:8000`。

## 测试与构建

后端：

```bash
cd backend
source .venv/bin/activate
pytest -q
```

前端：

```bash
cd web
npm run build
```

可选真实 OpenAI Realtime token smoke test 默认跳过。确认 `.env` 中有真实 key 后再运行：

```bash
cd backend
source .venv/bin/activate
RUN_OPENAI_LIVE_TESTS=1 pytest tests/test_openai_realtime_live.py -q
```

## OpenAI Realtime 说明

后端 `POST /api/realtime/token` 会使用 `OPENAI_API_KEY` 调用 OpenAI `POST /v1/realtime/client_secrets`，返回短期 client secret。浏览器拿到临时凭证后，把 SDP offer 发往 `https://api.openai.com/v1/realtime/calls` 建立 WebRTC 会话。OpenAI 文档建议浏览器音频场景使用 WebRTC，并用 client secret 避免泄露标准 API key。

参考：

- https://developers.openai.com/api/docs/guides/realtime-webrtc
- https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/methods/create

## 已知限制

- 尚未接入真实美团、饿了么或正规聚合服务商 API。
- 尚未实现正式鉴权和用户体系。
- 尚未做数据库持久化，订单预览和确认 token 仍在内存中。
- 尚未实现家属端完整 UI。
- 尚未做生产部署、审计日志落库、风控规则后台配置。
- MediaPipe 模型文件需要放到 `web/public/models/face_landmarker.task` 后，情绪识别才会真正运行。
