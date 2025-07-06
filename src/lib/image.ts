export async function compressImage(file: File, maxDim = 1500): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      // Redimensionnement
      if (width > height) {
        if (width > maxDim) {
          height = (height * maxDim) / width;
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = (width * maxDim) / height;
          height = maxDim;
        }
      }
      // Canvas pour le redraw
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject("Impossible d'obtenir le context 2D");
      ctx.drawImage(img, 0, 0, width, height);

      // Export en PNG (lossless)
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject("Échec de la génération du blob");
          // On renomme l'extension en .png et on spécifie le bon MIME
          const outFile = new File(
            [blob],
            file.name.replace(/\.\w+$/, ".png"),
            { type: "image/png" },
          );
          resolve(outFile);
        },
        "image/png", // format PNG
      );
    };
    img.onerror = (e) => reject(e);
    img.src = URL.createObjectURL(file);
  });
}
