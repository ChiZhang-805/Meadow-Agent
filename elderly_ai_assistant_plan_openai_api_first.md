# 面向老年人的语音陪伴、情绪识别与买菜助手：WSL2 Ubuntu 22.04 落地方案

> 版本：v2.0  
> 日期：2026-06-18  
> 目标开发环境：Windows 主机 + WSL2 Ubuntu 22.04  
> 关键更新：**OpenAI API 额度充足时，AI 语音主链路优先使用真实 OpenAI API；Mock 仅用于买菜平台和离线兜底。**

---

## 1. 项目目标

你要做的软件具备以下能力：

1. 老人可以与系统进行中文语音对话。
2. 浏览器采集语音，通过 OpenAI Realtime API 实时理解、转写、推理并语音回复。
3. 浏览器打开摄像头，本地实时识别老人情绪倾向，例如开心、可能低落、平静、疑惑、生气、疲惫等。
4. 老人语音提出买菜需求时，系统返回几个候选选项。
5. 老人确认后，系统生成订单预览；真实下单前必须二次确认。
6. 后续可对接美团、饿了么或正规聚合服务商 API；MVP 阶段先用 Mock 买菜 Provider。
7. 后端、数据库、缓存和开发工具运行在 WSL2 Ubuntu 22.04。
8. 摄像头、麦克风由 Windows 浏览器采集，避免 WSL2 直接访问音视频设备的复杂性。

---

## 2. 关键边界

```text
AI 负责理解、解释、推荐、陪伴；
后端规则负责权限、预算、风控；
老人或家属负责最终确认；
平台官方 API 或授权服务商负责真实交易；
摄像头情绪识别只做辅助关怀，不做医学或心理诊断。
```

### 2.1 OpenAI API 使用策略

当前假设是 OpenAI API 额度充足，因此策略调整为：

```text
1. 语音对话主流程必须优先使用真实 OpenAI Realtime API。
2. 不为了节省额度把 OpenAI 语音能力做成假实现。
3. Mock 只用于买菜平台、美团/饿了么未授权时的外部服务兜底。
4. 后端 /api/realtime/token 不返回假 token；OPENAI_API_KEY 缺失时返回清晰错误。
5. 允许增加 live smoke tests，用真实 OpenAI API 验证 Realtime token 创建。
6. live tests 默认不随 pytest 自动运行，必须显式设置 RUN_OPENAI_LIVE_TESTS=1。
7. 标准 OPENAI_API_KEY 仍然只能放在后端环境变量中，不能进入前端。
8. 仍然保留会话超时、无交互自动暂停麦克风、错误提示和日志脱敏。
```

---

## 3. 总体架构

```text
Windows 主机
│
├─ Chrome / Edge 浏览器
│  ├─ 老人端 Web App / PWA
│  │  ├─ 麦克风采集：getUserMedia + WebRTC
│  │  ├─ AI 语音对话：OpenAI Realtime API
│  │  ├─ 摄像头采集：getUserMedia
│  │  ├─ 情绪识别：MediaPipe Face Landmarker + 规则/轻量模型
│  │  ├─ 买菜候选卡片
│  │  └─ 大字号、大按钮、语音重播、取消确认
│  │
│  └─ 家属端 Web App
│     ├─ 查看今日状态
│     ├─ 设置预算
│     ├─ 确认高风险订单
│     └─ 查看提醒和审计记录
│
└─ WSL2 Ubuntu 22.04
   ├─ FastAPI 后端
   │  ├─ OpenAI Realtime ephemeral token 签发
   │  ├─ 工具调用网关
   │  ├─ GroceryService
   │  ├─ Mock / Meituan / Eleme Provider Adapter
   │  ├─ 订单预览与 confirmation_token
   │  ├─ 情绪事件接收
   │  ├─ 用户、地址、偏好、预算管理
   │  └─ 家属端接口、审计、风控
   │
   ├─ PostgreSQL
   ├─ Redis
   └─ Docker Compose / 本地进程
```

---

## 4. 技术栈

### 4.1 前端

| 模块 | 技术 |
|---|---|
| 框架 | React + TypeScript + Vite |
| 实时语音 | WebRTC |
| 音视频采集 | `navigator.mediaDevices.getUserMedia()` |
| 情绪识别 | MediaPipe Tasks Vision / Face Landmarker |
| 状态管理 | Zustand |
| UI | Tailwind CSS 或自研大字号组件 |
| 部署形态 | Web App / PWA |

老人端 UI 原则：

```text
1. 字体大：正文 >= 24px，主按钮 >= 32px。
2. 操作少：默认只保留“开始说话”“停止”“再说一遍”“取消”。
3. 所有 AI 回复同步显示文字。
4. 购买、付款、地址类动作必须屏幕二次确认。
5. 老人可随时取消当前任务。
```

