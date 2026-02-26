import { NextRequest, NextResponse } from "next/server";

const CURSOR_API = "https://api.cursor.com";

export async function proxyToCursor(
  req: NextRequest,
  path: string,
  options?: { method?: string; body?: unknown }
): Promise<NextResponse> {
  const apiKey = req.headers.get("x-cursor-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }

  const method = options?.method ?? req.method;
  const basicAuth = Buffer.from(`${apiKey}:`).toString("base64");

  const fetchOptions: RequestInit = {
    method,
    headers: {
      Authorization: `Basic ${basicAuth}`,
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

  const url = `${CURSOR_API}${path}`;
  const res = await fetch(url, fetchOptions);

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  const text = await res.text();
  return new NextResponse(text, { status: res.status });
}
