"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { ActionButton } from "@/components/design-system";
import { isMuted, setMuted } from "@/lib/sounds";

export function SoundToggle() {
  // Hydrate from the lib/sounds in-memory mute flag (which itself reads
  // localStorage on first call). We snapshot once on mount.
  const [muted, setMutedState] = useState(false);

  // Hydrate from the in-memory mute flag (which reads localStorage). The
  // setState here is a one-shot post-mount sync; lint allows it because we
  // are reflecting an external (browser-only) source into render state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMutedState(isMuted()); }, []);

  const handleToggle = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  return (
    <ActionButton
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      aria-label={muted ? "Unmute Scout sounds" : "Mute Scout sounds"}
      title={muted ? "Sounds off" : "Sounds on"}
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </ActionButton>
  );
}
