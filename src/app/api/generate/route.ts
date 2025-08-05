import { NextResponse } from "next/server";
import { getPrompt } from "@/lib/prompts";
import { extractTextWithOCR } from "@/lib/ocr";

export const runtime = "nodejs";
type GenerationMode = "fiche" | "critique" | "traduction";

export async function POST(req: Request) {
  try {
    let inputText = "";
    let mode: GenerationMode = "fiche";
    let title = "";
    let author = "";
    const ct = req.headers.get("content-type") ?? "";

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const m = String(form.get("mode") ?? "fiche");
      if (m === "critique") mode = "critique";
      else if (m === "traduction") mode = "traduction";

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
      const m = String(json.mode ?? "fiche");
      if (m === "critique") mode = "critique";
      else if (m === "traduction") mode = "traduction";

      title = (typeof json.title === "string" ? json.title : "").trim();
      author = (typeof json.author === "string" ? json.author : "").trim();
      inputText = (typeof json.input === "string" ? json.input : "").trim();
    }

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

    const prompt = getPrompt(mode, inputText, title, author);
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

    const content = data.choices?.[0]?.message?.content ?? "";
    let fiche = "",
      meta = "",
      newsletter = "",
      translation = "";

    if (mode === "critique") {
      fiche = content.trim();
    } else if (mode === "traduction") {
      translation = content.trim();
    } else {
      fiche = content.match(/FICHE:\s*([\s\S]*?)META:/)?.[1].trim() ?? "";
      meta = content.match(/META:\s*([\s\S]*?)NEWSLETTER:/)?.[1].trim() ?? "";
      newsletter = content.match(/NEWSLETTER:\s*([\s\S]*)/)?.[1].trim() ?? "";
    }

    return NextResponse.json({ fiche, meta, newsletter, translation });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "Erreur inattendue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
