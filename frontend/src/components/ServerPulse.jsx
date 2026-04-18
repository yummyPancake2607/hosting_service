export default function ServerPulse() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-neon/40 bg-neon/10 px-3 py-1.5 text-xs text-neon">
      <span className="relative inline-flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-neon" />
      </span>
      SERVER ONLINE
    </div>
  );
}
