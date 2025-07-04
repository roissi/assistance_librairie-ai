"use client";

import { useState, useEffect, FormEvent } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import ResultCard from "@/components/ResultCard";
import { inter } from "@/lib/fonts";
import { ArrowRight, AlertCircle } from "lucide-react";
import { CustomSelect } from "@/components/ui/CustomSelect";

type GenerationMode = "fiche" | "critique";

export default function HomePage() {
  const [input, setInput] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [author, setAuthor] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [mode, setMode] = useState<GenerationMode>("fiche");
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<null | {
    fiche: string;
    meta: string;
    newsletter: string;
  }>(null);
  const [error, setError] = useState<string | null>(null);

  // Génération automatique de l'URL d'aperçu
  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setImagePreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setImagePreview("");
  }, [imageFile]);

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
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
      setCopied({});
    }
  };

  const copyToClipboard = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => setCopied((prev) => ({ ...prev, [key]: false })), 2000);
  };

  return (
    <main className="max-w-4xl w-full bg-gradient-to-br from-[#fdfcfb] to-[#dedace] px-6 bg-white/80 rounded-3xl shadow-xl border border-gray-200 backdrop-blur-lg">
      <h1
        className={`${inter.className} text-4xl font-bold text-center my-10 text-gray-800`}
      >
        Générateur de fiches livre automatisé
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 mb-10 bg-white/50 p-6 rounded-2xl shadow-sm backdrop-blur-sm"
      >
        {/* Mode */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Choisissez un type de génération
          </label>

          <CustomSelect
            value={mode}
            onChange={(value) => setMode(value as GenerationMode)}
            options={[
              {
                value: "fiche",
                label:
                  "Fiche produit + Meta description SEO + Texte newsletter",
              },
              { value: "critique", label: "Texte critique littéraire" },
            ]}
            placeholder="Choisissez un mode"
          />
        </div>

        {/* Auteur / Titre */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Indiquez le nom de l&apos;auteur{" "}
              <span className="text-[#9542e3]">*</span>
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full p-2 rounded-md border border-gray-300 bg-white focus:ring focus:ring-pink-200"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Indiquez le titre du livre{" "}
              <span className="text-[#9542e3]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 rounded-md border border-gray-300 bg-white focus:ring focus:ring-pink-200"
            />
          </div>
        </div>

        {/* Texte source */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <ArrowRight className="w-8 h-8 sm:w-6 h-6 text-gray-700" />
            OPTION 1 : Insérez le texte source de la 4ᵉ de couverture (laissez
            ce bloc vide si vous uploadez une photo - option 2)
          </label>
          <textarea
            rows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full p-2 rounded-md border bg-white disabled:bg-white"
            placeholder="Recopiez ou collez ici la 4e de couverture"
            disabled={!!imageFile}
          />
        </div>

        {/* Upload image */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <ArrowRight className="w-8 h-8 sm:w-6 h-6 text-gray-700" />
            OPTION 2 : Uploadez une photo de la 4ᵉ de couverture (le texte doit
            être lisible)
          </label>

          <div className="flex items-center gap-2">
            {/* 1. input caché */}
            <input
              id="cover-input"
              type="file"
              accept="image/*"
              onChange={(e) => {
                setImageFile(e.target.files?.[0] ?? null);
                if (e.target.files?.[0]) setInput("");
              }}
              className="hidden"
            />

            {/* 2. label personnalisé */}
            <label
              htmlFor="cover-input"
              className="inline-flex items-center gap-1 px-4 py-2 bg-white border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 text-gray-700"
            >
              Choisissez un fichier
            </label>

            {/* 3. nom du fichier / placeholder */}
            <span className="text-[#9542e3]">
              {imageFile?.name || "Aucun fichier choisi"}
            </span>
          </div>
        </div>

        {/* Aperçu optimisé */}
        {imagePreview && (
          <div className="relative w-48 h-64 mt-4">
            <Image
              src={imagePreview}
              alt="Aperçu de la 4e de couverture"
              fill
              style={{ objectFit: "contain" }}
              unoptimized
            />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div className="flex-1 text-sm text-red-800">{error}</div>
          </div>
        )}

        <Button
          type="submit"
          className="w-full bg-[#a15be3] hover:bg-[#9542e3] text-white transition-colors duration-200"
          disabled={loading}
        >
          {loading ? "Génération en cours..." : "Générez les textes attendus"}
        </Button>
      </form>

      {/* Résultats */}
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
