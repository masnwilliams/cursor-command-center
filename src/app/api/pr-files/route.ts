import { NextRequest, NextResponse } from "next/server";

function parsePrUrl(
  url: string,
): { owner: string; repo: string; number: number } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) };
}

function buildFilePatch(file: {
  filename: string;
  status: string;
  patch?: string;
  previous_filename?: string;
}): string | undefined {
  if (!file.patch) return undefined;

  const oldName =
    file.status === "added"
      ? "/dev/null"
      : `a/${file.previous_filename || file.filename}`;
  const newName =
    file.status === "removed" ? "/dev/null" : `b/${file.filename}`;

  let header = `diff --git a/${file.previous_filename || file.filename} b/${file.filename}\n`;
  if (file.status === "added") header += "new file mode 100644\n";
  else if (file.status === "removed") header += "deleted file mode 100644\n";

  return `${header}--- ${oldName}\n+++ ${newName}\n${file.patch}`;
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
        patch?: string;
        previous_filename?: string;
      }) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        patch: buildFilePatch(f),
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
