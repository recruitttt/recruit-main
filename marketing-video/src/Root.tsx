import { Composition } from "remotion";
import { HeroVideo } from "./Composition";
import { ApplyClip, DiscoverClip, TailorClip } from "./scenes/ExplainerClips";
import { CLIP_DURATION_FRAMES, DURATION_FRAMES, FPS, HEIGHT, WIDTH } from "./theme";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="DiscoverClip"
        component={DiscoverClip}
        durationInFrames={CLIP_DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="TailorClip"
        component={TailorClip}
        durationInFrames={CLIP_DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="ApplyClip"
        component={ApplyClip}
        durationInFrames={CLIP_DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="HeroVideo"
        component={HeroVideo}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
