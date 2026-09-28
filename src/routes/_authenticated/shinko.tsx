import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle } from "@/components/AppShell";
import { Timeline, TimelineLegend, type TimelineBar } from "@/components/Timeline";
import { fmtDate, fmtTime, machineLabel, startOfDay } from "@/lib/mes";

export const Route = createFileRoute("/_authenticated/shinko")({
  head: () => ({
    meta: [
      { title: "進行リスト Shinko Risuto — DYNAMO VIETNAM MC - MES" },
      { name: "description", content: "Bảng tiến độ đơn hàng: số lượng kế hoạch, đạt, NG, phần trăm hoàn thành và hạn giao." },
      { property: "og:title", content: "進行リスト Shinko Risuto — DYNAMO VIETNAM MC - MES" },
      { property: "og:description", content: "Bảng tiến độ đơn hàng sản xuất." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({ wo: typeof s["wo"] === "string" ? s["wo"] : undefined }),
  component: Shinko,
});

function Shinko() {
  const [jobView, setJobView] = useState<string | null>(Route.useSearch().wo ?? null);
  const [keyword, setKeyword] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["shinko"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [wos, jobs, machines] = await Promise.all([
        supabase.from("work_orders").select("*").order("due_date"),
        supabase.from("jobs").select("*"),
        supabase.from("machines").select("*").order("sort_order"),
      ]);
      if (wos.error) throw wos.error;
      if (jobs.error) throw jobs.error;
      if (machines.error) throw machines.error;
      return { wos: wos.data, jobs: jobs.data, machines: machines.data };
    },
  });

  if (isLoading || !data) return <p className="text-xs">Đang tải 進行リスト…</p>;

  const machineByCode = new Map(data.machines.map((m) => [m.id, machineLabel(m)]));
  const now = Date.now();

  if (jobView) {
    const wo = data.wos.find((w) => w.id === jobView);
    if (!wo) return <p className="text-xs">Không tìm thấy mã hàng.</p>;
    const jobs = data.jobs.filter((j) => j.work_order_id === jobView);
    const rows = data.machines
      .filter((m) => jobs.some((j) => j.machine_id === m.id))
      .map((m) => ({ id: m.id, label: m.code, sublabel: m.name }));
    const bars: TimelineBar[] = jobs.map((j) => ({
      rowId: j.machine_id ?? "",
      key: j.id,
      title: `${wo.part_number} · ${j.status}`,
      planStart: j.plan_start,
      planEnd: j.plan_end,
      actualStart: j.actual_start,
      actualEnd: j.actual_end,
      colorKey: wo.part_number,
      delayed: j.status !== "COMPLETED" && !!j.plan_end && new Date(j.plan_end).getTime() < now,
    }));
    const base = startOfDay(new Date());
    base.setDate(base.getDate() - base.getDay() + 1);
    return (
      <>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setJobView(null)}
            className="rounded bg-foreground px-3 py-1 text-[11px] font-bold text-background"
          >
            ⬅ BACK
          </button>
          <PageTitle title={`JOB TIMELINE — ${wo.wo_number}`} sub={`${wo.part_number} · ${wo.part_name ?? ""}`} />
        </div>
        <TimelineLegend />
        <Timeline rows={rows} bars={bars} rangeStart={base} days={7} />
      </>
    );
  }

  const list = data.wos.filter((w) =>
    keyword
      ? `${w.wo_number} ${w.part_number} ${w.part_name ?? ""} ${w.customer ?? ""}`
          .toLowerCase()
          .includes(keyword.toLowerCase())
      : true,
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageTitle title="進行リスト — SHINKO RISUTO" sub="Tiến độ đơn hàng" />
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Tìm mã hàng / WO / khách hàng"
          className="rounded border border-input bg-card px-2 py-1 text-[11px]"
        />
      </div>
      <div className="mes-card min-h-0 flex-1 overflow-auto">
        <table className="mes-table">
          <thead>
            <tr>
              {["WO", "KHÁCH HÀNG", "MÃ HÀNG", "TÊN HÀNG", "BẢN VẼ", "MÁY", "KH", "ĐẠT", "NG", "%", "HẠN GIAO", "TRẠNG THÁI"].map(
                (h) => (
                  <th key={h}>{h}</th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {list.map((w) => {
              const jobs = data.jobs.filter((j) => j.work_order_id === w.id);
              const good = jobs.reduce((a, j) => a + j.good_qty, 0);
              const ng = jobs.reduce((a, j) => a + j.ng_qty, 0);
              const pct = w.quantity ? Math.round((good / w.quantity) * 100) : 0;
              const overdue =
                w.status !== "COMPLETED" && w.due_date && new Date(w.due_date).getTime() < now;
              const cls = pct >= 100 ? "bg-completed" : overdue ? "bg-delay text-destructive-foreground" : pct > 0 ? "bg-warning" : "";
              return (
                <tr key={w.id}>
                  <td>{w.wo_number}</td>
                  <td>{w.customer}</td>
                  <td>
                    <button
                      onClick={() => setJobView(w.id)}
                      className="font-bold text-primary underline"
                    >
                      {w.part_number}
                    </button>
                  </td>
                  <td>{w.part_name}</td>
                  <td>{w.drawing_number}</td>
                  <td>{w.machine_id ? machineByCode.get(w.machine_id) : "-"}</td>
                  <td className="text-right">{w.quantity}</td>
                  <td className="text-right">{good}</td>
                  <td className="text-right">{ng}</td>
                  <td className={`text-right font-bold ${cls}`}>{pct}%</td>
                  <td className={overdue ? "font-bold text-destructive" : ""}>{fmtDate(w.due_date)}</td>
                  <td>{w.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Cập nhật gần nhất: {fmtTime(new Date().toISOString())} — bấm mã hàng để mở Job Timeline.
      </p>
    </>
  );
}
