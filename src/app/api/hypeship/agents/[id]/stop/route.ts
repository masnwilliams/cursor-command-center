import { type NextRequest } from "next/server";
import { proxyToHypeship } from "@/lib/hypeship-proxy";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToHypeship(req, `/v1/agents/${encodeURIComponent(id)}/stop`, { method: "POST" });
}
