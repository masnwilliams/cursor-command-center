import { NextRequest } from "next/server";
import { proxyToCursor } from "@/lib/proxy";

export async function GET(req: NextRequest) {
  return proxyToCursor(req, "/v0/repositories");
}
