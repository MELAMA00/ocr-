"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { createWorker } from "tesseract.js";
// Theme toggle removed

type LangCode = "eng" | "fra";

export default function Home() {
  // state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState<string>("");
  const [lang, setLang] = useState<LangCode>("eng");
  const [status, setStatus] = useState<string>("Idle");
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // worker ref to allow cancel
  const workerRef = useRef<Awaited<ReturnType<typeof createWorker>> | null>(null);

  // human-friendly status
  const humanStatus = useMemo(() => {
    if (status === "Idle" && !file) return "Importez une image (PNG/JPG/WEBP)";
    if (status === "recognizing text") return "Reconnaissance du texte…";
    if (status === "loading tesseract core") return "Chargement du moteur…";
    if (status === "initializing tesseract") return "Initialisation…";
    if (status === "loading language traineddata")
      return `Téléchargement du modèle (${lang})…`;
    if (status === "Done") return "Terminé ✅";
    if (status === "Cancelled") return "Annulé ⛔";
    if (status === "Error") return "Erreur ❌";
    return status;
  }, [status, lang, file]);

  // helpers
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
    setPreview(URL.createObjectURL(f));
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLLabelElement | HTMLDivElement>) => {
      e.preventDefault();
      onSelectFile(e.dataTransfer.files?.[0] ?? undefined);
    },
    [onSelectFile]
  );

  const onChoose = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onSelectFile(e.target.files?.[0]),
    [onSelectFile]
  );

  async function runOCR() {
    if (!file) return;
    setIsRunning(true);
    setError(null);
    setText("");
    setProgress(0);

    const worker = await createWorker(lang, 1, {
      logger: (m) => {
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
        setError(err?.message ?? "Échec OCR");
        setStatus("Error");
      }
    } finally {
      await worker.terminate();
      workerRef.current = null;
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

  function copyText() {
    if (text) navigator.clipboard.writeText(text);
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      {/* HEADER */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-neutral-950/80 backdrop-blur border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-[1100px] px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-black text-white grid place-items-center font-bold">
              OCR
            </div>
            <div className="leading-none">
              <div className="font-semibold text-lg">OCR Studio</div>
              <div className="text-xs text-neutral-500">Responsive Demo</div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <label className="text-sm hidden sm:flex items-center gap-2">
              Langue
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as LangCode)}
                className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm"
              >
                <option value="eng">English (eng)</option>
                <option value="fra">Français (fra)</option>
              </select>
            </label>

            {/* Theme toggle removed */}

            <button
              className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={() => window.location.reload()}
              title="Reset"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="mx-auto w-full max-w-[1100px] px-3 sm:px-4 py-4 sm:py-6">
        {/* GRID: 1 col on mobile, 2 cols >= lg */}
        <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
          {/* LEFT PANEL */}
          <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
              <h2 className="font-semibold text-base sm:text-lg">Image source</h2>
              {/* visible on small screens */}
              <label className="block lg:hidden">
                <span className="sr-only">Importer</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={onChoose}
                  className="hidden"
                />
                <span className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
                  Importer
                </span>
              </label>
            </div>

            {/* Dropzone */}
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className={[
                "block border-2 border-dashed rounded-xl p-4 sm:p-6 md:p-8 text-center cursor-pointer",
                "bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700",
                "hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors",
              ].join(" ")}
            >
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onChoose}
                className="hidden"
              />
              <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
                Faites glisser une image ici, ou{" "}
                <span className="underline">choisissez un fichier</span>
              </p>

              {preview ? (
                <div className="mt-4 sm:mt-6 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="preview"
                    className="w-full object-contain max-h-[45vh] sm:max-h-[50vh]"
                  />
                  <div className="p-2 sm:p-3 text-xs text-neutral-600 dark:text-neutral-400 flex items-center justify-between">
                    <span className="truncate">
                      {file?.name} • {((file?.size ?? 0) / 1024 / 1024).toFixed(2)} MB
                    </span>
                    <span className="hidden sm:inline">{file?.type}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-6 h-28 sm:h-32 grid place-items-center text-neutral-500">
                  Aucune image sélectionnée
                </div>
              )}
            </label>

            {/* Actions + progress */}
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  onClick={runOCR}
                  disabled={!file || isRunning}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
                >
                  {isRunning ? "Analyse en cours…" : "Lancer l’OCR"}
                </button>
                <button
                  onClick={cancelOCR}
                  disabled={!isRunning}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                    setText("");
                    setProgress(0);
                    setStatus("Idle");
                    setError(null);
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700"
                >
                  Réinitialiser
                </button>
              </div>

              <div className="space-y-2">
                <div
                  className="h-2 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <div
                    className="h-2 bg-neutral-900 dark:bg-neutral-100 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300">
                  {humanStatus} {progress ? `• ${progress}%` : ""}
                </div>
                {error && (
                  <div className="text-sm text-red-600 border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20 rounded-md p-3">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* RIGHT PANEL */}
          <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 sm:p-5">
            {/* Collapsible header on small screens to save space */}
            <details open className="group">
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <h2 className="font-semibold text-base sm:text-lg">Résultat OCR</h2>
                <span className="text-xs text-neutral-500 group-open:rotate-180 transition-transform">
                  ▾
                </span>
              </summary>

              <div className="mt-3 sm:mt-4">
                <div className="flex items-center justify-end gap-2 mb-2">
                  <button
                    onClick={copyText}
                    disabled={!text}
                    className="px-3 py-1.5 text-sm rounded-md border border-neutral-300 dark:border-neutral-700 disabled:opacity-50"
                  >
                    Copier
                  </button>
                  <a
                    href={"data:text/plain;charset=utf-8," + encodeURIComponent(text || "")}
                    download="ocr.txt"
                    className={[
                      "px-3 py-1.5 text-sm rounded-md border border-neutral-300 dark:border-neutral-700",
                      !text ? "pointer-events-none opacity-50" : "",
                    ].join(" ")}
                  >
                    Télécharger .txt
                  </a>
                </div>

                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Le texte reconnu s’affichera ici…"
                  className="min-h-[40vh] w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-700"
                />
              </div>
            </details>
          </section>
        </div>
      </main>

      {/* MOBILE STICKY ACTION BAR (only when running & on small screens) */}
      {isRunning && (
        <div className="fixed bottom-3 left-0 right-0 px-3 lg:hidden">
          <div className="mx-auto max-w-[600px] rounded-xl border shadow-sm bg-white/90 dark:bg-neutral-900/90 backdrop-blur border-neutral-200 dark:border-neutral-800 p-2 flex items-center gap-2">
            <div className="flex-1">
              <div className="h-2 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-neutral-900 dark:bg-neutral-100 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-xs mt-1 text-neutral-700 dark:text-neutral-300 truncate">
                {humanStatus} {progress ? `• ${progress}%` : ""}
              </div>
            </div>
            <button
              onClick={cancelOCR}
              className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-sm"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 py-6 text-center text-xs text-neutral-500">
        Client-side OCR avec Tesseract.js • Aucune donnée envoyée au serveur
      </footer>
    </div>
  );
}
