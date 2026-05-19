import { useMemo } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import type { RepoStats, BranchDetail } from "../types";

// ── Layout constants (px) ───────────────────────────────────────────────────
const MAIN_H = 52;
const ROW_H = 44;
const ROW_GAP = 5;

// ── Helpers ──────────────────────────────────────────────────────────────────
function toPercent(dateStr: string, minTime: number, totalMs: number): number {
  const t = new Date(dateStr).getTime();
  return Math.max(0, Math.min(100, ((t - minTime) / totalMs) * 100));
}

function fmtDate(d: string) {
  return format(parseISO(d), "MMM d, yyyy");
}

function fmtDuration(days: number): string {
  if (days < 1) return "<1d";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function BranchTimeline({ stats }: { stats: RepoStats }) {
  const emailToColor = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of stats.authors) m.set(a.email.toLowerCase(), a.color);
    return m;
  }, [stats.authors]);

  const { minTime, totalMs, mainBranch, featureBranches, monthTicks } =
    useMemo(() => {
      const branches = stats.branchDetails;
      if (!branches.length)
        return {
          minTime: 0,
          totalMs: 1,
          mainBranch: null,
          featureBranches: [],
          monthTicks: [],
        };

      const start = new Date(stats.firstCommit).getTime();
      const end = new Date(stats.lastCommit).getTime();
      const total = Math.max(end - start, 1);

      const main = branches.find((b) => b.isDefault) ?? null;
      const features = [...branches.filter((b) => !b.isDefault)].sort((a, b) =>
        (a.branchPointDate ?? a.firstCommit).localeCompare(
          b.branchPointDate ?? b.firstCommit,
        ),
      );

      const ticks: { label: string; percent: number }[] = [];
      const cur = new Date(
        new Date(start).getFullYear(),
        new Date(start).getMonth(),
        1,
      );
      while (cur.getTime() <= end) {
        const p = ((cur.getTime() - start) / total) * 100;
        if (p >= 1 && p <= 99)
          ticks.push({ label: format(cur, "MMM yy"), percent: p });
        cur.setMonth(cur.getMonth() + 1);
      }

      return {
        minTime: start,
        totalMs: total,
        mainBranch: main,
        featureBranches: features,
        monthTicks: ticks,
      };
    }, [stats.branchDetails, stats.firstCommit, stats.lastCommit]);

  if (!stats.branchDetails.length)
    return <p className="text-sm text-zinc-500">No branch data available.</p>;

  const pct = (d: string) => toPercent(d, minTime, totalMs);

  // Y-center of each row within the timeline canvas
  const mainCY = MAIN_H / 2;
  const featureCY = (n: number) =>
    MAIN_H + ROW_GAP + n * (ROW_H + ROW_GAP) + ROW_H / 2;

  const totalH = MAIN_H + ROW_GAP + featureBranches.length * (ROW_H + ROW_GAP);

  // X% for the visual end of a branch line
  const endPct = (b: BranchDetail) =>
    b.mergedAt ? pct(b.mergedAt) : pct(b.lastCommit);

  // colour per branch status
  const branchColor = (b: BranchDetail) =>
    b.isDeleted ? "#a855f7" : b.isMerged ? "#22c55e" : "#f59e0b";

  return (
    <div className="select-none space-y-2">
      {/* ── Time axis ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-2">
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
        <div className="w-52 shrink-0" />
      </div>

      {/* ── Three-column layout ────────────────────────────────────────────── */}
      <div className="flex gap-2">
        {/* Labels */}
        <div className="w-40 shrink-0 relative" style={{ height: totalH }}>
          {mainBranch && (
            <div
              className="absolute inset-x-0 pr-2 flex items-center justify-end"
              style={{ top: 0, height: MAIN_H }}
            >
              <span
                className="text-xs font-mono font-bold text-blue-400 truncate"
                title={mainBranch.name}
              >
                {mainBranch.name}
              </span>
            </div>
          )}
          {featureBranches.map((b, n) => {
            const top = MAIN_H + ROW_GAP + n * (ROW_H + ROW_GAP);
            const color = b.isDeleted
              ? "text-purple-400"
              : b.isMerged
                ? "text-green-400"
                : "text-amber-400";
            return (
              <div
                key={b.name}
                className="absolute inset-x-0 pr-2 flex items-center justify-end"
                style={{ top, height: ROW_H }}
              >
                <span
                  className={`text-[11px] font-mono truncate ${color}`}
                  style={{ opacity: b.isDeleted ? 0.7 : 1 }}
                  title={b.isDeleted ? `${b.name} (deleted)` : b.name}
                >
                  {b.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Timeline canvas ───────────────────────────────────────────────── */}
        <div
          className="flex-1 relative rounded overflow-hidden"
          style={{ height: totalH, background: "rgba(24,24,27,0.6)" }}
        >
          {/* Month grid lines */}
          {monthTicks.map((m, i) => (
            <div
              key={i}
              className="absolute inset-y-0 w-px"
              style={{
                left: `${m.percent}%`,
                backgroundColor: "#3f3f46",
                opacity: 0.5,
              }}
            />
          ))}

          {/* ── Main branch ─────────────────────────────────────────────────── */}
          {mainBranch && (
            <>
              {/* Main line */}
              <div
                className="absolute rounded-full"
                style={{
                  top: mainCY - 2,
                  left: 0,
                  right: 0,
                  height: 4,
                  backgroundColor: "#3b82f6",
                  opacity: 0.65,
                }}
              />
              {/* Commit ticks on main (author-coloured) */}
              {mainBranch.commits.map((c, i) => (
                <div
                  key={i}
                  title={`${fmtDate(c.date)}`}
                  style={{
                    position: "absolute",
                    left: `${pct(c.date)}%`,
                    top: mainCY - 6,
                    width: 1,
                    height: 12,
                    transform: "translateX(-50%)",
                    backgroundColor: emailToColor.get(c.email) ?? "#71717a",
                    opacity: 0.45,
                  }}
                />
              ))}
            </>
          )}

          {/* ── Feature branches ────────────────────────────────────────────── */}
          {featureBranches.map((b, n) => {
            const cy = featureCY(n);
            const forkX = pct(b.branchPointDate ?? b.firstCommit);
            const endX = endPct(b);
            const spanW = Math.max(endX - forkX, 0.3);
            const color = branchColor(b);
            const mergeX = b.mergedAt
              ? pct(b.mergedAt)
              : b.isMerged
                ? endX
                : null;

            return (
              <div key={b.name}>
                {/* Row background stripe (subtle) */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: cy - ROW_H / 2,
                    height: ROW_H,
                    backgroundColor: n % 2 === 0 ? "#27272a" : "transparent",
                    opacity: 0.25,
                  }}
                />

                {/* Full-width faint baseline */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: cy - 0.5,
                    height: 1,
                    backgroundColor: "#3f3f46",
                    opacity: 0.35,
                  }}
                />

                {/* Fork connector: vertical from main down to branch */}
                {b.branchPointDate && (
                  <div
                    style={{
                      position: "absolute",
                      left: `${forkX}%`,
                      top: mainCY + 2,
                      height: cy - mainCY - 2,
                      width: 1,
                      transform: "translateX(-50%)",
                      backgroundColor: color,
                      opacity: 0.22,
                    }}
                  />
                )}

                {/* Merge connector: vertical from branch up to main */}
                {mergeX !== null && (
                  <div
                    style={{
                      position: "absolute",
                      left: `${mergeX}%`,
                      top: mainCY + 2,
                      height: cy - mainCY - 2,
                      width: 2,
                      transform: "translateX(-50%)",
                      backgroundColor: "#22c55e",
                      opacity: 0.5,
                    }}
                  />
                )}

                {/* Merge diamond on main */}
                {mergeX !== null && (
                  <div
                    title={`${b.name}${b.isDeleted ? " (deleted)" : ""} merged${b.mergedAt ? " · " + fmtDate(b.mergedAt) : ""}`}
                    style={{
                      position: "absolute",
                      left: `${mergeX}%`,
                      top: mainCY,
                      width: 10,
                      height: 10,
                      transform: "translate(-50%, -50%) rotate(45deg)",
                      backgroundColor: "#22c55e",
                      border: "1.5px solid #16a34a",
                      zIndex: 3,
                    }}
                  />
                )}

                {/* Active span line */}
                <div
                  style={{
                    position: "absolute",
                    left: `${forkX}%`,
                    width: `${spanW}%`,
                    top: cy - 1,
                    height: 2,
                    backgroundColor: color,
                    opacity: b.isDeleted ? 0.5 : 0.85,
                    borderRadius: 99,
                  }}
                />

                {/* Commit ticks (author-coloured vertical marks) */}
                {b.commits.map((c, i) => {
                  const x = pct(c.date);
                  if (x < forkX - 2 || x > endX + 2) return null;
                  return (
                    <div
                      key={i}
                      title={`${fmtDate(c.date)}`}
                      style={{
                        position: "absolute",
                        left: `${x}%`,
                        top: cy - 5,
                        width: 1,
                        height: 10,
                        transform: "translateX(-50%)",
                        backgroundColor: emailToColor.get(c.email) ?? "#71717a",
                        opacity: 0.8,
                      }}
                    />
                  );
                })}

                {/* Fork dot */}
                {b.branchPointDate && (
                  <div
                    title={`Branched from ${b.parentBranch ?? "(unknown)"} · ${fmtDate(b.branchPointDate)}`}
                    style={{
                      position: "absolute",
                      left: `${forkX}%`,
                      top: cy,
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      transform: "translate(-50%, -50%)",
                      backgroundColor: color,
                      opacity: 0.8,
                      border: "1px solid rgba(0,0,0,0.5)",
                      zIndex: 2,
                    }}
                  />
                )}

                {/* End cap: diamond for merged, open circle for open */}
                {b.isMerged ? (
                  <div
                    title={`Merged${b.mergedAt ? " · " + fmtDate(b.mergedAt) : ""}`}
                    style={{
                      position: "absolute",
                      left: `${endX}%`,
                      top: cy,
                      width: 9,
                      height: 9,
                      transform: "translate(-50%, -50%) rotate(45deg)",
                      backgroundColor: color,
                      zIndex: 2,
                    }}
                  />
                ) : (
                  <div
                    title={`Open · last commit ${fmtDate(b.lastCommit)}`}
                    style={{
                      position: "absolute",
                      left: `${endX}%`,
                      top: cy,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      transform: "translate(-50%, -50%)",
                      border: `2px solid ${color}`,
                      backgroundColor: "#18181b",
                      zIndex: 2,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Badges ────────────────────────────────────────────────────────── */}
        <div className="w-52 shrink-0 relative" style={{ height: totalH }}>
          {/* Main branch badge */}
          {mainBranch && (
            <div
              className="absolute inset-x-0 pl-3 flex items-center"
              style={{ top: 0, height: MAIN_H }}
            >
              <span className="text-[11px] text-zinc-400 tabular-nums">
                {mainBranch.commitCount} commits
              </span>
            </div>
          )}

          {/* Feature branch badges */}
          {featureBranches.map((b, n) => {
            const top = MAIN_H + ROW_GAP + n * (ROW_H + ROW_GAP);
            const start = b.branchPointDate ?? b.firstCommit;
            const end2 = b.mergedAt ?? b.lastCommit;
            const days =
              start && end2
                ? differenceInDays(parseISO(end2), parseISO(start))
                : 0;

            return (
              <div
                key={b.name}
                className="absolute inset-x-0 pl-3 flex flex-col justify-center gap-0.5"
                style={{ top, height: ROW_H }}
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-zinc-400 tabular-nums">
                    {b.commitCount}c
                  </span>
                  {days > 0 && (
                    <span className="text-[11px] text-zinc-600 tabular-nums">
                      {fmtDuration(days)}
                    </span>
                  )}
                  {b.isMerged ? (
                    <span className="text-[10px] font-medium text-green-500 bg-green-950/60 px-1.5 py-0.5 rounded-full border border-green-900/60">
                      {b.isDeleted ? "merged · deleted" : "merged"}
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-amber-500 bg-amber-950/60 px-1.5 py-0.5 rounded-full border border-amber-900/60">
                      open
                    </span>
                  )}
                </div>
                {b.mergedAt && (
                  <span className="text-[10px] text-zinc-600">
                    ↳ {fmtDate(b.mergedAt)}
                  </span>
                )}
                {b.branchPointDate && b.parentBranch && (
                  <span className="text-[10px] text-zinc-700">
                    ↱ from {b.parentBranch} · {fmtDate(b.branchPointDate)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Legend ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 ml-40 text-[10px] text-zinc-600">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-4 rounded-full"
            style={{ height: 3, backgroundColor: "#3b82f6", opacity: 0.65 }}
          />
          Default branch
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-4 rounded-full"
            style={{ height: 2, backgroundColor: "#22c55e", opacity: 0.85 }}
          />
          Merged
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-4 rounded-full"
            style={{ height: 2, backgroundColor: "#f59e0b", opacity: 0.85 }}
          />
          Open / unmerged
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-4 rounded-full"
            style={{ height: 2, backgroundColor: "#a855f7", opacity: 0.65 }}
          />
          Deleted (merged)
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block shrink-0"
            style={{
              width: 8,
              height: 8,
              backgroundColor: "#22c55e",
              transform: "rotate(45deg)",
            }}
          />
          Merge into main
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-px shrink-0"
            style={{ height: 12, backgroundColor: "#71717a", opacity: 0.5 }}
          />
          Commit (by author colour)
        </span>
      </div>

      {/* ── Author colour key ─────────────────────────────────────────────────── */}
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
