import { useState } from "react";
import { formatDistanceStrict, parseISO, format } from "date-fns";
import type { PRDetail, PRReview } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return format(parseISO(iso), "MMM d, yyyy");
}

function fmtDuration(from: string, to: string | null) {
  if (!to) return "open";
  return formatDistanceStrict(parseISO(from), parseISO(to));
}

function fmtReviewTime(seconds: number | null) {
  if (seconds === null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

// ---------------------------------------------------------------------------
// Reviewer badge
// ---------------------------------------------------------------------------

const stateColors: Record<PRReview["state"], string> = {
  APPROVED: "bg-green-500/20 text-green-400 border-green-500/40",
  CHANGES_REQUESTED: "bg-red-500/20 text-red-400 border-red-500/40",
  COMMENTED: "bg-zinc-700 text-zinc-400 border-zinc-600",
  DISMISSED: "bg-zinc-800 text-zinc-500 border-zinc-700",
};

const stateIcons: Record<PRReview["state"], string> = {
  APPROVED: "✓",
  CHANGES_REQUESTED: "✗",
  COMMENTED: "💬",
  DISMISSED: "–",
};

function ReviewerBadge({ review }: { review: PRReview }) {
  const initials = review.reviewer.slice(0, 2).toUpperCase();
  const cls = stateColors[review.state] ?? stateColors.COMMENTED;
  const icon = stateIcons[review.state] ?? "?";
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-mono ${cls}`}
      title={`${review.reviewer}: ${review.state}`}
    >
      <span>{icon}</span>
      <span>{initials}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// State pill
// ---------------------------------------------------------------------------

function StatePill({ pr }: { pr: PRDetail }) {
  if (pr.draft)
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-700 text-zinc-400 border border-zinc-600">
        Draft
      </span>
    );
  if (pr.state === "merged")
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-400 border border-purple-500/40">
        Merged
      </span>
    );
  if (pr.state === "open")
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400 border border-green-500/40">
        Open
      </span>
    );
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-700 text-zinc-400 border border-zinc-600">
      Closed
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sort types
// ---------------------------------------------------------------------------

type SortKey =
  | "number"
  | "author"
  | "createdAt"
  | "duration"
  | "size"
  | "comments";
type SortDir = "asc" | "desc";

function SortBtn({
  col,
  current,
  dir,
  onClick,
  children,
}: {
  col: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  children: React.ReactNode;
}) {
  const active = col === current;
  return (
    <button
      className={`flex items-center gap-1 hover:text-zinc-100 transition-colors ${active ? "text-zinc-200" : "text-zinc-500"}`}
      onClick={() => onClick(col)}
    >
      {children}
      {active && (
        <span className="text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PRReviewPanel({ prs }: { prs: PRDetail[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...prs].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "number") cmp = a.number - b.number;
    else if (sortKey === "author") cmp = a.author.localeCompare(b.author);
    else if (sortKey === "createdAt")
      cmp = a.createdAt.localeCompare(b.createdAt);
    else if (sortKey === "duration") {
      const da = a.mergedAt ?? a.closedAt ?? new Date().toISOString();
      const db = b.mergedAt ?? b.closedAt ?? new Date().toISOString();
      cmp =
        new Date(da).getTime() -
        new Date(a.createdAt).getTime() -
        (new Date(db).getTime() - new Date(b.createdAt).getTime());
    } else if (sortKey === "size")
      cmp = a.additions + a.deletions - (b.additions + b.deletions);
    else if (sortKey === "comments")
      cmp = a.comments + a.reviewComments - (b.comments + b.reviewComments);

    return sortDir === "asc" ? cmp : -cmp;
  });

  if (prs.length === 0) {
    return (
      <p className="text-sm text-zinc-500 py-4">No pull requests found.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr className="text-xs text-zinc-500 border-b border-zinc-800">
            <th className="pb-2 pr-3 text-left font-medium">
              <SortBtn
                col="number"
                current={sortKey}
                dir={sortDir}
                onClick={handleSort}
              >
                #
              </SortBtn>
            </th>
            <th className="pb-2 pr-3 text-left font-medium min-w-40">Title</th>
            <th className="pb-2 pr-3 text-left font-medium">
              <SortBtn
                col="author"
                current={sortKey}
                dir={sortDir}
                onClick={handleSort}
              >
                Author
              </SortBtn>
            </th>
            <th className="pb-2 pr-3 text-left font-medium">State</th>
            <th className="pb-2 pr-3 text-left font-medium">
              <SortBtn
                col="size"
                current={sortKey}
                dir={sortDir}
                onClick={handleSort}
              >
                Size
              </SortBtn>
            </th>
            <th className="pb-2 pr-3 text-left font-medium">Reviewers</th>
            <th className="pb-2 pr-3 text-left font-medium">
              <SortBtn
                col="comments"
                current={sortKey}
                dir={sortDir}
                onClick={handleSort}
              >
                Comments
              </SortBtn>
            </th>
            <th className="pb-2 pr-3 text-left font-medium">1st review</th>
            <th className="pb-2 pr-3 text-left font-medium">
              <SortBtn
                col="createdAt"
                current={sortKey}
                dir={sortDir}
                onClick={handleSort}
              >
                Opened
              </SortBtn>
            </th>
            <th className="pb-2 text-left font-medium">
              <SortBtn
                col="duration"
                current={sortKey}
                dir={sortDir}
                onClick={handleSort}
              >
                Duration
              </SortBtn>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((pr) => {
            const closeDate = pr.mergedAt ?? pr.closedAt;
            const isUnreviewed = pr.mergedWithoutReview;

            return (
              <tr
                key={pr.number}
                className={`border-b border-zinc-800/60 ${isUnreviewed ? "bg-amber-500/5" : ""}`}
              >
                {/* # */}
                <td className="py-2 pr-3 text-zinc-400 font-mono">
                  {pr.number}
                </td>
                {/* Title */}
                <td className="py-2 pr-3 text-zinc-200 max-w-xs">
                  <span className="line-clamp-1" title={pr.title}>
                    {pr.title}
                  </span>
                  {isUnreviewed && (
                    <span
                      className="ml-1 text-[10px] text-amber-400"
                      title="Merged without any approving review"
                    >
                      ⚠ no review
                    </span>
                  )}
                </td>
                {/* Author */}
                <td className="py-2 pr-3 text-zinc-400 whitespace-nowrap">
                  {pr.author}
                </td>
                {/* State */}
                <td className="py-2 pr-3">
                  <StatePill pr={pr} />
                </td>
                {/* Size */}
                <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">
                  <span className="text-green-400">+{pr.additions}</span>
                  <span className="text-zinc-600 mx-0.5">/</span>
                  <span className="text-red-400">-{pr.deletions}</span>
                </td>
                {/* Reviewers */}
                <td className="py-2 pr-3">
                  <div className="flex flex-wrap gap-1">
                    {pr.reviews.length === 0 ? (
                      <span className="text-zinc-600 text-xs">—</span>
                    ) : (
                      pr.reviews.map((r, i) => (
                        <ReviewerBadge key={i} review={r} />
                      ))
                    )}
                  </div>
                </td>
                {/* Comments */}
                <td
                  className="py-2 pr-3 text-zinc-400 text-center whitespace-nowrap"
                  title={`${pr.comments} general · ${pr.reviewComments} inline review`}
                >
                  {pr.comments + pr.reviewComments > 0 ? (
                    <span className="tabular-nums">
                      {pr.comments + pr.reviewComments}
                      {pr.reviewComments > 0 && (
                        <span className="text-zinc-600 text-[10px] ml-1">
                          ({pr.reviewComments} inline)
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                {/* Time to first review */}
                <td className="py-2 pr-3 text-zinc-400 whitespace-nowrap">
                  {fmtReviewTime(pr.timeToFirstReviewSeconds)}
                </td>
                {/* Opened */}
                <td className="py-2 pr-3 text-zinc-400 whitespace-nowrap">
                  {fmtDate(pr.createdAt)}
                </td>
                {/* Duration */}
                <td className="py-2 text-zinc-400 whitespace-nowrap">
                  {fmtDuration(pr.createdAt, closeDate)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
