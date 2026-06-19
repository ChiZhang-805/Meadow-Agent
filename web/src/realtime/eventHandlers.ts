import type { RealtimeToolCall } from "./toolBridge";

interface RealtimeEventHandlerParams {
  addEventLog: (line: string) => void;
  addTranscriptBubble: (text: string) => void;
  appendAiReplyDelta: (text: string) => void;
  finishAiReplyBubble: () => void;
  onUserTranscript: (text: string) => void;
  onUserTurnFinished: () => void;
  onAssistantSpeakingChange: (speaking: boolean) => void;
  onToolCall: (call: RealtimeToolCall) => void;
}

export function createRealtimeEventHandler(params: RealtimeEventHandlerParams) {
  return (event: Record<string, any>) => {
    const type = String(event.type ?? "unknown");
    params.addEventLog(type);

    if (isAssistantSpeakingStart(type)) {
      params.onAssistantSpeakingChange(true);
    }

    if (type === "input_audio_buffer.speech_stopped") {
      params.onUserTurnFinished();
    }

    if (type === "conversation.item.input_audio_transcription.completed" && typeof event.transcript === "string") {
      params.addTranscriptBubble(event.transcript);
      params.onUserTranscript(event.transcript);
    }

    if (
      (type === "response.output_text.delta" || type === "response.text.delta") &&
      typeof event.delta === "string"
    ) {
      params.appendAiReplyDelta(event.delta);
    }

    if (
      (type === "response.output_audio_transcript.delta" || type === "response.audio_transcript.delta") &&
      typeof event.delta === "string"
    ) {
      params.appendAiReplyDelta(event.delta);
    }

    if (
      type === "response.output_text.done" ||
      type === "response.text.done" ||
      type === "response.output_audio_transcript.done" ||
      type === "response.audio_transcript.done" ||
      type === "response.done" ||
      (type === "response.output_item.done" && event.item?.type === "message")
    ) {
      params.finishAiReplyBubble();
    }

    if (isAssistantSpeakingEnd(type)) {
      params.onAssistantSpeakingChange(false);
    }

    const directToolCall = extractToolCall(event);
    if (directToolCall) {
      params.onToolCall(directToolCall);
    }
  };
}

function isAssistantSpeakingStart(type: string) {
  return (
    type === "input_audio_buffer.committed" ||
    type === "response.created" ||
    type === "response.output_item.added" ||
    type === "response.output_item.created" ||
    type === "response.content_part.added" ||
    type === "output_audio_buffer.started" ||
    type === "response.output_audio.delta" ||
    type === "response.audio.delta" ||
    type === "response.output_audio.started" ||
    type === "response.output_audio_transcript.delta" ||
    type === "response.audio_transcript.delta"
  );
}

function isAssistantSpeakingEnd(type: string) {
  return (
    type === "response.output_audio.done" ||
    type === "response.audio.done" ||
    type === "response.audio_transcript.done" ||
    type === "output_audio_buffer.stopped" ||
    type === "response.done" ||
    type === "response.cancelled" ||
    type === "response.failed"
  );
}

function extractToolCall(event: Record<string, any>): RealtimeToolCall | null {
  if (
    event.type === "response.function_call_arguments.done" &&
    event.call_id &&
    event.name &&
    typeof event.arguments === "string"
  ) {
    return {
      callId: String(event.call_id),
      name: String(event.name),
      arguments: event.arguments
    };
  }

  const item = event.item;
  if (event.type === "response.output_item.done" && item?.type === "function_call" && item.call_id && item.name) {
    return {
      callId: String(item.call_id),
      name: String(item.name),
      arguments: String(item.arguments ?? "{}")
    };
  }

  return null;
}
