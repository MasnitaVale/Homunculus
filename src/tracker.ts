// Finds hands, face and body in the camera image (MediaPipe, on-device).
// The models run in a background worker; the mirror keeps drawing at full speed
// and uses the latest positions whenever they arrive.

import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type Landmarks = NormalizedLandmark[];
export type Tracking = { hands: Landmarks[]; face: Landmarks | null; pose: Landmarks | null };
type Turn = "hands" | "face" | "pose";

// Hands change fastest, so they get every other turn.
const TURNS: Turn[] = ["hands", "face", "hands", "pose"];
const MAX_SIDE = 480; // the models look at a small copy of the frame: much faster

export async function createTracker() {
  const worker = new Worker(new URL("./detector.worker.ts", import.meta.url), { type: "classic" });
  const state: Tracking = { hands: [], face: null, pose: null };
  let busy = false;
  let turn = 0;
  let lastTime = 0;

  await new Promise<void>((resolve, reject) => {
    worker.onmessage = (e) => {
      if (e.data.type === "ready") resolve();
      else if (e.data.type === "error") reject(new Error(e.data.message));
    };
    worker.onerror = (e) => reject(new Error(e.message));
    worker.postMessage({ type: "init" });
  });

  worker.onmessage = (e) => {
    if (e.data.type !== "result") return;
    if (e.data.turn === "hands") state.hands = e.data.result;
    else if (e.data.turn === "face") state.face = e.data.result;
    else state.pose = e.data.result;
    busy = false;
  };

  // Returns the latest known positions straight away, and sends a new frame
  // to the worker if it's free.
  function detect(video: HTMLVideoElement): Tracking {
    if (!busy && video.videoWidth) {
      busy = true;
      const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
      const w = Math.round(video.videoWidth * scale);
      const h = Math.round(video.videoHeight * scale);
      createImageBitmap(video, { resizeWidth: w, resizeHeight: h, resizeQuality: "low" })
        .then((bitmap) => {
          const time = Math.max(performance.now(), lastTime + 1);
          lastTime = time;
          worker.postMessage({ type: "frame", bitmap, time, turn: TURNS[turn++ % TURNS.length] }, [bitmap]);
        })
        .catch(() => {
          busy = false;
        });
    }
    return state;
  }

  function close() {
    worker.terminate();
  }

  return { detect, close };
}