### 4.2 后端

| 模块 | 技术 |
|---|---|
| API 框架 | FastAPI |
| Python | 3.10+ |
| 异步 HTTP | httpx |
| 配置 | pydantic-settings + `.env` |
| 数据库 | PostgreSQL |
| ORM | SQLAlchemy 2.x / SQLModel |
| 缓存 | Redis |
| 测试 | pytest + pytest-asyncio |
| 日志 | structlog / loguru |
| 容器 | Docker Compose |

---

## 5. 推荐目录结构

```text
elderly-ai-assistant/
├─ README.md
├─ AGENTS.md
├─ .env.example
├─ docker-compose.yml
│
├─ backend/
│  ├─ pyproject.toml
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ settings.py
│  │  ├─ api/
│  │  │  ├─ realtime.py
│  │  │  ├─ tools.py
│  │  │  ├─ emotion.py
│  │  │  ├─ grocery.py
│  │  │  └─ caregiver.py
│  │  ├─ services/
│  │  │  ├─ openai_realtime.py
│  │  │  ├─ grocery_service.py
│  │  │  ├─ safety_policy.py
│  │  │  ├─ confirmation_service.py
│  │  │  └─ conversation_memory.py
│  │  ├─ providers/
│  │  │  ├─ base.py
│  │  │  ├─ mock_grocery.py
│  │  │  ├─ meituan.py
│  │  │  └─ eleme.py
│  │  ├─ models/
│  │  │  ├─ user.py
│  │  │  ├─ conversation.py
│  │  │  ├─ emotion.py
│  │  │  ├─ grocery.py
│  │  │  └─ order.py
│  │  └─ db/
│  │     ├─ session.py
│  │     └─ migrations/
│  └─ tests/
│     ├─ test_safety_policy.py
│     ├─ test_confirmation.py
│     ├─ test_mock_grocery.py
│     └─ test_openai_realtime_live.py
│
└─ web/
   ├─ package.json
   ├─ vite.config.ts
   ├─ public/
   │  ├─ models/
   │  │  └─ face_landmarker.task
   │  └─ wasm/
   └─ src/
      ├─ main.tsx
      ├─ components/
      │  ├─ VoiceButton.tsx
      │  ├─ TranscriptPanel.tsx
      │  ├─ EmotionBadge.tsx
      │  ├─ GroceryOptionCards.tsx
      │  └─ ConfirmDialog.tsx
      ├─ realtime/
      │  ├─ startRealtimeSession.ts
      │  ├─ eventHandlers.ts
      │  └─ toolBridge.ts
      ├─ emotion/
      │  ├─ faceLandmarker.ts
      │  ├─ emotionClassifier.ts
      │  └─ smoothing.ts
      ├─ api/
      │  ├─ client.ts
      │  └─ grocery.ts
      └─ store/
         ├─ useVoiceStore.ts
         ├─ useEmotionStore.ts
         └─ useGroceryStore.ts
```

---

## 6. WSL2 Ubuntu 22.04 开发环境

### 6.1 Windows 侧

PowerShell 管理员执行：

```powershell
wsl --install -d Ubuntu-22.04
wsl --set-version Ubuntu-22.04 2
wsl --update
wsl --shutdown
```

### 6.2 Ubuntu 侧依赖

```bash
sudo apt update && sudo apt upgrade -y

sudo apt install -y \
  build-essential \
  git \
  curl \
  ffmpeg \
  python3 \
  python3-venv \
  python3-pip \
  postgresql-client \
  redis-tools \
  libgl1 \
  libglib2.0-0
```

### 6.3 Node.js

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
node -v
npm -v
```

### 6.4 后端依赖

```bash
mkdir -p ~/projects/elderly-ai-assistant
cd ~/projects/elderly-ai-assistant
mkdir backend
cd backend

python3 -m venv .venv
source .venv/bin/activate

pip install \
  fastapi \
  "uvicorn[standard]" \
  httpx \
  pydantic-settings \
  python-dotenv \
  sqlalchemy \
  asyncpg \
  redis \
  python-multipart \
  pytest \
  pytest-asyncio
```

### 6.5 前端依赖

```bash
cd ~/projects/elderly-ai-assistant
npm create vite@latest web -- --template react-ts
cd web
npm install
npm install @mediapipe/tasks-vision zustand
```

---

## 7. 环境变量

`.env.example`：

```bash
# OpenAI
OPENAI_API_KEY=sk-REPLACE_ME
OPENAI_REALTIME_MODEL=gpt-realtime-2
OPENAI_REALTIME_VOICE=marin

# Live OpenAI API tests
# 0: 默认跳过真实 API 测试；1: 手动允许跑 live smoke tests
RUN_OPENAI_LIVE_TESTS=0

# App
APP_ENV=development
APP_ORIGIN=http://localhost:5173
DEMO_USER_ID=demo-user

