"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createWorker } from "tesseract.js";
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

    const worker = await createWorker('eng', undefined, {
      logger: (m: { status?: string; progress?: number }) => {
        if (m.status) setStatus(m.status);
        if (typeof m.progress === "number") {
          setProgress(Math.max(1, Math.round(m.progress * 100)));
        }
      },
    });
    workerRef.current = worker;

    try {
      const { data } = await worker.recognize(file);
      setText(data.text || "");
      setStatus("Done");
      setProgress(100);
    } catch (err: any) {
      if (status !== "Cancelled") {
        setError(err?.message ?? "Echec OCR");
        setStatus("Error");
      }
    } finally {
      try {
        await worker.terminate();
      } finally {
        workerRef.current = null;
        setIsRunning(false);
      }
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
