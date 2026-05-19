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
          <span className="text-base font-bold text-zinc-100">{percent}%</span>
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
                <Cell key={entry.type} fill={entry.color} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-xs text-zinc-600">No conventional commits</p>
      )}
    </div>
  );
}
