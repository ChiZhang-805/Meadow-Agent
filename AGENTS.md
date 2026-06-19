# Meadow Agent 麦豆开发约定

## 项目边界

- 标准 `OPENAI_API_KEY` 只能在后端读取，前端只接收 OpenAI Realtime client secret。
- 买菜 MVP 只使用 `MockGroceryAdapter`。不要写爬虫，不要操控美团、饿了么或其他消费者 App。
- 下单必须经过 `create_order_preview -> issue_confirmation_token -> submit_order`。
- 不实现真实支付，不绕过二次确认。
- 不保存原始音频或视频。
- 情绪识别只能表达倾向，例如“可能低落”，不得做医学或心理诊断。

## 常用命令

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
pytest -q
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

```bash
cd web
npm install
npm run build
npm run dev -- --host 0.0.0.0 --port 5173
```

## 代码风格

- 后端保持 FastAPI + Pydantic 的简单分层：API 层只做请求响应，业务规则放到 `services/`，外部平台适配放到 `providers/`。
- 前端保持大字号、低认知负担，老人端第一屏就是可用界面。
- 风控和确认逻辑优先写测试。
