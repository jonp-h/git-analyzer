import { useMemo } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import type { RepoStats } from "../types";

function toPercent(dateStr: string, minTime: number, totalMs: number): number {
  const t = new Date(dateStr).getTime();
  return Math.max(0, Math.min(100, ((t - minTime) / totalMs) * 100));
}

function formatDuration(days: number): string {
  if (days < 1) return "<1d";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

export function BranchTimeline({ stats }: { stats: RepoStats }) {
  const branches = stats.branchDetails;

  // email → author colour from the already-resolved authors array
  const emailToColor = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of stats.authors) map.set(a.email.toLowerCase(), a.color);
    return map;
  }, [stats.authors]);

  const { minTime, totalMs, rows, monthTicks } = useMemo(() => {
    if (!branches.length)
      return { minTime: 0, totalMs: 1, rows: [], monthTicks: [] };

    const projectStart = new Date(stats.firstCommit).getTime();
    const projectEnd = new Date(stats.lastCommit).getTime();
    const total = Math.max(projectEnd - projectStart, 1);

    // default branch first, then feature branches sorted by fork date
    const sorted = [...branches].sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return (a.branchPointDate ?? a.firstCommit).localeCompare(
        b.branchPointDate ?? b.firstCommit,
      );
    });

    // month tick marks for the time axis
    const ticks: { label: string; percent: number }[] = [];
    const cur = new Date(
      new Date(projectStart).getFullYear(),
      new Date(projectStart).getMonth(),
      1,
    );
    const endDate = new Date(projectEnd);
    while (cur <= endDate) {
      const p = ((cur.getTime() - projectStart) / total) * 100;
      // Skip ticks within 1 % of either edge – they would overflow the
      // container or overlap the branch-name column.
      if (p >= 1 && p <= 99)
        ticks.push({ label: format(cur, "MMM yy"), percent: p });
      cur.setMonth(cur.getMonth() + 1);
    }

    return {
      minTime: projectStart,
      totalMs: total,
      rows: sorted,
      monthTicks: ticks,
    };
  }, [branches, stats.firstCommit, stats.lastCommit]);

  if (!branches.length)
    return <p className="text-sm text-zinc-600">No branch data available.</p>;

  const pct = (d: string) => toPercent(d, minTime, totalMs);

  return (
    <div className="space-y-0.5 select-none">
      {/* ── Time axis ── */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-40 shrink-0" />
        <div className="relative flex-1 h-5">
          {monthTicks.map((m, i) => (
            <span
              key={i}
              className="absolute text-[10px] text-zinc-600 whitespace-nowrap"
              style={{ left: `${m.percent}%`, transform: "translateX(-50%)" }}
            >
              {m.label}
            </span>
          ))}
        </div>
        <div className="w-28 shrink-0" />
      </div>

      {/* ── Branch rows ── */}
      {rows.map((branch) => {
        const isDefault = branch.isDefault;
        const forkDate = branch.branchPointDate ?? branch.firstCommit;
        const forkPct = pct(forkDate);
        const endPct = pct(branch.lastCommit);
        const spanWidth = Math.max(endPct - forkPct, 0.25);

        const lineColor = isDefault
          ? "#3b82f6"
          : branch.isMerged
            ? "#22c55e"
            : "#f59e0b";

        const duration =
          branch.firstCommit && branch.lastCommit
            ? differenceInDays(parseISO(branch.lastCommit), parseISO(forkDate))
            : 0;

        const safeCommits = branch.commits ?? [];

        return (
          <div
            key={branch.name}
            className={`flex items-center gap-2 group ${isDefault ? "mb-3" : ""}`}
          >
            {/* Branch label */}
            <div
              className={`w-40 shrink-0 text-right text-xs font-mono truncate cursor-default transition-colors ${
                isDefault
                  ? "text-blue-400 font-semibold"
                  : "text-zinc-500 group-hover:text-zinc-200"
              }`}
              title={branch.name}
            >
              {branch.name}
            </div>

            {/* ── Swimlane track ── */}
            <div className="relative flex-1 h-8">
              {/* faint full-width baseline */}
              <div
                className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2"
                style={{ backgroundColor: "#27272a" }}
              />

              {/* coloured active-span line */}
              <div
                className="absolute top-1/2 -translate-y-1/2 rounded-full"
                style={{
                  left: `${forkPct}%`,
                  width: `${spanWidth}%`,
                  height: isDefault ? 2 : 1.5,
                  backgroundColor: lineColor,
                  opacity: 0.35,
                }}
              />

              {/* fork-point tick for feature branches */}
              {!isDefault && branch.branchPointDate && (
                <div
                  className="absolute top-0 h-full w-px"
                  style={{
                    left: `${forkPct}%`,
                    backgroundColor: lineColor,
                    opacity: 0.2,
                  }}
                />
              )}

              {/* ── Commit dots ── */}
              {safeCommits.map((c, i) => {
                const x = pct(c.date);
                const dotColor = emailToColor.get(c.email) ?? "#71717a";
                const size = isDefault ? 5 : 7;
                return (
                  <div
                    key={i}
                    className="absolute rounded-full cursor-default"
                    style={{
                      left: `${x}%`,
                      top: "50%",
                      width: size,
                      height: size,
                      transform: "translate(-50%, -50%)",
                      backgroundColor: dotColor,
                      opacity: isDefault ? 0.4 : 0.85,
                      zIndex: 1,
                    }}
                    title={`${branch.name} · ${format(parseISO(c.date), "MMM d, yyyy")}`}
                  />
                );
              })}

              {/* merged check at end of span */}
              {!isDefault && branch.isMerged && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 text-green-500 font-bold leading-none"
                  style={{
                    left: `calc(${forkPct + spanWidth}% + 3px)`,
                    fontSize: 9,
                  }}
                >
                  ✓
                </div>
              )}

              {/* open branch dot at end */}
              {!isDefault && !branch.isMerged && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 rounded-full border"
                  style={{
                    left: `calc(${forkPct + spanWidth}% + 2px)`,
                    width: 6,
                    height: 6,
                    borderColor: "#f59e0b",
                    backgroundColor: "transparent",
                  }}
                />
              )}
            </div>

            {/* Right badge */}
            <div className="w-28 shrink-0 text-right text-[10px] tabular-nums leading-tight">
              <span className="text-zinc-500">{branch.commitCount}c</span>
              {duration > 0 && (
                <span className="text-zinc-700 ml-1">
                  {formatDuration(duration)}
                </span>
              )}
              {!isDefault && (
                <span
                  className={`ml-1.5 ${branch.isMerged ? "text-green-600" : "text-amber-600"}`}
                >
                  {branch.isMerged ? "merged" : "open"}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 ml-40 text-[10px] text-zinc-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-blue-500 opacity-50" />
          Default branch
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-green-500 opacity-50" />
          Merged
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-amber-500 opacity-50" />
          Open
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-px h-3 bg-zinc-500 opacity-30" />
          Fork point
        </span>
      </div>

      {/* ── Author colour key ── */}
      {stats.authors.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 ml-40 text-[10px] text-zinc-500">
          {stats.authors.map((a) => (
            <span key={a.email} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: a.color }}
              />
              {a.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
