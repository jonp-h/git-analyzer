import type { AuthorStats } from "../types";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  eachMonthOfInterval,
  getDay,
} from "date-fns";

function hexRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function commitAlpha(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 0.3;
  if (count <= 3) return 0.55;
  if (count <= 6) return 0.75;
  return 1;
}

function MonthCalendar({
  monthStart,
  dayMap,
  color,
}: {
  monthStart: Date;
  dayMap: Map<string, number>;
  color: string;
}) {
  const days = eachDayOfInterval({
    start: startOfMonth(monthStart),
    end: endOfMonth(monthStart),
  });
  const offset = getDay(startOfMonth(monthStart)); // 0 = Sunday

  return (
    <div className="flex-shrink-0">
      <div className="text-xs font-semibold text-zinc-400 mb-1.5 text-center tracking-wide">
        {format(monthStart, "MMM yyyy")}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div
            key={d}
            className="w-7 h-5 flex items-center justify-center text-[10px] text-zinc-600"
          >
            {d}
          </div>
        ))}
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`pad-${i}`} className="w-7 h-7" />
        ))}
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const count = dayMap.get(dateStr) ?? 0;
          const alpha = commitAlpha(count);
          const hasActivity = alpha > 0;
          return (
            <div
              key={dateStr}
              title={
                hasActivity
                  ? `${count} commit${count !== 1 ? "s" : ""} on ${format(day, "MMM d")}`
                  : format(day, "MMM d")
              }
              className="w-7 h-7 rounded flex items-center justify-center text-[11px] select-none cursor-default transition-opacity hover:opacity-80"
              style={{
                backgroundColor: hasActivity
                  ? hexRgba(color, alpha)
                  : "#18181b",
                color: alpha > 0.5 ? "#fff" : "#52525b",
                fontWeight: hasActivity ? 600 : 400,
              }}
            >
              {format(day, "d")}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ActivityHeatmap({ author }: { author: AuthorStats }) {
  const dayMap = new Map<string, number>();
  for (const d of author.dailyActivity) {
    if (d.count > 0) dayMap.set(d.date, d.count);
  }

  const activeDays = author.dailyActivity.filter((d) => d.count > 0);
  if (activeDays.length === 0) {
    return <p className="text-sm text-zinc-600">No commit activity found.</p>;
  }

  const sorted = [...activeDays].sort((a, b) => a.date.localeCompare(b.date));
  const months = eachMonthOfInterval({
    start: startOfMonth(parseISO(sorted[0].date)),
    end: startOfMonth(parseISO(sorted[sorted.length - 1].date)),
  });

  return (
    <div className="flex flex-wrap gap-5">
      {months.map((monthStart) => (
        <MonthCalendar
          key={format(monthStart, "yyyy-MM")}
          monthStart={monthStart}
          dayMap={dayMap}
          color={author.color}
        />
      ))}
    </div>
  );
}
