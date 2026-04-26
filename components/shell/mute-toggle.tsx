"use client";

// Global mute toggle. Lives in the topnav (and optionally elsewhere) and
// flips the `lib/sounds` mute flag, which silences both the Web-Audio SFX
// (`playSend`/`playReceive`/etc.) and the ElevenLabs TTS narration handled
// in `lib/speech`.
//
// Multiple instances stay in sync via `subscribeMuted` — toggling in the
// topnav updates the icon on the onboarding-page copy and vice versa.

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { ActionButton } from "@/components/design-system";
import { isMuted, setMuted, subscribeMuted } from "@/lib/sounds";

export function MuteToggle({ className = "" }: { className?: string }) {
  const [muted, setMutedState] = useState(() => isMuted());

  useEffect(() => {
    return subscribeMuted((next) => setMutedState(next));
  }, []);

  const handleToggle = () => {
    setMuted(!muted);
  };

  return (
    <ActionButton
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      aria-label={muted ? "Unmute Scout" : "Mute Scout"}
      title={muted ? "Sound off" : "Sound on"}
      className={className}
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </ActionButton>
  );
}
