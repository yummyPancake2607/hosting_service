import { useEffect, useMemo, useRef } from "react";

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }

  return date.toLocaleTimeString();
}

export default function TerminalViewer({
  title = "TERMINAL OUTPUT",
  lines = [],
  heightClass = "h-72",
  showCursor = true,
}) {
  const scrollerRef = useRef(null);

  const normalized = useMemo(
    () =>
      lines.map((line, idx) => {
        if (!line) {
          return {
            id: `line-${idx}`,
            log_line: "",
            timestamp: new Date().toISOString(),
          };
        }

        if (typeof line === "string") {
          return {
            id: `line-${idx}`,
            log_line: line,
            timestamp: new Date().toISOString(),
          };
        }

        return {
          id: line.id ?? `line-${idx}`,
          log_line: line.log_line ?? "",
          timestamp: line.timestamp ?? new Date().toISOString(),
        };
      }),
    [lines]
  );

  useEffect(() => {
    if (!scrollerRef.current) {
      return;
    }

    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [normalized]);

  return (
    <section className="terminal-window overflow-hidden rounded-md">
      <header className="flex items-center justify-between border-b border-neon/30 bg-black/70 px-3 py-2 text-xs text-neon">
        <span>{title}</span>
        <span>{normalized.length} lines</span>
      </header>

      <div ref={scrollerRef} className={`${heightClass} overflow-y-auto px-3 py-3 text-sm text-emerald-100`}>
        {normalized.map((line) => (
          <p key={line.id} className="mb-1 break-words leading-relaxed">
            <span className="mr-2 text-emerald-300/45">[{formatTimestamp(line.timestamp)}]</span>
            <span>{line.log_line}</span>
          </p>
        ))}

        {showCursor ? <span className="cursor-blink inline-block text-neon">_</span> : null}
      </div>
    </section>
  );
}
