import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

export type CoordinatorView = {
  name: string;
  startedAt: number;
  percent?: number | null;
  activity?: string;
  state: "working" | "idle" | "completed" | "needs_input" | "blocked" | "failed";
};

export function elapsed(startedAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h${minutes % 60}m`;
}

export function footerLines(coordinators: Iterable<CoordinatorView>, width: number, now: number, colorIcon: (icon: string, state: CoordinatorView["state"]) => string = icon => icon): string[] {
  if (width <= 0) return [];
  const entries = [...coordinators];
  if (!entries.length) return [truncateToWidth("Janus Coordinates · No coordinators", width)];
  const blink = Math.floor(now / 600) % 2 === 0;
  const icons: Record<CoordinatorView["state"], string> = {
    working: blink ? "●" : "○", idle: "○", completed: "✓", needs_input: "!", blocked: "!", failed: "✕",
  };
  return entries.map(c => {
    const name = truncateToWidth(c.name.replace(/[\x00-\x1f\x7f\x1b]/g, " "), Math.max(1, Math.min(26, Math.floor(width * 0.38))));
    const pct = c.percent == null ? "—" : `${Math.max(0, Math.round(c.percent))}%`;
    const left = `${colorIcon(icons[c.state], c.state)} ${name} [${pct}] · ${elapsed(c.startedAt, now)}: `;
    const space = width - visibleWidth(left);
    if (space <= 0) return truncateToWidth(left.trimEnd(), width);
    const detail = (c.activity ?? (c.state === "working" ? "Working" : c.state === "completed" ? "Report ready" : c.state === "needs_input" ? "Needs input" : c.state === "failed" ? "Failed" : "Idle"))
      .replace(/[\x00-\x1f\x7f\x1b]/g, " ");
    return left + truncateToWidth(detail, space);
  });
}
