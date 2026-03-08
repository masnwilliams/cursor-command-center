import { type NextRequest } from "next/server";
import { proxyToHypeship } from "@/lib/hypeship-proxy";

export async function GET(req: NextRequest) {
  return proxyToHypeship(req, "/v1/threads");
}
