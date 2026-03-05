import { type NextRequest } from "next/server";
import { proxyToHypeship } from "@/lib/hypeship-proxy";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  return proxyToHypeship(req, `/v1/prompt/${threadId}/follow-up`);
}
