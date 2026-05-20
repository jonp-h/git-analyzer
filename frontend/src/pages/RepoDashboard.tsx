import { useState, useMemo, useEffect } from "react";
import type {
  RepoStats,
  AuthorStats,
  FilterState,
  GitHubDataResponse,
} from "../types";
import { AuthorCard } from "../components/AuthorCard";
import { CommitTimeline } from "../components/CommitTimeline";
import { ContributionChart } from "../components/ContributionChart";
import { ActivityHeatmap } from "../components/ActivityHeatmap";
import { CommitSizeChart } from "../components/CommitSizeChart";
import { ConventionalCommitsChart } from "../components/ConventionalCommitsChart";
import { FileAttribution } from "../components/FileAttribution";
import { BranchTimeline } from "../components/BranchTimeline";
import { CommitTimingChart } from "../components/CommitTimingChart";
import { DirectCommitsPanel } from "../components/DirectCommitsPanel";
import { FilterBar } from "../components/FilterBar";
import { PRReviewPanel } from "../components/PRReviewPanel";
import { ReviewStats } from "../components/ReviewStats";
import { IssuePanel } from "../components/IssuePanel";
import { IssueVelocityChart } from "../components/IssueVelocityChart";
import { applyFilters } from "../lib/filterStats";
import { GitBranch, GitMerge, Calendar, Users, Hash } from "lucide-react";
import { format, parseISO } from "date-fns";

const DEFAULT_FILTER: FilterState = {
  dateFrom: null,
  dateTo: null,
  authorMode: "exclude",
  selectedAuthors: [],
};

