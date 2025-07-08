import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  let isbn = searchParams.get("isbn")?.trim() ?? "";
  if (!isbn) {
    return NextResponse.json({ error: "ISBN requis" }, { status: 400 });
  }

  // On ne garde que chiffres et éventuellement X
  isbn = isbn.replace(/[^0-9Xx]/g, "").toUpperCase();

  // Construire l’URL OpenLibrary
  const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;

  // On considère que si l’image existe (status 200), elle est valide
  const res = await fetch(url, { method: "HEAD" });
  if (res.status !== 200) {
    return NextResponse.json(
      { error: "Pas de couverture OpenLibrary" },
      { status: 404 },
    );
  }

  return NextResponse.json({ thumbnail: url });
}
