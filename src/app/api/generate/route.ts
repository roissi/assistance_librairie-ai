export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getPrompt } from "@/lib/prompts";

export async function POST(req: Request) {
  const { input, mode, title, author } = await req.json(); // ← récupération de author

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Clé API manquante" }, { status: 500 });
  }

  if (!input || input.trim() === "") {
    return NextResponse.json({ error: "Texte vide" }, { status: 400 });
  }

  const prompt = getPrompt(mode || "fiche", input, title || "", author || ""); // ← passage de author

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo", // ou "gpt-4o" selon ton quota
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";

  console.log("🧠 Contenu brut OpenAI :", content);

  let fiche = "";
  let meta = "";
  let newsletter = "";

  if (mode === "critique") {
    fiche = content.trim();
  } else {
    fiche = content.split("FICHE:")[1]?.split("META:")[0]?.trim() || "";
    meta = content.split("META:")[1]?.split("NEWSLETTER:")[0]?.trim() || "";
    newsletter = content.split("NEWSLETTER:")[1]?.trim() || "";
  }

  return NextResponse.json({ fiche, meta, newsletter });
}
