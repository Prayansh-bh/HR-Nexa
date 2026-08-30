export function Avatar({ initials, size = 36 }: { initials: string; size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full btn-gradient font-bold"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}
