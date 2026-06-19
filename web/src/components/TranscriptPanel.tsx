import { Bot, UserRound } from "lucide-react";
import { useEffect, useRef } from "react";

import type { VoiceBubble } from "../store/useVoiceStore";

interface TranscriptPanelProps {
  title: string;
  placeholder: string;
  bubbles: VoiceBubble[];
}

export function TranscriptPanel({ title, bubbles, placeholder }: TranscriptPanelProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    window.requestAnimationFrame(() => {
      list.scrollTop = list.scrollHeight;
    });
  }, [bubbles]);

  return (
    <section className="transcript-panel" aria-label={title}>
      <h2>{title}</h2>
      <div className="bubble-list" ref={listRef}>
        {bubbles.length === 0 ? <p className="bubble-placeholder">{placeholder}</p> : null}
        {bubbles.map((bubble) => (
          <article className={`chat-bubble chat-bubble-${bubble.role}`} key={bubble.id}>
            <span className="bubble-avatar" aria-hidden="true">
              {bubble.role === "meadow" ? <Bot size={22} /> : <UserRound size={22} />}
            </span>
            <p>{bubble.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
