import type { AuthorStats } from "../types";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const TYPE_COLORS: Record<string, string> = {
  feat: "#3b82f6",
  fix: "#ef4444",
  docs: "#71717a",
  style: "#a855f7",
  refactor: "#f59e0b",
  test: "#22c55e",
  chore: "#52525b",
  build: "#6b7280",
  ci: "#6b7280",
  perf: "#eab308",
  revert: "#94a3b8",
};

export function ConventionalCommitsChart({ author }: { author: AuthorStats }) {
  const { total, conforming, percent, types } = author.conventionalCommits;
  const mq = author.messageQuality;

  const pieData = [
    { name: "Conventional", value: conforming, color: "#22c55e" },
    { name: "Non-conventional", value: total - conforming, color: "#3f3f46" },
  ];

  const barData = Object.entries(types)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([type, count]) => ({
      type,
      count,
      color: TYPE_COLORS[type] ?? "#52525b",
    }));

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-4">
        {/* Donut */}
        <div className="relative flex-shrink-0">
          <ResponsiveContainer width={120} height={120}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={36}
                outerRadius={52}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                strokeWidth={0}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-base font-bold text-zinc-100">
              {percent}%
            </span>
          </div>
        </div>

        {/* Type breakdown */}
        {barData.length > 0 ? (
          <ResponsiveContainer width="100%" height={120}>
            <BarChart
              data={barData}
              layout="vertical"
              margin={{ top: 0, right: 0, left: 10, bottom: 0 }}
            >
              <XAxis
                type="number"
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="type"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={55}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value) => [value, "Commits"]}
              />
              <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                {barData.map((entry) => (
                  <Cell
                    key={entry.type}
                    fill={entry.color}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-zinc-600">No conventional commits</p>
        )}
      </div>
      <MessageQualitySection mq={mq} total={total} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal helper — message quality strip rendered below the chart
// ---------------------------------------------------------------------------
function MessageQualitySection({
  mq,
  total,
}: {
  mq: import("../types").MessageQualityStats;
  total: number;
}) {
  const shortPct = total > 0 ? (mq.tooShort / total) * 100 : 0;
  const goodPct = total > 0 ? (mq.good / total) * 100 : 0;
  const longPct = total > 0 ? (mq.tooLong / total) * 100 : 0;
  const noisyPct = total > 0 ? (mq.noisy / total) * 100 : 0;

  return (
    <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Message Quality
      </p>

      {/* Stacked length bar */}
      <div className="flex flex-col gap-1">
        <div className="flex h-3 w-full overflow-hidden rounded-sm">
          {shortPct > 0 && (
            <div
              className="h-full bg-red-500/80"
              style={{ width: `${shortPct}%` }}
              title={`Too short (<10 chars): ${mq.tooShort}`}
            />
          )}
          {goodPct > 0 && (
            <div
              className="h-full bg-emerald-500/80"
              style={{ width: `${goodPct}%` }}
              title={`Good length (10–72 chars): ${mq.good}`}
            />
          )}
          {longPct > 0 && (
            <div
              className="h-full bg-amber-500/80"
              style={{ width: `${longPct}%` }}
              title={`Too long (>72 chars): ${mq.tooLong}`}
            />
          )}
        </div>
        <div className="flex gap-3 text-[10px] text-zinc-400">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm bg-red-500/80" />
            Short {mq.tooShort}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500/80" />
            Good {mq.good}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm bg-amber-500/80" />
            Long {mq.tooLong}
          </span>
        </div>
      </div>

      {/* Stat row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        <span className="text-zinc-400">
          Avg length{" "}
          <span className="font-semibold text-zinc-200">{mq.avgLength}</span>
          <span className="text-zinc-600"> chars</span>
        </span>
        <span className="text-zinc-400">
          With body{" "}
          <span className="font-semibold text-zinc-200">
            {mq.hasBodyPercent}%
          </span>
          <span className="text-zinc-600"> ({mq.hasBody})</span>
        </span>
        <span className="text-zinc-400">
          Noisy{" "}
          <span
            className={
              mq.noisy === 0
                ? "font-semibold text-zinc-200"
                : noisyPct >= 10
                  ? "font-semibold text-red-400"
                  : "font-semibold text-amber-400"
            }
          >
            {mq.noisy}
          </span>
          {mq.noisy > 0 && (
            <span className="text-zinc-600"> ({Math.round(noisyPct)}%)</span>
          )}
        </span>
      </div>
    </div>
  );
}
