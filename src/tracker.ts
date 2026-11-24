// Finds hands, lips and face in the camera image (MediaPipe, on-device)
// and turns them into "bulges": a center, a radius and a strength.

import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

// One magnified area. x/y in video coordinates (0..1, origin top-left),
// r in units of the video height, s = how much it magnifies (0 = none).
export type Bulge = { x: number; y: number; r: number; s: number };

// How much each body part grows at full strength, homunculus-style.
const WEIGHT = { hand: 0.62, lips: 0.6, face: 0.28 };
export const SLOTS = 4; // two hands, lips, face

export async function createTracker() {
  const vision = await FilesetResolver.forVisionTasks("/wasm");
  const make = async (delegate: "GPU" | "CPU") =>
    Promise.all([
      HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "/models/hand_landmarker.task", delegate },
        runningMode: "VIDEO",
        numHands: 2,
      }),
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate },
        runningMode: "VIDEO",
        numFaces: 1,
      }),
    ]);

  let hands: HandLandmarker;
  let face: FaceLandmarker;
  try {
    [hands, face] = await make("GPU");
  } catch {
    [hands, face] = await make("CPU");
  }

  let frame = 0;
  let lastTime = -1;
  let handTargets: (Bulge | null)[] = [null, null];
  let faceTargets: (Bulge | null)[] = [null, null];

  // Hands and face are detected on alternate frames to keep it smooth on phones.
  function detect(video: HTMLVideoElement, aspect: number): (Bulge | null)[] {
    let now = performance.now();
    if (now <= lastTime) now = lastTime + 1;
    lastTime = now;

    if (frame++ % 2 === 0) {
      const res = hands.detectForVideo(video, now);
      handTargets = [0, 1].map((i) => (res.landmarks[i] ? handBulge(res.landmarks[i], aspect) : null));
    } else {
      const res = face.detectForVideo(video, now);
      const lm = res.faceLandmarks[0];
      faceTargets = lm ? [lipsBulge(lm, aspect), faceBulge(lm, aspect)] : [null, null];
    }
    return [...handTargets, ...faceTargets];
  }

  function close() {
    hands.close();
    face.close();
  }

  return { detect, close };
}

// Distance in units of the video height.
const dist = (a: NormalizedLandmark, b: NormalizedLandmark, aspect: number) =>
  Math.hypot((a.x - b.x) * aspect, a.y - b.y);

function center(points: NormalizedLandmark[]) {
  const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return { x, y, z: 0 } as NormalizedLandmark;
}

function handBulge(lm: NormalizedLandmark[], aspect: number): Bulge {
  const c = center(lm);
  const r = Math.max(...lm.map((p) => dist(c, p, aspect))) * 1.25;
  return { x: c.x, y: c.y, r, s: WEIGHT.hand };
}

// Face mesh points: 61/291 mouth corners, 0/17 outer lips,
// 10 forehead, 152 chin, 234/454 cheeks.
function lipsBulge(lm: NormalizedLandmark[], aspect: number): Bulge {
  const c = center([lm[61], lm[291], lm[0], lm[17]]);
  const r = dist(lm[61], lm[291], aspect) * 0.85;
  return { x: c.x, y: c.y, r, s: WEIGHT.lips };
}

function faceBulge(lm: NormalizedLandmark[], aspect: number): Bulge {
  const c = center([lm[10], lm[152], lm[234], lm[454]]);
  const r = dist(lm[10], lm[152], aspect) * 0.7;
  return { x: c.x, y: c.y, r, s: WEIGHT.face };
}
