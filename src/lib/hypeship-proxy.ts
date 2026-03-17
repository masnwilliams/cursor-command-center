import { NextRequest, NextResponse } from "next/server";

export async function proxyToHypeship(
  req: NextRequest,
  path: string,
  options?: { method?: string; body?: unknown },
): Promise<NextResponse> {
  const apiUrl = req.headers.get("x-hypeship-url");
  const jwt = req.headers.get("x-hypeship-jwt");
  const apiKey = req.headers.get("x-hypeship-api-key");

  if (!apiUrl || (!jwt && !apiKey)) {
    return NextResponse.json(
      { error: "Missing Hypeship URL or auth (JWT or API key)" },
      { status: 401 },
    );
  }

  const method = options?.method ?? req.method;

  const fetchOptions: RequestInit = {
    method,
    headers: {
      Authorization: jwt ? `Bearer ${jwt}` : `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  };

  if (options?.body) {
    fetchOptions.body = JSON.stringify(options.body);
  } else if (method === "POST" || method === "PUT" || method === "PATCH") {
    try {
      const body = await req.json();
      fetchOptions.body = JSON.stringify(body);
    } catch {
      // no body
    }
  }

  const base = apiUrl.replace(/\/$/, "");
  const url = `${base}${path}`;

  try {
    const res = await fetch(url, fetchOptions);
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }
    const text = await res.text();
    return new NextResponse(text, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Hypeship request failed" },
      { status: 502 },
    );
  }
}
