"use client";

// Re-export the global MuteToggle under its legacy name so onboarding callers
// keep working. The implementation now lives in `components/shell/mute-toggle`
// because the same control is reused in the topnav; both instances share state
// via `subscribeMuted` in `lib/sounds`.

export { MuteToggle as SoundToggle } from "@/components/shell/mute-toggle";
