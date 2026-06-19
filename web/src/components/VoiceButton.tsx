import type { LucideIcon } from "lucide-react";

interface VoiceButtonProps {
  label: string;
  icon: LucideIcon;
  tone: "primary" | "neutral" | "danger";
  disabled?: boolean;
  onClick: () => void;
}

export function VoiceButton({ label, icon: Icon, tone, disabled, onClick }: VoiceButtonProps) {
  return (
    <button className={`voice-button voice-button-${tone}`} disabled={disabled} onClick={onClick} title={label}>
      <Icon aria-hidden="true" size={34} strokeWidth={2.4} />
      <span>{label}</span>
    </button>
  );
}
