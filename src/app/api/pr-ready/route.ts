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

  if (!prUrl) {
    return NextResponse.json({ error: "missing prUrl" }, { status: 400 });
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
    // REST API ignores draft:false — must use GraphQL to mark ready
    const prRes = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${ghToken}`,
          "User-Agent": "cursor-agents-ui",
        },
      },
    );

    if (!prRes.ok) {
      const data = await prRes.json();
      return NextResponse.json(
        { error: data.message ?? `github api ${prRes.status}` },
        { status: prRes.status },
      );
    }

    const prData = await prRes.json();
    const nodeId: string = prData.node_id;

    if (!nodeId) {
      return NextResponse.json(
        { error: "could not resolve pr node id" },
        { status: 500 },
      );
    }

    const gqlRes = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ghToken}`,
        "Content-Type": "application/json",
        "User-Agent": "cursor-agents-ui",
      },
      body: JSON.stringify({
        query: `mutation($id: ID!) {
          markPullRequestReadyForReview(input: { pullRequestId: $id }) {
            pullRequest { isDraft }
          }
        }`,
        variables: { id: nodeId },
      }),
    });

    const gqlData = await gqlRes.json();

    if (gqlData.errors?.length) {
      return NextResponse.json(
        { error: gqlData.errors[0].message },
        { status: 422 },
      );
    }

    return NextResponse.json({ ready: true });
  } catch {
    return NextResponse.json(
      { error: "failed to mark pr ready" },
      { status: 502 },
    );
  }
}
