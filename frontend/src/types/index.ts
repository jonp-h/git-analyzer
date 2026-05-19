export interface CommitSizeBuckets {
  tiny: number;
  small: number;
  medium: number;
  large: number;
  dump: number;
}

export interface ConventionalCommitStats {
  total: number;
  conforming: number;
  percent: number;
  types: Record<string, number>;
}

export interface DailyActivity {
  date: string;
  count: number;
}

export interface WeeklyCommit {
  week: string;
  count: number;
}

export interface AuthorStats {
  key: string;
  name: string;
  email: string;
  color: string;
  totalCommits: number;
  linesAdded: number;
  linesDeleted: number;
  netLines: number;
  filesTouched: number;
  activeDays: number;
  firstCommit: string;
  lastCommit: string;
  avgTimeBetweenCommitsHours: number;
  commitSizeBuckets: CommitSizeBuckets;
  conventionalCommits: ConventionalCommitStats;
  dailyActivity: DailyActivity[];
  weeklyCommits: WeeklyCommit[];
}

export interface CommitInfo {
  hash: string;
  authorName: string;
  authorEmail: string;
  authorKey: string;
  date: string;
  message: string;
  insertions: number;
  deletions: number;
  totalLines: number;
  size: "tiny" | "small" | "medium" | "large" | "dump";
  isMerge: boolean;
  isConventional: boolean;
  conventionalType: string | null;
}

export interface FileAuthorAttribution {
  name: string;
  email: string;
  key: string;
  linesAdded: number;
  percent: number;
}

export interface FileAttribution {
  file: string;
  totalLines: number;
  authors: FileAuthorAttribution[];
}

export interface WeeklyDataPoint {
  week: string;
  [key: string]: number | string;
}

export interface BranchDetail {
  name: string;
  branchPointDate: string | null;
  firstCommit: string;
  lastCommit: string;
  commitCount: number;
  isMerged: boolean;
  isDefault: boolean;
  mergedAt: string | null;
  isDeleted?: boolean;
  parentBranch: string | null;
  commits: Array<{ date: string; email: string }>;
}

export interface BlameLine {
  content: string;
  authorName: string;
  authorEmail: string;
}

export interface DirectMainCommit {
  hash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  message: string;
}

export interface RepoStats {
  name: string;
  branches: string[];
  branchDetails: BranchDetail[];
  mergeCount: number;
  firstCommit: string;
  lastCommit: string;
  lifespanDays: number;
  contributors: number;
  totalCommits: number;
  authors: AuthorStats[];
  allCommits: CommitInfo[];
  weeklyActivity: WeeklyDataPoint[];
  fileAttribution: FileAttribution[];
  directMainCommits: DirectMainCommit[];
}
