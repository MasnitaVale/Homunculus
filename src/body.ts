// Turns tracking into homunculus "bulges": which areas grow (hands, lips, face,
// feet, a touched spot) and which shrink (torso, shoulders), with smoothing.

import type { PartId } from "./content";
import type { Landmarks, Tracking } from "./tracker";

// x/y in video coordinates (0..1, origin top-left), r in units of the video height,
// s = magnification (positive grows, negative shrinks). e stretches the area into an
// oval (e = width / height, 1 = circle) and a tilts it (radians).
export type Bulge = { x: number; y: number; r: number; s: number; e: number; a: number };
export type Label = { part: PartId; x: number; y: number };
export type Contact = { x: number; y: number; since: number };

export type Kind = "hand" | "lips" | "face" | "torso" | "shoulders" | "foot" | "contact";

// How strongly each kind grows (positive) or shrinks (negative).
const STRENGTH: Record<Kind, number> = {
  hand: 0.72, lips: 0.6, face: 0.3, torso: -0.45, shoulders: -0.35, foot: 0.5, contact: 0.45,
};

export const SLOT_KINDS: Kind[] = ["hand", "hand", "lips", "face", "torso", "shoulders", "foot", "foot", "contact", "contact"];
export const SLOTS = SLOT_KINDS.length;

