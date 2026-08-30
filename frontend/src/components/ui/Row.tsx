export function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className={bold ? "text-lg font-bold" : "font-semibold"}>{v}</span>
    </div>
  );
}
