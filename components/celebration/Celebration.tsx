"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { WrapStyle } from "@/lib/wraps";

export interface CelebrationHandle {
  /** Celebrate from this point on screen (the opened wrap). */
  fire(x: number, y: number): void;
}

/** Vibrate where the device allows it. iOS Safari has no vibration, so it's simply skipped. */
export function haptic(pattern: number | number[]) {
  try {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    // Some browsers throw when vibration is blocked by policy.
  }
}

/* ---------------------------------------------------------------- Moods */

type Shape = "rect" | "strip" | "circle" | "scrap";
interface Swatch {
  front: string;
  back: string;
  /** Foil catches the light: a bright glint when it faces you. */
  metal?: boolean;
  weight: number;
}
interface Mood {
  swatches: Swatch[];
  shapes: [Shape, number][];
  slow: "sparkle" | "streamer" | "mote";
  slowColors: string[];
}

/** Colours come from the tokens in globals.css, read once per celebration. */
function moodFor(kind: WrapStyle): Mood {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(`--${name}`).trim();
  if (kind === "envelope") {
    return {
      swatches: [
        { front: v("ink-blue"), back: v("graphite"), weight: 3 },
        { front: v("paper"), back: v("paper-shade"), weight: 4 },
        { front: v("kraft"), back: v("paper-shade"), weight: 3 },
        { front: v("wax-light"), back: v("wax"), weight: 1 },
      ],
      shapes: [
        ["scrap", 55],
        ["strip", 35],
        ["rect", 10],
      ],
      slow: "streamer",
      slowColors: [v("paper"), v("kraft"), v("paper-shade")],
    };
  }
  if (kind === "ticket") {
    return {
      swatches: [
        { front: v("silver-light"), back: v("silver-dark"), metal: true, weight: 4 },
        { front: v("stock"), back: v("stock-shade"), weight: 3 },
        { front: v("silver"), back: v("graphite"), metal: true, weight: 2 },
        { front: v("graphite"), back: v("graphite"), weight: 1 },
      ],
      shapes: [
        ["circle", 75],
        ["rect", 25],
      ],
      slow: "mote",
      slowColors: [v("silver-light"), v("silver")],
    };
  }
  return {
    swatches: [
      { front: v("gold-light"), back: v("gold-dark"), metal: true, weight: 4 },
      { front: v("ivory"), back: v("ivory-edge"), weight: 3 },
      { front: v("gold"), back: v("gold-dark"), metal: true, weight: 3 },
      { front: v("accent"), back: v("gold-dark"), metal: true, weight: 1 },
    ],
    shapes: [
      ["rect", 60],
      ["strip", 25],
      ["circle", 15],
    ],
    slow: "sparkle",
    slowColors: [v("gold-light"), v("ivory")],
  };
}

function pick<T>(items: [T, number][]): T {
  const total = items.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [item, w] of items) {
    roll -= w;
    if (roll <= 0) return item;
  }
  return items[0][0];
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/* -------------------------------------------------------------- Physics */

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  shape: Shape;
  swatch: Swatch;
  /** Rotation about the screen axis, and tumbling about the piece's own two axes (3D). */
  rz: number;
  tiltX: number;
  tiltY: number;
  vrz: number;
  vTiltX: number;
  vTiltY: number;
  drag: number;
  flutter: number;
  flutterSpeed: number;
  flutterForce: number;
  born: number;
  /** For scraps: a slightly uneven quad, like torn paper. */
  corners?: number[];
}

interface Floater {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  born: number;
  life: number;
  phase: number;
  spin: number;
  angle: number;
}

const GRAVITY = 1150; // px/s²
const CONFETTI_FADE_AT = 1.85; // s
const CONFETTI_END = 2.55; // s
const ALL_END = 2.75; // s

/**
 * The celebration after a wrap opens: a burst of light from the wrap, confetti
 * with real physics on one canvas, then a few slow floating pieces that fade.
 * About 2.5s, then the canvas is cleared and the loop stops.
 */
