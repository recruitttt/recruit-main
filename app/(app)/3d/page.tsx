import { RoomCanvasClient } from "@/components/room/room-canvas-client";
import { RoomHud } from "./_hud";

export const metadata = {
  title: "The room · Recruit",
  description: "Live 3D view of your agent squad working in parallel.",
};

export default function ThreeDPage() {
  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-6">
      <RoomHud />
      <RoomCanvasClient />
    </div>
  );
}
