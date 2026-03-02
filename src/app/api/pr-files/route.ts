import { NextRequest, NextResponse } from "next/server";

function parsePrUrl(
  url: string,
): { owner: string; repo: string; number: number } | null {
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
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}/files?per_page=100`,
      { headers },
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `github api ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.json();

    const files = data.map(
      (f: {
        filename: string;
        status: string;
        additions: number;
        deletions: number;
        changes: number;
        previous_filename?: string;
      }) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        previous_filename: f.previous_filename,
      }),
    );

    return NextResponse.json({ files });
  } catch {
    return NextResponse.json(
      { error: "failed to fetch pr files" },
      { status: 502 },
    );
  }
}
