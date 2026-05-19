import { useState } from "react";
import type { RepoStats, AuthorStats } from "../types";
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
import { GitBranch, GitMerge, Calendar, Users, Hash } from "lucide-react";
import { format, parseISO } from "date-fns";

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

function RepoHeader({ stats }: { stats: RepoStats }) {
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

  const selectedAuthor: AuthorStats | null =
    stats.authors.find((a) => a.email === selectedEmail) ?? null;

  const toggle = (email: string) =>
    setSelectedEmail((prev) => (prev === email ? null : email));

  return (
    <div className="flex flex-col min-h-full">
      <RepoHeader stats={stats} />

      <div className="p-6 space-y-8 max-w-[1600px]">
        {/* Contributors */}
        <section>
          <SectionHeading>Contributors</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {stats.authors.map((author) => (
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
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: selectedAuthor.color }}
              />
              <span className="font-semibold text-zinc-100">
                {selectedAuthor.name}
              </span>
              <span className="text-zinc-600 text-sm">
                {selectedAuthor.email}
              </span>
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
            <ContributionChart stats={stats} />
          </div>
        </section>

        {/* Branch timeline */}
        {stats.branchDetails.length > 0 && (
          <section>
            <SectionHeading>Branch Activity</SectionHeading>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <BranchTimeline stats={stats} />
            </div>
          </section>
        )}

        {/* Direct commits to main */}
        <section>
          <SectionHeading>Direct Commits to Main</SectionHeading>
          <DirectCommitsPanel stats={stats} />
        </section>

        {/* Commit timeline */}
        <section>
          <SectionHeading>Commit Timeline</SectionHeading>
          <CommitTimeline stats={stats} />
        </section>

        {/* Work patterns */}
        <section>
          <SectionHeading>Work Patterns</SectionHeading>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <CommitTimingChart stats={stats} />
          </div>
        </section>

        {/* File attribution */}
        {stats.fileAttribution.length > 0 && (
          <section>
            <SectionHeading>File Attribution</SectionHeading>
            <FileAttribution stats={stats} />
          </section>
        )}
      </div>
    </div>
  );
}
