"use client";

import { useState } from "react";
import type { ImageAttachment } from "@/lib/images";

interface ImageAttachmentsProps {
  images: ImageAttachment[];
  onRemove: (id: string) => void;
}

export function ImageAttachments({ images, onRemove }: ImageAttachmentsProps) {
  const [fullscreen, setFullscreen] = useState<string | null>(null);

  if (images.length === 0) return null;

  return (
    <>
      <div className="flex gap-1 overflow-x-auto py-1 scrollbar-none">
        {images.map((img) => (
          <div key={img.id} className="relative shrink-0 group">
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
