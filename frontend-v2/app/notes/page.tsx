import { getAllNotes } from "../../lib/content";
import { NoteTimelineItem } from "../../components/NoteTimelineItem";

export const metadata = {
  title: "随记与备忘",
  description: "日常工程碎片、调试记录与灵感备忘",
};

export default async function NotesPage() {
  const notes = await getAllNotes();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2 pb-6 border-b border-[var(--border)]">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          随记与备忘
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          记录日常调试发现、架构碎片与未成体系的工程思考。
        </p>
      </div>

      {/* 垂直时间轴 */}
      <div>
        {notes.map((note) => (
          <NoteTimelineItem key={note.id} note={note} />
        ))}
      </div>
    </div>
  );
}
