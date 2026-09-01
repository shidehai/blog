import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { Note } from "../lib/types";

interface NoteTimelineItemProps {
  note: Note;
}

/** 随记时间轴节点。随记没有详情页，正文在此直接展开，不做跳转。 */
export function NoteTimelineItem({ note }: NoteTimelineItemProps) {
  const formattedDate = format(
    new Date(note.publishedAt),
    "yyyy年MM月dd日 HH:mm",
    { locale: zhCN },
  );

  return (
    <div className="relative pl-6 sm:pl-8 pb-8 group last:pb-0">
      {/* 竖轴，最后一项不画 */}
      <div className="absolute left-[11px] sm:left-[15px] top-6 bottom-0 w-px bg-[var(--border)] group-last:hidden" />

      {/* 节点圆点 */}
      <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-[var(--code-bg)] border-2 border-[var(--border)] flex items-center justify-center group-hover:border-[var(--accent)] transition-colors">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] group-hover:bg-[var(--accent)] transition-colors" />
      </div>

      <div className="p-4 sm:p-5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors space-y-3">
        <div className="flex items-center justify-between gap-2 text-xs font-mono text-[var(--text-muted)]">
          <span className="px-2 py-0.5 rounded bg-[var(--code-bg)] text-[var(--accent)] font-semibold text-[11px]">
            {note.category}
          </span>
          <time dateTime={note.publishedAt}>{formattedDate}</time>
        </div>

        <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] leading-snug">
          {note.title}
        </h2>

        <div className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
          {note.content}
        </div>

        {note.tags.length > 0 && (
          <div className="pt-1 flex flex-wrap items-center gap-1.5 text-xs font-mono text-[var(--text-muted)]">
            {note.tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
