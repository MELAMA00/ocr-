"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createWorker, OEM } from "tesseract.js";
import RetroWindow from "@/components/RetroWindow";
import PixelButton, { pixelButtonClass } from "@/components/PixelButton";
import DottedDivider from "@/components/DottedDivider";
import Badge from "@/components/Badge";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState<string>("");
  const [status, setStatus] = useState<string>("Idle");
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const workerRef = useRef<Awaited<ReturnType<typeof createWorker>> | null>(null);
  const dragCounter = useRef(0);

  // Resize/compress large images client-side to speed up OCR and reduce memory
  const prepareImage = useCallback(async (f: File): Promise<Blob> => {
    const MAX_DIMENSION = 2200; // px on the longest side (balance of quality/speed)
    const isImage = f.type.startsWith("image/");
    if (!isImage) throw new Error("Fichier non supporte");

    // If already small (< 3MB) and not huge dimensions, use as-is
    // We still guard with try/catch; if canvas fails we return original
    try {
      const bmp = await createImageBitmap(f).catch(() => null as ImageBitmap | null);
      if (!bmp) return f;

      const { width, height } = bmp;
      const longest = Math.max(width, height);
      if (longest <= MAX_DIMENSION && f.size <= 3 * 1024 * 1024) {
        bmp.close();
        return f;
      }

      const scale = MAX_DIMENSION / longest;
      const targetW = Math.round(width * Math.min(1, scale));
      const targetH = Math.round(height * Math.min(1, scale));

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        bmp.close();
        return f;
      }

      // Draw with high quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bmp, 0, 0, targetW, targetH);
      bmp.close();

      const quality = 0.85; // good balance
      const type = f.type === "image/png" ? "image/jpeg" : f.type; // prefer jpeg for size

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), type || "image/jpeg", quality)
      );
      if (!blob) return f;
      // If compression somehow bigger, fallback
      if (blob.size >= f.size) return f;
      return blob;
    } catch {
      return f;
    }
  }, []);

  const humanStatus = useMemo(() => {
    if (status === "Idle" && !file) return "Importez une image (PNG/JPG/WEBP)";
    if (status === "recognizing text") return "Reconnaissance du texte...";
    if (status === "loading tesseract core") return "Chargement du moteur...";
    if (status === "initializing tesseract") return "Initialisation...";
    if (status === "loading language traineddata") return "Telechargement du modele...";
    if (status === "Done") return "Termine.";
    if (status === "Cancelled") return "Annule.";
    if (status === "Error") return "Erreur.";
    return status;
  }, [status, file]);

  const onSelectFile = useCallback((f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Cette version n'accepte que les images (PNG/JPEG/WEBP).");
      return;
    }
    setError(null);
    setText("");
    setProgress(0);
    setStatus("Idle");
    setIsRunning(false);
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  }, []);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Theme removed

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      onSelectFile(e.dataTransfer.files?.[0]);
    },
    [onSelectFile]
  );

  const onDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current += 1;
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const onChoose = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSelectFile(e.target.files?.[0] ?? undefined);
    },
    [onSelectFile]
  );

  async function runOCR() {
    if (!file) return;
    setIsRunning(true);
    setError(null);
    setText("");
    setProgress(0);

    // Lazily create or reuse a single worker (faster, more stable)
    if (!workerRef.current) {
      workerRef.current = await createWorker("eng", OEM.LSTM_ONLY, {
        logger: (m: { status?: string; progress?: number }) => {
          if (m.status) setStatus(m.status);
          if (typeof m.progress === "number") {
            setProgress(Math.max(1, Math.round(m.progress * 100)));
          }
        },
      });
    }
    const worker = workerRef.current;

    try {
      // Preprocess image to speed up OCR and reduce crashes on huge inputs
      const inputBlob = await prepareImage(file);
      const toRecognize = inputBlob instanceof File ? inputBlob : new File([inputBlob], file.name, { type: inputBlob.type || file.type });

      const { data } = await worker.recognize(toRecognize, { rectangle: undefined });
      setText(data.text || "");
      setStatus("Done");
      setProgress(100);
    } catch (err: any) {
      if (status !== "Cancelled") {
        const msg = String(err?.message || err || "");
        // Map some common fetch/wasm errors to friendlier text
        const friendly =
          msg.includes("Failed to fetch") || msg.includes("NetworkError")
            ? "Telechargement du modele echoue. Verifiez la connexion et reessayez."
            : msg.includes("wasm") || msg.includes("WebAssembly")
            ? "Le moteur WebAssembly n'a pas pu se charger. Reessayez dans un nouvel onglet."
            : msg.includes("Out of memory") || msg.includes("memory")
            ? "Image trop volumineuse. Essayez avec une image plus petite."
            : undefined;
        setError(friendly ?? (msg || "Echec OCR"));
        setStatus("Error");
      }
    } finally {
      // Keep worker alive for next runs; terminate on cancel/unmount
      setIsRunning(false);
    }
  }

  async function cancelOCR() {
    if (workerRef.current) {
      setStatus("Cancelled");
      setIsRunning(false);
      try {
        await workerRef.current.terminate();
      } finally {
        workerRef.current = null;
      }
    }
  }

  // Cleanup worker on unmount to free resources
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate().catch(() => {});
        workerRef.current = null;
      }
    };
  }, []);

  function copyText() {
    if (text) navigator.clipboard.writeText(text);
  }

  return (
    <div className="min-h-screen text-neutral-900">
      {/* HEADER */}
      <header className="border-b border-neutral-200 sticky top-0 z-20 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 grid place-items-center rounded-md bg-neutral-900 text-white font-semibold">OCR</div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight font-[family-name:var(--font-silkscreen)] tracking-widest">OCR</h1>
            
          </div>
          <div className="flex items-center gap-2">
            <Badge>DEMO</Badge>
          </div>
      
        </div>
      </header>

      {/* MAIN */}
      <main className="mx-auto max-w-7xl px-4 py-8 grid gap-8 lg:gap-10 md:grid-cols-2">
        {/* LEFT: Input */}
        <section className="space-y-4">
          <RetroWindow title="IMAGE SOURCE" className="shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 md:gap-8 mb-4">
              <h2 className="font-semibold font-[family-name:var(--font-silkscreen)] uppercase tracking-[0.15em] whitespace-nowrap flex items-center gap-3 text-base sm:text-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/window.svg" alt="" className="w-4 h-4 sm:w-5 sm:h-5" />
                Image source
              </h2>
              <div className="flex items-center gap-2">
              <label className={[pixelButtonClass(), 'cursor-pointer w-full sm:w-auto justify-center'].join(' ')}>
                Importer
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={onChoose}
                />
              </label>
            </div>
            <DottedDivider className="my-4 md:my-5" />
            </div>

            {/* Dropzone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              className={[
                "relative border-2 border-dashed rounded-xl p-6 sm:p-8 transition-colors",
                isDragging
                  ? "border-neutral-900 bg-neutral-50/60"
                  : "bg-white border-neutral-300 hover:bg-neutral-50",
              ].join(" ")}
              aria-label="Zone de depot"
            >
              <p className="text-sm text-neutral-600 mb-3">
                Faites glisser une image ici, ou{" "}
                <label className="underline cursor-pointer">
                  choisissez un fichier
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={onChoose}
                  />
                </label>
              </p>

              {/* Preview card */}
              {preview ? (
                <div className="rounded-lg overflow-hidden border border-neutral-200 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Apercu" className="w-full object-contain max-h-[380px]" />
                  <div className="p-3 text-xs text-neutral-600 flex items-center justify-between">
                    <span className="truncate">
                      {file?.name} - {((file?.size ?? 0) / 1024 / 1024).toFixed(2)} MB
                    </span>
                    <span>{file?.type}</span>
                  </div>
                </div>
              ) : (
                <div className="h-40 grid place-items-center text-neutral-500">
                  Aucune image selectionnee
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <PixelButton onClick={runOCR} disabled={!file || isRunning} variant="primary">
                {isRunning ? "Analyse en cours..." : "Lancer l'OCR"}
              </PixelButton>
              <PixelButton onClick={cancelOCR} disabled={!isRunning}>Annuler</PixelButton>
              <PixelButton
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                  setText("");
                  setError(null);
                  setProgress(0);
                  setStatus("Idle");
                }}
                disabled={isRunning || (!file && !text)}
              >
                Reinitialiser
              </PixelButton>
            </div>

            {/* Status + Progress */}
            <div className="mt-4 space-y-2" aria-live="polite">
              <div className="h-2 w-full bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-gradient-to-r from-neutral-900 to-neutral-700 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-sm text-neutral-700">
                {humanStatus} {progress ? `- ${progress}%` : ""}
              </div>

              {error && (
                <div className="text-sm text-red-700 border border-red-300 bg-red-50 rounded-md p-3 flex items-start gap-2">
                  <span aria-hidden>⚠️</span>
                  <span>{error}</span>
                </div>
              )}
            </div>
          </RetroWindow>
        </section>

        {/* RIGHT: Result */}
        <section className="space-y-4">
          <RetroWindow title="OCR RESULT" className="shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 md:gap-8 mb-4">
              <h2 className="font-semibold font-[family-name:var(--font-silkscreen)] uppercase tracking-[0.15em] whitespace-nowrap flex items-center gap-3 text-base sm:text-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/file.svg" alt="" className="w-4 h-4 sm:w-5 sm:h-5" />
                Resultat OCR
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <PixelButton className="w-full sm:w-auto" onClick={copyText} disabled={!text}>Copier</PixelButton>
                <a
                  href={"data:text/plain;charset=utf-8," + encodeURIComponent(text || "")}
                  download="ocr.txt"
                  className={[pixelButtonClass(), 'w-full sm:w-auto text-center', !text ? "pointer-events-none opacity-50" : ""].join(" ")}
                >
                  Telecharger .txt
                </a>
              </div>
            </div>
            <DottedDivider className="my-4 md:my-5" />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Le texte reconnu s'affichera ici..."
              className="min-h-[32vh] md:min-h-[360px] w-full rounded-md border border-neutral-200 bg-white p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-neutral-300"
              spellCheck={false}
            />
          </RetroWindow>

          <p className="text-xs text-neutral-500">
            Astuce: la precision est meilleure avec des images nettes, contraste eleve, et une
            resolution &gt;= 300 DPI.
          </p>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-neutral-200 py-6 text-center text-xs text-neutral-500 font-[family-name:var(--font-silkscreen)] tracking-widest">
        OCR cote client avec Tesseract.js - Aucune donnee envoyee au serveur
      </footer>
    </div>
  );
}
