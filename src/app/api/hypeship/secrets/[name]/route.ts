import { type NextRequest } from "next/server";
import { proxyToHypeship } from "@/lib/hypeship-proxy";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "";
  const userId = url.searchParams.get("user_id") ?? "";
  const qs = new URLSearchParams();
  if (scope) qs.set("scope", scope);
  if (userId) qs.set("user_id", userId);
  const q = qs.toString();
  return proxyToHypeship(req, `/v1/secrets/${encodeURIComponent(name)}${q ? `?${q}` : ""}`, {
    method: "DELETE",
  });
}