function loadFilter(repoName: string): FilterState {
  try {
    const raw = localStorage.getItem(`git-analyzer:filters:${repoName}`);
    if (raw) return { ...DEFAULT_FILTER, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_FILTER;
}

function saveFilter(repoName: string, f: FilterState) {
  try {
    localStorage.setItem(`git-analyzer:filters:${repoName}`, JSON.stringify(f));
  } catch {
    // ignore
  }
}

function StatPill({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-zinc-400">
      <Icon className="w-3.5 h-3.5 text-zinc-500" />
      {label}
    </div>
  );
}

function RepoHeader({
  stats,
  children,
}: {
  stats: RepoStats;
  children?: React.ReactNode;
}) {
  const first = stats.firstCommit
    ? format(parseISO(stats.firstCommit), "MMM d, yyyy")
    : "—";
  const last = stats.lastCommit
    ? format(parseISO(stats.lastCommit), "MMM d, yyyy")
    : "—";

  return (
    <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-6 py-4">
      <h1 className="text-lg font-bold text-zinc-100 mb-2">{stats.name}</h1>
      <div className="flex flex-wrap gap-5">
        <StatPill
          icon={Calendar}
          label={`${first} → ${last} (${stats.lifespanDays}d)`}
        />
        <StatPill
          icon={GitBranch}
          label={`${stats.branches.length} branches`}
        />
        <StatPill icon={GitMerge} label={`${stats.mergeCount} merges`} />
        <StatPill icon={Users} label={`${stats.contributors} contributors`} />
        <StatPill icon={Hash} label={`${stats.totalCommits} commits`} />
      </div>
      {children}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
      {children}
    </h2>
  );
}

export function RepoDashboard({ stats }: { stats: RepoStats }) {
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [filterState, setFilterState] = useState<FilterState>(() =>
    loadFilter(stats.name),
  );
  const [ghData, setGhData] = useState<GitHubDataResponse | null>(null);

  useEffect(() => {
    setGhData(null);
    fetch(`/api/repos/${encodeURIComponent(stats.name)}/github-data`)
      .then((r) => r.json() as Promise<GitHubDataResponse>)
      .then(setGhData)
      .catch(() =>
        setGhData({
          prs: [],
          issues: [],
          remote: null,
          error: "Failed to fetch GitHub data",
        }),
      );
  }, [stats.name]);

  const handleFilterChange = (f: FilterState) => {
    setFilterState(f);
    saveFilter(stats.name, f);
  };

  const filteredStats = useMemo(
    () => applyFilters(stats, filterState),
    [stats, filterState],
  );

  const isDateFiltered = !!(filterState.dateFrom || filterState.dateTo);

  // If the selected author got filtered out, deselect them.
  const selectedAuthor: AuthorStats | null =
    filteredStats.authors.find((a) => a.email === selectedEmail) ?? null;

  const toggle = (email: string) =>
    setSelectedEmail((prev) => (prev === email ? null : email));

  return (
    <div className="flex flex-col min-h-full">
      <RepoHeader stats={filteredStats}>
        <FilterBar
          authors={stats.authors}
          filterState={filterState}
          onChange={handleFilterChange}
          totalCommits={stats.totalCommits}
          filteredCommits={filteredStats.totalCommits}
        />
      </RepoHeader>

      <div className="p-6 space-y-8 max-w-400">
        {/* Contributors */}
        <section>
          <SectionHeading>Contributors</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {filteredStats.authors.map((author) => (
              <AuthorCard
                key={author.email}
                author={author}
                selected={selectedEmail === author.email}
                onClick={() => toggle(author.email)}
              />
            ))}
          </div>
        </section>

        {/* Author detail panel */}
        {selectedAuthor && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="flex items-center gap-2 mb-5">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: selectedAuthor.color }}
              />
              <span className="font-semibold text-zinc-100">
                {selectedAuthor.name}
              </span>
              <span className="text-zinc-600 text-sm">
                {selectedAuthor.email}
              </span>
              {isDateFiltered && (
                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-500 border border-zinc-700">
                  Summary stats are all-time
                </span>
              )}
            </div>
            <div className="space-y-6">
              <div>
                <p className="text-xs text-zinc-500 mb-3">Activity heatmap</p>
                <ActivityHeatmap author={selectedAuthor} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-zinc-500 mb-2">Commit sizes</p>
                  <CommitSizeChart author={selectedAuthor} />
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-2">
                    Conventional commits
                  </p>
                  <ConventionalCommitsChart author={selectedAuthor} />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Contribution over time */}
        <section>
          <SectionHeading>Lines Added Over Time</SectionHeading>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <ContributionChart stats={filteredStats} />
          </div>
        </section>

        {/* File attribution */}
        {filteredStats.fileAttribution.length > 0 && (
          <section>
            <SectionHeading>File Attribution</SectionHeading>
            <FileAttribution stats={filteredStats} />
          </section>
        )}

        {/* Branch timeline */}
        {filteredStats.branchDetails.length > 0 && (
          <section>
            <SectionHeading>Branch Activity</SectionHeading>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <BranchTimeline stats={filteredStats} prs={ghData?.prs} />
            </div>
          </section>
        )}

        {/* Review activity */}
        {ghData && !ghData.error && ghData.prs.length > 0 && (
          <section>
            <SectionHeading>Review Activity</SectionHeading>
            <ReviewStats prs={ghData.prs} />
          </section>
        )}

        {/* Pull requests */}
        <section>
          <SectionHeading>Pull Requests</SectionHeading>
          {ghData === null ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : ghData.error === "GITHUB_TOKEN not configured" ? (
            <p className="text-sm text-zinc-500">
              Add <code className="text-zinc-400">GITHUB_TOKEN</code> to{" "}
              <code className="text-zinc-400">backend/.env</code> to enable PR
              &amp; issue data.
            </p>
          ) : ghData.error ? (
            <p className="text-sm text-amber-500">{ghData.error}</p>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <PRReviewPanel prs={ghData.prs} />
            </div>
          )}
        </section>

        {/* Issue velocity */}
        {ghData && !ghData.error && ghData.issues.length > 0 && (
          <section>
            <SectionHeading>Issue Velocity</SectionHeading>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <IssueVelocityChart issues={ghData.issues} />
            </div>
          </section>
        )}

        {/* Issues */}
        {ghData && !ghData.error && (
          <section>
            <SectionHeading>Issues</SectionHeading>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <IssuePanel issues={ghData.issues} />
            </div>
          </section>
        )}

        {/* Direct commits to main */}
        <section>
          <SectionHeading>Direct Commits to Main</SectionHeading>
          <DirectCommitsPanel stats={filteredStats} />
        </section>

        {/* Work patterns */}
        <section>
          <SectionHeading>Work Patterns</SectionHeading>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <CommitTimingChart stats={filteredStats} />
          </div>
        </section>

        {/* Commit timeline */}
        <section>
          <SectionHeading>Commit Timeline</SectionHeading>
          <CommitTimeline stats={filteredStats} />
        </section>
      </div>
    </div>
  );
}
