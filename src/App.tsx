import { useEffect, useRef, useState } from "react";
import { content } from "./content";
import { createTracker, SLOTS, type Bulge } from "./tracker";
import { createWarp } from "./warp";

type Phase = "intro" | "loading" | "running" | "camera-error" | "load-error";

// Moves the drawn bulges smoothly toward what the tracker found, and fades
// them out when a hand or face disappears.
function follow(current: Bulge[], targets: (Bulge | null)[]) {
  targets.forEach((t, i) => {
    const c = current[i];
    if (t) {
      const fresh = c.s === 0;
      const k = fresh ? 1 : 0.45;
      c.x += (t.x - c.x) * k;
      c.y += (t.y - c.y) * k;
      c.r += (t.r - c.r) * k;
      c.s += (t.s - c.s) * 0.25;
    } else {
      c.s = Math.max(0, c.s - 0.05);
    }
  });
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [strength, setStrength] = useState(1);
  const [seenHands, setSeenHands] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strengthRef = useRef(strength);
  strengthRef.current = strength;

  useEffect(() => {
    if (phase !== "loading") return;
    let stopped = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let tracker: Awaited<ReturnType<typeof createTracker>> | null = null;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
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

      const warp = createWarp(canvasRef.current!);
      const bulges: Bulge[] = Array.from({ length: SLOTS }, () => ({ x: 0.5, y: 0.5, r: 0, s: 0 }));
      setPhase("running");

      const loop = () => {
        if (stopped) return;
        if (video.readyState >= 2) {
          const targets = tracker!.detect(video, video.videoWidth / video.videoHeight);
          if (targets[0] || targets[1]) setSeenHands(true);
          follow(bulges, targets);
          warp.draw(video, bulges, strengthRef.current);
        }
        raf = requestAnimationFrame(loop);
      };
      loop();
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      tracker?.close();
    };
  }, [phase === "loading" || phase === "running"]); // eslint-disable-line react-hooks/exhaustive-deps

  const savePhoto = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "homunculus.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  };

  if (phase === "intro" || phase === "camera-error" || phase === "load-error") {
    return (
      <main className="intro">
        <h1>{content.title}</h1>
        <p>{content.intro}</p>
        <p className="muted">{content.privacy}</p>
        {phase === "camera-error" ? <p className="error">{content.cameraError}</p> : null}
        {phase === "load-error" ? <p className="error">{content.loadError}</p> : null}
        <button type="button" className="primary" onClick={() => setPhase("loading")}>
          {content.start}
        </button>
        <p className="muted">
          <a href={content.credit.url}>{content.credit.label}</a>
        </p>
      </main>
    );
  }

  return (
    <main className="stage">
      <video ref={videoRef} playsInline muted hidden />
      <canvas ref={canvasRef} aria-label={content.title} />
      {phase === "loading" ? <p className="status">{content.loading}</p> : null}
      {phase === "running" ? (
        <>
          <p className="hint" style={{ opacity: seenHands ? 0 : 1 }}>
            {content.hint}
          </p>
          <div className="controls">
            <label>
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
            <button type="button" onClick={savePhoto}>
              {content.photo}
            </button>
            <button type="button" onClick={() => setPhase("intro")}>
              {content.stop}
            </button>
          </div>
        </>
      ) : null}
    </main>
  );
}
