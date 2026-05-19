import { simpleGit } from "simple-git";
import { readdirSync, statSync, existsSync } from "fs";
import { join } from "path";

export const AUTHOR_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f97316", // orange
  "#a855f7", // purple
  "#eab308", // yellow
  "#ef4444", // red
];

const CONVENTIONAL_RE =
  /^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(\([^)]+\))?(!)?: .+/i;
const CONVENTIONAL_TYPE_RE =
  /^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)/i;

const BOUNDARY = "COMMITBOUNDARY";

interface RawCommit {
  hash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  message: string;
  isMerge: boolean;
  insertions: number;
  deletions: number;
  files: Array<{ path: string; insertions: number; deletions: number }>;
}

function parseGitLog(raw: string): RawCommit[] {
  const chunks = raw.split(BOUNDARY + "\n").slice(1);
  const commits: RawCommit[] = [];

  for (const chunk of chunks) {
    const lines = chunk.split("\n");
    const hash = lines[0]?.trim();
    const authorName = lines[1]?.trim();
    const authorEmail = lines[2]?.trim();
    const date = lines[3]?.trim();
    const message = lines[4]?.trim();
    const parents = lines[5]?.trim() ?? "";
    const isMerge = parents.split(" ").filter(Boolean).length >= 2;

    if (!hash || !authorEmail) continue;

    let insertions = 0;
    let deletions = 0;
    const files: RawCommit["files"] = [];

    // numstat starts at line 7 (line 5 = parents, line 6 = blank separator)
    for (let i = 7; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split("\t");
      if (parts.length !== 3) continue;
      if (parts[0] === "-" || parts[1] === "-") continue; // binary file

      const ins = parseInt(parts[0], 10) || 0;
      const del = parseInt(parts[1], 10) || 0;
      // Handle renames: "old.ts => new.ts" or "{old => new}/file.ts"
      let filePath = parts[2];
      if (filePath.includes("=>")) {
        filePath = filePath
          .replace(/\{[^}]* => ([^}]*)\}/, "$1")
          .replace(/\/+/g, "/");
        if (filePath.includes(" => ")) filePath = filePath.split(" => ").pop()!;
        filePath = filePath.trim();
      }

      files.push({ path: filePath, insertions: ins, deletions: del });
      insertions += ins;
      deletions += del;
    }

    commits.push({
      hash,
      authorName,
      authorEmail,
      date,
      message,
      isMerge,
      insertions,
      deletions,
      files,
    });
  }

  return commits;
}

function sizeLabel(lines: number): string {
  if (lines <= 10) return "tiny";
  if (lines <= 50) return "small";
  if (lines <= 200) return "medium";
  if (lines <= 500) return "large";
  return "dump";
}

function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function weekKeyToDate(key: string): string {
  const [y, w] = key.split("-W").map(Number);
  const d = new Date(y, 0, 1 + (w - 1) * 7);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d.toISOString().slice(0, 10);
}

function parseCommitLines(raw: string): Array<{ date: string; email: string }> {
  return raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf("\t");
      if (tab < 0) return { date: line.trim(), email: "" };
      return {
        date: line.slice(0, tab).trim(),
        email: line
          .slice(tab + 1)
          .trim()
          .toLowerCase(),
      };
    })
    .filter((c) => c.date);
}

export function listRepos(reposDir: string): string[] {
  if (!existsSync(reposDir)) return [];
  return readdirSync(reposDir).filter((name) => {
    try {
      const full = join(reposDir, name);
      return statSync(full).isDirectory() && existsSync(join(full, ".git"));
    } catch {
      return false;
    }
  });
}

