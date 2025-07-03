"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import ResultCard from "@/components/ResultCard";
import { inter } from "@/lib/fonts";

export default function HomePage() {
  const [input, setInput] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [mode, setMode] = useState<"fiche" | "critique">("fiche");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({});
  const [result, setResult] = useState<null | {
    fiche: string;
    meta: string;
    newsletter: string;
  }>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/generate/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, title, author, mode }),
    });

    const data = await res.json();
    setResult(data);
    setLoading(false);
    setCopied({});
  };

  const copyToClipboard = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopied((prev) => ({ ...prev, [key]: false }));
    }, 2000);
  };

  return (
    <main className="max-w-4xl w-full bg-gradient-to-br from-[#fdfcfb] to-[#dedace] px-6 bg-white/80 rounded-3xl shadow-xl border border-gray-200 backdrop-blur-lg">
      <h1
        className={`${inter.className} text-4xl font-bold text-center mb-10 mt-10 text-gray-800`}
      >
        Générateur de fiches livre automatisé
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 mb-10 bg-white/50 p-6 rounded-2xl shadow-sm backdrop-blur-sm"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Type de génération
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "fiche" | "critique")}
              className="w-full p-2 rounded-md border border-gray-300 bg-white focus:ring focus:ring-pink-200"
            >
              <option value="fiche">Fiche produit + SEO + newsletter</option>
              <option value="critique">Texte critique littéraire</option>
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Auteur
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full p-2 rounded-md border border-gray-300 bg-white focus:ring focus:ring-pink-200"
                placeholder="Auteur du livre"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Titre du livre
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2 rounded-md border border-gray-300 bg-white focus:ring focus:ring-pink-200"
                placeholder="Titre du livre"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Texte source
          </label>
          <textarea
            rows={8}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full p-3 rounded-md border border-gray-300 bg-white focus:ring focus:ring-pink-200"
            placeholder="Collez ici la 4e de couverture"
          />
        </div>

        <Button
          type="submit"
          className="w-full bg-[#a15be3] hover:bg-[#9542e3] text-white transition-colors duration-200"
          disabled={loading}
        >
          {loading ? "Génération en cours..." : "Générer"}
        </Button>
      </form>

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
