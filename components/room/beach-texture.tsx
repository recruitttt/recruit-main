"use client";

import { useMemo } from "react";
import * as THREE from "three";

const W = 2048;
const H = 384;

let cached: THREE.CanvasTexture | null = null;

function buildBeachTexture(): THREE.CanvasTexture {
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const skyH = Math.floor(H * 0.55);
  const sky = ctx.createLinearGradient(0, 0, 0, skyH);
  sky.addColorStop(0, "#8FBFEA");
  sky.addColorStop(0.45, "#B9D6EC");
  sky.addColorStop(0.85, "#E4EEF2");
  sky.addColorStop(1, "#F5F1E2");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, skyH);

  const sunCX = W * 0.74;
  const sunCY = skyH * 0.28;
  const sunGlow = ctx.createRadialGradient(sunCX, sunCY, 8, sunCX, sunCY, 140);
  sunGlow.addColorStop(0, "rgba(255, 250, 230, 0.95)");
  sunGlow.addColorStop(0.35, "rgba(255, 245, 215, 0.4)");
  sunGlow.addColorStop(1, "rgba(255, 245, 215, 0)");
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, W, skyH);
  ctx.beginPath();
  ctx.arc(sunCX, sunCY, 24, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFBEF";
  ctx.fill();

  const clouds = [
    { x: 120, y: 90, r: 54, a: 0.82 },
    { x: 420, y: 60, r: 38, a: 0.7 },
    { x: 720, y: 110, r: 62, a: 0.78 },
    { x: 1020, y: 70, r: 46, a: 0.72 },
    { x: 1340, y: 98, r: 58, a: 0.82 },
    { x: 1620, y: 54, r: 40, a: 0.68 },
    { x: 1900, y: 110, r: 52, a: 0.78 },
  ];
  for (const c of clouds) {
    drawCloud(ctx, c.x, c.y, c.r, c.a);
  }

  ctx.fillStyle = "rgba(120, 150, 140, 0.35)";
  drawHills(ctx, skyH);

  const oceanY = skyH;
  const oceanH = Math.floor(H * 0.22);
  const ocean = ctx.createLinearGradient(0, oceanY, 0, oceanY + oceanH);
  ocean.addColorStop(0, "#4B94BE");
  ocean.addColorStop(0.35, "#3A7AA4");
  ocean.addColorStop(0.75, "#2A6088");
  ocean.addColorStop(1, "#1E4A6B");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, oceanY, W, oceanH);

  const haze = ctx.createLinearGradient(0, oceanY - 4, 0, oceanY + 6);
  haze.addColorStop(0, "rgba(230, 240, 245, 0.85)");
  haze.addColorStop(1, "rgba(230, 240, 245, 0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, oceanY - 4, W, 12);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
  ctx.lineWidth = 1.1;
  for (let row = 0; row < 8; row++) {
    const y = oceanY + 10 + row * 9;
    ctx.beginPath();
    let x = (row * 73) % 60;
    while (x < W) {
      const w = 20 + (row * 13) % 30;
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      x += w + 36 + (row * 7) % 40;
    }
    ctx.stroke();
  }

  const shimmer = ctx.createRadialGradient(sunCX, oceanY + 22, 6, sunCX, oceanY + 22, 130);
  shimmer.addColorStop(0, "rgba(255, 248, 220, 0.55)");
  shimmer.addColorStop(1, "rgba(255, 248, 220, 0)");
  ctx.fillStyle = shimmer;
  ctx.fillRect(sunCX - 160, oceanY, 320, 80);

  const sandY = oceanY + oceanH;
  const sand = ctx.createLinearGradient(0, sandY, 0, H);
  sand.addColorStop(0, "#F0DDA6");
  sand.addColorStop(0.4, "#E4CB88");
  sand.addColorStop(1, "#C9AD68");
  ctx.fillStyle = sand;
  ctx.fillRect(0, sandY, W, H - sandY);

  const wet = ctx.createLinearGradient(0, sandY, 0, sandY + 14);
  wet.addColorStop(0, "rgba(120, 94, 54, 0.7)");
  wet.addColorStop(1, "rgba(120, 94, 54, 0)");
  ctx.fillStyle = wet;
  ctx.fillRect(0, sandY, W, 16);

  ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
  drawFoam(ctx, sandY);

  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = `rgba(175, 145, 95, ${0.14 + (i % 3) * 0.04})`;
    ctx.beginPath();
    ctx.ellipse(60 + i * 120, sandY + 30 + (i * 17) % 40, 90 + (i * 23) % 80, 10 + (i * 11) % 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPalm(ctx, 210, H - 22, 170);
  drawPalm(ctx, 1280, H - 12, 200);
  drawPalm(ctx, 1760, H - 18, 150);

  ctx.fillStyle = "#8B6D44";
  for (let i = 0; i < 12; i++) {
    const x = (i * 173 + 90) % W;
    const y = sandY + 32 + ((i * 41) % 30);
    ctx.beginPath();
    ctx.ellipse(x, y, 3, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(60, 60, 68, 0.6)";
  ctx.lineWidth = 1.4;
  const birds = [
    { x: 560, y: 70 }, { x: 600, y: 92 }, { x: 1480, y: 50 }, { x: 1830, y: 96 },
  ];
  for (const b of birds) {
    ctx.beginPath();
    ctx.moveTo(b.x - 7, b.y + 3);
    ctx.quadraticCurveTo(b.x - 3, b.y - 2, b.x, b.y + 2);
    ctx.quadraticCurveTo(b.x + 3, b.y - 2, b.x + 7, b.y + 3);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  cached = tex;
  return tex;
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
  ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.7, r * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.35, y - r * 0.1, r * 0.55, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - r * 0.3, y - r * 0.04, r * 0.44, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, a - 0.12)})`;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.12, r * 0.68, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawHills(ctx: CanvasRenderingContext2D, horizonY: number) {
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  ctx.quadraticCurveTo(120, horizonY - 22, 230, horizonY - 8);
  ctx.quadraticCurveTo(320, horizonY - 26, 440, horizonY - 4);
  ctx.lineTo(440, horizonY);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(900, horizonY);
  ctx.quadraticCurveTo(1020, horizonY - 18, 1150, horizonY - 10);
  ctx.lineTo(1150, horizonY);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(1620, horizonY);
  ctx.quadraticCurveTo(1720, horizonY - 20, 1840, horizonY - 6);
  ctx.quadraticCurveTo(1940, horizonY - 24, 2048, horizonY - 2);
  ctx.lineTo(2048, horizonY);
  ctx.closePath();
  ctx.fill();
}

function drawFoam(ctx: CanvasRenderingContext2D, shoreY: number) {
  ctx.beginPath();
  ctx.moveTo(0, shoreY + 2);
  for (let x = 0; x <= W; x += 40) {
    const y = shoreY + 2 + Math.sin(x * 0.03) * 3 + Math.sin(x * 0.07) * 2;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, shoreY + 12);
  for (let x = W; x >= 0; x -= 40) {
    const y = shoreY + 10 + Math.sin(x * 0.04 + 1) * 3;
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawPalm(ctx: CanvasRenderingContext2D, baseX: number, baseY: number, height: number) {
  ctx.strokeStyle = "#3F2D1F";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.bezierCurveTo(baseX + 14, baseY - height * 0.35, baseX - 10, baseY - height * 0.7, baseX + 6, baseY - height);
  ctx.stroke();
  ctx.strokeStyle = "rgba(32, 22, 14, 0.6)";
  ctx.lineWidth = 1.6;
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    const x = baseX + (14 * t - 10 * t * t + 6 * t * t * t);
    const y = baseY - height * t;
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x + 4, y);
    ctx.stroke();
  }
  const crownX = baseX + 6;
  const crownY = baseY - height;
  ctx.fillStyle = "#251810";
  ctx.beginPath();
  ctx.ellipse(crownX, crownY, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  const fronds = [
    { dx: -110, dy: -10, c: "#1F4A28", w: 6 },
    { dx: 100, dy: -18, c: "#265A30", w: 6 },
    { dx: -82, dy: -54, c: "#2A5A2F", w: 5 },
    { dx: 74, dy: -58, c: "#1F4A28", w: 5 },
    { dx: -20, dy: -78, c: "#2F6835", w: 5 },
    { dx: 40, dy: -36, c: "#193F20", w: 5 },
    { dx: -58, dy: 14, c: "#194220", w: 5 },
    { dx: 66, dy: 10, c: "#265A30", w: 5 },
  ];
  for (const f of fronds) {
    ctx.strokeStyle = f.c;
    ctx.lineWidth = f.w;
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(crownX + f.dx * 0.5, crownY + f.dy * 0.6, crownX + f.dx, crownY + f.dy);
    ctx.stroke();
    ctx.strokeStyle = f.c;
    ctx.lineWidth = 1.8;
    for (let i = 1; i <= 6; i++) {
      const t = i / 6;
      const tx = crownX + f.dx * t;
      const ty = crownY + f.dy * t - 2;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + (f.dx > 0 ? -2 : 2), ty + 14);
      ctx.stroke();
    }
  }
  ctx.fillStyle = "#3E2D1E";
  ctx.beginPath();
  ctx.arc(crownX - 4, crownY + 4, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(crownX + 3, crownY + 7, 5, 0, Math.PI * 2);
  ctx.fill();
}

export function useBeachTexture() {
  return useMemo(() => buildBeachTexture(), []);
}
