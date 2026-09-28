import { useMemo } from "react";
import { stringToColor } from "@/lib/mes";

export type TimelineRow = {
  id: string;
  label: string;
  sublabel?: string;
};

export type TimelineBar = {
  rowId: string;
  key: string;
  title: string;
  planStart: string | null;
  planEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  colorKey: string;
  delayed: boolean;
  workOrderId?: string;
};

type Props = {
  rows: TimelineRow[];
  bars: TimelineBar[];
  rangeStart: Date;
  days: number;
  onBarClick?: (bar: TimelineBar) => void;
};

const HOUR_MS = 3600_000;

export function Timeline({ rows, bars, rangeStart, days, onBarClick }: Props) {
  const start = rangeStart.getTime();
  const total = days * 24 * HOUR_MS;
  const now = Date.now();

  const columns = useMemo(() => {
    if (days === 1) {
      return Array.from({ length: 24 }, (_, i) => {
        const d = new Date(start + i * HOUR_MS);
        return { key: `h${i}`, label: `${String(i).padStart(2, "0")}`, date: d };
      });
    }
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(start + i * 24 * HOUR_MS);
      return {
        key: `d${i}`,
        label: `${d.getDate()}/${d.getMonth() + 1} ${["日", "月", "火", "水", "木", "金", "土"][d.getDay()]}`,
        date: d,
      };
    });
  }, [start, days]);

  function colBg(date: Date) {
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    if (days === 1) return sameDay && date.getHours() === today.getHours() ? "bg-today" : "";
    if (sameDay) return "bg-today";
    if (date.getDay() === 6) return "bg-sat";
    if (date.getDay() === 0) return "bg-sun";
    return "";
  }

  function pct(ms: number) {
    return `${Math.max(0, Math.min(100, ((ms - start) / total) * 100))}%`;
  }

  function span(from: number, to: number) {
    const left = Math.max(start, from);
    const right = Math.min(start + total, to);
    if (right <= left) return null;
    return { left: pct(left), width: `${((right - left) / total) * 100}%` };
  }

  return (
    <div className="mes-card flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="min-w-[900px]">
        <div className="sticky top-0 z-20 flex bg-primary text-primary-foreground">
          <div className="w-40 shrink-0 border-r border-border px-2 py-1.5 text-[11px] font-bold">
            MACHINE / 設備
          </div>
          <div className="relative flex flex-1">
            {columns.map((c) => (
              <div
                key={c.key}
                className="flex-1 border-l border-border/40 py-1.5 text-center text-[10px] font-bold"
              >
                {c.label}
              </div>
            ))}
          </div>
        </div>

        {rows.map((row) => {
          const rowBars = bars.filter((b) => b.rowId === row.id);
          return (
            <div key={row.id} className="flex border-b border-border">
              <div className="w-40 shrink-0 border-r border-border bg-muted px-2 py-1.5">
                <div className="text-[11px] font-bold">{row.label}</div>
                {row.sublabel && (
                  <div className="text-[10px] text-muted-foreground">{row.sublabel}</div>
                )}
              </div>
              <div className="relative min-h-12 flex-1">
                <div className="absolute inset-0 flex">
                  {columns.map((c) => (
                    <div key={c.key} className={`flex-1 border-l border-border/60 ${colBg(c.date)}`} />
                  ))}
                </div>
                {now > start && now < start + total && (
                  <div
                    className="absolute top-0 bottom-0 z-10 w-0.5 bg-destructive"
                    style={{ left: pct(now) }}
                  />
                )}
                <div className="relative py-1">
                  {rowBars.map((bar, idx) => {
                    const planFrom = bar.planStart ? new Date(bar.planStart).getTime() : null;
                    const planTo = bar.planEnd ? new Date(bar.planEnd).getTime() : null;
                    const planPos = planFrom && planTo ? span(planFrom, planTo) : null;
                    const actFrom = bar.actualStart ? new Date(bar.actualStart).getTime() : null;
                    const actTo = bar.actualEnd ? new Date(bar.actualEnd).getTime() : actFrom ? now : null;
                    const actPos = actFrom && actTo ? span(actFrom, actTo) : null;
                    return (
                      <div key={bar.key} className="relative h-9" style={{ marginTop: idx ? 2 : 0 }}>
                        {planPos && (
                          <button
                            type="button"
                            onClick={() => onBarClick?.(bar)}
                            title={`${bar.title} — bấm để xem chi tiết`}
                            className="absolute top-0 h-4 cursor-pointer overflow-hidden rounded-sm px-1 text-left text-[10px] font-bold text-primary-foreground transition hover:brightness-110 hover:ring-1 hover:ring-ring"
                            style={{
                              left: planPos.left,
                              width: planPos.width,
                              backgroundColor: bar.delayed
                                ? "var(--delay)"
                                : stringToColor(bar.colorKey),
                            }}
                          >
                            {bar.title}
                          </button>
                        )}
                        {actPos && (
                          <button
                            type="button"
                            onClick={() => onBarClick?.(bar)}
                            title={`THỰC TẾ — ${bar.title} — bấm để xem chi tiết`}
                            className="absolute top-5 h-4 cursor-pointer overflow-hidden rounded-sm border border-actual-border bg-actual px-1 text-left text-[10px] font-bold text-foreground transition hover:brightness-95 hover:ring-1 hover:ring-ring"
                            style={{ left: actPos.left, width: actPos.width }}
                          >
                            ACTUAL
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="p-4 text-center text-[11px] text-muted-foreground">Không có dữ liệu.</div>
        )}
      </div>
    </div>
  );
}

export function TimelineLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[10px]">
      <span className="flex items-center gap-1">
        <i className="inline-block h-3 w-5 rounded-sm bg-plan" /> PLAN
      </span>
      <span className="flex items-center gap-1">
        <i className="inline-block h-3 w-5 rounded-sm border border-actual-border bg-actual" /> ACTUAL
      </span>
      <span className="flex items-center gap-1">
        <i className="inline-block h-3 w-5 rounded-sm bg-delay" /> DELAY
      </span>
      <span className="flex items-center gap-1">
        <i className="inline-block h-3 w-5 rounded-sm bg-completed" /> COMPLETED
      </span>
      <span className="flex items-center gap-1">
        <i className="inline-block h-3 w-5 rounded-sm bg-sat" /> 土
      </span>
      <span className="flex items-center gap-1">
        <i className="inline-block h-3 w-5 rounded-sm bg-sun" /> 日
      </span>
    </div>
  );
}
