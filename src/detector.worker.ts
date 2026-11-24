// Runs the MediaPipe models in the background so the mirror never freezes
// while they think. Receives small camera frames, sends back landmarks.

import { FaceLandmarker, FilesetResolver, HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";

type Models = [HandLandmarker, FaceLandmarker, PoseLandmarker];
let models: Models | null = null;

async function init() {
  const base = self.location.origin;
  const vision = await FilesetResolver.forVisionTasks(`${base}/wasm`);
  const make = (delegate: "GPU" | "CPU") =>
    Promise.all([
      HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: `${base}/models/hand_landmarker.task`, delegate },
        runningMode: "VIDEO",
        numHands: 2,
      }),
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: `${base}/models/face_landmarker.task`, delegate },
        runningMode: "VIDEO",
        numFaces: 1,
      }),
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: `${base}/models/pose_landmarker_lite.task`, delegate },
        runningMode: "VIDEO",
        numPoses: 1,
      }),
    ]) as Promise<Models>;
  try {
    models = await make("GPU");
  } catch {
    models = await make("CPU");
  }
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === "init") {
    try {
      await init();
      self.postMessage({ type: "ready" });
    } catch (err) {
      self.postMessage({ type: "error", message: String(err) });
    }
    return;
  }
  if (msg.type === "frame" && models) {
    const bitmap: ImageBitmap = msg.bitmap;
    const [hands, face, pose] = models;
    let result: unknown = null;
    if (msg.turn === "hands") result = hands.detectForVideo(bitmap, msg.time).landmarks;
    else if (msg.turn === "face") result = face.detectForVideo(bitmap, msg.time).faceLandmarks[0] ?? null;
    else result = pose.detectForVideo(bitmap, msg.time).landmarks[0] ?? null;
    bitmap.close();
    self.postMessage({ type: "result", turn: msg.turn, result });
  }
};
