"use client";

import { useState, useCallback } from "react";
import { useArtifacts, getArtifactDownloadUrl } from "@/lib/api";
import type { Artifact } from "@/lib/types";

function fileName(absolutePath: string): string {
  return absolutePath.split("/").pop() ?? absolutePath;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "mov"]);

function extOf(path: string): string {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

function ArtifactRow({
  artifact,
  agentId,
}: {
  artifact: Artifact;
  agentId: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ext = extOf(artifact.absolutePath);
  const isImage = IMAGE_EXTS.has(ext);
  const isVideo = VIDEO_EXTS.has(ext);
  const isPreviewable = isImage || isVideo;

  const handleDownload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { url } = await getArtifactDownloadUrl(
        agentId,
        artifact.absolutePath,
      );
      window.open(url, "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "download failed");
    } finally {
      setLoading(false);
    }
  }, [agentId, artifact.absolutePath]);

  const handlePreview = useCallback(async () => {
    if (previewUrl) {
      setPreviewUrl(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { url } = await getArtifactDownloadUrl(
        agentId,
        artifact.absolutePath,
      );
      setPreviewUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "preview failed");
    } finally {
      setLoading(false);
    }
  }, [agentId, artifact.absolutePath, previewUrl]);

  return (
    <div className="border-b border-zinc-800/50 last:border-b-0">
      <div className="flex items-center gap-2 px-2 py-1.5 group/row hover:bg-zinc-800/30">
        <span className="text-[10px] text-zinc-600 shrink-0 w-3 text-center">
          {isImage ? "◻" : isVideo ? "▶" : "◆"}
        </span>
        <span className="text-xs text-zinc-300 truncate flex-1 min-w-0 font-mono">
          {fileName(artifact.absolutePath)}
        </span>
        <span className="text-[10px] text-zinc-600 shrink-0">
          {formatBytes(artifact.sizeBytes)}
        </span>
        {isPreviewable && (
          <button
            onClick={handlePreview}
            disabled={loading}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 shrink-0"
          >
            {previewUrl ? "hide" : "view"}
          </button>
        )}
        <button
          onClick={handleDownload}
          disabled={loading}
          className="text-[10px] text-blue-500 hover:text-blue-300 shrink-0"
        >
          {loading ? "..." : "dl"}
        </button>
      </div>
      {error && (
        <p className="text-[10px] text-red-400 px-2 pb-1">{error}</p>
      )}
      {previewUrl && isImage && (
        <div className="px-2 pb-2">
          <img
            src={previewUrl}
            alt={fileName(artifact.absolutePath)}
            className="max-w-full max-h-48 border border-zinc-800"
          />
        </div>
      )}
      {previewUrl && isVideo && (
        <div className="px-2 pb-2">
          <video
            src={previewUrl}
            controls
            className="max-w-full max-h-48 border border-zinc-800"
          />
        </div>
      )}
    </div>
  );
}

interface ArtifactsPanelProps {
  agentId: string;
  onClose: () => void;
}

export function ArtifactsPanel({ agentId, onClose }: ArtifactsPanelProps) {
  const { data, error, isLoading } = useArtifacts(agentId);
  const artifacts = data?.artifacts ?? [];

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-zinc-800 bg-zinc-900/60 shrink-0">
        <span className="text-[10px] text-zinc-400 font-mono flex-1">
          artifacts ({artifacts.length})
        </span>
        <button
          onClick={onClose}
          className="text-[10px] text-zinc-500 hover:text-zinc-300"
        >
          back
        </button>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading && (
          <p className="text-[10px] text-zinc-600 px-2 py-3">loading...</p>
        )}
        {error && (
          <p className="text-[10px] text-red-400 px-2 py-3">
            {error.message ?? "failed to load artifacts"}
          </p>
        )}
        {!isLoading && !error && artifacts.length === 0 && (
          <p className="text-[10px] text-zinc-600 px-2 py-3">no artifacts</p>
        )}
        {artifacts.map((a: Artifact) => (
          <ArtifactRow
            key={a.absolutePath}
            artifact={a}
            agentId={agentId}
          />
        ))}
      </div>
    </div>
  );
}
