import { NextResponse } from "next/server";
import { getPrompt } from "@/lib/prompts";
import { extractTextWithOCR } from "@/lib/ocr";

export const runtime = "nodejs";

type GenerationMode = "fiche" | "critique";

export async function POST(req: Request) {
  let inputText = "";
  let mode: GenerationMode = "fiche";
  let title = "";
  let author = "";

  const contentType = req.headers.get("content-type") ?? "";

  // --- Extraction des champs ---
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const m = form.get("mode");
    if (m === "critique") mode = "critique";

    title = String(form.get("title") ?? "").trim();
    author = String(form.get("author") ?? "").trim();

    const fileBlob = form.get("coverImage");
    if (fileBlob instanceof Blob && fileBlob.size > 0) {
      const buf = await fileBlob.arrayBuffer();
      inputText = (await extractTextWithOCR(buf)).trim();
    } else {
      inputText = String(form.get("textSource") ?? "").trim();
    }
  } else {
    const json = await req.json();
    mode = json.mode === "critique" ? "critique" : "fiche";
    title = (typeof json.title === "string" ? json.title : "").trim();
    author = (typeof json.author === "string" ? json.author : "").trim();
    inputText = (typeof json.input === "string" ? json.input : "").trim();
  }

  // --- Validations côté API ---
  if (!author) {
    return NextResponse.json(
      { error: "Vous devez impérativement indiquer le nom de l'auteur." },
      { status: 400 },
    );
  }

  if (!title) {
    return NextResponse.json(
      { error: "Vous devez impérativement indiquer le titre du livre." },
      { status: 400 },
    );
  }

  if (!inputText) {
    return NextResponse.json(
      {
        error:
          "Vous devez impérativement entrer un texte (option 1) ou charger une photo (option 2) pour lancer la génération.",
      },
      { status: 400 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Clé API manquante" }, { status: 500 });
  }

  // --- Appel OpenAI ---
  const prompt = getPrompt(mode, inputText, title, author);

  try {
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    const data = await aiRes.json();
    if (!aiRes.ok) {
      const errMsg =
        typeof data.error?.message === "string"
          ? data.error.message
          : "Erreur lors de l’appel à OpenAI";
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    const content: string = data.choices?.[0]?.message?.content ?? "";
    let fiche = "",
      meta = "",
      newsletter = "";

    if (mode === "critique") {
      fiche = content.trim();
    } else {
      const mF = content.match(/FICHE:\s*([\s\S]*?)META:/);
      const mM = content.match(/META:\s*([\s\S]*?)NEWSLETTER:/);
      const mN = content.match(/NEWSLETTER:\s*([\s\S]*)/);
      fiche = mF?.[1].trim() ?? "";
      meta = mM?.[1].trim() ?? "";
      newsletter = mN?.[1].trim() ?? "";
    }

    return NextResponse.json({ fiche, meta, newsletter });
  } catch (err: unknown) {
    // Gestion sécurisée de l'erreur sans `any`
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "Erreur inattendue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
