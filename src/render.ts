// Draws the "alchemical" diagram on a transparent layer above the warped image:
// a gold circle around each grown or shrunk body part, sized to its distortion,
// Latin names written along the rings, constellation lines between the parts,
// small stars on the fingertips, and a burst of sparks where you touch yourself.

import { content, type PartId } from "./content";
import { SLOT_KINDS, type Bulge, type Contact, type Kind } from "./body";
import type { Tracking } from "./tracker";

const GOLD = "217,180,90";
const EMBER = "255,122,82";
const INK = "18,18,63";
const SERIF = 'Georgia, "Times New Roman", serif';

// Planet and metal symbols from old alchemy plates, one per ring.
const GLYPHS: Partial<Record<Kind, string[]>> = {
  hand: ["☿", "♃", "☿", "♃"],
  lips: ["♀", "☽", "♀", "☽"],
  face: ["☉", "☽", "☉", "☽"],
  foot: ["♄", "♁", "♄", "♁"],
  torso: ["♄", "♂", "♄", "♂"],
};

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

// Constellation: pairs of slots joined by a thin line when both are visible.
// Slots: 0,1 hands · 2 lips · 3 face · 4 torso · 5 shoulders · 6,7 feet
const LINKS = [
  [0, 3], [1, 3], [2, 3], [3, 4], [0, 1], [4, 6], [4, 7], [0, 4], [1, 4],
];

const TIPS = [4, 8, 12, 16, 20];

export type Frame = {
  tracking: Tracking;
  bulges: Bulge[]; // with the final strength already applied
  contacts: Contact[];
  mouthOpen: number;
  showLabels: boolean;
  aspect: number;
};