// One Euro filter: smooth when still, responsive when moving fast.
class OneEuro {
  private x: number | null = null;
  private dx = 0;
  private minCutoff: number;
  private beta: number;
  constructor(minCutoff = 1.2, beta = 8) {
    this.minCutoff = minCutoff;
    this.beta = beta;
  }
  private alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  filter(value: number, dt: number) {
    if (this.x === null) {
      this.x = value;
      return value;
    }
    const d = (value - this.x) / dt;
    this.dx += this.alpha(1, dt) * (d - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += this.alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
  reset() {
    this.x = null;
    this.dx = 0;
  }
}

type Target = { x: number; y: number; r: number; extra?: number; e?: number; a?: number } | null;

class Slot {
  x = 0.5;
  y = 0.5;
  r = 0;
  s = 0;
  e = 1;
  a = 0;
  seen = false;
  private fx = new OneEuro();
  private fy = new OneEuro();
  private fr = new OneEuro(0.6, 2);
  readonly kind: Kind;
  constructor(kind: Kind) {
    this.kind = kind;
  }

  update(t: Target, goal: number, dt: number) {
    if (t) {
      if (!this.seen) [this.fx, this.fy, this.fr].forEach((f) => f.reset());
      this.x = this.fx.filter(t.x, dt);
      this.y = this.fy.filter(t.y, dt);
      this.r = this.fr.filter(t.r, dt);
      this.s += (goal + (t.extra ?? 0) - this.s) * Math.min(1, dt * 6);
      const k = this.seen ? Math.min(1, dt * 10) : 1;
      this.e += ((t.e ?? 1) - this.e) * k;
      this.a += ((t.a ?? 0) - this.a) * k;
      this.seen = true;
    } else {
      this.s += (0 - this.s) * Math.min(1, dt * 5);
      this.seen = false;
    }
  }
}

const P = (lm: Landmarks, i: number) => lm[i];
const visible = (lm: Landmarks, i: number) => (lm[i].visibility ?? 1) > 0.5;

export function createBody() {
  const slots = SLOT_KINDS.map((k) => new Slot(k));
  const contacts: (Contact | null)[] = [null, null];
  let last = performance.now();

  function update(t: Tracking, aspect: number) {
    const now = performance.now();
    const dt = Math.max(1 / 120, Math.min(0.1, (now - last) / 1000));
    last = now;
    const strength = STRENGTH;
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot((a.x - b.x) * aspect, a.y - b.y);
    const mean = (pts: { x: number; y: number }[]) => ({
      x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
      y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    });

    const targets: Target[] = Array(SLOTS).fill(null);
    const labels: Label[] = [];

    // Hands: keep each hand on the slot it was on last frame.
    const handTargets = t.hands.map((lm) => {
      const c = mean(lm);
      return { x: c.x, y: c.y, r: Math.max(...lm.map((p) => dist(c, p))) * 1.25, lm };
    });
    if (handTargets.length >= 2) {
      const [a, b] = handTargets;
      const swap = dist(a, slots[1]) + dist(b, slots[0]) < dist(a, slots[0]) + dist(b, slots[1]);
      [targets[0], targets[1]] = swap ? [b, a] : [a, b];
    } else if (handTargets.length === 1) {
      const h = handTargets[0];
      const useSecond =
        slots[1].seen && (!slots[0].seen || dist(h, slots[1]) < dist(h, slots[0]));
      targets[useSecond ? 1 : 0] = h;
    }
    [0, 1].forEach((i) => {
      if (targets[i]) labels.push({ part: "hands", x: targets[i]!.x, y: targets[i]!.y - targets[i]!.r * 0.6 });
    });

    // Face, lips, mouth.
    let faceCenter: { x: number; y: number; r: number } | null = null;
    let mouthOpen = 0;
    if (t.face) {
      const f = t.face;
      const lipsC = mean([P(f, 61), P(f, 291), P(f, 0), P(f, 17)]);
      const mouthW = dist(P(f, 61), P(f, 291));
      mouthOpen = Math.min(1, Math.max(0, dist(P(f, 13), P(f, 14)) / mouthW - 0.08) * 2.5);
      // Lips: a wide, flat oval along the line between the mouth corners, so it
      // doesn't reach up into the nose. It gets taller as the mouth opens.
      const lipsH = dist(P(f, 0), P(f, 17));
      const r = Math.max(mouthW * 0.4, lipsH * 0.85);
      const tilt = Math.atan2(P(f, 291).y - P(f, 61).y, (P(f, 291).x - P(f, 61).x) * aspect);
      targets[2] = {
        x: lipsC.x,
        y: lipsC.y,
        r,
        e: Math.max(1, (mouthW * 0.8) / r),
        a: tilt,
        extra: mouthOpen * 0.25,
      };
      const fc = mean([P(f, 10), P(f, 152), P(f, 234), P(f, 454)]);
      const fr = dist(P(f, 10), P(f, 152)) * 0.7;
      targets[3] = { x: fc.x, y: fc.y, r: fr };
      faceCenter = { ...fc, r: fr };
      labels.push({ part: "face", x: P(f, 10).x, y: P(f, 10).y });
      labels.push({ part: mouthOpen > 0.25 ? "mouth" : "lips", x: P(f, 61).x, y: lipsC.y });
    }

    // Body: torso and shoulders shrink, feet grow.
    if (t.pose) {
      const p = t.pose;
      if (visible(p, 11) && visible(p, 12)) {
        const sw = dist(P(p, 11), P(p, 12));
        const mid = mean([P(p, 11), P(p, 12)]);
        const hips = visible(p, 23) && visible(p, 24);
        const torso = hips ? mean([P(p, 11), P(p, 12), P(p, 23), P(p, 24)]) : { x: mid.x, y: mid.y + sw * 0.6 };
        targets[4] = { x: torso.x, y: torso.y, r: sw * 0.85 };
        targets[5] = { x: mid.x, y: mid.y, r: sw * 0.55 };
        labels.push({ part: "torso", x: torso.x, y: Math.min(0.95, torso.y) });
      }
      [
        [27, 29, 31],
        [28, 30, 32],
      ].forEach(([ankle, heel, toe], i) => {
        if (visible(p, ankle) && visible(p, toe)) {
          const c = mean([P(p, ankle), P(p, heel), P(p, toe)]);
          targets[6 + i] = { x: c.x, y: c.y, r: dist(P(p, ankle), P(p, toe)) * 1.4 };
          labels.push({ part: "feet", x: c.x, y: c.y });
        }
      });
    }

    // Contact: a fingertip touching the face or the other hand.
    const tips = [4, 8, 12, 16, 20];
    [0, 1].forEach((i) => {
      const hand = t.hands[i];
      let hit: { x: number; y: number; r: number } | null = null;
      if (hand) {
        const others: { x: number; y: number; r: number }[] = [];
        if (faceCenter) others.push(faceCenter);
        const other = t.hands[1 - i];
        if (other) {
          const c = mean(other);
          others.push({ ...c, r: Math.max(...other.map((p) => dist(c, p))) * 0.55 });
        }
        let best = Infinity;
        for (const tip of tips) {
          for (const o of others) {
            const d = dist(P(hand, tip), o) / o.r;
            if (d < 0.95 && d < best) {
              best = d;
              hit = { x: P(hand, tip).x, y: P(hand, tip).y, r: o.r * 0.4 };
            }
          }
        }
      }
      targets[8 + i] = hit;
      if (hit) {
        contacts[i] = { x: hit.x, y: hit.y, since: contacts[i]?.since ?? now };
        labels.push({ part: "contact", x: hit.x, y: hit.y });
      } else contacts[i] = null;
    });

    slots.forEach((slot, i) => slot.update(targets[i], strength[slot.kind], dt));

    const bulges: Bulge[] = slots.map((s) => ({ x: s.x, y: s.y, r: s.r, s: s.s, e: s.e, a: s.a }));
    return { bulges, labels, contacts: contacts.filter(Boolean) as Contact[], mouthOpen };
  }

  return { update };
}
