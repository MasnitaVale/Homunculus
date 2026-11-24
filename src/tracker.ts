// Finds hands, face and body in the camera image (MediaPipe, on-device).
// Detectors take turns frame by frame so drawing stays smooth on phones.

import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

export type Landmarks = NormalizedLandmark[];
export type Tracking = { hands: Landmarks[]; face: Landmarks | null; pose: Landmarks | null };

export async function createTracker() {
  const vision = await FilesetResolver.forVisionTasks("/wasm");
  const make = (delegate: "GPU" | "CPU") =>
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
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "/models/pose_landmarker_lite.task", delegate },
        runningMode: "VIDEO",
        numPoses: 1,
      }),
    ]);

  let models: Awaited<ReturnType<typeof make>>;
  try {
    models = await make("GPU");
  } catch {
    models = await make("CPU");
  }
  const [hands, face, pose] = models;

  let frame = 0;
  let lastTime = -1;
  const state: Tracking = { hands: [], face: null, pose: null };

  // Hands change fastest, so they get every other frame; face and body share the rest.
  function detect(video: HTMLVideoElement): Tracking {
    let now = performance.now();
    if (now <= lastTime) now = lastTime + 1;
    lastTime = now;

    const turn = frame++ % 4;
    if (turn === 0 || turn === 2) {
      state.hands = hands.detectForVideo(video, now).landmarks;
    } else if (turn === 1) {
      state.face = face.detectForVideo(video, now).faceLandmarks[0] ?? null;
    } else {
      state.pose = pose.detectForVideo(video, now).landmarks[0] ?? null;
    }
    return state;
  }

  function close() {
    hands.close();
    face.close();
    pose.close();
  }

  return { detect, close };
}
