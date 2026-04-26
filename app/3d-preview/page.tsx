import { RoomCanvasClient } from "@/components/room/room-canvas-client";

export const metadata = {
  title: "3D room preview · Recruit",
  description: "Unauthenticated local preview of the Recruit 3D room.",
};

export default function ThreeDPreviewPage() {
  return (
    <main className="min-h-screen bg-[#F2EEE5] px-4 py-4 md:px-6">
      <div className="mx-auto flex h-[calc(100vh-32px)] min-h-[560px] max-w-[1500px] flex-col">
        <div className="mb-4 shrink-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#6B7A90]">
            Local preview · no auth
          </div>
          <h1 className="mt-1 font-serif text-3xl leading-tight text-[#101827]">
            The room
          </h1>
        </div>
        <div className="min-h-0 flex-1">
          <RoomCanvasClient userId={null} />
        </div>
      </div>
    </main>
  );
}
