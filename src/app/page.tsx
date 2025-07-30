"use client";

import { useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import ResultCard from "@/components/ResultCard";
import { inter } from "@/lib/fonts";
import { compressImage } from "@/lib/image";
import {
  AlertCircle,
  ChevronRight,
  ScanEye,
  Download,
  X as CloseIcon,
} from "lucide-react";
import { CustomSelect } from "@/components/ui/CustomSelect";

type GenerationMode = "fiche" | "critique" | "traduction";

export default function HomePage() {
  const [input, setInput] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [mode, setMode] = useState<GenerationMode>("fiche");
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [loadingCover, setLoadingCover] = useState(false);
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [isbn, setIsbn] = useState<string>("");
  const [fetchedCover, setFetchedCover] = useState<string>("");
  const [result, setResult] = useState<null | {
    fiche?: string;
    meta?: string;
    newsletter?: string;
    translation?: string;
  }>(null);
const [errorGen,   setErrorGen]   = useState<string | null>(null);
const [errorCover, setErrorCover] = useState<string | null>(null);

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
        .getUserMedia({
          video: {
            // que des ideal, pas de min
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        })
        .catch(() =>
          setErrorGen(
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
    setLoadingGenerate(true);
    try {
      // on passe uniquement la dimension max, plus de quality pour le PNG
      const compressed = await compressImage(file, 1500);
      setImageFile(compressed);
    } catch {
      // en cas d'échec, on conserve l'original
      setImageFile(file);
    } finally {
      setLoadingGenerate(false);
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
    setErrorGen(null);
    setLoadingGenerate(true);

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

      // on gère chaque mode séparément
      if (mode === "traduction") {
        setResult({ translation: data.translation });
      } else if (mode === "critique") {
        setResult({ fiche: data.fiche });
      } else {
        setResult({
          fiche: data.fiche,
          meta: data.meta,
          newsletter: data.newsletter,
        });
      }
    } catch (err) {
      setErrorGen(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingGenerate(false);
      setCopied({});
    }
  };

  // fonction de fetch
  const fetchCover = async () => {
    const cleanIsbn = isbn.replace(/[^0-9Xx]/g, "").toUpperCase();
    if (cleanIsbn.length < 10) {
setErrorCover("Veuillez saisir un ISBN valide");
return;
}
    setErrorCover(null);
    setLoadingCover(true);
    try {
      const res = await fetch(`/api/cover?isbn=${cleanIsbn}`);
      const json = await res.json();
      if (res.ok && json.thumbnail) setFetchedCover(json.thumbnail);
      else setErrorCover("Couverture introuvable");
    } catch {
      setErrorCover("Erreur de recherche de couverture");
    } finally {
      setLoadingCover(false);
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
        Votre <span className="inline-block animate-fadeColor">générateur</span>{" "}
        de contenus automatisé ++
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white/50 p-6 rounded-2xl shadow-sm backdrop-blur-sm"
      >
        {/* Mode de génération */}
        <div className="space-y-2">
          <label className="flex items-center gap-1 text-md font-medium text-gray-700">
            <ChevronRight className="w-5 h-5 text-gray-700" />
            Choisir un type de génération
          </label>
          <CustomSelect
            value={mode}
            onChange={(v) => setMode(v as GenerationMode)}
            options={[
              { value: "fiche", label: "Fiche produit + SEO + newsletter" },
              { value: "critique", label: "Texte critique littéraire" },
              { value: "traduction", label: "Version anglaise du texte" },
            ]}
            placeholder="Choisissez un mode"
          />
        </div>

        {/* Auteur & Titre */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-md font-medium text-gray-700">
              Indiquer le nom de l&apos;auteur{" "}
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
            <label className="block text-md font-medium text-gray-700">
              Indiquer le titre du livre{" "}
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

        {/* Option 1 : Texte */}
        <div className="space-y-2">
          <p className="flex items-center gap-1 mb-5 text-md font-medium text-gray-700">
            <ChevronRight className="w-5 h-5 text-gray-700" />
            Choisir l&apos;une des 2 options
          </p>
          <div className="flex flex-col items-center sm:flex-row sm:items-center gap-2">
            <span className="inline-block border-2 border-[#9542e3] text-[#9542e3] px-4 sm:px-2 py-0.5 rounded-md text-md font-medium">
              Option 1
            </span>
            <span className="text-gray-700">Insérer le texte source</span>
          </div>
          <textarea
            rows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full p-2 rounded-md border bg-white disabled:bg-gray-100"
            placeholder="Coller ou recopier ici le texte de la 4ᵉ de couverture"
            disabled={!!imageFile}
          />
        </div>

        {/* Option 2 : Photo */}
        <div className="space-y-2">
          <div className="flex flex-col items-center sm:flex-row sm:items-center gap-2">
            <span className="inline-block border-2 border-[#9542e3] text-[#9542e3] px-4 sm:px-2 py-0.5 rounded-md text-md font-medium">
              Option 2
            </span>
            <span className="text-gray-700">
              Prendre ou importer une photo de la 4ᵉ de couverture
            </span>
          </div>

          <div className="flex flex-col md:flex-row gap-2">
            {/* Mobile: input natif */}
            <label
              htmlFor="camera-input"
              className="block md:hidden w-full h-10 flex items-center justify-center gap-1 px-4 bg-white border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 text-gray-700"
            >
              <ScanEye className="mr-1 h-5 w-5 text-[#9542e3] animate-pulse" />
              Prendre une photo
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
                className="hidden md:flex md:flex-1 h-10 items-center justify-center gap-1 text-md text-gray-700"
                onClick={() => {
                  setErrorGen(null);
                  setIsCapturing(true);
                }}
              >
                <ScanEye className="mr-1 h-5 w-5 text-[#9542e3] animate-pulse" />
                Prendre une photo
              </Button>
            )}

            {isCapturing && (
              <div className="hidden md:flex flex-col items-center gap-4">
                {/* Conseils d’utilisation */}
                <p className="text-sm text-[#9542e3] animate-pulse">
                  Veuillez approcher le livre de la caméra et vous assurer que
                  le texte soit bien lisible.
                </p>
                {/* container responsive + ratio 4:3 */}
                <div className="bg-black rounded overflow-hidden w-full max-w-lg aspect-[4/3]">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="default"
                    className="h-10"
                    onClick={handleCapture}
                  >
                    Capturer
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
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
              Importer une photo
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

        {/* Message d’erreur Gen API */}
        {errorGen && (
          <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
            <div className="flex-1 text-sm text-red-800">{errorGen}</div>
          </div>
        )}

        {/* Légende des champs obligatoires */}
        <p className="text-sm text-[#9542e3]">* Champs obligatoires</p>

        {/* Bouton Générer */}
        <Button
          type="submit"
          className="w-full bg-[#a15be3] hover:bg-[#9542e3] text-white text-md transition-colors duration-200"
          disabled={loadingGenerate}
        >
          {loadingGenerate
            ? "Génération en cours…"
            : "Générer les textes attendus"}
        </Button>
      </form>

      {/* Résultats GPT */}
      {result && (
        <section className="space-y-6 mt-6 mb-10">
          {mode === "fiche" && (
            <>
              <ResultCard
                id="fiche"
                title="Fiche produit"
                text={result.fiche!}
                copied={copied}
                onCopy={copyToClipboard}
              />
              <ResultCard
                id="meta"
                title="Meta description SEO"
                text={result.meta!}
                copied={copied}
                onCopy={copyToClipboard}
              />
              <ResultCard
                id="newsletter"
                title="Texte newsletter"
                text={result.newsletter!}
                copied={copied}
                onCopy={copyToClipboard}
              />
            </>
          )}
          {mode === "critique" && (
            <ResultCard
              id="critique"
              title="Texte critique"
              text={result.fiche!}
              copied={copied}
              onCopy={copyToClipboard}
            />
          )}
          {mode === "traduction" && (
            <ResultCard
              id="translation"
              title="Version anglaise"
              text={result.translation!}
              copied={copied}
              onCopy={copyToClipboard}
            />
          )}
        </section>
      )}

      {/* ----- Section Bonus : Recherche de couverture ----- */}
      <section className="mt-12 bg-white/50 border-2 border-[#9542e3] p-6 rounded-2xl shadow-sm backdrop-blur-sm">
        <h2 className="flex items-center gap-2 text-md font-medium text-gray-700 mb-2">
          Récupérer l&apos;image de la couverture de l&apos;ouvrage
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <input
            type="text"
            placeholder="Taper ici l'ISBN (10 ou 13 chiffres)"
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            className="w-full p-2 mt-1 rounded-md border border-gray-300 bg-white focus:ring focus:ring-pink-200"
          />
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={fetchCover}
            disabled={loadingCover || isbn.trim() === ""}
          >
            {loadingCover ? "Recherche…" : "Recherche"}
          </Button>
        </div>
{errorCover && (
<div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-4 mt-2">
<AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
<div className="flex-1 text-sm text-red-800">{errorCover}</div>
</div>
)}
        {fetchedCover && (
          <div className="mt-6 text-center">
            <Image
              src={fetchedCover}
              alt="Jaquette trouvée"
              width={300}
              height={450}
              className="mx-auto rounded shadow-lg"
            />
            <div className="mt-4">
              <a
                href={fetchedCover}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-sm"
              >
                Téléchargez l&apos;image en haute qualité
              </a>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
