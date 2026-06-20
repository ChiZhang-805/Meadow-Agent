import { Mic, Repeat2, Settings, Square, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { createOrderPreview, issueConfirmationToken, submitOrder } from "./api/grocery";
import { CancelOrderDialog, isActiveOrderStage } from "./components/CancelOrderDialog";
import { ConfigSidebar } from "./components/ConfigSidebar";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { EmotionBadge } from "./components/EmotionBadge";
import { GroceryOptionCards } from "./components/GroceryOptionCards";
import { GroceryStageTracker } from "./components/GroceryStageTracker";
import { OrderHistoryDialog, stageLabel } from "./components/OrderHistoryDialog";
import { TranscriptPanel } from "./components/TranscriptPanel";
import { VoiceButton } from "./components/VoiceButton";
import agentIconUrl from "./assets/agent_icon.png";
import { createRealtimeEventHandler } from "./realtime/eventHandlers";
import { startRealtimeSession, type RealtimeSessionHandle } from "./realtime/startRealtimeSession";
import { handleRealtimeToolCall, sendToolOutput, summarizePreview } from "./realtime/toolBridge";
import { type GroceryStage, type OrderHistoryRecord, useGroceryStore } from "./store/useGroceryStore";
import { useVoiceStore } from "./store/useVoiceStore";
import { getSessionUserId } from "./user/sessionUser";

type InputGateState = "open" | "paused" | "suspended";
const LOCAL_AUDIO_SILENCE_MS = 1400;
const NO_AUDIO_RESPONSE_FALLBACK_MS = 2800;
const REMOTE_AUDIO_RMS_THRESHOLD = 0.012;

export default function App() {
  const userId = useMemo(() => getSessionUserId(), []);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionRef = useRef<RealtimeSessionHandle | null>(null);
  const groceryTimersRef = useRef<Map<string, number[]>>(new Map());
  const assistantSpeakingRef = useRef(false);
  const assistantUnmuteTimerRef = useRef<number | null>(null);
  const inputGateRef = useRef<InputGateState>("open");
  const assistantOutputGateRef = useRef(false);
  const assistantServerDoneRef = useRef(false);
  const outputHeardRef = useRef(false);
  const outputGateStartedAtRef = useRef(0);
  const outputLastHeardAtRef = useRef(0);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputMonitorFrameRef = useRef<number | null>(null);
  const lastSyncedStageRef = useRef<string>("");
  const [busyConfirming, setBusyConfirming] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTargetOrderId, setCancelTargetOrderId] = useState<string | undefined>();

  const {
    status,
    transcriptBubbles,
    aiReplyBubbles,
    lastError,
    setStatus,
    addEventLog,
    addTranscriptBubble,
    appendAiReplyDelta,
    finishAiReplyBubble,
    clearConversation,
    setError
  } = useVoiceStore();

  const {
    options,
    currentPreview,
    lastOrder,
    orderHistory,
    selectedHistoryOrderId,
    pendingConfirmation,
    stage,
    setPreview,
    clearPreview,
    setOrder,
    setStage,
    setOrderStage,
    cancelOrder,
    selectHistoryOrder
  } = useGroceryStore();

  useEffect(() => {
    return () => {
      clearGroceryTimers();
      clearAssistantUnmuteTimer();
      cleanupOutputAudioMonitor();
    };
  }, []);

  useEffect(() => {
    if (!lastOrder) return;
    runGroceryStageSimulation(lastOrder.order_id);
  }, [lastOrder?.order_id]);

  useEffect(() => {
    syncOrderMemoryToAssistant();
  }, [orderHistory]);

  const realtimeEventHandler = useMemo(
    () =>
      createRealtimeEventHandler({
        addEventLog,
        addTranscriptBubble,
        appendAiReplyDelta,
        finishAiReplyBubble,
        onUserTranscript: handleUserTranscriptIntent,
        onUserTurnFinished: pauseInputForPendingAssistant,
        onAssistantSpeakingChange: setAssistantSpeaking,
        onToolCall: async (call) => {
          addEventLog(`tool:${call.name}`);
          const channel = sessionRef.current?.dc;
          try {
            const output = await handleRealtimeToolCall(call, userId);
            if (channel) {
              suspendInputForAssistant();
              sendToolOutput(channel, call.callId, output);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            addEventLog(`tool_error:${message}`);
            if (channel) {
              suspendInputForAssistant();
              sendToolOutput(channel, call.callId, { error: message });
            }
          }
        }
      }),
    [addEventLog, addTranscriptBubble, appendAiReplyDelta, finishAiReplyBubble, userId]
  );

  async function start() {
    if (sessionRef.current) return;
    setStatus("starting");
    clearConversation();
    try {
      const session = await startRealtimeSession({
        userId,
        onEvent: realtimeEventHandler,
        onRemoteAudioStream: (stream) => {
          if (audioRef.current) {
            audioRef.current.srcObject = stream;
            void audioRef.current.play();
          }
          bindOutputAudioMonitor(stream);
        },
        onDataChannelOpen: () => addEventLog("data_channel.open")
      });
      sessionRef.current = session;
      inputGateRef.current = "open";
      session.resumeInput();
      syncOrderMemoryToAssistant(true);
      setStatus("connected");
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      sessionRef.current?.stop();
      sessionRef.current = null;
    }
  }

  function stopTalking() {
    sessionRef.current?.stop();
    sessionRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }
    clearAssistantUnmuteTimer();
    assistantSpeakingRef.current = false;
    assistantOutputGateRef.current = false;
    assistantServerDoneRef.current = false;
    stopOutputMonitorLoop();
    cleanupOutputAudioMonitor();
    inputGateRef.current = "open";
    setStatus("stopped");
    addEventLog("voice.stopped");
  }

  function replay() {
    sendTextToAssistant("请把刚才的话再慢慢说一遍。");
    addEventLog("client.repeat");
  }

  function cancel() {
    openCancelOrderDialog();
    addEventLog("client.cancel_picker");
  }

  function handleUserTranscriptIntent(text: string) {
    if (isStopTalkingIntent(text)) {
      addEventLog("intent.stop_voice");
      stopTalking();
      return;
    }

    if (isCancelOrderIntent(text) || (isGenericCancelOrderIntent(text) && getActiveOrders().length > 0)) {
      addEventLog("intent.cancel_order");
      requestCancelOrderFromVoice(text);
    }
  }

  function openCancelOrderDialog() {
    setCancelTargetOrderId(undefined);
    setCancelDialogOpen(true);
  }

  function requestCancelOrderFromVoice(text: string) {
    const activeOrders = getActiveOrders();
    if (activeOrders.length === 0) {
      sendTextToAssistant("系统通知：老人想取消订单，但当前没有正在进行的订单。请简短告诉老人没有可取消订单。");
      return;
    }

    const matches = activeOrders.filter((record) => orderMatchesText(record, text));
    if (matches.length === 1) {
      setCancelTargetOrderId(matches[0].order.order_id);
      setCancelDialogOpen(true);
      sessionRef.current?.sendContext(
        `系统状态同步：老人想取消${matches[0].preview.title}。屏幕已弹出二次确认窗口，确认前不要说订单已经取消。`
      );
      return;
    }

    if (activeOrders.length === 1 && matches.length === 0 && isGenericCancelOrderIntent(text)) {
      setCancelTargetOrderId(activeOrders[0].order.order_id);
      setCancelDialogOpen(true);
      sessionRef.current?.sendContext(
        `系统状态同步：老人想取消订单。屏幕已弹出${activeOrders[0].preview.title}的二次确认窗口，确认前不要说订单已经取消。`
      );
      return;
    }

    setCancelTargetOrderId(undefined);
    setCancelDialogOpen(true);
    sessionRef.current?.sendContext("系统状态同步：老人想取消订单，但需要在屏幕上选择具体订单并二次确认。");
  }

  function chooseCancelOrder(orderId: string) {
    setCancelTargetOrderId(orderId);
  }

  function confirmCancelOrder(orderId: string) {
    const record = useGroceryStore.getState().orderHistory.find((item) => item.order.order_id === orderId);
    if (!record) return;
    clearGroceryTimers(orderId);
    cancelOrder(orderId);
    setCancelDialogOpen(false);
    setCancelTargetOrderId(undefined);
    lastSyncedStageRef.current = "";
    sendTextToAssistant(
      `系统通知：老人已经二次确认取消订单。订单号${orderId}，商品${record.preview.title}，当前状态改为已取消。请简短告诉老人订单已取消。`
    );
  }

  function getActiveOrders() {
    return useGroceryStore.getState().orderHistory.filter((record) => isActiveOrderStage(record.stage));
  }

  async function previewOption(optionId: string) {
    try {
      const preview = await createOrderPreview({ user_id: userId, option_id: optionId });
      setPreview(preview);
      sendTextToAssistant(`${summarizePreview(preview)} 请等待我在屏幕上确认。`);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  }

  async function confirmOrder() {
    if (!currentPreview) return;
    const preview = currentPreview;
    setBusyConfirming(true);
    setStage("ordering");
    try {
      const confirmationToken = await issueConfirmationToken({
        user_id: userId,
        preview_id: preview.preview_id
      });
      const order = await submitOrder({
        user_id: userId,
        preview_id: preview.preview_id,
        confirmation_token: confirmationToken
      });
      setOrder(order, preview);
      lastSyncedStageRef.current = "";
      sendTextToAssistant(
        [
          "系统通知：老人已在屏幕上点击“确认提交”。",
          "后端已签发并验证一次性确认凭据，模拟订单已提交。",
          `订单号：${order.order_id}。`,
          `商品：${preview.title}。`,
          `送达地址：${preview.address_masked}。`,
          `预计 ${preview.eta_minutes} 分钟送达。`,
          "请直接告诉老人订单已提交，不要再要求确认凭据。"
        ].join("")
      );
    } catch (error) {
      setStage("preview_ready");
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyConfirming(false);
    }
  }

  function clearGroceryTimers(orderId?: string) {
    if (orderId) {
      for (const timer of groceryTimersRef.current.get(orderId) ?? []) {
        window.clearTimeout(timer);
      }
      groceryTimersRef.current.delete(orderId);
      return;
    }

    for (const timers of groceryTimersRef.current.values()) {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    }
    groceryTimersRef.current.clear();
  }

  function clearAssistantUnmuteTimer() {
    if (assistantUnmuteTimerRef.current !== null) {
      window.clearTimeout(assistantUnmuteTimerRef.current);
      assistantUnmuteTimerRef.current = null;
    }
  }

  function pauseInputForPendingAssistant() {
    clearAssistantUnmuteTimer();
    assistantSpeakingRef.current = true;
    if (inputGateRef.current !== "open") return;
    sessionRef.current?.pauseInputCapture();
    inputGateRef.current = "paused";
  }

  function suspendInputForAssistant() {
    clearAssistantUnmuteTimer();
    assistantSpeakingRef.current = true;
    if (inputGateRef.current === "suspended") return;
    sessionRef.current?.suspendInput({ clearBuffer: true });
    inputGateRef.current = "suspended";
  }

  function beginAssistantOutputGate() {
    suspendInputForAssistant();
    if (!assistantOutputGateRef.current) {
      const now = performance.now();
      assistantOutputGateRef.current = true;
      assistantServerDoneRef.current = false;
      outputHeardRef.current = false;
      outputGateStartedAtRef.current = now;
      outputLastHeardAtRef.current = now;
    }
    startOutputMonitorLoop();
  }

  function markAssistantServerDone() {
    assistantServerDoneRef.current = true;
    startOutputMonitorLoop();
    maybeReleaseAssistantOutputGate();
  }

  function releaseAssistantOutputGate() {
    clearAssistantUnmuteTimer();
    stopOutputMonitorLoop();
    assistantOutputGateRef.current = false;
    assistantServerDoneRef.current = false;
    outputHeardRef.current = false;
    assistantSpeakingRef.current = false;
    inputGateRef.current = "open";
    sessionRef.current?.resumeInput();
  }

  function sendTextToAssistant(text: string) {
    const session = sessionRef.current;
    if (!session || session.dc.readyState !== "open") return;
    beginAssistantOutputGate();
    session.sendText(text);
  }

  function syncOrderMemoryToAssistant(force = false) {
    const records = useGroceryStore.getState().orderHistory;
    if (records.length === 0) return;

    const syncKey = records
      .map((record) => `${record.order.order_id}:${record.stage}:${record.updatedAt}`)
      .join("|");
    if (!force && lastSyncedStageRef.current === syncKey) return;
    lastSyncedStageRef.current = syncKey;

    const knownItems = Array.from(
      new Set(
        records.flatMap((record) =>
          record.preview.items.map((item) => String(item.name ?? "").trim()).filter(Boolean)
        )
      )
    );

    const memoryLines = records.slice(0, 8).map((record, index) => {
      const items = record.preview.items
        .map((item) => `${String(item.name ?? "菜品")}(${String(item.quantity ?? "适量")})`)
        .join("、");
      const weight = Math.max(0.45, 1 - index * 0.18).toFixed(2);
      return `记忆${index + 1}，权重${weight}，订单号${record.order.order_id}，菜品${items}，套餐${record.preview.title}，状态${stageLabel(record.stage)}，更新时间${new Date(record.updatedAt).toLocaleTimeString()}。`;
    });

    sessionRef.current?.sendContext(
      [
        "系统订单记忆库同步：以下仅包含已经确认提交的订单，候选预览不算已购买。",
        "最近的订单记忆权重更高，回答进展问题时优先使用权重高的匹配订单。",
        `已购买菜品集合：${knownItems.join("、") || "无"}。`,
        "如果老人询问的菜品不在已购买菜品集合中，必须明确回答没有找到该菜品订单，不要套用其他订单状态。",
        ...memoryLines
      ].join("")
    );
    addEventLog("memory.sync");
  }

  function setAssistantSpeaking(speaking: boolean) {
    if (speaking) {
      beginAssistantOutputGate();
      return;
    }

    markAssistantServerDone();
  }

  function bindOutputAudioMonitor(stream: MediaStream) {
    cleanupOutputAudioMonitor();
    const AudioContextConstructor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;

    try {
      const context = new AudioContextConstructor();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.15;
      source.connect(analyser);
      outputAudioContextRef.current = context;
      outputAudioSourceRef.current = source;
      outputAnalyserRef.current = analyser;
      void context.resume();
    } catch (error) {
      addEventLog(`audio_monitor_error:${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function cleanupOutputAudioMonitor() {
    stopOutputMonitorLoop();
    outputAudioSourceRef.current?.disconnect();
    outputAudioSourceRef.current = null;
    outputAnalyserRef.current = null;
    if (outputAudioContextRef.current) {
      void outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
  }

  function startOutputMonitorLoop() {
    if (outputMonitorFrameRef.current !== null) return;
    const tick = () => {
      outputMonitorFrameRef.current = null;
      readRemoteAudioLevel();
      if (maybeReleaseAssistantOutputGate()) return;
      if (assistantOutputGateRef.current) {
        outputMonitorFrameRef.current = window.requestAnimationFrame(tick);
      }
    };
    outputMonitorFrameRef.current = window.requestAnimationFrame(tick);
  }

  function stopOutputMonitorLoop() {
    if (outputMonitorFrameRef.current !== null) {
      window.cancelAnimationFrame(outputMonitorFrameRef.current);
      outputMonitorFrameRef.current = null;
    }
  }

  function readRemoteAudioLevel() {
    const analyser = outputAnalyserRef.current;
    if (!analyser || !assistantOutputGateRef.current) return;

    const samples = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) {
      const centered = (sample - 128) / 128;
      sum += centered * centered;
    }
    const rms = Math.sqrt(sum / samples.length);
    if (rms >= REMOTE_AUDIO_RMS_THRESHOLD) {
      outputHeardRef.current = true;
      outputLastHeardAtRef.current = performance.now();
    }
  }

  function maybeReleaseAssistantOutputGate() {
    if (!assistantOutputGateRef.current || !assistantServerDoneRef.current) return false;

    const now = performance.now();
    const heardAudio = outputHeardRef.current;
    const localPlaybackDone = heardAudio
      ? now - outputLastHeardAtRef.current >= LOCAL_AUDIO_SILENCE_MS
      : now - outputGateStartedAtRef.current >= NO_AUDIO_RESPONSE_FALLBACK_MS;

    if (localPlaybackDone) {
      releaseAssistantOutputGate();
      return true;
    }

    return false;
  }

  function runGroceryStageSimulation(orderId: string) {
    clearGroceryTimers(orderId);
    const schedule = [
      ["accepted", 1400],
      ["at_store", 3200],
      ["delivering", 5600],
      ["delivered", 8600]
    ] as const;
    const timers = schedule.map(([nextStage, delay], index) =>
      window.setTimeout(() => {
        setOrderStage(orderId, nextStage);
        if (index === schedule.length - 1) {
          groceryTimersRef.current.delete(orderId);
        }
      }, delay)
    );
    groceryTimersRef.current.set(orderId, timers);
  }

  const connected = status === "connected" || status === "starting";
  const selectedHistoryRecord = selectedHistoryOrderId
    ? orderHistory.find((record) => record.order.order_id === selectedHistoryOrderId)
    : undefined;
  const displayedStage = selectedHistoryRecord?.stage ?? stage;
  const displayedStageTimes = selectedHistoryRecord?.stageTimes;
  const activeOrders = getActiveOrders();
  const cancelTarget = cancelTargetOrderId
    ? orderHistory.find((record) => record.order.order_id === cancelTargetOrderId)
    : undefined;

  return (
    <main className="app-shell">
      <audio ref={audioRef} autoPlay />
      <ConfigSidebar open={settingsOpen} userId={userId} onClose={() => setSettingsOpen(false)} />

      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">
          <img src={agentIconUrl} alt="" />
        </div>
        <div>
          <h1>Meadow Agent 麦豆</h1>
          <p>AI 语音陪伴</p>
        </div>
        <button className="settings-button" onClick={() => setSettingsOpen(true)} title="打开开发配置">
          <Settings aria-hidden="true" size={28} />
          <span>配置</span>
        </button>
        <EmotionBadge userId={userId} />
      </header>

      <div className="feature-modules">
        <section className="feature-module chat-module" aria-label="语音聊天">
          <header className="module-header">
            <h2>语音聊天</h2>
            <div className={`status-pill status-${status}`}>{statusText(status)}</div>
          </header>

          <section className="voice-console" aria-label="语音控制台">
            <div className="button-grid">
              <VoiceButton label="开始说话" icon={Mic} tone="primary" disabled={connected} onClick={start} />
              <VoiceButton label="停止说话" icon={Square} tone="neutral" disabled={!connected} onClick={stopTalking} />
              <VoiceButton label="再说一遍" icon={Repeat2} tone="neutral" disabled={status !== "connected"} onClick={replay} />
              <VoiceButton label="取消订单" icon={X} tone="danger" onClick={cancel} />
            </div>
            {lastError ? <p className="error-text">{lastError}</p> : null}
          </section>

          <div className="conversation-grid">
            <TranscriptPanel title="我听到" bubbles={transcriptBubbles} placeholder=" " />
            <TranscriptPanel title="麦豆回复" bubbles={aiReplyBubbles} placeholder=" " />
          </div>

        </section>

        <section className="feature-module grocery-module" aria-label="语音买菜">
          <header className="module-header">
            <h2>语音买菜</h2>
            <button
              className="history-entry-button"
              disabled={orderHistory.length === 0}
              onClick={() => setHistoryOpen(true)}
              type="button"
            >
              历史订单
            </button>
          </header>
          <GroceryStageTracker stage={displayedStage} stageTimes={displayedStageTimes} />
        </section>

        <section className="feature-module order-module" aria-label="订单预览">
          <header className="module-header">
            <h2>订单预览</h2>
          </header>
          <GroceryOptionCards options={options} onPreview={previewOption} />
        </section>
      </div>

      {pendingConfirmation && currentPreview ? (
        <ConfirmDialog
          preview={currentPreview}
          busy={busyConfirming}
          onConfirm={confirmOrder}
          onCancel={clearPreview}
        />
      ) : null}
      {historyOpen ? (
        <OrderHistoryDialog
          history={orderHistory}
          selectedOrderId={selectedHistoryRecord?.order.order_id}
          onSelect={selectHistoryOrder}
          onClose={() => setHistoryOpen(false)}
        />
      ) : null}
      {cancelDialogOpen ? (
        <CancelOrderDialog
          activeOrders={activeOrders}
          confirmTarget={cancelTarget}
          onChoose={chooseCancelOrder}
          onConfirm={confirmCancelOrder}
          onBack={() => setCancelTargetOrderId(undefined)}
          onClose={() => {
            setCancelTargetOrderId(undefined);
            setCancelDialogOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}

function statusText(status: string) {
  if (status === "idle") return "待机中";
  if (status === "starting") return "连接中";
  if (status === "connected") return "通话中";
  if (status === "stopped") return "已停止";
  if (status === "error") return "需要处理";
  return status;
}

function isStopTalkingIntent(text: string) {
  const normalized = normalizeIntentText(text);
  return (
    /(停止|停下|别说|不要说|不用说|先不说|安静|闭嘴|别讲|不要讲)/.test(normalized) &&
    /(说话|讲话|回复|回答|出声|声音|麦豆|你)/.test(normalized)
  );
}

function isCancelOrderIntent(text: string) {
  const normalized = normalizeIntentText(text);
  return /(取消|退掉|撤销|不要了|不要这个|不要这单|取消订单|退单)/.test(normalized) && /(订单|这单|买菜|配送|骑手|送达|菜|肉|蛋|奶|水果)/.test(normalized);
}

function isGenericCancelOrderIntent(text: string) {
  const normalized = normalizeIntentText(text);
  return /(取消|退掉|撤销|不要了|不要这单|取消订单|退单)/.test(normalized);
}

function orderMatchesText(record: OrderHistoryRecord, text: string) {
  const normalized = normalizeIntentText(text);
  return record.preview.items.some((item) => {
    const name = normalizeIntentText(String(item.name ?? ""));
    return name.length > 0 && normalized.includes(name);
  });
}

function normalizeIntentText(text: string) {
  return text.replace(/\s+/g, "").replace(/[，。！？,.!?]/g, "").toLowerCase();
}
