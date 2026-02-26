import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const repo = req.nextUrl.searchParams.get("repo");
  if (!repo) {
    return NextResponse.json({ branches: [] });
  }

  // Extract owner/name from full GitHub URL
  const match = repo.replace(/^(https?:\/\/)?github\.com\//, "").match(/^([^/]+)\/([^/]+)/);
  if (!match) {
    return NextResponse.json({ branches: [] });
  }

  const [, owner, name] = match;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${name}/branches?per_page=100`,
      {
        headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "cursor-agents-ui" },
      }
    );
    if (!res.ok) return NextResponse.json({ branches: [] });
    const data = await res.json();
    const branches = data.map((b: { name: string }) => b.name);
    return NextResponse.json({ branches });
  } catch {
    return NextResponse.json({ branches: [] });
  }
}
