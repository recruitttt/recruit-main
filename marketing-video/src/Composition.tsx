import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { PaperBackground } from "./components/PaperBackground";
import { Caption } from "./components/Caption";
import { IntroScene } from "./scenes/IntroScene";
import { PasteScene } from "./scenes/PasteScene";
import { TailorScene } from "./scenes/TailorScene";
import { ApplyScene } from "./scenes/ApplyScene";
import { OutroScene } from "./scenes/OutroScene";
import { SCENES, theme } from "./theme";

const len = (s: { start: number; end: number }) => s.end - s.start;

export const HeroVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: theme.paper }}>
      <PaperBackground />

      <Sequence from={SCENES.intro.start} durationInFrames={len(SCENES.intro)}>
        <IntroScene />
      </Sequence>
      <Sequence from={SCENES.paste.start} durationInFrames={len(SCENES.paste)}>
        <PasteScene />
      </Sequence>
      <Sequence from={SCENES.tailor.start} durationInFrames={len(SCENES.tailor)}>
        <TailorScene />
      </Sequence>
      <Sequence from={SCENES.apply.start} durationInFrames={len(SCENES.apply)}>
        <ApplyScene />
      </Sequence>
      <Sequence from={SCENES.outro.start} durationInFrames={len(SCENES.outro)}>
        <OutroScene />
      </Sequence>

      <Sequence from={SCENES.intro.start + 18} durationInFrames={60}>
        <Caption text="Apply while you sleep." />
      </Sequence>
      <Sequence from={SCENES.paste.start + 12} durationInFrames={90}>
        <Caption text="Paste any job." />
      </Sequence>
      <Sequence from={SCENES.tailor.start + 18} durationInFrames={120}>
        <Caption text="AI tailors your resume." />
      </Sequence>
      <Sequence from={SCENES.apply.start + 12} durationInFrames={90}>
        <Caption text="Auto-applies for you." />
      </Sequence>
      <Sequence from={SCENES.outro.start + 30} durationInFrames={75}>
        <Caption text="Recruit." emphasis />
      </Sequence>

      <Audio src={staticFile("ambient.mp3")} volume={0.45} />
    </AbsoluteFill>
  );
};
