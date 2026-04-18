const toneMap = {
  Running: "border-neon/60 bg-neon/15 text-neon",
  Building: "border-yellow-400/60 bg-yellow-400/15 text-yellow-300",
  Failed: "border-rose-500/60 bg-rose-500/15 text-rose-300",
  Stopped: "border-slate-500/60 bg-slate-500/15 text-slate-200",
};

export default function StatusBadge({ status }) {
  const classes = toneMap[status] || "border-emerald-500/50 bg-emerald-500/10 text-emerald-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${classes}`}>
      {status}
    </span>
  );
}