export function Celebration({ kind, ref }: { kind: WrapStyle; ref?: Ref<CelebrationHandle> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const burstRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => () => stopRef.current(), []);

  useImperativeHandle(
    ref,
    () => ({
      fire(originX, originY) {
        // The peak of the moment: a light double pulse.
        setTimeout(() => haptic([10, 60, 14]), 140);
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const burst = burstRef.current;
        if (burst) {
          burst.style.left = `${originX}px`;
          burst.style.top = `${originY}px`;
          burst.classList.remove("is-bursting");
          void burst.offsetWidth; // restart the animation
          burst.classList.add("is-bursting");
        }

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        stopRef.current();

        const nav = navigator as Navigator & { deviceMemory?: number };
        const lowEnd = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
        const width = window.innerWidth;
        const height = window.innerHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, lowEnd ? 1.25 : 2);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);

        const mood = moodFor(kind);
        const swatchPool = mood.swatches.map((s) => [s, s.weight] as [Swatch, number]);
        const scale = Math.min(1.15, Math.max(0.75, height / 850));
        const pieces: Piece[] = [];
        const floaters: Floater[] = [];

        const spawnPiece = (born: number, power: number) => {
          const shape = pick(mood.shapes);
          const angle = -Math.PI / 2 + rand(-1.25, 1.25);
          const speed = rand(700, 1450) * power * scale;
          const size = rand(0.8, 1.2);
          const dims: Record<Shape, [number, number]> = {
            rect: [7 * size, 11 * size],
            strip: [3.2 * size, 16 * size],
            circle: [7 * size, 7 * size],
            scrap: [9 * size, 9 * size],
          };
          const [w, h] = dims[shape];
          pieces.push({
            x: originX + rand(-18, 18),
            y: originY + rand(-12, 12),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            w,
            h,
            shape,
            swatch: pick(swatchPool),
            rz: rand(0, Math.PI * 2),
            tiltX: rand(0, Math.PI * 2),
            tiltY: rand(0, Math.PI * 2),
            vrz: rand(-5, 5),
            vTiltX: rand(5, 13) * (Math.random() < 0.5 ? -1 : 1),
            vTiltY: rand(2, 7) * (Math.random() < 0.5 ? -1 : 1),
            drag: shape === "strip" ? rand(2.8, 3.6) : rand(2.2, 3.1),
            flutter: rand(0, Math.PI * 2),
            flutterSpeed: rand(4, 9),
            flutterForce: rand(140, 340),
            born,
            corners: shape === "scrap" ? Array.from({ length: 8 }, () => rand(-0.18, 0.18)) : undefined,
          });
        };

        // Two layers of confetti: the main burst, then a smaller second pop.
        const count = lowEnd ? 55 : 95;
        for (let i = 0; i < Math.round(count * 0.72); i++) spawnPiece(0, 1);
        const second = Math.round(count * 0.28);

        // The slow layer, spread over half a second after the burst.
        const floaterCount = mood.slow === "streamer" ? (lowEnd ? 5 : 7) : lowEnd ? 8 : 13;
        for (let i = 0; i < floaterCount; i++) {
          const streamer = mood.slow === "streamer";
          floaters.push({
            x: originX + rand(-170, 170),
            y: originY + (streamer ? rand(-300, -140) : rand(-200, 40)),
            vx: rand(-14, 14),
            vy: streamer ? rand(45, 85) : rand(-42, -16),
            size: streamer ? rand(34, 54) : mood.slow === "mote" ? rand(1.2, 2.4) : rand(4, 9),
            color: mood.slowColors[i % mood.slowColors.length],
            born: rand(0.22, 0.7),
            life: rand(1.3, 1.9),
            phase: rand(0, Math.PI * 2),
            spin: rand(-1.2, 1.2),
            angle: rand(0, Math.PI * 2),
          });
        }

        let frame = 0;
        let start = 0;
        let last = 0;
        let secondFired = false;

        const draw = (now: number) => {
          if (!start) start = last = now;
          const t = (now - start) / 1000;
          // Real frame time, capped, so a slow phone gets the same motion in fewer frames.
          const dt = Math.min((now - last) / 1000, 1 / 20);
          last = now;

          if (!secondFired && t > 0.11) {
            secondFired = true;
            for (let i = 0; i < second; i++) spawnPiece(t, 0.62);
          }

          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (t > ALL_END) {
            frame = 0;
            return;
          }

          // Confetti
          const fade = t < CONFETTI_FADE_AT ? 1 : Math.max(0, 1 - (t - CONFETTI_FADE_AT) / (CONFETTI_END - CONFETTI_FADE_AT));
          if (fade > 0) {
            for (const p of pieces) {
              if (p.y > height + 40) continue;
              const drag = Math.exp(-p.drag * dt);
              p.flutter += p.flutterSpeed * dt;
              // Air pushes a tumbling piece sideways as it turns: the flutter.
              p.vx = p.vx * drag + Math.sin(p.flutter) * p.flutterForce * dt;
              p.vy = p.vy * drag + GRAVITY * scale * dt * (1 - p.drag / 12);
              p.x += p.vx * dt;
              p.y += p.vy * dt;
              const spinDrag = Math.exp(-0.5 * dt);
              p.rz += p.vrz * dt;
              p.tiltX += p.vTiltX * dt;
              p.tiltY += p.vTiltY * dt;
              p.vrz *= spinDrag;

              const sx = Math.cos(p.tiltY);
              const sy = Math.cos(p.tiltX);
              const facing = sx * sy;
              const cos = Math.cos(p.rz);
              const sin = Math.sin(p.rz);
              const ax = Math.abs(sx) < 0.06 ? 0.06 * Math.sign(sx || 1) : sx;
              const ay = p.shape === "circle" ? 1 : Math.abs(sy) < 0.06 ? 0.06 * Math.sign(sy || 1) : sy;
              ctx.setTransform(cos * ax * dpr, sin * ax * dpr, -sin * ay * dpr, cos * ay * dpr, p.x * dpr, p.y * dpr);

              ctx.beginPath();
              if (p.shape === "circle") {
                ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
              } else if (p.shape === "scrap" && p.corners) {
                const hw = p.w / 2;
                const hh = p.h / 2;
                const c = p.corners;
                ctx.moveTo(-hw * (1 + c[0]), -hh * (1 + c[1]));
                ctx.lineTo(hw * (1 + c[2]), -hh * (1 + c[3]));
                ctx.lineTo(hw * (1 + c[4]), hh * (1 + c[5]));
                ctx.lineTo(-hw * (1 + c[6]), hh * (1 + c[7]));
                ctx.closePath();
              } else {
                ctx.rect(-p.w / 2, -p.h / 2, p.w, p.h);
              }

              ctx.globalAlpha = fade;
              ctx.fillStyle = facing >= 0 ? p.swatch.front : p.swatch.back;
              ctx.fill();
              // Turned away from the light: darker.
              const edge = 1 - Math.abs(facing);
              if (edge > 0.15) {
                ctx.globalAlpha = fade * edge * 0.32;
                ctx.fillStyle = "black";
                ctx.fill();
              }
              // Foil facing you: a bright glint.
              if (p.swatch.metal) {
                const glint = Math.pow(Math.abs(facing), 6);
                if (glint > 0.08) {
                  ctx.globalAlpha = fade * glint * 0.55;
                  ctx.fillStyle = "white";
                  ctx.fill();
                }
              }
            }
          }

          // Slow floating layer
          for (const f of floaters) {
            const age = t - f.born;
            if (age < 0 || age > f.life) continue;
            const k = age / f.life;
            const alpha = Math.sin(Math.PI * Math.min(1, k * 1.15)) * (mood.slow === "mote" ? 0.7 : 0.9);
            if (alpha <= 0) continue;
            f.x += (f.vx + Math.sin(age * 1.6 + f.phase) * 22) * dt;
            f.y += f.vy * dt;
            f.angle += f.spin * dt;
            ctx.globalAlpha = alpha;

            if (mood.slow === "streamer") {
              // A thin curl of paper that keeps changing its curve as it falls.
              const curl = Math.sin(age * 3 + f.phase) * f.size * 0.32;
              const half = f.size / 2;
              ctx.setTransform(Math.cos(f.angle) * dpr, Math.sin(f.angle) * dpr, -Math.sin(f.angle) * dpr, Math.cos(f.angle) * dpr, f.x * dpr, f.y * dpr);
              ctx.beginPath();
              ctx.moveTo(-half, 0);
              ctx.bezierCurveTo(-half / 3, -curl, half / 3, curl, half, 0);
              ctx.strokeStyle = f.color;
              ctx.lineWidth = 2.4;
              ctx.lineCap = "round";
              ctx.stroke();
            } else if (mood.slow === "mote") {
              ctx.setTransform(dpr, 0, 0, dpr, f.x * dpr, f.y * dpr);
              ctx.beginPath();
              ctx.arc(0, 0, f.size, 0, Math.PI * 2);
              ctx.fillStyle = f.color;
              ctx.fill();
            } else {
              // A four-point glint that twinkles as it drifts up.
              const s = f.size * (0.65 + 0.35 * Math.sin(age * 8 + f.phase));
              ctx.setTransform(Math.cos(f.angle) * dpr, Math.sin(f.angle) * dpr, -Math.sin(f.angle) * dpr, Math.cos(f.angle) * dpr, f.x * dpr, f.y * dpr);
              ctx.beginPath();
              ctx.moveTo(0, -s);
              ctx.quadraticCurveTo(0, 0, s, 0);
              ctx.quadraticCurveTo(0, 0, 0, s);
              ctx.quadraticCurveTo(0, 0, -s, 0);
              ctx.quadraticCurveTo(0, 0, 0, -s);
              ctx.fillStyle = f.color;
              ctx.fill();
            }
          }
          ctx.globalAlpha = 1;
          frame = requestAnimationFrame(draw);
        };

        frame = requestAnimationFrame(draw);
        stopRef.current = () => {
          if (frame) cancelAnimationFrame(frame);
          frame = 0;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        };
      },
    }),
    [kind],
  );

  return (
    <>
      <div ref={burstRef} className="light-burst" data-wrap={kind} aria-hidden="true" />
      <canvas ref={canvasRef} className="celebrate-canvas" aria-hidden="true" />
    </>
  );
}
