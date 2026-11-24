import { useEffect, useRef, useState } from "react";
import { content } from "./content";
import { createTracker } from "./tracker";
import { createBody } from "./body";
import { createWarp } from "./warp";
import { createRenderer } from "./render";
import { settle } from "./geometry";

type Phase = "intro" | "loading" | "running" | "camera-error" | "load-error";
const MAX_RECORDING_MS = 10_000;

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Start screen: the text scattered across the page, with a "map" of body words
// sized like the homunculus. Privacy note and Start button stay plain.
function Intro({ phase, onStart }: { phase: Phase; onStart: () => void }) {
  return (
    <main className="intro">
      <h1>{content.title}</h1>
      <p className="map" aria-hidden="true">
        {content.map.map((m) => (
          <span key={m.word} style={{ fontSize: `${m.size}em` }}>
            {m.word}
          </span>
        ))}
      </p>
      <div className="fragments">
        {content.fragments.map((f) => (
          <p key={f.text} className={`frag at-${f.at} size-${f.size}`}>
            {f.text}
          </p>
        ))}
      </div>
      <div className="plain">
        <p className="muted">{content.privacy}</p>
        {phase === "camera-error" ? <p className="error">{content.cameraError}</p> : null}
        {phase === "load-error" ? <p className="error">{content.loadError}</p> : null}
        <button type="button" className="primary" onClick={onStart}>
          {content.start}
        </button>
        <p className="muted small">{content.sharesNote}</p>
        <p className="muted small">
          <a href={content.credit.url}>{content.credit.label}</a>
        </p>
      </div>
    </main>
  );
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [strength, setStrength] = useState(1);
  const [showLabels, setShowLabels] = useState(true);
  const [recording, setRecording] = useState(false);
  const [seenHands, setSeenHands] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const recCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const options = useRef({ strength, showLabels });
  options.current = { strength, showLabels };

  const active = phase === "loading" || phase === "running";

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let tracker: Awaited<ReturnType<typeof createTracker>> | null = null;

    (async () => {
      const portrait = window.innerHeight > window.innerWidth;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: portrait ? 720 : 1280 },
            height: { ideal: portrait ? 1280 : 720 },
          },
          audio: false,
        });
      } catch {
        if (!stopped) setPhase("camera-error");
        return;
      }
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play().catch(() => {});

      try {
        tracker = await createTracker();
      } catch {
        if (!stopped) setPhase("load-error");
        return;
      }
      if (stopped) return;

      const body = createBody();
      const warp = createWarp(canvasRef.current!);
      const renderer = createRenderer(overlayRef.current!);
      setPhase("running");

      const loop = () => {
        if (stopped) return;
        if (video.readyState >= 2 && video.videoWidth) {
          const o = options.current;
          const aspect = video.videoWidth / video.videoHeight;
          const tracking = tracker!.detect(video);
          if (tracking.hands.length) setSeenHands(true);
          const b = body.update(tracking, aspect);
          const bulges = settle(
            b.bulges.map((x) => ({ ...x, s: Math.max(-0.7, Math.min(0.9, x.s * o.strength)) })),
            aspect,
          );
          warp.draw(video, bulges);
          renderer.draw(video.videoWidth, video.videoHeight, {
            tracking,
            bulges,
            contacts: b.contacts,
            mouthOpen: b.mouthOpen,
            showLabels: o.showLabels,
            aspect,
          });
          // While recording, combine both layers into the canvas being recorded.
          const rec = recCanvasRef.current;
          if (rec) {
            const rctx = rec.getContext("2d")!;
            rctx.drawImage(canvasRef.current!, 0, 0, rec.width, rec.height);
            rctx.drawImage(overlayRef.current!, 0, 0, rec.width, rec.height);
          }
        }
        raf = requestAnimationFrame(loop);
      };
      loop();
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      recorderRef.current?.state === "recording" && recorderRef.current.stop();
      stream?.getTracks().forEach((t) => t.stop());
      tracker?.close();
    };
  }, [active]);

  // Both layers (image + labels) flattened into one picture.
  const flatten = () => {
    const base = canvasRef.current!;
    const c = document.createElement("canvas");
    c.width = base.width;
    c.height = base.height;
    const cx = c.getContext("2d")!;
    cx.drawImage(base, 0, 0);
    cx.drawImage(overlayRef.current!, 0, 0);
    return c;
  };

  const savePhoto = () => flatten().toBlob((b) => b && download(b, "homunculus.png"), "image/png");

  const toggleRecording = () => {
    const current = recorderRef.current;
    if (current && current.state === "recording") {
      current.stop();
      return;
    }
    if (!canvasRef.current || typeof MediaRecorder === "undefined") return;
    const canvas = flatten();
    recCanvasRef.current = canvas;
    const type = ["video/mp4", "video/webm;codecs=vp9", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(canvas.captureStream(30), type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      recCanvasRef.current = null;
      setRecording(false);
      const blob = new Blob(chunks, { type: recorder.mimeType });
      download(blob, `homunculus.${recorder.mimeType.includes("mp4") ? "mp4" : "webm"}`);
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
    setTimeout(() => recorder.state === "recording" && recorder.stop(), MAX_RECORDING_MS);
  };

  if (!active) return <Intro phase={phase} onStart={() => setPhase("loading")} />;

  return (
    <main className="stage">
      <video ref={videoRef} playsInline muted hidden />
      <canvas ref={canvasRef} aria-label={content.title} />
      <canvas ref={overlayRef} className="overlay" aria-hidden="true" />
      {phase === "loading" ? <p className="status">{content.loading}</p> : null}
      {phase === "running" ? (
        <>
          <p className="hint" style={{ opacity: seenHands ? 0 : 1 }}>
            {content.hint}
          </p>
          {recording ? <span className="rec" aria-live="polite">● REC</span> : null}
          <button type="button" className="exit" onClick={() => setPhase("intro")}>
            {content.stop}
          </button>
          <div className="controls">
            <label className="row">
              {content.strength}
              <input
                type="range"
                min={0}
                max={1.4}
                step={0.05}
                value={strength}
                onChange={(e) => setStrength(Number(e.target.value))}
              />
            </label>
            <div className="row">
              <button type="button" aria-pressed={showLabels} onClick={() => setShowLabels((v) => !v)}>
                {content.labels}
              </button>
              <button type="button" onClick={savePhoto}>
                {content.photo}
              </button>
              <button type="button" className={recording ? "recording" : ""} onClick={toggleRecording}>
                {recording ? content.stopRecording : content.record}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
