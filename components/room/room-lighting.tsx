"use client";

export function RoomLighting() {
  return (
    <>
      <ambientLight intensity={0.5} color="#FBF4E5" />
      <hemisphereLight args={["#FFF2D8", "#C9D4DC", 0.35]} position={[0, 8, 0]} />
      <directionalLight
        position={[6, 9, 5]}
        intensity={1}
        color="#FFE9C2"
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-bias={-0.0005}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={0.5}
        shadow-camera-far={28}
      />
      <directionalLight position={[-7, 6, -4]} intensity={0.35} color="#B8CFE4" />
      <pointLight position={[0, 3.5, 2.6]} intensity={0.65} distance={10} decay={2} color="#FFD7A0" />
    </>
  );
}
