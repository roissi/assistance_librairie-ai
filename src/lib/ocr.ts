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
      // Spécifie le dossier tessdata pour trouver fra.traineddata
      tessdataDir: "/usr/share/tesseract-ocr/4.00/tessdata",
    };
    const text: string = await tesseract.recognize(filePath, config);
    return text;
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
}