# Database
DATABASE_URL=postgresql+asyncpg://elderly:elderly_pass@localhost:5432/elderly_ai
REDIS_URL=redis://localhost:6379/0

# Grocery
GROCERY_PROVIDER=mock
SINGLE_ORDER_LIMIT_CENTS=5000
DAILY_BUDGET_CENTS=10000

# Security
CONFIRMATION_TOKEN_TTL_SECONDS=300
```

规则：

```text
1. OPENAI_API_KEY 只能存在后端环境变量中。
2. 前端不得写入 sk- 开头的标准 API key。
3. `.env` 不提交 Git。
4. live tests 必须显式打开 RUN_OPENAI_LIVE_TESTS=1。
```

---

## 8. Docker Compose

```yaml
services:
  postgres:
    image: postgres:16
    container_name: elderly_postgres
    environment:
      POSTGRES_USER: elderly
      POSTGRES_PASSWORD: elderly_pass
      POSTGRES_DB: elderly_ai
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    container_name: elderly_redis
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

启动：

```bash
docker compose up -d
```

---

## 9. OpenAI Realtime 接入

### 9.1 主流程

```text
浏览器请求 /api/realtime/token
  ↓
FastAPI 使用 OPENAI_API_KEY 调 OpenAI /v1/realtime/client_secrets
  ↓
FastAPI 返回 ephemeral token
  ↓
浏览器创建 RTCPeerConnection
  ↓
浏览器采集麦克风音轨
  ↓
浏览器把 SDP offer 发给 OpenAI /v1/realtime/calls
  ↓
OpenAI 返回 SDP answer
  ↓
浏览器播放 AI 语音输出，并接收事件
```

### 9.2 后端 settings

`backend/app/settings.py`：

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openai_api_key: str
    openai_realtime_model: str = "gpt-realtime-2"
    openai_realtime_voice: str = "marin"
    run_openai_live_tests: bool = False

    app_origin: str = "http://localhost:5173"
    demo_user_id: str = "demo-user"
    confirmation_token_ttl_seconds: int = 300
    single_order_limit_cents: int = 5000
    daily_budget_cents: int = 10000


settings = Settings()
```

### 9.3 系统提示词

```python
SYSTEM_INSTRUCTIONS = """
你是一个面向老年人的中文语音助手。你的目标是陪伴、解释、提醒、协助购物，但不能代替医生、律师或家属做重大决定。

说话要求：
1. 使用简体中文。
2. 每次回复尽量不超过 80 个汉字。
3. 语速偏慢，句子短，信息分块清楚。
4. 不要假装自己是真人。首次会话要说明“我是 AI 语音助手”。
5. 老人没听清时，要耐心重复。
6. 涉及购买、付款、地址、个人信息、医疗建议、紧急情况时，必须复述关键信息并要求二次确认。
7. 不得在一次语音确认中直接完成付款或下单。
8. 情绪识别结果只能作为陪伴参考，不得诊断心理疾病。
9. 如果老人表达明显自伤、跌倒、急病、迷路等风险，应建议联系家属或急救，并触发安全提醒工具。
""".strip()
```

### 9.4 Realtime Tools

```python
REALTIME_TOOLS = [
    {
        "type": "function",
        "name": "search_grocery_options",
        "description": "根据老人语音中的买菜需求搜索附近可购买的候选商品或套餐；只返回候选项，不下单。",
        "parameters": {
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "quantity": {"type": "string"}
                        },
                        "required": ["name"]
                    }
                },
                "budget_cents": {"type": "integer"},
                "delivery_time": {"type": "string"}
            },
            "required": ["items"]
        }
    },
    {
        "type": "function",
        "name": "create_order_preview",
        "description": "根据候选项生成订单预览，包括商品、配送费、总价、预计送达时间；不会提交订单。",
        "parameters": {
            "type": "object",
            "properties": {"option_id": {"type": "string"}},
            "required": ["option_id"]
        }
    },
    {
        "type": "function",
        "name": "submit_order",
        "description": "提交订单。只有服务端签发 confirmation_token 后才允许调用。",
        "parameters": {
            "type": "object",
            "properties": {
                "preview_id": {"type": "string"},
                "confirmation_token": {"type": "string"}
            },
            "required": ["preview_id", "confirmation_token"]
        }
    }
]
```

### 9.5 后端 token 接口

`backend/app/api/realtime.py`：

```python
from hashlib import sha256

import httpx
from fastapi import APIRouter, HTTPException, Request

from app.settings import settings
from app.services.openai_realtime import REALTIME_TOOLS, SYSTEM_INSTRUCTIONS

router = APIRouter(prefix="/api/realtime", tags=["realtime"])


def safety_identifier(user_id: str) -> str:
    return sha256(user_id.encode("utf-8")).hexdigest()


