// Draws the tracking overlay on a transparent layer above the warped image:
// points, lines, labels and contact flares.

import { content, type Mode } from "./content";
import type { Bulge, Contact, Label } from "./body";
import type { Tracking } from "./tracker";

const HAND_LINES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11],
  [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
const BODY_LINES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
];

const COLORS = { line: "rgba(245,243,238,0.75)", point: "#ffd426", face: "rgba(111,116,255,0.85)", accent: "#ff7a52", box: "rgba(18,18,63,0.72)" };

export type Frame = {
  tracking: Tracking;
  bulges: Bulge[]; // with the final strength already applied
  labels: Label[];
  contacts: Contact[];
  mode: Mode;
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

  function draw(W: number, H: number, f: Frame) {
    if (!W || !H) return;
    if (out.width !== W || out.height !== H) {
      out.width = W;
      out.height = H;
    } else ctx.clearRect(0, 0, W, H);
    const now = performance.now();
    const u = H / 720;

    if (!f.showLabels) {
      drawContacts(f, W, H, u, now);
      return;
    }

    const screen = (x: number, y: number) => {
      const p = forward(x, y, f.bulges, f.aspect);
      return { x: (1 - p.x) * W, y: p.y * H };
    };

    // Body lines (faint), face points, hand skeletons.
    ctx.lineCap = "round";
    if (f.tracking.pose) {
      const p = f.tracking.pose;
      ctx.strokeStyle = "rgba(245,243,238,0.35)";
      ctx.lineWidth = 1.5 * u;
      ctx.beginPath();
      for (const [a, b] of BODY_LINES) {
        if ((p[a].visibility ?? 1) < 0.5 || (p[b].visibility ?? 1) < 0.5) continue;
        const A = screen(p[a].x, p[a].y);
        const B = screen(p[b].x, p[b].y);
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
      }
      ctx.stroke();
    }
    if (f.tracking.face) {
      ctx.fillStyle = COLORS.face;
      const face = f.tracking.face;
      for (let i = 0; i < 468; i += 5) {
        const P = screen(face[i].x, face[i].y);
        ctx.fillRect(P.x - u, P.y - u, 2 * u, 2 * u);
      }
    }
    for (const hand of f.tracking.hands) {
      const pts = hand.map((p) => screen(p.x, p.y));
      ctx.strokeStyle = COLORS.line;
      ctx.lineWidth = 1.6 * u;
      ctx.beginPath();
      for (const [a, b] of HAND_LINES) {
        ctx.moveTo(pts[a].x, pts[a].y);
        ctx.lineTo(pts[b].x, pts[b].y);
      }
      ctx.stroke();
      ctx.fillStyle = COLORS.point;
      for (const P of pts) {
        ctx.beginPath();
        ctx.arc(P.x, P.y, 3 * u, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawContacts(f, W, H, u, now);

    // Labels with callout lines, pointing toward the middle so they stay on screen.
    const map = f.mode === "movement" ? "movement" : "touch";
    ctx.textBaseline = "top";
    for (const l of f.labels) {
      const A = screen(l.x, l.y);
      const dir = A.x < W / 2 ? 1 : -1;
      const L = { x: A.x + dir * 70 * u, y: A.y - 46 * u };
      const part = content.parts[l.part];
      const title = part.label.toUpperCase();
      const share = l.part === "contact" ? "" : `${map} ≈ ${part[map]}%`;
      ctx.font = `700 ${15 * u}px "JetBrains Mono", monospace`;
      const tw = ctx.measureText(title).width;
      ctx.font = `400 ${12 * u}px "JetBrains Mono", monospace`;
      const sw = share ? ctx.measureText(share).width : 0;
      const bw = Math.max(tw, sw) + 14 * u;
      const bh = (share ? 38 : 22) * u;
      const bx = dir > 0 ? L.x : L.x - bw;
      const by = L.y - bh / 2;

      ctx.strokeStyle = l.part === "contact" ? COLORS.accent : COLORS.point;
      ctx.lineWidth = 1.2 * u;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(L.x, L.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(A.x, A.y, 4 * u, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = COLORS.box;
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = l.part === "contact" ? COLORS.accent : "#f5f3ee";
      ctx.font = `700 ${15 * u}px "JetBrains Mono", monospace`;
      ctx.fillText(title, bx + 7 * u, by + 4 * u);
      if (share) {
        ctx.fillStyle = "rgba(245,243,238,0.75)";
        ctx.font = `400 ${12 * u}px "JetBrains Mono", monospace`;
        ctx.fillText(share, bx + 7 * u, by + 22 * u);
      }
    }
  }

  // Contact flare: a glow and rings rippling out from the touched spot.
  function drawContacts(f: Frame, W: number, H: number, u: number, now: number) {
    for (const c of f.contacts) {
      const p = forward(c.x, c.y, f.bulges, f.aspect);
      const X = (1 - p.x) * W;
      const Y = p.y * H;
      const t = (now - c.since) / 1000;
      const glow = ctx.createRadialGradient(X, Y, 0, X, Y, 60 * u);
      glow.addColorStop(0, "rgba(255,122,82,0.55)");
      glow.addColorStop(1, "rgba(255,122,82,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(X - 60 * u, Y - 60 * u, 120 * u, 120 * u);
      ctx.lineWidth = 2 * u;
      for (let k = 0; k < 3; k++) {
        const phase = (t * 0.9 + k / 3) % 1;
        ctx.strokeStyle = `rgba(255,122,82,${(1 - phase) * 0.9})`;
        ctx.beginPath();
        ctx.arc(X, Y, (10 + phase * 90) * u, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  return { draw };
}
