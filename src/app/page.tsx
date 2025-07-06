"use client";

import { useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import ResultCard from "@/components/ResultCard";
import { inter } from "@/lib/fonts";
import { compressImage } from "@/lib/image";
import {
  ArrowRight,
  AlertCircle,
  ScanEye,
  Download,
  X as CloseIcon,
} from "lucide-react";
import { CustomSelect } from "@/components/ui/CustomSelect";

type GenerationMode = "fiche" | "critique";

export default function HomePage() {
  const [input, setInput] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [mode, setMode] = useState<GenerationMode>("fiche");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<null | {
    fiche: string;
    meta: string;
    newsletter: string;
  }>(null);
  const [error, setError] = useState<string | null>(null);

  // pour la capture webcam desktop
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // générer l’aperçu à chaque changement de fichier
  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setImagePreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setImagePreview("");
  }, [imageFile]);

  // démarrer/arrêter la webcam desktop
  useEffect(() => {
    if (isCapturing) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        })
        .catch(() =>
          setError(
            "Impossible d'accéder à la caméra, vérifiez vos permissions.",
          ),
        );
    } else {
      const stream = videoRef.current?.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
      }
    }
  }, [isCapturing]);

  // helper de compression + setImageFile
  async function compressAndSet(file: File) {
    setLoading(true);
    try {
      // on passe uniquement la dimension max, plus de quality pour le PNG
      const compressed = await compressImage(file, 1500);
      setImageFile(compressed);
    } catch {
      // en cas d'échec, on conserve l'original
      setImageFile(file);
    } finally {
      setLoading(false);
      setIsCapturing(false);
    }
  }

  // capture de la photo (desktop)
  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg"),
    );
    if (!blob) return;

    const rawFile = new File([blob], `capture-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    await compressAndSet(rawFile);
  };

  // soumission du formulaire
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData();
    form.append("mode", mode);
    form.append("title", title);
    form.append("author", author);
    if (imageFile) form.append("coverImage", imageFile);
    else form.append("textSource", input);

    try {
      const res = await fetch("/api/generate/", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur inconnue");
      setResult({
        fiche: data.fiche,
        meta: data.meta,
        newsletter: data.newsletter,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setCopied({});
    }
  };

  // copier dans le presse-papiers
  const copyToClipboard = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => setCopied((prev) => ({ ...prev, [key]: false })), 2000);
  };

  return (
    <main className="max-w-4xl w-full bg-gradient-to-br from-[#fdfcfb] to-[#dedace] px-6 py-8 bg-white/80 rounded-3xl shadow-xl border border-gray-200 backdrop-blur-lg">
      <h1
        className={`${inter.className} text-4xl font-bold text-center mb-10 text-gray-800`}
      >
        Votre générateur de contenus automatisé
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white/50 p-6 rounded-2xl shadow-sm backdrop-blur-sm"
      >
        {/* Mode de génération */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Choisissez un type de génération
          </label>
          <CustomSelect
            value={mode}
            onChange={(v) => setMode(v as GenerationMode)}
            options={[
              { value: "fiche", label: "Fiche produit + SEO + newsletter" },
              { value: "critique", label: "Texte critique littéraire" },
            ]}
            placeholder="Choisissez un mode"
          />
        </div>

        {/* Auteur & Titre */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Indiquez le nom de l&apos;auteur{" "}
              <span className="text-[#9542e3]">*</span>
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full p-2 mt-1 rounded-md border border-gray-300 bg-white focus:ring focus:ring-pink-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Indiquez le titre du livre{" "}
              <span className="text-[#9542e3]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 mt-1 rounded-md border border-gray-300 bg-white focus:ring focus:ring-pink-200"
            />
          </div>
        </div>

        {/* Légende champs obligatoires */}
        <p className="text-sm text-[#9542e3]">* Champs obligatoires</p>

        {/* Option 1 : Texte */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <ArrowRight className="w-6 h-6 text-gray-700" />
            OPTION 1 : Insérez le texte source (laisser vide si photo)
          </label>
          <textarea
            rows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full p-2 mt-1 rounded-md border bg-white disabled:bg-gray-100"
            placeholder="Collez ici le texte de la 4ᵉ de couverture"
            disabled={!!imageFile}
          />
        </div>

        {/* Option 2 : Photo */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <ArrowRight className="w-6 h-6 text-gray-700" />
            OPTION 2 : Photo de la 4ᵉ de couverture
          </label>

          <div className="flex flex-col md:flex-row gap-2">
            {/* Mobile: input natif */}
            <label
              htmlFor="camera-input"
              className="block md:hidden w-full h-10 flex items-center justify-center gap-1 px-4 bg-white border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 text-gray-700"
            >
              <ScanEye className="mr-1 h-5 w-5 text-[#9542e3] animate-pulse" />
              Prenez une photo
            </label>
            <input
              id="camera-input"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={async (e: ChangeEvent<HTMLInputElement>) => {
                const f = e.target.files?.[0] ?? null;
                if (f) await compressAndSet(f);
                setInput("");
                setIsCapturing(false);
              }}
            />

            {/* Desktop: UI webcam */}
            {!isCapturing && (
              <Button
                type="button"
                variant="outline"
                className="hidden md:flex md:flex-1 h-10 items-center justify-center gap-1 text-sm"
                onClick={() => {
                  setError(null);
                  setIsCapturing(true);
                }}
              >
                <ScanEye className="mr-1 h-5 w-5 text-[#9542e3] animate-pulse" />
                Prenez une photo
              </Button>
            )}
            {isCapturing && (
              <div className="hidden md:flex flex-col items-center gap-2">
                <video ref={videoRef} className="w-48 h-64 bg-black rounded" />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="h-10"
                    onClick={handleCapture}
                  >
                    Capturer
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10"
                    onClick={() => setIsCapturing(false)}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}

            {/* Import classique */}
            <label
              htmlFor="cover-input"
              className="w-full md:flex-1 h-10 flex items-center justify-center gap-1 px-4 bg-white border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 text-gray-700"
            >
              <Download className="mr-1 h-5 w-5 text-[#9542e3] animate-pulse" />
              Importez une photo
            </label>
            <input
              id="cover-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e: ChangeEvent<HTMLInputElement>) => {
                const f = e.target.files?.[0] ?? null;
                if (f) await compressAndSet(f);
                setInput("");
                setIsCapturing(false);
              }}
            />

            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>

        {/* Aperçu + bouton supprimer */}
        {imagePreview && (
          <div className="mt-4 text-center">
            <div className="relative w-64 h-64 mx-auto">
              <Image
                src={imagePreview}
                alt="Aperçu de la 4e de couverture"
                fill
                style={{ objectFit: "contain" }}
                unoptimized
              />
              <button
                type="button"
                className="absolute top-1 right-1 bg-[#a15be3] p-1 rounded-full shadow hover:bg-[#9542e3]"
                onClick={() => setImageFile(null)}
              >
                <CloseIcon className="h-4 w-4 text-white" />
              </button>
            </div>
            {imageFile && (
              <p className="mt-2 text-xs text-gray-600">({imageFile.name})</p>
            )}
          </div>
        )}

        {/* Message d’erreur API */}
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
            <div className="flex-1 text-sm text-red-800">{error}</div>
          </div>
        )}

        {/* Bouton Générer */}
        <Button
          type="submit"
          className="w-full bg-[#a15be3] hover:bg-[#9542e3] text-white text-sm transition-colors duration-200"
          disabled={loading}
        >
          {loading ? "Génération en cours…" : "Générez les textes attendus"}
        </Button>
      </form>

      {/* Résultats GPT */}
      {result && (
        <section className="space-y-6 mb-10">
          {mode === "fiche" ? (
            <>
              <ResultCard
                id="fiche"
                title="Fiche produit"
                text={result.fiche}
                copied={copied}
                onCopy={copyToClipboard}
              />
              <ResultCard
                id="meta"
                title="Meta description SEO"
                text={result.meta}
                copied={copied}
                onCopy={copyToClipboard}
              />
              <ResultCard
                id="newsletter"
                title="Texte newsletter"
                text={result.newsletter}
                copied={copied}
                onCopy={copyToClipboard}
              />
            </>
          ) : (
            <ResultCard
              id="critique"
              title="Texte critique"
              text={result.fiche}
              copied={copied}
              onCopy={copyToClipboard}
            />
          )}
        </section>
      )}
    </main>
  );
}
