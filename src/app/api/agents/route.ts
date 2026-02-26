import { NextRequest } from "next/server";
import { proxyToCursor } from "@/lib/proxy";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const qs = params.toString();
  return proxyToCursor(req, `/v0/agents${qs ? `?${qs}` : ""}`);
}

export async function POST(req: NextRequest) {
  return proxyToCursor(req, "/v0/agents");
}
