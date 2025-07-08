import tesseract from "node-tesseract-ocr";
import fs from "fs/promises";
import os from "os";
import path from "path";

export async function extractTextWithOCR(buffer: ArrayBuffer): Promise<string> {
  const filePath = path.join(os.tmpdir(), `cover-${Date.now()}.jpg`);
  await fs.writeFile(filePath, Buffer.from(buffer));

  try {
    const config = {
      lang: "fra",
      oem: 1,
      psm: 3,
      tessdataDir: "/usr/share/tesseract-ocr/4.00/tessdata",
    };

    const rawText: string = await tesseract.recognize(filePath, config);

    // Nettoyage post-OCR : supprime les artefacts de saut de ligne et les coupures de mots
    const cleanedText = rawText
      .replace(/-\s*\n/g, "") // supprime les coupures de mots en fin de ligne
      .replace(/\n+/g, " ") // transforme tous les sauts de ligne en espace
      .replace(/\s{2,}/g, " ") // supprime les espaces multiples
      .trim(); // retire les espaces de début/fin

    return cleanedText;
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
}
