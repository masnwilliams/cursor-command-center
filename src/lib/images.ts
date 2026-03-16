export interface ImageAttachment {
  id: string;
  data: string; // base64 encoded (no data URL prefix)
  dimension: { width: number; height: number };
  mediaType: string; // "image/png", "image/jpeg", etc.
  previewUrl: string; // data URL for local preview
}

export interface ImageReadResult {
  images: ImageAttachment[];
  rejected: string[];
}

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

let counter = 0;

export function readFileAsImage(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    if (!ALLOWED_TYPES.has(file.type)) {
      reject(new Error(`${file.name}: only png, jpg, gif, webp allowed`));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error(`${file.name}: exceeds 10MB limit`));
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
          mediaType: file.type,
          previewUrl: dataUrl,
        });
      };
      img.onerror = () => reject(new Error(`${file.name}: failed to load`));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error(`${file.name}: failed to read`));
    reader.readAsDataURL(file);
  });
}

export async function readFilesAsImages(
  files: FileList | File[],
): Promise<ImageReadResult> {
  const all = Array.from(files);
  const results = await Promise.allSettled(all.map(readFileAsImage));

  const images: ImageAttachment[] = [];
  const rejected: string[] = [];

  for (const r of results) {
    if (r.status === "fulfilled") {
      images.push(r.value);
    } else {
      rejected.push(r.reason?.message ?? "unknown file rejected");
    }
  }

  return { images, rejected };
}
