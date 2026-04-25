"use client";

import { useCallback, useEffect } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useRoomStore } from "./room-store";
import type { FocusTarget } from "./room-store";

type Props = {
  target: FocusTarget;
  hotspotKey: string;
  size?: readonly [number, number, number];
  position?: readonly [number, number, number];
  children?: React.ReactNode;
};

const DEFAULT_SIZE = [1.6, 2.0, 1.6] as const;

export function InteractiveHotspot({
  target,
  hotspotKey,
  size = DEFAULT_SIZE,
  position = [0, 1, 0],
  children,
}: Props) {
  const setHoveredObject = useRoomStore((s) => s.setHoveredObject);
  const setFocusTarget = useRoomStore((s) => s.setFocusTarget);

  const onPointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      document.body.style.cursor = "pointer";
      setHoveredObject(hotspotKey);
    },
    [hotspotKey, setHoveredObject],
  );

  const onPointerOut = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      document.body.style.cursor = "auto";
      setHoveredObject(null);
    },
    [setHoveredObject],
  );

  const onClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      setFocusTarget(target);
    },
    [target, setFocusTarget],
  );

  useEffect(() => {
    return () => {
      document.body.style.cursor = "auto";
    };
  }, []);

  return (
    <group position={position as [number, number, number]}>
      <mesh
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onClick={onClick}
      >
        <boxGeometry args={size as [number, number, number]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      {children}
    </group>
  );
}
