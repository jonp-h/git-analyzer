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

    if (!hash || !authorEmail) continue;

    let insertions = 0;
    let deletions = 0;
    const files: RawCommit["files"] = [];

    // numstat starts at line 6 (line 5 is blank separator)
    for (let i = 6; i < lines.length; i++) {
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
    `--format=${BOUNDARY}%n%H%n%an%n%ae%n%aI%n%s`,
    "--numstat",
  ]);

  const commits = parseGitLog(rawLog);

  // Branches
  const branchData = await git.branch(["-a"]);
  const branches = [
    ...new Set(
      Object.values(branchData.branches)
        .filter((b) => !b.name.includes("HEAD"))
        .map((b) => b.name.replace(/^remotes\/origin\//, "")),
    ),
  ];

  // Merge count
  const mergeRaw = await git.raw(["log", "--all", "--merges", "--format=%H"]);
  const mergeCount = mergeRaw.trim()
    ? mergeRaw.trim().split("\n").filter(Boolean).length
    : 0;

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
        isConventional: CONVENTIONAL_RE.test(c.message),
        conventionalType: m ? m[1].toLowerCase() : null,
      };
    });

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
  };
}
