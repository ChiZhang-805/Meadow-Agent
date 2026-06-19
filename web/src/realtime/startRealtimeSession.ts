import { apiUrl } from "../api/client";

export interface RealtimeSessionHandle {
  pc: RTCPeerConnection;
  dc: RTCDataChannel;
  localStream: MediaStream;
  stop: () => void;
  setInputMuted: (muted: boolean) => void;
  pauseInputCapture: () => void;
  suspendInput: (options?: { clearBuffer?: boolean }) => void;
  resumeInput: () => void;
  clearInputAudioBuffer: () => void;
  sendContext: (text: string) => void;
  sendText: (text: string) => void;
}

const NO_INTERRUPT_TURN_DETECTION = {
  type: "server_vad",
  threshold: 0.6,
  prefix_padding_ms: 300,
  silence_duration_ms: 700,
  create_response: true,
  interrupt_response: false
} as const;

export async function startRealtimeSession(params: {
  userId: string;
  onEvent: (event: Record<string, unknown>) => void;
  onRemoteAudioStream: (stream: MediaStream) => void;
  onDataChannelOpen?: () => void;
}): Promise<RealtimeSessionHandle> {
  const tokenResponse = await fetch(apiUrl("/api/realtime/token"), {
    method: "POST",
    headers: { "X-User-Id": params.userId }
  });

  if (!tokenResponse.ok) {
    const detail = await tokenResponse.text();
    throw new Error(`Failed to create realtime token: ${tokenResponse.status} ${detail}`);
  }

  const tokenData = await tokenResponse.json();
  const ephemeralKey = tokenData.value ?? tokenData.client_secret?.value;

  if (!ephemeralKey) {
    throw new Error("Realtime token response does not contain a client secret value");
  }

  const pc = new RTCPeerConnection();
  let localStream: MediaStream | null = null;

  try {
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) params.onRemoteAudioStream(stream);
    };

    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });

    const [localAudioTrack] = localStream.getAudioTracks();
    const audioSender = localAudioTrack ? pc.addTrack(localAudioTrack, localStream) : null;
    let microphoneAttached = true;
    let microphoneSwitchId = 0;

    const dc = pc.createDataChannel("oai-events");
    dc.addEventListener("open", () => {
      sendTurnDetectionUpdate(dc, NO_INTERRUPT_TURN_DETECTION);
      params.onDataChannelOpen?.();
    });
    dc.addEventListener("message", (event) => {
      try {
        params.onEvent(JSON.parse(event.data));
      } catch {
        params.onEvent({ type: "client.unparsed_event", raw: String(event.data) });
      }
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${ephemeralKey}`,
        "Content-Type": "application/sdp"
      }
    });

    if (!sdpResponse.ok) {
      const detail = await sdpResponse.text();
      throw new Error(`Realtime SDP failed: ${sdpResponse.status} ${detail}`);
    }

    await pc.setRemoteDescription({
      type: "answer",
      sdp: await sdpResponse.text()
    });

    function setMicrophoneAttached(attached: boolean) {
      localStream?.getAudioTracks().forEach((track) => {
        track.enabled = attached;
      });

      if (!audioSender || microphoneAttached === attached) return;
      microphoneAttached = attached;
      const switchId = ++microphoneSwitchId;
      void audioSender.replaceTrack(attached ? localAudioTrack : null).catch(() => {
        if (switchId === microphoneSwitchId) {
          microphoneAttached = !attached;
        }
      });
    }

    function clearInputAudioBuffer() {
      if (dc.readyState !== "open") return;
      dc.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
    }

    function pauseInputCapture() {
      setMicrophoneAttached(false);
    }

    function suspendInput(options: { clearBuffer?: boolean } = {}) {
      pauseInputCapture();
      sendTurnDetectionUpdate(dc, null);
      if (options.clearBuffer ?? true) {
        clearInputAudioBuffer();
      }
    }

    function resumeInput() {
      clearInputAudioBuffer();
      sendTurnDetectionUpdate(dc, NO_INTERRUPT_TURN_DETECTION);
      setMicrophoneAttached(true);
    }

    return {
      pc,
      dc,
      localStream,
      stop() {
        localStream?.getTracks().forEach((track) => track.stop());
        pc.close();
      },
      setInputMuted(muted: boolean) {
        if (muted) {
          pauseInputCapture();
        } else {
          resumeInput();
        }
      },
      pauseInputCapture,
      suspendInput,
      resumeInput,
      clearInputAudioBuffer,
      sendContext(text: string) {
        sendUserTextItem(dc, text);
      },
      sendText(text: string) {
        if (dc.readyState !== "open") return;
        sendUserTextItem(dc, text);
        dc.send(JSON.stringify({ type: "response.create" }));
      }
    };
  } catch (error) {
    localStream?.getTracks().forEach((track) => track.stop());
    pc.close();
    throw error;
  }
}

function sendUserTextItem(dc: RTCDataChannel, text: string) {
  if (dc.readyState !== "open") return;
  dc.send(
    JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }]
      }
    })
  );
}

function sendTurnDetectionUpdate(
  dc: RTCDataChannel,
  turnDetection: typeof NO_INTERRUPT_TURN_DETECTION | null
) {
  if (dc.readyState !== "open") return;
  dc.send(
    JSON.stringify({
      type: "session.update",
      session: {
        type: "realtime",
        audio: {
          input: {
            turn_detection: turnDetection
          }
        }
      }
    })
  );
}