@router.post("/token")
async def create_realtime_token(request: Request):
    if not settings.openai_api_key or settings.openai_api_key.startswith("sk-REPLACE"):
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured")

    user_id = request.headers.get("X-User-Id", settings.demo_user_id)

    session_config = {
        "session": {
            "type": "realtime",
            "model": settings.openai_realtime_model,
            "instructions": SYSTEM_INSTRUCTIONS,
            "audio": {"output": {"voice": settings.openai_realtime_voice}},
            "tools": REALTIME_TOOLS,
        }
    }

    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": safety_identifier(user_id),
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.openai.com/v1/realtime/client_secrets",
            headers=headers,
            json=session_config,
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    return response.json()
```

### 9.6 前端 WebRTC 连接

`web/src/realtime/startRealtimeSession.ts`：

```ts
export async function startRealtimeSession(params: {
  userId: string;
  onEvent: (event: any) => void;
  onRemoteAudioStream: (stream: MediaStream) => void;
}) {
  const tokenResponse = await fetch("/api/realtime/token", {
    method: "POST",
    headers: { "X-User-Id": params.userId },
  });

  if (!tokenResponse.ok) {
    const detail = await tokenResponse.text();
    throw new Error(`Failed to create realtime token: ${tokenResponse.status} ${detail}`);
  }

  const tokenData = await tokenResponse.json();
  const ephemeralKey = tokenData.value;

  if (!ephemeralKey) {
    throw new Error("Realtime token response does not contain value");
  }

  const pc = new RTCPeerConnection();

  pc.ontrack = (event) => {
    params.onRemoteAudioStream(event.streams[0]);
  };

  const localStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });

  for (const track of localStream.getAudioTracks()) {
    pc.addTrack(track, localStream);
  }

  const dc = pc.createDataChannel("oai-events");
  dc.addEventListener("message", (event) => {
    params.onEvent(JSON.parse(event.data));
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${ephemeralKey}`,
      "Content-Type": "application/sdp",
    },
  });

  if (!sdpResponse.ok) {
    const detail = await sdpResponse.text();
    throw new Error(`Realtime SDP failed: ${sdpResponse.status} ${detail}`);
  }

  await pc.setRemoteDescription({
    type: "answer",
    sdp: await sdpResponse.text(),
  });

  return {
    pc,
    dc,
    localStream,
    stop() {
      localStream.getTracks().forEach((track) => track.stop());
      pc.close();
    },
  };
}
```

---

## 10. Live OpenAI API 测试

MVP 中建议增加一个默认跳过的 live test，用来验证额度、key、网络和 Realtime token 创建。

`backend/tests/test_openai_realtime_live.py`：

```python
import os

import pytest


pytestmark = pytest.mark.skipif(
    os.getenv("RUN_OPENAI_LIVE_TESTS") != "1",
    reason="Set RUN_OPENAI_LIVE_TESTS=1 to run live OpenAI API tests",
)


@pytest.mark.asyncio
async def test_create_realtime_client_secret_live(async_client):
    response = await async_client.post(
        "/api/realtime/token",
        headers={"X-User-Id": "demo-user"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "value" in data
    assert isinstance(data["value"], str)
    assert len(data["value"]) > 20
```

运行：

```bash
cd backend
source .venv/bin/activate
export OPENAI_API_KEY="sk-..."
export RUN_OPENAI_LIVE_TESTS=1
pytest tests/test_openai_realtime_live.py -q
```

普通测试不跑真实 API：

```bash
pytest -q
```

---

## 11. 语音对话产品规则

### 11.1 交互能力

```text
1. 开始说话。
2. 停止说话。
3. 打断 AI。
4. 再说一遍。
5. 取消当前任务。
6. 显示 AI 听到的内容。
7. 显示 AI 回复。
```

### 11.2 回复风格

```text
老人：我今天有点不开心。
AI：听起来您今天心情不太好。我在这里陪您。要不要和我说说发生了什么？

老人：帮我买点西红柿和鸡蛋。
AI：好的。我先帮您找西红柿和鸡蛋，只看选项，不会直接下单。

老人：就买第一个。
AI：请确认：西红柿两斤、鸡蛋一盒，送到默认地址，总价三十二元。您确认购买吗？
```

禁止：

```text
1. “我就是您的家人。”
2. “您肯定抑郁了。”
3. “我已经帮您付款了。”
4. “不用确认，我替您决定。”
5. 医疗、法律、金融上的确定性高风险建议。
```

---

## 12. 情绪识别方案

### 12.1 架构

```text
浏览器摄像头视频帧
  ↓
MediaPipe Face Landmarker
  ↓
face landmarks + blendshape scores
  ↓
规则分类 / 轻量模型
  ↓
3–5 秒平滑
  ↓
情绪倾向标签
  ↓
只把 label、confidence、valence、arousal、timestamp 发给后端
```

### 12.2 前端分类器

`web/src/emotion/emotionClassifier.ts`：

```ts
export type EmotionLabel =
  | "happy"
  | "sad_tendency"
  | "angry_tendency"
  | "surprised"
  | "calm"
  | "unknown";

export interface EmotionResult {
  label: EmotionLabel;
  confidence: number;
  valence: number;
  arousal: number;
}

function avg(...xs: number[]) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function classifyEmotion(scores: Record<string, number>): EmotionResult {
  const smile = avg(scores.mouthSmileLeft ?? 0, scores.mouthSmileRight ?? 0);
  const frown = avg(scores.mouthFrownLeft ?? 0, scores.mouthFrownRight ?? 0);
  const browDown = avg(scores.browDownLeft ?? 0, scores.browDownRight ?? 0);
  const eyeWide = avg(scores.eyeWideLeft ?? 0, scores.eyeWideRight ?? 0);
  const jawOpen = scores.jawOpen ?? 0;
  const browInnerUp = scores.browInnerUp ?? 0;

  const happyScore = smile * 0.8 + (scores.cheekSquintLeft ?? 0) * 0.1 + (scores.cheekSquintRight ?? 0) * 0.1;
  const sadScore = frown * 0.6 + browInnerUp * 0.4;
  const angryScore = browDown * 0.7 + avg(scores.eyeSquintLeft ?? 0, scores.eyeSquintRight ?? 0) * 0.3;
  const surprisedScore = jawOpen * 0.5 + eyeWide * 0.3 + browInnerUp * 0.2;

  const candidates: Array<[EmotionLabel, number]> = [
    ["happy", happyScore],
    ["sad_tendency", sadScore],
    ["angry_tendency", angryScore],
    ["surprised", surprisedScore],
  ];

  candidates.sort((a, b) => b[1] - a[1]);
  const [label, confidence] = candidates[0];

  if (confidence < 0.35) {
    return { label: "calm", confidence: 0.6, valence: 0, arousal: 0.2 };
  }

  const valence =
    label === "happy" ? 0.8 :
    label === "sad_tendency" ? -0.6 :
    label === "angry_tendency" ? -0.7 :
    label === "surprised" ? 0.1 :
    0;

  const arousal = label === "sad_tendency" ? 0.4 : 0.75;

  return { label, confidence, valence, arousal };
}
```

### 12.3 后端事件

```http
POST /api/emotion/events
Content-Type: application/json

{
  "user_id": "demo-user",
  "label": "sad_tendency",
  "confidence": 0.71,
  "valence": -0.6,
  "arousal": 0.4,
  "window_seconds": 5,
  "source": "face_blendshape",
  "raw_video_saved": false
}
```

---

## 13. 买菜 / 外卖功能

### 13.1 推荐路径

```text
MVP：MockGroceryAdapter
  ↓
联调：稳定 Provider Interface
  ↓
生产：美团企业版 / 饿了么授权 API / 正规聚合服务商 / 自有商城
```

### 13.2 禁止路径

```text
1. 爬取消费者版美团/饿了么页面。
2. 自动控制手机 App 点击下单。
3. 未授权调用平台接口。
4. 未确认直接付款。
5. 在前端保存平台账号密码。
```

### 13.3 买菜语音流程

```text
老人：帮我买两斤西红柿和一把小青菜。
  ↓
AI 提取商品、数量、预算和配送偏好
  ↓
调用 search_grocery_options
  ↓
后端 GroceryService 调用 MockGroceryAdapter
  ↓
返回 3 个候选项
  ↓
AI 读出三个选项
  ↓
老人选择其中一个
  ↓
调用 create_order_preview
  ↓
AI 复述商品、地址、总价、预计送达时间
  ↓
老人通过语音 + UI 按钮确认
  ↓
后端签发 confirmation_token
  ↓
submit_order 校验 token 后提交
```

---

## 14. Provider Adapter

`backend/app/providers/base.py`：

```python
from abc import ABC, abstractmethod
from typing import Optional

from pydantic import BaseModel


class GroceryItem(BaseModel):
    name: str
    quantity: Optional[str] = None


class GroceryOption(BaseModel):
    id: str
    provider: str
    title: str
    shop_name: str
    items: list[dict]
    price_cents: int
    delivery_fee_cents: int
    eta_minutes: int
    raw_payload: dict = {}


class OrderPreview(BaseModel):
    preview_id: str
    provider: str
    title: str
    items: list[dict]
    total_cents: int
    delivery_fee_cents: int
    eta_minutes: int
    address_masked: str
    need_caregiver_confirm: bool = False
    policy_reason: str | None = None
    raw_payload: dict = {}


class OrderResult(BaseModel):
    order_id: str
    provider_order_id: str
    status: str


class GroceryProvider(ABC):
    @abstractmethod
    async def search_options(
        self,
        user_id: str,
        items: list[GroceryItem],
        latitude: float,
        longitude: float,
        budget_cents: Optional[int] = None,
    ) -> list[GroceryOption]:
        raise NotImplementedError

    @abstractmethod
    async def create_order_preview(self, user_id: str, option_id: str) -> OrderPreview:
        raise NotImplementedError

    @abstractmethod
    async def submit_order(self, user_id: str, preview_id: str, confirmation_token: str) -> OrderResult:
        raise NotImplementedError
```

---

## 15. 风控与确认 Token

### 15.1 风控规则

```text
1. 单笔超过 single_order_limit_cents：家属确认。
2. 单日超过 daily_budget_cents：家属确认。
3. 涉及药品、酒精、保健品、处方药：禁止或家属确认。
4. 地址变更：家属确认。
5. 首次使用付款：家属设置。
6. submit_order 必须校验 confirmation_token。
7. confirmation_token 短期、一次性、绑定 user_id + preview_id。
8. 老人说“随便买”时，只能展示候选项，不能下单。
9. 所有订单相关动作写审计日志。
```

### 15.2 ConfirmationService

```python
import secrets
import time
from dataclasses import dataclass


@dataclass
class ConfirmationRecord:
    preview_id: str
    user_id: str
    expires_at: float
    used: bool = False


class InMemoryConfirmationService:
    def __init__(self, ttl_seconds: int = 300):
        self.ttl_seconds = ttl_seconds
        self.records: dict[str, ConfirmationRecord] = {}

    def issue(self, user_id: str, preview_id: str) -> str:
        token = secrets.token_urlsafe(32)
        self.records[token] = ConfirmationRecord(
            preview_id=preview_id,
            user_id=user_id,
            expires_at=time.time() + self.ttl_seconds,
        )
        return token

    def verify_and_consume(self, user_id: str, preview_id: str, token: str) -> bool:
        record = self.records.get(token)
        if not record or record.used:
            return False
        if record.user_id != user_id or record.preview_id != preview_id:
            return False
        if record.expires_at < time.time():
            return False
        record.used = True
        return True
```

---

## 16. 后端 API 草案

```http
GET  /api/health
POST /api/realtime/token
POST /api/tools/search_grocery_options
POST /api/tools/create_order_preview
POST /api/tools/issue_confirmation_token
POST /api/tools/submit_order
POST /api/emotion/events
GET  /api/caregiver/dashboard?user_id=demo-user
POST /api/caregiver/settings/budget
```

---

## 17. 数据库设计

### users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  birth_year INTEGER,
  default_address TEXT,
  default_latitude NUMERIC,
  default_longitude NUMERIC,
  phone TEXT,
  caregiver_phone TEXT,
  daily_budget_cents INTEGER DEFAULT 10000,
  single_order_limit_cents INTEGER DEFAULT 5000,
  allergies JSONB DEFAULT '[]',
  dietary_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now()
);
```

### conversations

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  started_at TIMESTAMP DEFAULT now(),
  ended_at TIMESTAMP,
  transcript JSONB DEFAULT '[]',
  summary TEXT,
  risk_flags JSONB DEFAULT '[]'
);
```

### emotion_events

```sql
CREATE TABLE emotion_events (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  ts TIMESTAMP DEFAULT now(),
  label TEXT NOT NULL,
  confidence NUMERIC,
  valence NUMERIC,
  arousal NUMERIC,
  source TEXT DEFAULT 'face_blendshape',
  raw_video_saved BOOLEAN DEFAULT false
);
```

### orders

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  provider TEXT,
  provider_order_id TEXT,
  status TEXT,
  total_cents INTEGER,
  confirmation_method TEXT,
  created_at TIMESTAMP DEFAULT now(),
  raw_payload JSONB
);
```

### audit_logs

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now()
);
```

