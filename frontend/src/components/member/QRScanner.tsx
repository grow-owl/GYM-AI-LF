import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import jsQR from "jsqr";
import { Camera, X, AlertTriangle, Keyboard, ScanLine, Zap } from "lucide-react";

type ScanStatus = "starting" | "scanning" | "denied" | "unsupported" | "no-camera" | "error";

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  allowManualEntry?: boolean;
}

const statusCopy: Record<Exclude<ScanStatus, "starting" | "scanning">, string> = {
  denied: "Camera access was denied. Allow camera permission in your browser settings, then try again.",
  unsupported: "Camera scanning isn't supported on this device or browser.",
  "no-camera": "No camera was found on this device.",
  error: "Couldn't start the camera. Please try again.",
};

export default function QRScanner({ onScan, onClose, allowManualEntry = true }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const hasScannedRef = useRef(false);

  const [status, setStatus] = useState<ScanStatus>("starting");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState("");

  const stopStream = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || hasScannedRef.current) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });
        if (code?.data) {
          hasScannedRef.current = true;
          stopStream();
          onScan(code.data);
          return;
        }
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [onScan, stopStream]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next } as unknown as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      // Some devices report torch capability but reject the constraint — fail silently.
    }
  }, [torchOn]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const capabilities = stream.getVideoTracks()[0]?.getCapabilities?.() as
          | (MediaTrackCapabilities & { torch?: boolean })
          | undefined;
        setTorchSupported(Boolean(capabilities?.torch));

        setStatus("scanning");
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        if (cancelled) return;

        const name = (err as DOMException)?.name;
        if (name === "NotAllowedError" || name === "SecurityError") setStatus("denied");
        else if (name === "NotFoundError" || name === "OverconstrainedError") setStatus("no-camera");
        else setStatus("error");
      }
    }

    start();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [stopStream, tick]);

  function handleManualSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = manualCode.trim();
    if (!trimmed) return;

    hasScannedRef.current = true;
    stopStream();
    onScan(trimmed);
  }

  const hasError = status === "denied" || status === "unsupported" || status === "no-camera" || status === "error";

  return (
    <div className="flex flex-col items-center">
      {/* Header row */}
      <div className="flex items-center gap-2 mb-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-(--color-accent-soft) text-(--color-accent-text)">
          <ScanLine size={15} />
        </span>
        <p className="font-display text-sm font-semibold text-(--color-text)">Scan gym check-in code</p>
      </div>

      <div className="relative w-full max-w-sm aspect-square rounded-3xl overflow-hidden bg-(--color-navbar) shadow-lg">
        <video
          ref={videoRef}
          muted
          playsInline
          className={`h-full w-full object-cover transition-opacity duration-300 ${
            status === "scanning" ? "opacity-100" : "opacity-0"
          }`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {status === "scanning" && (
          <>
            {/* Dim scrim outside the target box so the frame reads clearly */}
            <div className="pointer-events-none absolute inset-0 [box-shadow:inset_0_0_0_2000px_rgba(0,0,0,0.32)] [clip-path:polygon(0%_0%,0%_100%,12%_100%,12%_12%,88%_12%,88%_88%,12%_88%,12%_100%,100%_100%,100%_0%)]" />

            <div className="pointer-events-none absolute inset-[12%] rounded-2xl border border-white/30">
              <span className="absolute -top-1 -left-1 h-8 w-8 border-t-[3px] border-l-[3px] border-(--color-accent) rounded-tl-2xl" />
              <span className="absolute -top-1 -right-1 h-8 w-8 border-t-[3px] border-r-[3px] border-(--color-accent) rounded-tr-2xl" />
              <span className="absolute -bottom-1 -left-1 h-8 w-8 border-b-[3px] border-l-[3px] border-(--color-accent) rounded-bl-2xl" />
              <span className="absolute -bottom-1 -right-1 h-8 w-8 border-b-[3px] border-r-[3px] border-(--color-accent) rounded-br-2xl" />
              <div className="absolute left-0 top-0 h-0.5 w-full bg-gradient-to-r from-transparent via-(--color-accent) to-transparent shadow-[0_0_8px_var(--color-accent)] scan-line-anim" />
            </div>

            {/* Top scrim with live badge */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/50 to-transparent flex items-start justify-center pt-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90">
                <span className="h-1.5 w-1.5 rounded-full bg-(--color-good) animate-pulse" /> Camera live
              </span>
            </div>

            {torchSupported && (
              <button
                type="button"
                onClick={toggleTorch}
                aria-label="Toggle flashlight"
                className={`absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-sm transition-colors ${
                  torchOn ? "bg-(--color-accent) text-(--color-navbar)" : "bg-black/40 text-white"
                }`}
              >
                <Zap size={16} fill={torchOn ? "currentColor" : "none"} />
              </button>
            )}
          </>
        )}

        {status === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-white/85">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
              <Camera size={20} className="animate-pulse" />
            </span>
            <p className="text-xs font-medium">Opening camera…</p>
          </div>
        )}

        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-(--color-warn-soft) text-(--color-warn)">
              <AlertTriangle size={22} />
            </span>
            <p className="text-xs leading-relaxed text-white/85">{statusCopy[status]}</p>
          </div>
        )}
      </div>

      <p className="text-xs text-(--color-text-faint) mt-4 text-center max-w-xs">
        {status === "scanning"
          ? "Position the gym's check-in QR code inside the frame"
          : "You can also enter the check-in code shown at the gym manually."}
      </p>

      {allowManualEntry && !manualMode && (
        <button
          onClick={() => setManualMode(true)}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-(--color-accent-text) hover:text-(--color-accent-strong) transition-colors"
        >
          <Keyboard size={13} /> Enter code manually
        </button>
      )}

      {manualMode && (
        <form onSubmit={handleManualSubmit} className="mt-3 w-full max-w-sm flex gap-2 animate-fade-in-up">
          <input
            autoFocus
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Check-in code"
            className="flex-1 rounded-full border border-(--color-border) bg-(--color-surface) px-4 py-2.5 text-sm text-(--color-text) outline-none focus:border-(--color-accent)"
          />
          <button
            type="submit"
            className="rounded-full bg-(--color-accent) hover:bg-(--color-accent-strong) text-(--color-navbar) text-sm font-semibold px-4 py-2.5 transition-colors"
          >
            Go
          </button>
        </form>
      )}

      <button
        onClick={() => {
          stopStream();
          onClose();
        }}
        className="mt-5 flex items-center gap-1.5 rounded-full border border-(--color-border) text-(--color-text-muted) hover:text-(--color-text) hover:border-(--color-text-faint) text-sm font-medium px-5 py-2.5 transition-colors"
      >
        <X size={15} /> Cancel
      </button>
    </div>
  );
}
