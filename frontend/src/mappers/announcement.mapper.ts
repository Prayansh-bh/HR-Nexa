export function mapApiAnnouncementToModel(a: any): any {
  const title = a.title || a.t || "System Announcement";
  const content = a.content || a.d || "";

  return {
    id: a.id,
    title,
    content,
    type: a.type || "Notice",
    scheduledFor: a.scheduledFor ? new Date(a.scheduledFor).toISOString() : null,
    duration: a.duration || null,
    t: title,
    d: content,
    date: a.date || (a.createdAt ? a.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)),
    author: a.author || "System Admin",
    read: a.readCount ?? a.read ?? 0,
  };
}
