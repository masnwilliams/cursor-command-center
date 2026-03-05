import { NextRequest } from "next/server";
import { proxyToCursor } from "@/lib/proxy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const path = req.nextUrl.searchParams.get("path");
  if (!path) {
    return new Response("Missing path query parameter", { status: 400 });
  }
  return proxyToCursor(
    req,
    `/v0/agents/${id}/artifacts/download?path=${encodeURIComponent(path)}`,
  );
}
