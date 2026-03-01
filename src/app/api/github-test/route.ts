import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const ghToken = req.headers.get("x-github-token");
  if (!ghToken) {
    return NextResponse.json({ error: "missing token" }, { status: 401 });
  }

  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "cursor-agents-ui",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `github ${res.status}: ${text}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json({ login: data.login });
  } catch {
    return NextResponse.json({ error: "failed to reach github" }, { status: 502 });
  }
}
