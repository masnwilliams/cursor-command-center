import { type NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = req.nextUrl.searchParams.get("url");
  const jwt = req.nextUrl.searchParams.get("jwt");

  if (!url || !jwt) {
    return new Response(JSON.stringify({ error: "Missing url or jwt" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const base = url.replace(/\/$/, "");
  const upstream = `${base}/v1/threads/${encodeURIComponent(id)}/stream`;

  try {
    const res = await fetch(upstream, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "text/event-stream",
      },
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "upstream error");
      return new Response(text, { status: res.status });
    }

    return new Response(res.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "SSE proxy failed" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}
