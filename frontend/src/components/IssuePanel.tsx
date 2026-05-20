import { useState } from "react";
import { formatDistanceStrict, parseISO, format } from "date-fns";
import type { IssueDetail } from "../types";

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

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

type SortKey = "number" | "author" | "createdAt" | "duration" | "comments";
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
// Label chip
// ---------------------------------------------------------------------------

function LabelChip({ name, color }: { name: string; color: string }) {
  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);
  // Determine text contrast
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const textColor = lum > 0.5 ? "#18181b" : "#f4f4f5";
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ backgroundColor: `#${color}`, color: textColor }}
    >
      {name}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function IssuePanel({ issues }: { issues: IssueDetail[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...issues].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "number") cmp = a.number - b.number;
    else if (sortKey === "author") cmp = a.author.localeCompare(b.author);
    else if (sortKey === "createdAt")
      cmp = a.createdAt.localeCompare(b.createdAt);
    else if (sortKey === "comments") cmp = a.comments - b.comments;
    else if (sortKey === "duration") {
      const da = a.closedAt ?? new Date().toISOString();
      const db = b.closedAt ?? new Date().toISOString();
      cmp =
        new Date(da).getTime() -
        new Date(a.createdAt).getTime() -
        (new Date(db).getTime() - new Date(b.createdAt).getTime());
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  if (issues.length === 0) {
    return <p className="text-sm text-zinc-500 py-4">No issues found.</p>;
  }

  const openCount = issues.filter((i) => i.state === "open").length;
  const closedCount = issues.length - openCount;
  const unassigned = issues.filter((i) => i.assignees.length === 0).length;

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="flex gap-5 text-xs text-zinc-500">
        <span>
          <span className="text-green-400 font-semibold">{openCount}</span> open
        </span>
        <span>
          <span className="text-zinc-300 font-semibold">{closedCount}</span>{" "}
          closed
        </span>
        {unassigned > 0 && (
          <span className="text-amber-400">⚠ {unassigned} unassigned</span>
        )}
      </div>

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
              <th className="pb-2 pr-3 text-left font-medium min-w-48">
                Title
              </th>
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
              <th className="pb-2 pr-3 text-left font-medium">Assignees</th>
              <th className="pb-2 pr-3 text-left font-medium">Labels</th>
              <th className="pb-2 pr-3 text-left font-medium">State</th>
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
            {sorted.map((issue) => {
              const noAssignee = issue.assignees.length === 0;
              return (
                <tr
                  key={issue.number}
                  className={`border-b border-zinc-800/60 ${noAssignee && issue.state === "open" ? "bg-amber-500/5" : ""}`}
                >
                  {/* # */}
                  <td className="py-2 pr-3 text-zinc-400 font-mono">
                    {issue.number}
                  </td>
                  {/* Title */}
                  <td className="py-2 pr-3 text-zinc-200 max-w-xs">
                    <span className="line-clamp-1" title={issue.title}>
                      {issue.title}
                    </span>
                  </td>
                  {/* Author */}
                  <td className="py-2 pr-3 text-zinc-400 whitespace-nowrap">
                    {issue.author}
                  </td>
                  {/* Assignees */}
                  <td className="py-2 pr-3">
                    {noAssignee ? (
                      <span className="text-zinc-600 text-xs">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {issue.assignees.map((a) => (
                          <span
                            key={a}
                            className="px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300 text-[10px]"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  {/* Labels */}
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {issue.labels.length === 0 ? (
                        <span className="text-zinc-600 text-xs">—</span>
                      ) : (
                        issue.labels.map((l) => (
                          <LabelChip
                            key={l.name}
                            name={l.name}
                            color={l.color}
                          />
                        ))
                      )}
                    </div>
                  </td>
                  {/* State */}
                  <td className="py-2 pr-3">
                    {issue.state === "open" ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400 border border-green-500/40">
                        Open
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-700 text-zinc-400 border border-zinc-600">
                        Closed
                      </span>
                    )}
                  </td>
                  {/* Comments */}
                  <td className="py-2 pr-3 text-zinc-400 text-center">
                    {issue.comments}
                  </td>
                  {/* Opened */}
                  <td className="py-2 pr-3 text-zinc-400 whitespace-nowrap">
                    {fmtDate(issue.createdAt)}
                  </td>
                  {/* Duration */}
                  <td className="py-2 text-zinc-400 whitespace-nowrap">
                    {fmtDuration(issue.createdAt, issue.closedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
