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

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const modeValue = form.get("mode");
    if (modeValue === "critique") {
      mode = "critique";
    }
    title = String(form.get("title") ?? "");
    author = String(form.get("author") ?? "");

    const fileBlob = form.get("coverImage");
    if (fileBlob instanceof Blob && fileBlob.size > 0) {
      const buffer = await fileBlob.arrayBuffer();
      inputText = (await extractTextWithOCR(buffer)).trim();
    } else {
      inputText = String(form.get("textSource") ?? "");
    }
  } else {
    const json = await req.json();
    inputText = typeof json.input === "string" ? json.input : "";
    if (json.mode === "critique") {
      mode = "critique";
    }
    title = typeof json.title === "string" ? json.title : "";
    author = typeof json.author === "string" ? json.author : "";
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Clé API manquante" }, { status: 500 });
  }
  if (!inputText.trim()) {
    return NextResponse.json(
      { error: "Texte vide après OCR" },
      { status: 400 },
    );
  }

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
      const errorMessage =
        typeof data.error?.message === "string"
          ? data.error.message
          : "Erreur lors de l’appel à OpenAI";
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    const content: string = data.choices?.[0]?.message?.content ?? "";
    let fiche = "";
    let meta = "";
    let newsletter = "";

    if (mode === "critique") {
      fiche = content.trim();
    } else {
      const ficheMatch = content.match(/FICHE:\s*([\s\S]*?)META:/);
      const metaMatch = content.match(/META:\s*([\s\S]*?)NEWSLETTER:/);
      const newsMatch = content.match(/NEWSLETTER:\s*([\s\S]*)/);
      fiche = ficheMatch?.[1]?.trim() ?? "";
      meta = metaMatch?.[1]?.trim() ?? "";
      newsletter = newsMatch?.[1]?.trim() ?? "";
    }

    return NextResponse.json({ fiche, meta, newsletter });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
