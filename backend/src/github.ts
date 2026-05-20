import { simpleGit } from "simple-git";

// ---------------------------------------------------------------------------
// Types (kept here to avoid a circular import with the shared types file)
// ---------------------------------------------------------------------------

export interface PRReview {
  reviewer: string;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED";
  submittedAt: string;
}

export interface PRDetail {
  number: number;
  title: string;
  state: "open" | "closed" | "merged";
  author: string;
  authorAvatarUrl: string;
  draft: boolean;
  createdAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  headBranch: string;
  baseBranch: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  reviews: PRReview[];
  mergedWithoutReview: boolean;
  timeToFirstReviewSeconds: number | null;
  comments: number;
  reviewComments: number;
}

export interface IssueLabel {
  name: string;
  color: string;
}

export interface IssueDetail {
  number: number;
  title: string;
  state: "open" | "closed";
  author: string;
  assignees: string[];
  labels: IssueLabel[];
  createdAt: string;
  closedAt: string | null;
  comments: number;
}

export interface GitHubDataResponse {
  prs: PRDetail[];
  issues: IssueDetail[];
  owner?: string;
  repo?: string;
  remote: string | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// Remote URL parser
// ---------------------------------------------------------------------------

const HTTPS_RE = /https?:\/\/(?:[^@]+@)?github\.com\/([^/]+)\/([^/.]+)/;
const SSH_RE = /git@github\.com:([^/]+)\/([^/.]+)/;

export async function getGitHubRemote(
  repoPath: string,
): Promise<{ owner: string; repo: string; url: string } | null> {
  try {
    const git = simpleGit(repoPath);
    const remotes = await git.getRemotes(true);
    const origin = remotes.find((r) => r.name === "origin") ?? remotes[0];
    if (!origin) return null;

    const url = origin.refs.fetch || origin.refs.push || "";

    const https = url.match(HTTPS_RE);
    if (https) return { owner: https[1], repo: https[2], url };

    const ssh = url.match(SSH_RE);
    if (ssh) return { owner: ssh[1], repo: ssh[2], url };

    return null; // not a github.com remote
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// In-memory cache (15-min TTL per owner/repo)
// ---------------------------------------------------------------------------

interface CacheEntry {
  prs: PRDetail[];
  issues: IssueDetail[];
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

async function ghFetch(path: string, token: string) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${path} → ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/** Generic paginator — works for any GitHub list endpoint. */
async function fetchAllPages(
  path: string,
  token: string,
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let page = 1;
  while (true) {
    const sep = path.includes("?") ? "&" : "?";
    const batch = (await ghFetch(
      `${path}${sep}per_page=100&page=${page}`,
      token,
    )) as Record<string, unknown>[];
    all.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return all;
}

/** Run `fn` over `items` in serial batches of `batchSize` (concurrency cap). */
async function inBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    results.push(...(await Promise.all(batch.map(fn))));
  }
  return results;
}

async function fetchReviews(
  owner: string,
  repo: string,
  prNumber: number,
  token: string,
): Promise<PRReview[]> {
  const raw = (await ghFetch(
    `/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
    token,
  )) as Record<string, unknown>[];

  return raw.map((r) => ({
    reviewer:
      ((r.user as Record<string, unknown>)?.login as string) ?? "unknown",
    state: r.state as PRReview["state"],
    submittedAt: r.submitted_at as string,
  }));
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Fetch PRs (with reviews) and issues in parallel, cache the combined result.
 * PRs: reviews are fetched in batches of 5 to avoid API rate hammering.
 * Issues: GitHub's issues endpoint returns PRs too — they are filtered out.
 */
export async function fetchGitHubData(
  owner: string,
  repo: string,
): Promise<{ prs: PRDetail[]; issues: IssueDetail[] }> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not configured");

  const cacheKey = `${owner}/${repo}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { prs: cached.prs, issues: cached.issues };
  }

  // PR list + issue list fetched in a single parallel round-trip
  const [rawPRs, rawAll] = await Promise.all([
    fetchAllPages(`/repos/${owner}/${repo}/pulls?state=all`, token),
    fetchAllPages(`/repos/${owner}/${repo}/issues?state=all`, token),
  ]);

  // GitHub issues endpoint includes PRs — exclude them
  const rawIssues = rawAll.filter((i) => !i.pull_request);

  // Fetch reviews in batches of 5 (concurrency cap)
  const prs = await inBatches(rawPRs, 5, async (pr) => {
    const number = pr.number as number;
    const reviews = await fetchReviews(owner, repo, number, token);

    const isMerged = !!pr.merged_at;
    const state: PRDetail["state"] = isMerged
      ? "merged"
      : pr.state === "open"
        ? "open"
        : "closed";

    const approvedBeforeMerge = isMerged
      ? reviews.some(
          (r) =>
            r.state === "APPROVED" && r.submittedAt <= (pr.merged_at as string),
        )
      : false;

    const createdAt = pr.created_at as string;
    const firstReview = reviews
      .map((r) => r.submittedAt)
      .filter(Boolean)
      .sort()[0];
    const timeToFirstReviewSeconds = firstReview
      ? (new Date(firstReview).getTime() - new Date(createdAt).getTime()) / 1000
      : null;

    return {
      number,
      title: pr.title as string,
      state,
      author:
        ((pr.user as Record<string, unknown>)?.login as string) ?? "unknown",
      authorAvatarUrl:
        ((pr.user as Record<string, unknown>)?.avatar_url as string) ?? "",
      draft: !!(pr.draft as boolean),
      createdAt,
      closedAt: (pr.closed_at as string | null) ?? null,
      mergedAt: (pr.merged_at as string | null) ?? null,
      headBranch: ((pr.head as Record<string, unknown>)?.ref as string) ?? "",
      baseBranch: ((pr.base as Record<string, unknown>)?.ref as string) ?? "",
      additions: (pr.additions as number) ?? 0,
      deletions: (pr.deletions as number) ?? 0,
      changedFiles: (pr.changed_files as number) ?? 0,
      reviews,
      mergedWithoutReview: isMerged && !approvedBeforeMerge,
      timeToFirstReviewSeconds,
      comments: (pr.comments as number) ?? 0,
      reviewComments: (pr.review_comments as number) ?? 0,
    } satisfies PRDetail;
  });

  const issues: IssueDetail[] = rawIssues.map((raw) => ({
    number: raw.number as number,
    title: raw.title as string,
    state: raw.state as "open" | "closed",
    author:
      ((raw.user as Record<string, unknown>)?.login as string) ?? "unknown",
    assignees: ((raw.assignees as Record<string, unknown>[]) ?? []).map(
      (a) => (a.login as string) ?? "",
    ),
    labels: ((raw.labels as Record<string, unknown>[]) ?? []).map((l) => ({
      name: (l.name as string) ?? "",
      color: (l.color as string) ?? "888888",
    })),
    createdAt: raw.created_at as string,
    closedAt: (raw.closed_at as string | null) ?? null,
    comments: (raw.comments as number) ?? 0,
  }));

  cache.set(cacheKey, { prs, issues, fetchedAt: Date.now() });
  return { prs, issues };
}
