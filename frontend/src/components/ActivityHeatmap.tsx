import type { AuthorStats } from "../types";
import { ActivityCalendar } from "react-activity-calendar";

export function ActivityHeatmap({ author }: { author: AuthorStats }) {
  const raw = author.dailyActivity
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date))
    .map((d) => ({
      date: d.date,
      count: d.count,
      level: d.level as 0 | 1 | 2 | 3 | 4,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (raw.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    raw.push({ date: today, count: 0, level: 0 });
  }

  // Ensure boundary entries so the calendar defines its own range
  if (raw[0].count !== 0) raw.unshift({ ...raw[0], count: 0, level: 0 });
  if (raw[raw.length - 1].count !== 0)
    raw.push({ ...raw[raw.length - 1], count: 0, level: 0 });

  return (
    <div className="overflow-x-auto pb-1">
      <ActivityCalendar
        data={raw}
        colorScheme="dark"
        theme={{ dark: ["#27272a", author.color] }}
        showWeekdayLabels
        fontSize={11}
        blockSize={12}
        blockMargin={3}
      />
    </div>
  );
}
