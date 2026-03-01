import { NextRequest, NextResponse } from "next/server";

function parsePrUrl(
  url: string,
): { owner: string; repo: string; number: number } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const prUrl: string | undefined = body.prUrl;
  const reviewers: string[] | undefined = body.reviewers;

  if (!prUrl) {
    return NextResponse.json({ error: "missing prUrl" }, { status: 400 });
  }
  if (!reviewers?.length) {
    return NextResponse.json(
      { error: "missing reviewers" },
      { status: 400 },
    );
  }

  const parsed = parsePrUrl(prUrl);
  if (!parsed) {
    return NextResponse.json({ error: "invalid pr url" }, { status: 400 });
  }

  const ghToken = req.headers.get("x-github-token");
  if (!ghToken) {
    return NextResponse.json(
      { error: "missing github token" },
      { status: 401 },
    );
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}/requested_reviewers`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${ghToken}`,
          "User-Agent": "cursor-agents-ui",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reviewers }),
      },
    );

    if (!res.ok) {
      const data = await res.json();
      return NextResponse.json(
        { error: data.message ?? `github api ${res.status}` },
        { status: res.status },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "failed to add reviewers" },
      { status: 502 },
    );
  }
}
