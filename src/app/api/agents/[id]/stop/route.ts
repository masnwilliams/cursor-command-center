import { NextRequest } from "next/server";
import { proxyToCursor } from "@/lib/proxy";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyToCursor(req, `/v0/agents/${id}/stop`);
}
