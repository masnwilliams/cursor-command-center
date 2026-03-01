import { NextRequest, NextResponse } from "next/server";

function parsePrUrl(url: string): { owner: string; repo: string; number: number } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) };
}

export async function GET(req: NextRequest) {
  const prUrl = req.nextUrl.searchParams.get("url");
  if (!prUrl) {
    return NextResponse.json({ error: "missing url param" }, { status: 400 });
  }

  const parsed = parsePrUrl(prUrl);
  if (!parsed) {
    return NextResponse.json({ error: "invalid pr url" }, { status: 400 });
  }

  const ghToken = req.headers.get("x-github-token");
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "cursor-agents-ui",
  };
  if (ghToken) {
    headers.Authorization = `Bearer ${ghToken}`;
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`,
      { headers },
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `github api ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    let status: string;
    if (data.draft) {
      status = "draft";
    } else if (data.merged) {
      status = "merged";
    } else if (data.state === "closed") {
      status = "closed";
    } else {
      status = "open";
    }

    return NextResponse.json({ status });
  } catch {
    return NextResponse.json({ error: "failed to fetch pr" }, { status: 502 });
  }
}
