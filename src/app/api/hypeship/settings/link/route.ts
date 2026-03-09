import { type NextRequest } from "next/server";
import { proxyToHypeship } from "@/lib/hypeship-proxy";

export async function POST(req: NextRequest) {
  return proxyToHypeship(req, "/v1/settings/link", { method: "POST" });
}
