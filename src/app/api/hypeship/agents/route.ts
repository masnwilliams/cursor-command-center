import { type NextRequest } from "next/server";
import { proxyToHypeship } from "@/lib/hypeship-proxy";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const includeArchived = url.searchParams.get("include_archived") ?? "false";
  const includeGone = url.searchParams.get("include_gone") ?? "false";
  return proxyToHypeship(
    req,
    `/v1/agents?include_archived=${includeArchived}&include_gone=${includeGone}`,
  );
}

export async function POST(req: NextRequest) {
  return proxyToHypeship(req, "/v1/agents", { method: "POST" });
}
