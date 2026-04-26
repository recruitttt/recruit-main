import { RoomCanvasClient } from "@/components/room/room-canvas-client";

export const metadata = {
  title: "Digital twin · Recruit",
  description: "Live 3D view of your agent squad working in parallel.",
};

export default function ThreeDPage() {
  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-6">
      <div className="mb-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#6B7A90]">
          Live · pipeline view
        </div>
        <h1 className="mt-1 font-serif text-3xl leading-tight text-[#101827]">Digital twin</h1>
      </div>
      <RoomCanvasClient />
    </div>
  );
}
