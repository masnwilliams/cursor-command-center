import { type NextRequest } from "next/server";
import { proxyToHypeship } from "@/lib/hypeship-proxy";

export async function GET(req: NextRequest) {
  return proxyToHypeship(req, "/v1/users/me/identities");
}

export async function POST(req: NextRequest) {
  return proxyToHypeship(req, "/v1/users/me/identities", { method: "POST" });
}
