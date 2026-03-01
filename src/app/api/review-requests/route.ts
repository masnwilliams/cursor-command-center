import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const ghToken = req.headers.get("x-github-token");
  if (!ghToken) {
    return NextResponse.json({ error: "missing token" }, { status: 401 });
  }

  const ghHeaders: Record<string, string> = {
    Authorization: `Bearer ${ghToken}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "cursor-agents-ui",
  };

  try {
    const userRes = await fetch("https://api.github.com/user", {
      headers: ghHeaders,
    });
    if (!userRes.ok) {
      return NextResponse.json(
        { error: `github ${userRes.status}` },
        { status: userRes.status },
      );
    }
    const user = await userRes.json();
    const login = user.login as string;

    const q = `type:pr+state:open+review-requested:${login}`;
    const searchRes = await fetch(
      `https://api.github.com/search/issues?q=${q}&sort=updated&order=desc&per_page=30`,
      { headers: ghHeaders },
    );

    if (!searchRes.ok) {
      return NextResponse.json(
        { error: `github search ${searchRes.status}` },
        { status: searchRes.status },
      );
    }

    const searchData = await searchRes.json();
    const prs = (searchData.items ?? []).map(
      (item: Record<string, unknown>) => {
        const prUrl = (item.html_url as string) ?? "";
        const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
        return {
          title: item.title as string,
          url: prUrl,
          number: item.number as number,
          repo: match ? `${match[1]}/${match[2]}` : "",
          author: (item.user as Record<string, unknown>)?.login as string,
          updatedAt: item.updated_at as string,
        };
      },
    );

    return NextResponse.json({ prs, total: searchData.total_count ?? 0 });
  } catch {
    return NextResponse.json(
      { error: "failed to fetch review requests" },
      { status: 502 },
    );
  }
}