export async function getRepoStats(reposDir: string, repoName: string) {
  const repoPath = join(reposDir, repoName);
  const git = simpleGit(repoPath);

  const rawLog = await git.raw([
    "log",
    "--all",
    `--format=${BOUNDARY}%n%H%n%an%n%ae%n%aI%n%s%n%P`,
    "--numstat",
  ]);

  const commits = parseGitLog(rawLog);

  // Branches
  const branchData = await git.branch(["-a"]);

  // Build branch list preserving the actual git ref so remote-only branches
  // (no local checkout) can still be queried with `git log <ref>`.
  // Prefer local refs; add remote-only branches in a second pass.
  const seenSimpleNames = new Set<string>();
  const branchList: Array<{ name: string; ref: string }> = [];
  for (const b of Object.values(branchData.branches)) {
    if (b.name.includes("HEAD") || b.name.startsWith("remotes/")) continue;
    if (!seenSimpleNames.has(b.name)) {
      seenSimpleNames.add(b.name);
      branchList.push({ name: b.name, ref: b.name });
    }
  }
  for (const b of Object.values(branchData.branches)) {
    if (b.name.includes("HEAD") || !b.name.startsWith("remotes/")) continue;
    const simpleName = b.name.replace(/^remotes\/origin\//, "");
    if (!seenSimpleNames.has(simpleName)) {
      seenSimpleNames.add(simpleName);
      branchList.push({ name: simpleName, ref: b.name }); // use full remote ref
    }
  }
  const branches = branchList.map((b) => b.name);

  // Merge count (derived from parsed commits)
  const mergeCount = commits.filter((c) => c.isMerge).length;

  // Branch details (for Gantt timeline)
  let defaultBranch = branches[0] ?? "main";
  try {
    defaultBranch = (await git.raw(["symbolic-ref", "--short", "HEAD"])).trim();
  } catch {
    /* detached HEAD */
  }

  const mergedBranchesRaw = await git
    .raw(["branch", "--merged", "HEAD"])
    .catch(() => "");
  const mergedRemoteRaw = await git
    .raw(["branch", "-r", "--merged", "HEAD"])
    .catch(() => "");
  const mergedSet = new Set([
    ...mergedBranchesRaw
      .split("\n")
      .map((b) => b.trim().replace(/^\*\s*/, ""))
      .filter(Boolean),
    ...mergedRemoteRaw
      .split("\n")
      .map((b) => b.trim().replace(/^origin\//, ""))
      .filter(Boolean),
  ]);

  const branchDetails: Array<{
    name: string;
    branchPointDate: string | null;
    firstCommit: string;
    lastCommit: string;
    commitCount: number;
    isMerged: boolean;
    isDefault: boolean;
    commits: Array<{ date: string; email: string }>;
  }> = [];

  // Pre-cache default-branch first-parent list so FF-merge detection
  // doesn't re-run the same expensive git log for every branch.
  const defaultFirstParent = (
    await git
      .raw([
        "log",
        defaultBranch,
        "--first-parent",
        "--format=%H",
        "--max-count=2000",
      ])
      .catch(() => "")
  )
    .trim()
    .split("\n")
    .filter(Boolean);

  for (const { name: branch, ref: branchRef } of branchList.slice(0, 25)) {
    try {
      if (branch === defaultBranch) {
        // Default branch: show full project timeline
        const defCommits = parseCommitLines(
          (
            await git
              .raw(["log", branchRef, "--format=%aI\t%ae", "--max-count=1000"])
              .catch(() => "")
          ).trim(),
        );
        if (!defCommits.length) continue;
        const defDates = defCommits.map((c) => c.date);
        branchDetails.push({
          name: branch,
          branchPointDate: null,
          firstCommit: defDates[defDates.length - 1],
          lastCommit: defDates[0],
          commitCount: defDates.length,
          isMerged: false,
          isDefault: true,
          commits: defCommits,
        });
      } else {
        // Feature branch: find where it diverged from the default branch.
        let mergeBase = (
          await git
            .raw(["merge-base", "--fork-point", defaultBranch, branchRef])
            .catch(() => "")
        ).trim();
        if (!mergeBase) {
          mergeBase = (
            await git
              .raw(["merge-base", defaultBranch, branchRef])
              .catch(() => "")
          ).trim();
        }

        if (mergeBase) {
          let branchPointDate =
            (
              await git
                .raw(["log", "-1", "--format=%aI", mergeBase])
                .catch(() => "")
            ).trim() || null;

          // Commits unique to this branch (date + email for dot colouring)
          let branchCommits = parseCommitLines(
            (
              await git
                .raw([
                  "log",
                  `${mergeBase}..${branchRef}`,
                  "--format=%aI\t%ae",
                  "--max-count=500",
                ])
                .catch(() => "")
            ).trim(),
          );

          // Fallback when mergeBase..branchRef is empty.
          // This happens when the branch tip is already an ancestor of the
          // default branch (i.e. the branch was merged).  Two strategies:
          //   1. FF-merge: the tip sits directly on main's first-parent chain.
          //   2. Regular merge: a merge commit in main has the tip as its
          //      second (or later) parent.  Use that commit's first parent as
          //      the real fork base so we get all branch-unique commits.
          if (!branchCommits.length) {
            const tip = (
              await git.raw(["rev-parse", branchRef]).catch(() => "")
            ).trim();
            if (tip) {
              // Strategy 1 – FF merge
              const idx = defaultFirstParent.indexOf(tip);
              if (idx >= 0 && idx + 1 < defaultFirstParent.length) {
                const realFork = defaultFirstParent[idx + 1];
                branchPointDate =
                  (
                    await git
                      .raw(["log", "-1", "--format=%aI", realFork])
                      .catch(() => "")
                  ).trim() || branchPointDate;
                branchCommits = parseCommitLines(
                  (
                    await git
                      .raw([
                        "log",
                        `${realFork}..${branchRef}`,
                        "--format=%aI\t%ae",
                        "--max-count=500",
                      ])
                      .catch(() => "")
                  ).trim(),
                );
              }

              // Strategy 2 – regular (non-FF) merge: search main's merge
              // commits for one whose parents include the branch tip.
              if (!branchCommits.length) {
                const mergesLog = (
                  await git
                    .raw([
                      "log",
                      defaultBranch,
                      "--merges",
                      "--format=%H %P",
                      "--max-count=1000",
                    ])
                    .catch(() => "")
                ).trim();
                for (const line of mergesLog.split("\n").filter(Boolean)) {
                  const parts = line.trim().split(/\s+/);
                  if (parts.length < 3) continue; // need at least hash + 2 parents
                  const parents = parts.slice(1);
                  if (parents.includes(tip)) {
                    // parents[0] is the first parent (main's side before merge)
                    const forkBase = parents[0];
                    branchPointDate =
                      (
                        await git
                          .raw(["log", "-1", "--format=%aI", forkBase])
                          .catch(() => "")
                      ).trim() || branchPointDate;
                    branchCommits = parseCommitLines(
                      (
                        await git
                          .raw([
                            "log",
                            `${forkBase}..${branchRef}`,
                            "--format=%aI\t%ae",
                            "--max-count=500",
                          ])
                          .catch(() => "")
                      ).trim(),
                    );
                    if (branchCommits.length) break;
                  }
                }
              }
            }
          }

          const dates = branchCommits.map((c) => c.date);
          if (!dates.length && !branchPointDate) continue;

          branchDetails.push({
            name: branch,
            branchPointDate,
            firstCommit: dates.length
              ? dates[dates.length - 1]
              : branchPointDate!,
            lastCommit: dates.length ? dates[0] : branchPointDate!,
            commitCount: dates.length,
            isMerged: mergedSet.has(branch),
            isDefault: false,
            commits: branchCommits,
          });
        } else {
          // No common ancestor (orphan branch) — full history fallback
          const branchCommits = parseCommitLines(
            (
              await git
                .raw(["log", branchRef, "--format=%aI\t%ae", "--max-count=500"])
                .catch(() => "")
            ).trim(),
          );
          if (!branchCommits.length) continue;
          const dates = branchCommits.map((c) => c.date);
          branchDetails.push({
            name: branch,
            branchPointDate: null,
            firstCommit: dates[dates.length - 1],
            lastCommit: dates[0],
            commitCount: dates.length,
            isMerged: mergedSet.has(branch),
            isDefault: false,
            commits: branchCommits,
          });
        }
      }
    } catch {
      /* skip branch */
    }
  }

  // Build per-author data keyed by lowercase email
  type AuthorEntry = {
    name: string;
    email: string;
    colorIndex: number;
    key: string;
    totalCommits: number;
    linesAdded: number;
    linesDeleted: number;
    filesTouched: Set<string>;
    dayCommits: Map<string, number>;
    commits: RawCommit[];
    sizeBuckets: Record<string, number>;
    ccTotal: number;
    ccConforming: number;
    ccTypes: Record<string, number>;
  };

  const authorMap = new Map<string, AuthorEntry>();
  let colorIdx = 0;

  for (const c of commits) {
    const key = c.authorEmail.toLowerCase();
    if (!authorMap.has(key)) {
      const idx = colorIdx++;
      authorMap.set(key, {
        name: c.authorName,
        email: c.authorEmail,
        colorIndex: idx,
        key: `a${idx}`,
        totalCommits: 0,
        linesAdded: 0,
        linesDeleted: 0,
        filesTouched: new Set(),
        dayCommits: new Map(),
        commits: [],
        sizeBuckets: { tiny: 0, small: 0, medium: 0, large: 0, dump: 0 },
        ccTotal: 0,
        ccConforming: 0,
        ccTypes: {},
      });
    }

    const a = authorMap.get(key)!;
    a.totalCommits++;
    a.linesAdded += c.insertions;
    a.linesDeleted += c.deletions;
    for (const f of c.files) a.filesTouched.add(f.path);

    const day = c.date.slice(0, 10);
    a.dayCommits.set(day, (a.dayCommits.get(day) || 0) + 1);
    a.commits.push(c);

    const size = sizeLabel(c.insertions + c.deletions);
    a.sizeBuckets[size]++;

    a.ccTotal++;
    if (CONVENTIONAL_RE.test(c.message)) {
      a.ccConforming++;
      const m = CONVENTIONAL_TYPE_RE.exec(c.message);
      if (m) {
        const t = m[1].toLowerCase();
        a.ccTypes[t] = (a.ccTypes[t] || 0) + 1;
      }
    }
  }

  // Serialize authors (ordered by most commits desc)
  const authorEntries = Array.from(authorMap.values()).sort(
    (a, b) => b.totalCommits - a.totalCommits,
  );

  const authors = authorEntries.map((a) => {
    const sorted = [...a.commits].sort((x, y) => x.date.localeCompare(y.date));
    const firstCommit = sorted[0]?.date ?? "";
    const lastCommit = sorted[sorted.length - 1]?.date ?? "";

    let avgGapHours = 0;
    if (sorted.length > 1) {
      const ms =
        new Date(lastCommit).getTime() - new Date(firstCommit).getTime();
      avgGapHours = ms / (sorted.length - 1) / 3_600_000;
    }

    const dailyActivity = Array.from(a.dayCommits.entries()).map(
      ([date, count]) => ({ date, count }),
    );

    const weekMap = new Map<string, number>();
    for (const c of a.commits) {
      const wk = isoWeekKey(c.date);
      weekMap.set(wk, (weekMap.get(wk) || 0) + 1);
    }
    const weeklyCommits = Array.from(weekMap.entries())
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([week, count]) => ({ week: weekKeyToDate(week), count }));

    return {
      key: a.key,
      name: a.name,
      email: a.email,
      color: AUTHOR_COLORS[a.colorIndex % AUTHOR_COLORS.length],
      totalCommits: a.totalCommits,
      linesAdded: a.linesAdded,
      linesDeleted: a.linesDeleted,
      netLines: a.linesAdded - a.linesDeleted,
      filesTouched: a.filesTouched.size,
      activeDays: a.dayCommits.size,
      firstCommit,
      lastCommit,
      avgTimeBetweenCommitsHours: Math.round(avgGapHours * 10) / 10,
      commitSizeBuckets: a.sizeBuckets as Record<string, number>,
      conventionalCommits: {
        total: a.ccTotal,
        conforming: a.ccConforming,
        percent:
          a.ccTotal > 0 ? Math.round((a.ccConforming / a.ccTotal) * 100) : 0,
        types: a.ccTypes,
      },
      dailyActivity,
      weeklyCommits,
    };
  });

  // Weekly activity: lines added per author per week (keyed by a.key)
  const weeklyMap = new Map<string, Record<string, number>>();
  for (const c of commits) {
    const wk = isoWeekKey(c.date);
    if (!weeklyMap.has(wk)) weeklyMap.set(wk, {});
    const entry = weeklyMap.get(wk)!;
    const authorEntry = authorMap.get(c.authorEmail.toLowerCase());
    if (authorEntry) {
      entry[authorEntry.key] = (entry[authorEntry.key] || 0) + c.insertions;
    }
  }
  const weeklyActivity = Array.from(weeklyMap.entries())
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([week, data]) => ({ week: weekKeyToDate(week), ...data }));

  // File attribution
  const fileMap = new Map<string, Map<string, number>>();
  for (const c of commits) {
    const authorEntry = authorMap.get(c.authorEmail.toLowerCase());
    if (!authorEntry) continue;
    for (const f of c.files) {
      if (!fileMap.has(f.path)) fileMap.set(f.path, new Map());
      const fm = fileMap.get(f.path)!;
      fm.set(authorEntry.key, (fm.get(authorEntry.key) || 0) + f.insertions);
    }
  }

  const keyToAuthor = new Map(authors.map((a) => [a.key, a]));
  const fileAttribution = Array.from(fileMap.entries())
    .map(([file, authorLines]) => {
      const total = Array.from(authorLines.values()).reduce((s, n) => s + n, 0);
      const fileAuthors = Array.from(authorLines.entries())
        .map(([key, lines]) => ({
          name: keyToAuthor.get(key)?.name ?? key,
          email: keyToAuthor.get(key)?.email ?? key,
          key,
          linesAdded: lines,
          percent: total > 0 ? Math.round((lines / total) * 100) : 0,
        }))
        .sort((a, b) => b.linesAdded - a.linesAdded);
      return { file, totalLines: total, authors: fileAuthors };
    })
    .filter((f) => f.totalLines > 0)
    .sort((a, b) => b.totalLines - a.totalLines)
    .slice(0, 100);

  // All commits for timeline
  const allCommits = commits
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((c) => {
      const totalLines = c.insertions + c.deletions;
      const m = CONVENTIONAL_TYPE_RE.exec(c.message);
      return {
        hash: c.hash,
        authorName: c.authorName,
        authorEmail: c.authorEmail.toLowerCase(),
        authorKey: authorMap.get(c.authorEmail.toLowerCase())?.key ?? "a0",
        date: c.date,
        message: c.message,
        insertions: c.insertions,
        deletions: c.deletions,
        totalLines,
        size: sizeLabel(totalLines),
        isMerge: c.isMerge,
        isConventional: CONVENTIONAL_RE.test(c.message),
        conventionalType: m ? m[1].toLowerCase() : null,
      };
    });

  // Direct (non-merge) commits on the default branch's first-parent chain.
  // Reuses the already-computed defaultFirstParent and commits arrays.
  const commitByHash = new Map(commits.map((c) => [c.hash, c]));
  const directMainCommits = defaultFirstParent
    .map((hash) => commitByHash.get(hash))
    .filter((c): c is RawCommit => !!c && !c.isMerge)
    .map((c) => ({
      hash: c.hash,
      authorName: c.authorName,
      authorEmail: c.authorEmail.toLowerCase(),
      date: c.date,
      message: c.message,
    }));

  const sortedAll = [...commits].sort((a, b) => a.date.localeCompare(b.date));
  const firstCommit = sortedAll[0]?.date ?? "";
  const lastCommit = sortedAll[sortedAll.length - 1]?.date ?? "";
  const lifespanDays =
    firstCommit && lastCommit
      ? Math.ceil(
          (new Date(lastCommit).getTime() - new Date(firstCommit).getTime()) /
            86_400_000,
        )
      : 0;

  return {
    name: repoName,
    branches,
    branchDetails,
    mergeCount,
    firstCommit,
    lastCommit,
    lifespanDays,
    contributors: authorMap.size,
    totalCommits: commits.length,
    authors,
    allCommits,
    weeklyActivity,
    fileAttribution,
    directMainCommits,
  };
}

export interface BlameLine {
  content: string;
  authorName: string;
  authorEmail: string;
}

export async function getFileBlame(
  reposDir: string,
  repoName: string,
  filePath: string,
): Promise<BlameLine[]> {
  const repoPath = join(reposDir, repoName);

  // Security: prevent path traversal
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.includes("..") || normalized.startsWith("/")) {
    throw new Error("Invalid file path");
  }

  const git = simpleGit(repoPath);
  const raw = await git.raw(["blame", "--line-porcelain", "--", normalized]);

  const lines = raw.split("\n");
  const result: BlameLine[] = [];
  let i = 0;

  while (i < lines.length) {
    if (/^[0-9a-f]{40} /.test(lines[i])) {
      let authorName = "Unknown";
      let authorEmail = "";
      i++;
      while (i < lines.length && !lines[i].startsWith("\t")) {
        if (lines[i].startsWith("author ") && !lines[i].startsWith("author-")) {
          authorName = lines[i].slice(7);
        } else if (lines[i].startsWith("author-mail ")) {
          authorEmail = lines[i].slice(12).replace(/[<>]/g, "");
        }
        i++;
      }
      if (i < lines.length && lines[i].startsWith("\t")) {
        result.push({ content: lines[i].slice(1), authorName, authorEmail });
      }
    }
    i++;
  }

  return result;
}
