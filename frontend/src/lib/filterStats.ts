import type { RepoStats, FilterState } from "../types";

/** Add `days` calendar days to a "YYYY-MM-DD" string and return a new one. */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

/**
 * Returns a new RepoStats with commits/authors filtered by the given FilterState.
 * Pure function — does not mutate the original.
 */
export function applyFilters(
  stats: RepoStats,
  filters: FilterState,
): RepoStats {
  const { dateFrom, dateTo, authorMode, selectedAuthors } = filters;

  const hasDateFilter = !!(dateFrom || dateTo);
  const hasAuthorFilter = selectedAuthors.length > 0;

  if (!hasDateFilter && !hasAuthorFilter) return stats;

  // AuthorStats.key is "a0", "a1", ... — not the email.
  // DirectMainCommit and BranchDetail commits only carry email, so we need a lookup.
  const emailToKey = new Map<string, string>();
  for (const a of stats.authors) {
    emailToKey.set(a.email.toLowerCase(), a.key);
  }

  // --- Author visibility ---
  const isAuthorVisible = (key: string): boolean => {
    if (!hasAuthorFilter) return true;
    const k = key.toLowerCase();
    return authorMode === "exclude"
      ? !selectedAuthors.includes(k)
      : selectedAuthors.includes(k);
  };

  // --- Date range check (ISO strings sort lexicographically) ---
  const inDateRange = (isoDate: string): boolean => {
    const day = isoDate.slice(0, 10); // "YYYY-MM-DD"
    if (dateFrom && day < dateFrom) return false;
    if (dateTo && day > dateTo) return false;
    return true;
  };

  // --- allCommits ---
  const allCommits = stats.allCommits.filter(
    (c) => inDateRange(c.date) && isAuthorVisible(c.authorKey),
  );

  // --- directMainCommits ---
  const directMainCommits = stats.directMainCommits.filter((c) => {
    const key =
      emailToKey.get(c.authorEmail.toLowerCase()) ??
      c.authorEmail.toLowerCase();
    return inDateRange(c.date) && isAuthorVisible(key);
  });

  // --- authors list ---
  const authors = stats.authors
    .filter((a) => isAuthorVisible(a.key))
    .map((a) => {
      if (!hasDateFilter) return a;
      return {
        ...a,
        dailyActivity: a.dailyActivity.filter((d) => inDateRange(d.date)),
        weeklyCommits: a.weeklyCommits.filter((w) => inDateRange(w.week)),
      };
    });

  // --- weeklyActivity ---
  // Include a week if it overlaps with the date range (week spans 7 days).
  const weeklyActivity = stats.weeklyActivity
    .filter((w) => {
      if (!hasDateFilter) return true;
      const weekStart = w.week as string;
      const weekEnd = addDays(weekStart, 6);
      if (dateFrom && weekEnd < dateFrom) return false;
      if (dateTo && weekStart > dateTo) return false;
      return true;
    })
    .map((w) => {
      if (!hasAuthorFilter) return w;
      const out: typeof w = { week: w.week };
      for (const [key, val] of Object.entries(w)) {
        if (key === "week") continue;
        if (isAuthorVisible(key)) out[key] = val;
      }
      return out;
    });

  // --- branchDetails ---
  const branchDetails = stats.branchDetails.map((b) => ({
    ...b,
    commits: b.commits.filter((c) => {
      const key =
        emailToKey.get(c.email.toLowerCase()) ?? c.email.toLowerCase();
      return inDateRange(c.date) && isAuthorVisible(key);
    }),
  }));

  // --- fileAttribution (author filter only; blame has no date metadata) ---
  const fileAttribution = hasAuthorFilter
    ? stats.fileAttribution
        .map((f) => ({
          ...f,
          authors: f.authors.filter((a) => isAuthorVisible(a.key)),
        }))
        .filter((f) => f.authors.length > 0)
    : stats.fileAttribution;

  // --- Recompute top-level summary fields ---
  const totalCommits = allCommits.length;
  const contributors = new Set(allCommits.map((c) => c.authorKey)).size;
  const dates = allCommits.map((c) => c.date).sort();
  const firstCommit = dates[0] ?? stats.firstCommit;
  const lastCommit = dates[dates.length - 1] ?? stats.lastCommit;
  const msPerDay = 1000 * 60 * 60 * 24;
  const lifespanDays = Math.max(
    0,
    Math.ceil(
      (new Date(lastCommit).getTime() - new Date(firstCommit).getTime()) /
        msPerDay,
    ),
  );

  return {
    ...stats,
    allCommits,
    directMainCommits,
    authors,
    weeklyActivity,
    branchDetails,
    fileAttribution,
    totalCommits,
    contributors,
    firstCommit,
    lastCommit,
    lifespanDays,
  };
}
