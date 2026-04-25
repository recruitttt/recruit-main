import { Composition } from "remotion";
import { HeroVideo } from "./Composition";
import { DURATION_FRAMES, FPS, HEIGHT, WIDTH } from "./theme";

export const Root: React.FC = () => {
  return (
    <Composition
      id="HeroVideo"
      component={HeroVideo}
      durationInFrames={DURATION_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
