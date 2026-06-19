import { create } from "zustand";

export type VoiceStatus = "idle" | "starting" | "connected" | "stopped" | "error";
export type VoiceBubbleRole = "elder" | "meadow";

export interface VoiceBubble {
  id: string;
  role: VoiceBubbleRole;
  text: string;
  complete: boolean;
}

interface VoiceState {
  status: VoiceStatus;
  eventLog: string[];
  transcriptBubbles: VoiceBubble[];
  aiReplyBubbles: VoiceBubble[];
  lastError?: string;
  setStatus: (status: VoiceStatus) => void;
  addEventLog: (line: string) => void;
  addTranscriptBubble: (text: string) => void;
  appendAiReplyDelta: (text: string) => void;
  finishAiReplyBubble: () => void;
  clearConversation: () => void;
  setError: (message: string) => void;
}

function makeBubbleId(role: VoiceBubbleRole) {
  return `${role}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  status: "idle",
  eventLog: [],
  transcriptBubbles: [],
  aiReplyBubbles: [],
  setStatus: (status) => set({ status, lastError: undefined }),
  addEventLog: (line) =>
    set((state) => ({
      eventLog: [`${new Date().toLocaleTimeString()} ${line}`, ...state.eventLog].slice(0, 80)
    })),
  addTranscriptBubble: (text) =>
    set((state) => ({
      transcriptBubbles: [
        ...state.transcriptBubbles,
        {
          id: makeBubbleId("elder"),
          role: "elder",
          text: text.trim(),
          complete: true
        } satisfies VoiceBubble
      ]
        .filter((bubble) => bubble.text.length > 0)
        .slice(-40)
    })),
  appendAiReplyDelta: (text) =>
    set((state) => ({
      aiReplyBubbles: appendDeltaToLastBubble(state.aiReplyBubbles, text)
    })),
  finishAiReplyBubble: () =>
    set((state) => ({
      aiReplyBubbles: state.aiReplyBubbles.map((bubble, index) =>
        index === state.aiReplyBubbles.length - 1 ? { ...bubble, complete: true } : bubble
      )
    })),
  clearConversation: () => set({ transcriptBubbles: [], aiReplyBubbles: [], eventLog: [] }),
  setError: (message) => set({ status: "error", lastError: message })
}));

function appendDeltaToLastBubble(bubbles: VoiceBubble[], text: string): VoiceBubble[] {
  if (!text) return bubbles;
  const last = bubbles[bubbles.length - 1];
  if (!last || last.complete) {
    return [
      ...bubbles,
      {
        id: makeBubbleId("meadow"),
        role: "meadow",
        text,
        complete: false
      } satisfies VoiceBubble
    ].slice(-40);
  }

  return bubbles.map((bubble, index) =>
    index === bubbles.length - 1 ? { ...bubble, text: `${bubble.text}${text}`.slice(-3000) } : bubble
  );
}
