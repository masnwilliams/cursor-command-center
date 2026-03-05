import { type NextRequest } from "next/server";
import { proxyToHypeship } from "@/lib/hypeship-proxy";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  return proxyToHypeship(
    req,
    `/v1/users/me/identities/${encodeURIComponent(provider)}`,
    { method: "DELETE" },
  );
}