export function createRenderer(out: HTMLCanvasElement) {
  const ctx = out.getContext("2d")!;

  // Where a point of the camera image ends up after the warp (the shader works
  // backwards, so this inverts it numerically, bulge by bulge).
  function forward(x: number, y: number, bulges: Bulge[], aspect: number) {
    let px = x;
    let py = y;
    for (let i = bulges.length - 1; i >= 0; i--) {
      const b = bulges[i];
      if (Math.abs(b.s) < 0.001 || b.r <= 0) continue;
      const dx = px - b.x;
      const dy = py - b.y;
      const rs = Math.hypot(dx * aspect, dy) / b.r;
      if (rs >= 1 || rs === 0) continue;
      let lo = 0;
      let hi = 1;
      for (let k = 0; k < 14; k++) {
        const mid = (lo + hi) / 2;
        const kk = 1 - mid * mid;
        if (mid * (1 - b.s * kk * kk) < rs) lo = mid;
        else hi = mid;
      }
      const scale = (lo + hi) / 2 / rs;
      px = b.x + dx * scale;
      py = b.y + dy * scale;
    }
    return { x: px, y: py };
  }

  // Letters set along a circle, centred on `angle` (0 = right, -π/2 = top).
  function arcText(text: string, cx: number, cy: number, radius: number, angle: number, size: number, outside: boolean) {
    ctx.font = `italic 600 ${size}px ${SERIF}`;
    const chars = [...text];
    const widths = chars.map((c) => ctx.measureText(c).width + size * 0.12);
    const total = widths.reduce((a, b) => a + b, 0) / radius;
    let a = angle - (outside ? total / 2 : -total / 2);
    chars.forEach((c, i) => {
      const step = widths[i] / radius;
      const mid = outside ? a + step / 2 : a - step / 2;
      ctx.save();
      ctx.translate(cx + Math.cos(mid) * radius, cy + Math.sin(mid) * radius);
      ctx.rotate(outside ? mid + Math.PI / 2 : mid - Math.PI / 2);
      ctx.strokeText(c, 0, 0);
      ctx.fillText(c, 0, 0);
      ctx.restore();
      a += outside ? step : -step;
    });
  }

  function star(x: number, y: number, r: number) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const rr = i % 2 ? r * 0.3 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  function draw(W: number, H: number, f: Frame) {
    if (!W || !H) return;
    if (out.width !== W || out.height !== H) {
      out.width = W;
      out.height = H;
    } else ctx.clearRect(0, 0, W, H);
    const now = performance.now();
    const t = now / 1000;
    const u = H / 720;

    const toScreen = (x: number, y: number) => {
      const p = forward(x, y, f.bulges, f.aspect);
      return { x: (1 - p.x) * W, y: p.y * H };
    };

    // Ring centres and sizes. A ring sits exactly on the edge of its distortion.
    const rings = f.bulges.map((b, i) => {
      const kind = SLOT_KINDS[i];
      const strength = Math.abs(b.s);
      return {
        kind,
        x: (1 - b.x) * W,
        y: b.y * H,
        r: b.r * H,
        grows: b.s > 0,
        alpha: Math.min(1, strength / 0.25),
        visible: strength > 0.04 && b.r > 0 && kind !== "contact" && kind !== "shoulders",
      };
    });

    if (f.showLabels) {
      ctx.lineCap = "round";

      // Constellation lines between the parts.
      ctx.setLineDash([2 * u, 6 * u]);
      ctx.lineWidth = 1 * u;
      for (const [a, b] of LINKS) {
        const A = rings[a];
        const B = rings[b];
        if (!A.visible || !B.visible) continue;
        ctx.strokeStyle = `rgba(${GOLD},${0.45 * Math.min(A.alpha, B.alpha)})`;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Circles: growing parts turn clockwise with solid rings; shrinking parts
      // turn the other way with broken rings.
      for (const ring of rings) {
        if (!ring.visible) continue;
        const { x, y, r, alpha } = ring;
        const spin = (ring.grows ? 1 : -1) * t * 0.25;
        ctx.strokeStyle = `rgba(${GOLD},${0.9 * alpha})`;

        if (!ring.grows) ctx.setLineDash([10 * u, 6 * u]);
        ctx.strokeStyle = `rgba(${INK},${0.35 * alpha})`;
        ctx.lineWidth = 4 * u;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(${GOLD},${0.9 * alpha})`;
        ctx.lineWidth = 1.4 * u;
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.lineWidth = 0.8 * u;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.86, 0, Math.PI * 2);
        ctx.stroke();

        // Tick marks between the two rings.
        ctx.beginPath();
        for (let k = 0; k < 36; k++) {
          const a = spin + (k * Math.PI) / 18;
          const inner = k % 3 === 0 ? r * 0.86 : r * 0.93;
          ctx.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner);
          ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        ctx.stroke();

        // Four symbols on the ring.
        const glyphs = GLYPHS[ring.kind];
        if (glyphs) {
          ctx.fillStyle = `rgba(${GOLD},${alpha})`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `${Math.max(12 * u, Math.min(26 * u, r * 0.16))}px ${SERIF}`;
          ctx.strokeStyle = `rgba(${INK},${0.6 * alpha})`;
          ctx.lineWidth = 3 * u;
          glyphs.forEach((g, k) => {
            const a = -spin + Math.PI / 4 + (k * Math.PI) / 2;
            const gx = x + Math.cos(a) * r * 0.93;
            const gy = y + Math.sin(a) * r * 0.93;
            ctx.strokeText(g, gx, gy);
            ctx.fillText(g, gx, gy);
          });
        }

        // Name along the top of the ring, share along the bottom.
        let part = PART[ring.kind];
        if (part === "lips" && f.mouthOpen > 0.25) part = "mouth";
        if (!part) continue;
        const info = content.parts[part];
        const share = `${info.label.toLowerCase()} · touch ≈ ${info.touch}%`;
        ctx.textBaseline = "middle";
        ctx.strokeStyle = `rgba(${INK},${0.7 * alpha})`;
        ctx.lineWidth = 3 * u;
        if (r < 80 * u) {
          // Too small to write around: a straight label beside the ring.
          const side = x < W / 2 ? 1 : -1;
          const lx = x + side * (r + 10 * u);
          ctx.textAlign = side > 0 ? "left" : "right";
          ctx.font = `italic 600 ${15 * u}px ${SERIF}`;
          ctx.fillStyle = `rgba(${GOLD},${alpha})`;
          ctx.strokeText(info.latin.toUpperCase(), lx, y - 8 * u);
          ctx.fillText(info.latin.toUpperCase(), lx, y - 8 * u);
          ctx.font = `italic 400 ${11 * u}px ${SERIF}`;
          ctx.fillStyle = `rgba(245,243,238,${0.9 * alpha})`;
          ctx.strokeText(share, lx, y + 9 * u);
          ctx.fillText(share, lx, y + 9 * u);
          continue;
        }
        const size = Math.min(22 * u, Math.max(14 * u, r * 0.14));
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(${GOLD},${alpha})`;
        arcText(info.latin.toUpperCase(), x, y, r + size * 0.85, -Math.PI / 2, size, true);
        ctx.fillStyle = `rgba(245,243,238,${0.9 * alpha})`;
        arcText(share, x, y, r + size * 0.75, Math.PI / 2, Math.max(11 * u, size * 0.62), false);
      }

      // Small stars on the fingertips.
      ctx.fillStyle = `rgba(${GOLD},0.95)`;
      for (const hand of f.tracking.hands) {
        for (const i of TIPS) {
          const P = toScreen(hand[i].x, hand[i].y);
          star(P.x, P.y, 6 * u);
        }
      }
    }

    // Contact: rings rippling out plus a burst of sparks, and the word TACTUS.
    for (const c of f.contacts) {
      const P = toScreen(c.x, c.y);
      const age = (now - c.since) / 1000;
      const glow = ctx.createRadialGradient(P.x, P.y, 0, P.x, P.y, 60 * u);
      glow.addColorStop(0, `rgba(${EMBER},0.55)`);
      glow.addColorStop(1, `rgba(${EMBER},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(P.x - 60 * u, P.y - 60 * u, 120 * u, 120 * u);
      ctx.lineWidth = 2 * u;
      for (let k = 0; k < 3; k++) {
        const phase = (age * 0.9 + k / 3) % 1;
        ctx.strokeStyle = `rgba(${EMBER},${(1 - phase) * 0.9})`;
        ctx.beginPath();
        ctx.arc(P.x, P.y, (10 + phase * 90) * u, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Sparks fly out along fixed directions, restarting every 0.8 s.
      for (let k = 0; k < 14; k++) {
        const a = k * 2.399 + Math.floor(age / 0.8) * 0.7;
        const phase = (age % 0.8) / 0.8;
        const d = (20 + (k % 4) * 14) * u * (0.3 + phase * 1.6);
        ctx.fillStyle = `rgba(${k % 2 ? GOLD : EMBER},${1 - phase})`;
        star(P.x + Math.cos(a) * d, P.y + Math.sin(a) * d, (2 + (k % 3)) * u);
      }
      if (f.showLabels) {
        ctx.fillStyle = `rgba(${EMBER},0.95)`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `italic 600 ${16 * u}px ${SERIF}`;
        ctx.strokeStyle = `rgba(${INK},0.7)`;
        ctx.lineWidth = 3 * u;
        ctx.strokeText(content.parts.contact.latin.toUpperCase(), P.x, P.y - 70 * u);
        ctx.fillText(content.parts.contact.latin.toUpperCase(), P.x, P.y - 70 * u);
      }
    }
  }

  return { draw };
}
