import { type NextRequest } from "next/server";
import { proxyToHypeship } from "@/lib/hypeship-proxy";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id") ?? "";
  const params = new URLSearchParams();
  if (userId) params.set("user_id", userId);
  const qs = params.toString();
  return proxyToHypeship(req, `/v1/secrets/resolved${qs ? `?${qs}` : ""}`);
}
