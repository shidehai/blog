"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ActivityDay } from "../lib/types";

interface ActivityHeatmapProps {
  days: ActivityDay[];
  activeDaysCount: number;
  totalUpdates: number;
}

export function ActivityHeatmap({
  days,
  activeDaysCount,
  totalUpdates,
}: ActivityHeatmapProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [hoveredDay, setHoveredDay] = useState<{
    date: string;
    count: number;
  } | null>(null);

  const weeks = useMemo(() => {
    const res: ActivityDay[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      res.push(days.slice(i, i + 7));
    }
    return res;
  }, [days]);

  // Auto scroll to rightmost (most recent weeks)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [weeks]);

  // 53 spans matching 53 week columns
  const monthLabels = [
    "8月",
    "",
    "9月",
    "",
    "",
    "",
    "10月",
    "",
    "",
    "",
    "11月",
    "",
    "",
    "",
    "",
    "12月",
    "",
    "",
    "",
    "1月",
    "",
    "",
    "",
    "2月",
    "",
    "",
    "",
    "3月",
    "",
    "",
    "",
    "",
    "4月",
    "",
    "",
    "",
    "5月",
    "",
    "",
    "",
    "",
    "6月",
    "",
    "",
    "",
    "7月",
    "",
    "",
    "",
    "8月",
    "",
    "",
    "",
  ];

  return (
    <section className="glass activity-card" aria-labelledby="activity-title">
      <header className="activity-head">
        <div>
          <h2 id="activity-title">创作记录</h2>
          <p>2025.08 - 2026.08 · {activeDaysCount} 个活跃日</p>
        </div>
        <div className="activity-total">
          <strong>{totalUpdates}</strong>
          <span>次更新</span>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="activity-scroll"
        role="region"
        tabIndex={0}
        aria-label="近一年内容活跃度，可横向滚动查看"
      >
        <div className="activity-chart" aria-hidden="true">
          {/* Top Month Header (53 Columns aligned with weeks) */}
          <div className="activity-months">
            {monthLabels.map((month, idx) => (
              <span key={idx}>{month}</span>
            ))}
          </div>

          {/* Body: 7 Weekday Labels (18px) + Gap (6px) + 53 Weeks Grid */}
          <div className="activity-chart-body">
            <div className="activity-weekdays">
              <span>一</span>
              <span></span>
              <span>三</span>
              <span></span>
              <span>五</span>
              <span></span>
              <span>日</span>
            </div>

            <ol className="activity-grid">
              {weeks.map((week, wIdx) => (
                <li key={wIdx} className="activity-week">
                  {week.map((d) => (
                    <span
                      key={d.date}
                      className={`activity-cell activity-level-${d.level}`}
                      onMouseEnter={() =>
                        setHoveredDay({ date: d.date, count: d.count })
                      }
                      onMouseLeave={() => setHoveredDay(null)}
                      title={`${d.date} · ${
                        d.count > 0 ? `${d.count} 次内容更新` : "无内容更新"
                      }`}
                    />
                  ))}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <footer className="activity-footer">
        <span>
          {hoveredDay ? (
            <strong style={{ color: "var(--accent)" }}>
              {hoveredDay.date} ·{" "}
              {hoveredDay.count > 0
                ? `${hoveredDay.count} 次内容更新`
                : "无内容更新"}
            </strong>
          ) : (
            "文章发布与更新"
          )}
        </span>
        <span className="activity-legend" aria-label="活跃度从低到高">
          低 <i className="activity-cell activity-level-0"></i>
          <i className="activity-cell activity-level-1"></i>
          <i className="activity-cell activity-level-2"></i>
          <i className="activity-cell activity-level-3"></i>
          <i className="activity-cell activity-level-4"></i> 高
        </span>
      </footer>
    </section>
  );
}
