"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { Post } from "../lib/types";

interface SideRightProps {
  posts: Post[];
}

export function SideRight({ posts }: SideRightProps) {
  // 1. Live Clock State
  const [timeStr, setTimeStr] = useState<string>("11:15:00");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewDate, setViewDate] = useState<Date>(new Date());

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentDate(now);
      setTimeStr(format(now, "HH:mm:ss"));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Calendar computation for viewDate
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth(); // 0-indexed

  // First day of month and total days
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun, 1=Mon...
  // Convert Sunday=0 to Monday-based index (0=Mon, 6=Sun)
  const mondayOffset = (firstDayOfWeek + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  const resetToToday = () => {
    setViewDate(new Date());
  };

  const isToday = (dayNum: number) => {
    const today = new Date();
    return (
      today.getFullYear() === viewYear &&
      today.getMonth() === viewMonth &&
      today.getDate() === dayNum
    );
  };

  const isWeekend = (dayIndex: number) => {
    // dayIndex % 7: 5=Saturday, 6=Sunday
    const col = dayIndex % 7;
    return col === 5 || col === 6;
  };

  // Chinese solar & lunar helpers
  const solarDateStr = format(currentDate, "yyyy年MM月dd日 EEEE", {
    locale: zhCN,
  });

  return (
    <aside className="side-right">
      {/* 1. 建站状态 */}
      <div className="glass side-card">
        <h4>建站状态</h4>

        <div className="stat-item">
          <svg
            className="ui-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M8 13h8M8 17h6" />
          </svg>
          <span className="stat-label">文章</span>
          <span className="stat-value">{posts.length} 篇</span>
        </div>

        <div className="stat-item">
          <svg
            className="ui-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span className="stat-label">运行</span>
          <span className="stat-value">128 天</span>
          <span className="sr-only">，始于 2026-04-15</span>
        </div>

        <div className="stat-item">
          <svg
            className="ui-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <span className="stat-label">更新</span>
          <time className="stat-value" dateTime="2026-08-20">
            2026-08-20
          </time>
        </div>
      </div>

      {/* 2. 本地时间与日历 */}
      <section className="glass side-card cal-card" aria-label="日期与日历">
        <header className="cal-card-head">
          <div>
            <span className="cal-kicker">本地时间</span>
            <time className="cal-clock" id="cal-clock">
              {timeStr}
            </time>
          </div>
          <span className="cal-head-icon" aria-hidden="true">
            <svg
              className="ui-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </span>
        </header>

        <div className="cal-date-summary">
          <time className="cal-solar">{solarDateStr}</time>
          <div className="cal-lunar">丙午年 丙申月 乙未日</div>
          <div className="cal-gz">农历七月初八</div>
          <div className="cal-term-wrap">
            <span className="cal-term">处暑 将至</span>
          </div>
        </div>

        <div className="cal-nav">
          <button
            type="button"
            onClick={prevMonth}
            aria-label="上个月"
            title="上个月"
          >
            <svg
              className="ui-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12 19-7-7 7-7M19 12H5" />
            </svg>
          </button>

          <button
            className="cal-month"
            type="button"
            onClick={resetToToday}
            aria-label="回到本月"
            title="回到本月"
          >
            {viewYear}年{viewMonth + 1}月
          </button>

          <button
            type="button"
            onClick={nextMonth}
            aria-label="下个月"
            title="下个月"
          >
            <svg
              className="ui-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* 7-Column Calendar Grid */}
        <div className="cal-grid" role="grid" aria-label="本月日历">
          <span className="cal-wd">一</span>
          <span className="cal-wd">二</span>
          <span className="cal-wd">三</span>
          <span className="cal-wd">四</span>
          <span className="cal-wd">五</span>
          <span className="cal-wd cal-weekend">六</span>
          <span className="cal-wd cal-weekend">日</span>

          {/* Empty offset cells before 1st day */}
          {Array.from({ length: mondayOffset }).map((_, i) => (
            <span key={`empty-${i}`} className="cal-cell cal-empty" />
          ))}

          {/* Days of month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const totalIndex = mondayOffset + i;
            const today = isToday(dayNum);
            const weekend = isWeekend(totalIndex);

            return (
              <span
                key={dayNum}
                className={`cal-cell ${today ? "cal-today" : ""} ${
                  weekend ? "cal-weekend" : ""
                }`}
              >
                {dayNum}
              </span>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
