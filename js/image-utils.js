// ============================================================
// Compressione immagini lato client.
//
// Serve per poter salvare la foto del pasto direttamente dentro
// un documento Firestore (niente Firebase Storage, quindi niente
// piano Blaze / carta di credito richiesti): un documento Firestore
// ha un limite di ~1 MiB, quindi la foto va ridotta e ricompressa
// prima di essere codificata in base64.
// ============================================================

/**
 * Ridimensiona e ricomprime un file immagine, ritornando anche la
 * versione base64 pronta per l'API Claude e per il salvataggio.
 * @param {File} file
 * @param {{maxDim?: number, quality?: number, maxBytes?: number}} opts
 * @returns {Promise<{dataUrl:string, base64:string, mediaType:string, approxBytes:number}>}
 */
export function compressImage(file, opts = {}) {
  const maxDim = opts.maxDim ?? 640;
  const startQuality = opts.quality ?? 0.6;
  const maxBytes = opts.maxBytes ?? 700000; // margine di sicurezza sotto il limite ~1MiB del documento Firestore

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width >= height && width > maxDim) {
        height = Math.round(height * (maxDim / width));
        width = maxDim;
      } else if (height > width && height > maxDim) {
        width = Math.round(width * (maxDim / height));
        height = maxDim;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      let quality = startQuality;
      let dataUrl = canvas.toDataURL("image/jpeg", quality);
      while (dataUrl.length > maxBytes && quality > 0.2) {
        quality -= 0.1;
        dataUrl = canvas.toDataURL("image/jpeg", quality);
      }

      resolve({
        dataUrl,
        base64: dataUrl.split(",")[1],
        mediaType: "image/jpeg",
        approxBytes: dataUrl.length
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Impossibile leggere l'immagine selezionata."));
    };

    img.src = objectUrl;
  });
}