---

## 18. 本地运行

### 后端

```bash
cd ~/projects/elderly-ai-assistant/backend
source .venv/bin/activate

export OPENAI_API_KEY="sk-..."
export OPENAI_REALTIME_MODEL="gpt-realtime-2"
export OPENAI_REALTIME_VOICE="marin"

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 前端代理

`web/vite.config.ts`：

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
```

启动：

```bash
cd ~/projects/elderly-ai-assistant/web
npm run dev -- --host 0.0.0.0 --port 5173
```

Windows 浏览器打开：

```text
http://localhost:5173
```

---

## 19. 开发阶段

### 阶段 1：项目骨架

```text
1. FastAPI 能启动。
2. React 能启动。
3. /api/health 正常。
4. Docker Compose 能启动 PostgreSQL / Redis。
5. README、AGENTS.md、.env.example 完整。
```

### 阶段 2：真实 OpenAI Realtime 语音

```text
1. 后端 /api/realtime/token 调真实 OpenAI API。
2. live smoke test 可通过。
3. 前端能建立 WebRTC。
4. 浏览器能播放 AI 语音。
5. Realtime event logger 可观察事件。
```

### 阶段 3：情绪识别

```text
1. 浏览器打开摄像头。
2. MediaPipe 输出 blendshape scores。
3. 页面显示情绪倾向。
4. 后端接收情绪事件。
5. 不上传原始视频。
```

