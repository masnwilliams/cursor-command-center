export interface ImageAttachment {
  id: string;
  data: string;
  dimension: { width: number; height: number };
  previewUrl: string;
}

let counter = 0;

export function readFileAsImage(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("not an image"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      const img = new Image();
      img.onload = () => {
        resolve({
          id: `img-${Date.now()}-${counter++}`,
          data: base64,
          dimension: { width: img.naturalWidth, height: img.naturalHeight },
          previewUrl: dataUrl,
        });
      };
      img.onerror = () => reject(new Error("failed to load image"));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error("failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function readFilesAsImages(
  files: FileList | File[],
): Promise<ImageAttachment[]> {
  const imageFiles = Array.from(files).filter((f) =>
    f.type.startsWith("image/"),
  );
  const results = await Promise.allSettled(imageFiles.map(readFileAsImage));
  return results
    .filter(
      (r): r is PromiseFulfilledResult<ImageAttachment> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value);
}
