"use client";

import { useState } from "react";
import type { ImageAttachment } from "@/lib/images";

const MAX_IMAGES = 5;

interface ImageAttachmentsProps {
  images: ImageAttachment[];
  onRemove: (id: string) => void;
}

export function ImageAttachments({ images, onRemove }: ImageAttachmentsProps) {
  const [fullscreen, setFullscreen] = useState<string | null>(null);

  if (images.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
        {images.map((img) => (
          <div
            key={img.id}
            className="relative shrink-0 group animate-in fade-in slide-in-from-bottom-1 duration-200"
          >
            <button
              type="button"
              onClick={() => setFullscreen(img.previewUrl)}
              className="block"
            >
              <img
                src={img.previewUrl}
                alt=""
                className="h-10 w-auto border border-zinc-700 object-cover"
              />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(img.id);
              }}
              className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-zinc-800 border border-zinc-600 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg
                width="6"
                height="6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
        <span className="text-[10px] text-zinc-600 font-mono shrink-0 ml-1">
          {images.length}/{MAX_IMAGES}
        </span>
      </div>

      {fullscreen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 cursor-pointer"
          onClick={() => setFullscreen(null)}
        >
          <img
            src={fullscreen}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setFullscreen(null)}
            className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-100 font-mono text-xs"
          >
            [esc]
          </button>
        </div>
      )}
    </>
  );
}

/** Read-only inline thumbnails for displaying images in message history */
export function InlineImageThumbnails({ images }: { images: { data: string; dimension: { width: number; height: number } }[] }) {
  const [fullscreen, setFullscreen] = useState<string | null>(null);

  if (!images || images.length === 0) return null;

  return (
    <>
      <div className="flex gap-1 mt-1 mb-1">
        {images.map((img, i) => {
          const src = img.data.startsWith("data:") ? img.data : `data:image/png;base64,${img.data}`;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setFullscreen(src)}
              className="block shrink-0"
            >
              <img
                src={src}
                alt=""
                className="h-16 w-auto border border-zinc-700 object-cover"
              />
            </button>
          );
        })}
      </div>
      {fullscreen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 cursor-pointer"
          onClick={() => setFullscreen(null)}
        >
          <img
            src={fullscreen}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setFullscreen(null)}
            className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-100 font-mono text-xs"
          >
            [esc]
          </button>
        </div>
      )}
    </>
  );
}
