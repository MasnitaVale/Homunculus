// Where a point of the camera image ends up on screen after the warp.
// The shader works backwards (screen → camera), applying the bulges in order,
// so this undoes them numerically from the last to the first.

import type { Bulge } from "./body";

export function forward(x: number, y: number, bulges: Bulge[], aspect: number) {
  let px = x;
  let py = y;
  for (let i = bulges.length - 1; i >= 0; i--) {
    const b = bulges[i];
    if (Math.abs(b.s) < 0.001 || b.r <= 0) continue;
    const dx = px - b.x;
    const dy = py - b.y;
    const c = Math.cos(b.a);
    const s = Math.sin(b.a);
    const qx = dx * aspect;
    const rs = Math.hypot((c * qx + s * dy) / b.e, -s * qx + c * dy) / b.r;
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

// Each bulge is applied after the earlier ones have already moved the picture,
// so its centre has to be moved the same way, or it misses its body part
// (e.g. the shrinking torso pulls the mouth down; the lips must follow).
export function settle(bulges: Bulge[], aspect: number): Bulge[] {
  const out = bulges.map((b) => ({ ...b }));
  for (let i = out.length - 1; i >= 0; i--) {
    const p = forward(out[i].x, out[i].y, out.slice(i + 1), aspect);
    out[i].x = p.x;
    out[i].y = p.y;
  }
  return out;
}
