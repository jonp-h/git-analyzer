import { useMemo } from "react";
import type { PRDetail } from "../types";

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

interface AuthorReviewStats {
  author: string;
  prsAuthored: number;
  prsReviewed: number;
  avgTimeToFirstReviewSeconds: number | null;
  approved: number;
  changesRequested: number;
  commented: number;
  mergedWithoutReview: number;
}

function aggregate(prs: PRDetail[]): AuthorReviewStats[] {
  const map = new Map<string, AuthorReviewStats>();

  const ensure = (login: string) => {
    if (!map.has(login)) {
      map.set(login, {
        author: login,
        prsAuthored: 0,
        prsReviewed: 0,
        avgTimeToFirstReviewSeconds: null,
        approved: 0,
        changesRequested: 0,
        commented: 0,
        mergedWithoutReview: 0,
      });
    }
    return map.get(login)!;
  };

  for (const pr of prs) {
    const a = ensure(pr.author);
    a.prsAuthored++;
    if (pr.mergedWithoutReview) a.mergedWithoutReview++;

    // Accumulate time-to-first-review for this author
    if (pr.timeToFirstReviewSeconds !== null) {
      const prev = a.avgTimeToFirstReviewSeconds;
      if (prev === null) {
        a.avgTimeToFirstReviewSeconds = pr.timeToFirstReviewSeconds;
      } else {
        // running average (we'll divide later); store sum for now
        a.avgTimeToFirstReviewSeconds = prev + pr.timeToFirstReviewSeconds;
      }
    }

    for (const r of pr.reviews) {
      if (r.reviewer === pr.author) continue; // skip self-reviews
      const rev = ensure(r.reviewer);
      rev.prsReviewed++;
      if (r.state === "APPROVED") rev.approved++;
      else if (r.state === "CHANGES_REQUESTED") rev.changesRequested++;
      else if (r.state === "COMMENTED") rev.commented++;
    }
  }

  // Finalize avg time-to-first-review (divide sum by count of reviewed PRs per author)
  for (const [login, stats] of map) {
    const reviewedPRs = prs.filter(
      (p) => p.author === login && p.timeToFirstReviewSeconds !== null,
    ).length;
    if (reviewedPRs > 0 && stats.avgTimeToFirstReviewSeconds !== null) {
      stats.avgTimeToFirstReviewSeconds =
        stats.avgTimeToFirstReviewSeconds / reviewedPRs;
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.prsAuthored + b.prsReviewed - (a.prsAuthored + a.prsReviewed),
  );
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtTime(seconds: number | null) {
  if (seconds === null) return "—";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReviewStats({ prs }: { prs: PRDetail[] }) {
  const stats = useMemo(() => aggregate(prs), [prs]);

  if (stats.length === 0) {
    return <p className="text-sm text-zinc-500 py-4">No contributors found.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div
          key={s.author}
          className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3"
        >
          {/* Header */}
          <div
            className="font-semibold text-zinc-100 text-sm truncate"
            title={s.author}
          >
            {s.author}
          </div>

          {/* Authored / Reviewed row */}
          <div className="flex gap-4 text-xs">
            <div>
              <div className="text-zinc-500 mb-0.5">PRs authored</div>
              <div className="text-zinc-200 font-semibold">{s.prsAuthored}</div>
            </div>
            <div>
              <div className="text-zinc-500 mb-0.5">PRs reviewed</div>
              <div className="text-zinc-200 font-semibold">{s.prsReviewed}</div>
            </div>
            <div>
              <div className="text-zinc-500 mb-0.5">Avg time to review</div>
              <div className="text-zinc-200 font-semibold">
                {fmtTime(s.avgTimeToFirstReviewSeconds)}
              </div>
            </div>
          </div>

          {/* Review type breakdown */}
          {s.prsReviewed > 0 && (
            <div className="flex gap-3 text-xs">
              <span className="text-green-400" title="Approved">
                ✓ {s.approved}
              </span>
              <span className="text-red-400" title="Changes requested">
                ✗ {s.changesRequested}
              </span>
              <span className="text-zinc-400" title="Commented">
                💬 {s.commented}
              </span>
            </div>
          )}

          {/* Warning: merged without review */}
          {s.mergedWithoutReview > 0 && (
            <div className="text-xs text-amber-400">
              ⚠ {s.mergedWithoutReview} merged without review
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