### 阶段 4：Mock 买菜闭环

```text
1. 语音提出买菜需求。
2. AI 调用 search_grocery_options。
3. 页面显示 3 个候选。
4. create_order_preview 返回订单预览。
5. issue_confirmation_token 签发一次性确认 token。
6. submit_order 成功提交 Mock 订单。
```

### 阶段 5：家属端和真实平台

```text
1. 家属设置预算。
2. 家属确认高风险订单。
3. 接入美团/饿了么授权 API 或正规聚合服务商。
```

---

## 20. 测试计划

必须覆盖：

```text
1. check_order_policy 正常订单通过。
2. 超单笔限额拦截。
3. 超日预算拦截。
4. 地址变更拦截。
5. 限制品类拦截。
6. confirmation_token 一次性使用。
7. confirmation_token 过期失败。
8. MockGroceryProvider 返回 3 个候选。
9. /api/realtime/token 在缺少 OPENAI_API_KEY 时返回清晰错误。
10. RUN_OPENAI_LIVE_TESTS=1 时真实 OpenAI token 测试可运行。
```

---

## 21. 隐私与合规

原则：

```text
1. 默认不保存原始音频。
2. 默认不保存原始视频。
3. 情绪识别尽量在浏览器本地完成。
4. 后端只保存标签、置信度、时间戳。
5. 对话 transcript 可配置关闭；默认保存摘要。
6. 地址、手机号、订单信息加密存储。
7. 家属端必须强认证。
8. 购买动作必须有审计日志。
9. 用户可导出和删除数据。
10. 首次启动明确告知：AI 语音由 AI 生成，不是真人。
11. 涉及敏感个人信息处理时取得单独同意。
```

