import { type NextRequest } from "next/server";

const MAX_STREAM_MS = 5 * 60 * 1000;

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
  const upstream = `${base}/v1/agents/${encodeURIComponent(id)}/stream`;

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), MAX_STREAM_MS);
  req.signal.addEventListener("abort", () => abort.abort(), { once: true });

  try {
    const res = await fetch(upstream, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "text/event-stream",
      },
      signal: abort.signal,
    });

    if (!res.ok || !res.body) {
      clearTimeout(timer);
      const text = await res.text().catch(() => "upstream error");
      return new Response(text, { status: res.status });
    }

    const reader = res.body.getReader();
    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            clearTimeout(timer);
            controller.close();
            return;
          }
          controller.enqueue(value);
        } catch {
          clearTimeout(timer);
          try { controller.close(); } catch {}
        }
      },
      cancel() {
        clearTimeout(timer);
        reader.cancel().catch(() => {});
        abort.abort();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    clearTimeout(timer);
    if (
      e instanceof DOMException && e.name === "AbortError" ||
      abort.signal.aborted
    ) {
      return new Response(null, { status: 499 });
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "SSE proxy failed" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}
