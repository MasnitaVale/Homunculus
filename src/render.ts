// Draws the diagram on a transparent layer above the warped image: one thin ring
// on the edge of each grown or shrunk body part, a small label with its share of
// the brain's touch map, and a ripple where you touch yourself.

import { content, type PartId } from "./content";
import { SLOT_KINDS, type Bulge, type Contact, type Kind } from "./body";
import type { Tracking } from "./tracker";
import { forward } from "./geometry";

const LINE = "245,243,238";
const EMBER = "255,122,82";
const INK = "18,18,63";
const MONO = '"JetBrains Mono", ui-monospace, monospace';

// Which body part each slot stands for (shoulders share the torso's ring).
const PART: Record<Kind, PartId | null> = {
  hand: "hands",
  lips: "lips",
  face: "face",
  torso: "torso",
  shoulders: null,
  foot: "feet",
  contact: null,
};

export type Frame = {
  tracking: Tracking;
  bulges: Bulge[]; // final: strength applied and centres settled
  contacts: Contact[];
  mouthOpen: number;
  showLabels: boolean;
  aspect: number;
};

export function createRenderer(out: HTMLCanvasElement) {
  const ctx = out.getContext("2d")!;

  // Text with a soft dark edge so it reads on any background.
  function text(s: string, x: number, y: number, size: number, alpha: number, color = LINE) {
    ctx.font = `500 ${size}px ${MONO}`;
    ctx.lineWidth = size * 0.28;
    ctx.strokeStyle = `rgba(${INK},${0.55 * alpha})`;
    ctx.strokeText(s, x, y);
    ctx.fillStyle = `rgba(${color},${alpha})`;
    ctx.fillText(s, x, y);
  }

  function draw(W: number, H: number, f: Frame) {
    if (!W || !H) return;
    if (out.width !== W || out.height !== H) {
      out.width = W;
      out.height = H;
    } else ctx.clearRect(0, 0, W, H);
    const now = performance.now();
    const u = H / 720;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineCap = "round";

    if (f.showLabels) {
      f.bulges.forEach((b, i) => {
        const kind = SLOT_KINDS[i];
        let part = PART[kind];
        const strength = Math.abs(b.s);
        if (!part || strength < 0.04 || b.r <= 0) return;
        const alpha = Math.min(1, strength / 0.25);
        const c = forward(b.x, b.y, f.bulges.slice(0, i), f.aspect);
        const x = (1 - c.x) * W;
        const y = c.y * H;
        const r = b.r * H;

        // Ring on the edge of the distortion: solid where the body grows,
        // dashed where it shrinks.
        if (b.s < 0) ctx.setLineDash([6 * u, 6 * u]);
        ctx.lineWidth = 3 * u;
        ctx.strokeStyle = `rgba(${INK},${0.25 * alpha})`;
        ctx.beginPath();
        // The picture is mirrored, so the tilt flips direction on screen.
        ctx.ellipse(x, y, r * b.e, r, -b.a, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1 * u;
        ctx.strokeStyle = `rgba(${LINE},${0.75 * alpha})`;
        ctx.stroke();
        ctx.setLineDash([]);

        if (part === "lips" && f.mouthOpen > 0.25) part = "mouth";
        const info = content.parts[part];
        text(`${info.label.toUpperCase()} ≈ ${info.touch}%`, x, y - r - 6 * u, 12 * u, alpha);
      });
    }

    // Contact: a glow and rings rippling out from the touched spot.
    for (const c of f.contacts) {
      const P = forward(c.x, c.y, f.bulges, f.aspect);
      const X = (1 - P.x) * W;
      const Y = P.y * H;
      const age = (now - c.since) / 1000;
      const glow = ctx.createRadialGradient(X, Y, 0, X, Y, 60 * u);
      glow.addColorStop(0, `rgba(${EMBER},0.5)`);
      glow.addColorStop(1, `rgba(${EMBER},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(X - 60 * u, Y - 60 * u, 120 * u, 120 * u);
      ctx.lineWidth = 1.5 * u;
      for (let k = 0; k < 3; k++) {
        const phase = (age * 0.9 + k / 3) % 1;
        ctx.strokeStyle = `rgba(${EMBER},${(1 - phase) * 0.9})`;
        ctx.beginPath();
        ctx.arc(X, Y, (10 + phase * 90) * u, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (f.showLabels) text(content.parts.contact.label.toUpperCase(), X, Y - 64 * u, 12 * u, 0.95, EMBER);
    }
  }

  return { draw };
}