---

## 22. 给 Codex 的 Prompt

下面这段可以直接复制给 Codex。

```text
你是我的资深全栈工程助手。请在当前空仓库中为一个“面向老年人的中文语音陪伴、情绪识别与买菜助手”创建 MVP 项目骨架。

技术栈与环境：
- 目标开发环境：WSL2 Ubuntu 22.04。
- Monorepo：backend + web。
- 后端：Python FastAPI，Python 3.10+，httpx，pydantic-settings，pytest，pytest-asyncio。
- 前端：React + TypeScript + Vite，Zustand，MediaPipe Tasks Vision。
- 数据库：PostgreSQL；缓存：Redis。MVP 先可以不实际写入数据库，但要保留结构。
- AI 语音：OpenAI Realtime API WebRTC。
- OpenAI API 额度充足：主语音链路必须优先使用真实 OpenAI API，不要把 OpenAI 语音能力做成假实现。Mock 只用于买菜平台和离线兜底。
- 买菜：先实现 MockGroceryAdapter，不要接真实美团/饿了么，不要写爬虫，不要做 App 自动点击。

请实现以下内容：

1. 项目结构
   - 创建 README.md、AGENTS.md、.env.example、docker-compose.yml。
   - 创建 backend/ 和 web/ 两个子项目。
   - backend 使用 FastAPI；web 使用 Vite React TypeScript。

2. 后端功能
   - GET /api/health：返回 {"status":"ok"}。
   - POST /api/realtime/token：使用环境变量 OPENAI_API_KEY 调用 https://api.openai.com/v1/realtime/client_secrets，创建 Realtime ephemeral token。
   - /api/realtime/token 不要返回假 token；如果 OPENAI_API_KEY 缺失，要返回清晰错误。
   - Realtime session config 使用：
     - model: 环境变量 OPENAI_REALTIME_MODEL，默认 gpt-realtime-2。
     - voice: 环境变量 OPENAI_REALTIME_VOICE，默认 marin。
     - instructions：中文老人助手系统提示词，要求短句、慢速、二次确认、明确 AI 语音披露、不得医疗诊断。
     - tools：search_grocery_options、create_order_preview、submit_order。
   - 工具接口：
     - POST /api/tools/search_grocery_options
     - POST /api/tools/create_order_preview
     - POST /api/tools/issue_confirmation_token
     - POST /api/tools/submit_order
   - 实现 providers/base.py 和 providers/mock_grocery.py。
   - 实现 services/safety_policy.py。
   - 实现 services/confirmation_service.py，MVP 可用内存字典；要求 token 短期有效、一次性使用、绑定 user_id + preview_id。
   - submit_order 必须校验 confirmation_token；没有 token、token 错误、重复使用、过期都要失败。
   - 写 pytest：安全策略、MockGroceryAdapter、confirmation token。
   - 增加可选 live API 测试：backend/tests/test_openai_realtime_live.py。该测试默认跳过，只有设置 RUN_OPENAI_LIVE_TESTS=1 且 OPENAI_API_KEY 存在时才调用真实 OpenAI API，验证 /v1/realtime/client_secrets 可用。

3. 前端功能
   - 创建老人端单页 UI。
   - 大按钮：开始说话、停止、再说一遍、取消。
   - 展示转写/事件日志区域和 AI 回复区域。
   - 实现 startRealtimeSession.ts：
     - 请求 /api/realtime/token 获取 ephemeral key。
     - 创建 RTCPeerConnection。
     - getUserMedia 获取麦克风。
     - 创建 data channel：oai-events。
     - 将 SDP offer 发到 https://api.openai.com/v1/realtime/calls。
     - 设置 SDP answer。
     - 播放远端音频。
   - 实现基本 Realtime event logger。
   - 实现 toolBridge.ts 的骨架：收到工具调用事件时，按 tool name 调后端 /api/tools/*，再把结果通过 data channel 发回 Realtime。若不确定 OpenAI event 的精确字段，请把解析逻辑写成可扩展形式，并在代码注释中标注需要按实际 event 调整。
   - 实现情绪识别骨架：
     - faceLandmarker.ts：加载 /models/face_landmarker.task 和 /wasm。
     - emotionClassifier.ts：基于 blendshape score 输出 happy、sad_tendency、angry_tendency、surprised、calm、unknown。
     - smoothing.ts：做 3–5 秒平滑。
   - 情绪识别默认只在浏览器本地运行，不上传原始视频。只向后端发送 label、confidence、valence、arousal、raw_video_saved=false。

4. 配置与运行
   - docker-compose.yml 启动 PostgreSQL 16 和 Redis 7。
   - .env.example 包含 OPENAI_API_KEY、OPENAI_REALTIME_MODEL、OPENAI_REALTIME_VOICE、RUN_OPENAI_LIVE_TESTS、DATABASE_URL、REDIS_URL、GROCERY_PROVIDER、SINGLE_ORDER_LIMIT_CENTS、DAILY_BUDGET_CENTS。
   - web/vite.config.ts 配置 /api 代理到 http://localhost:8000。
   - README.md 写清楚 WSL2 Ubuntu 22.04 下如何安装依赖、启动后端、启动前端、运行测试。

5. 安全和产品约束
   - 不要把 OPENAI_API_KEY 写入前端。
   - 不要实现真实支付。
   - 不要绕过订单确认。
   - 不要保存原始音频和视频。
   - 不要做医学诊断；情绪识别只显示“可能低落”等倾向。
   - 所有订单提交都必须走 create_order_preview → issue_confirmation_token → submit_order。
   - submit_order 必须校验短期一次性 confirmation_token。

6. 完成标准
   - pytest 能通过。
   - RUN_OPENAI_LIVE_TESTS=1 pytest backend/tests/test_openai_realtime_live.py 在配置 OPENAI_API_KEY 后能通过。
   - npm run build 能通过。
   - uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload 能启动。
   - npm run dev -- --host 0.0.0.0 --port 5173 能启动。
   - 浏览器打开 http://localhost:5173 后能看到老人端 UI。
   - README 中列出尚未完成的事项：真实平台接入、正式鉴权、数据库持久化、家属端完整 UI、生产部署。

请先给出你将创建/修改的文件清单和实现计划，然后直接实现。实现后运行可行的测试和构建命令，并在最终回复中总结：已完成内容、如何运行、已知限制、下一步建议。
```

---

## 23. 参考资料

1. OpenAI Realtime API with WebRTC：`https://developers.openai.com/api/docs/guides/realtime-webrtc`
2. OpenAI Realtime and audio：`https://developers.openai.com/api/docs/guides/realtime`
3. OpenAI Speech to text：`https://developers.openai.com/api/docs/guides/speech-to-text`
4. OpenAI Text to speech：`https://developers.openai.com/api/docs/guides/text-to-speech`
5. MediaPipe Face Landmarker：`https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker`
6. MDN getUserMedia：`https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia`
7. Microsoft WSL Networking：`https://learn.microsoft.com/en-us/windows/wsl/networking`
8. Microsoft WSL USB devices：`https://learn.microsoft.com/en-us/windows/wsl/connect-usb`
9. 美团企业版外卖 API 文档：`https://h5.dianping.com/app/bep-docs/sky-doc/canyinopenapi/waimai_api.html`
10. 饿了么 OpenAPI 文档：`https://openapi-doc.faas.ele.me/v2/api/index.html`
