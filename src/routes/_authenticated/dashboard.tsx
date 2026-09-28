import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle } from "@/components/AppShell";
import { machineStatusClass } from "@/lib/mes";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard KPI — DYNAMO VIETNAM MC - MES" },
      { name: "description", content: "KPI sản xuất realtime: máy chạy, chờ, hỏng, số lượng kế hoạch và thực tế." },
      { property: "og:title", content: "Dashboard KPI — DYNAMO VIETNAM MC - MES" },
      { property: "og:description", content: "KPI sản xuất realtime của nhà máy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Kpi({
  label,
  value,
  tone,
  to,
  search,
}: {
  label: string;
  value: string | number;
  tone?: string;
  to?: "/timeline" | "/shinko";
  search?: { status: string | undefined; machine: string | undefined };
}) {
  const body = (
    <>
      <div className="text-[10px] font-bold text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold ${tone ?? "text-primary"}`}>{value}</div>
    </>
  );
  if (to) {
    return (
      <Link
        to={to}
        search={search ?? { status: undefined, machine: undefined }}
        className="mes-card flex-1 cursor-pointer p-2 text-center transition-colors hover:border-primary"
        title="Bấm để mở trang xử lý"
      >
        {body}
      </Link>
    );
  }
  return <div className="mes-card flex-1 p-2 text-center">{body}</div>;
}


function Dashboard() {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [workshopFilter, setWorkshopFilter] = useState<string>("ALL");
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [machines, jobs, wos] = await Promise.all([
        supabase.from("machines").select("*").order("sort_order"),
        supabase.from("jobs").select("*"),
        supabase.from("work_orders").select("id, quantity, due_date, status"),
      ]);
      if (machines.error) throw machines.error;
      if (jobs.error) throw jobs.error;
      if (wos.error) throw wos.error;
      return { machines: machines.data, jobs: jobs.data, wos: wos.data };
    },
  });

  if (isLoading || !data) return <p className="text-xs">Đang tải dữ liệu…</p>;

  const PREFERRED = ["INSERT", "MOLD", "PIN"];
  const found = Array.from(new Set(data.machines.map((m) => m.workshop ?? "OTHER")));
  const workshops = [
    "ALL",
    ...PREFERRED.filter((w) => found.includes(w)),
    ...found.filter((w) => !PREFERRED.includes(w)).sort(),
  ];
  const countWorkshop = (w: string) => data.machines.filter((m) => (m.workshop ?? "OTHER") === w).length;

  // Machines inside the selected workshop (status badges count within this scope)
  const workshopMachines = data.machines.filter(
    (m) => workshopFilter === "ALL" || (m.workshop ?? "OTHER") === workshopFilter,
  );
  const count = (s: string) => workshopMachines.filter((m) => m.status === s).length;

  // Machines matching BOTH filters — the scope every KPI below is computed on
  const scopedMachines = workshopMachines.filter((m) => statusFilter === "ALL" || m.status === statusFilter);
  const scopedIds = new Set(scopedMachines.map((m) => m.id));
  const allScope = workshopFilter === "ALL" && statusFilter === "ALL";

  const scopedJobs = allScope
    ? data.jobs
    : data.jobs.filter((j) => j.machine_id && scopedIds.has(j.machine_id));

  const scopedWoIds = new Set(scopedJobs.map((j) => j.work_order_id));
  const planned = allScope
    ? data.wos.reduce((a, w) => a + (w.quantity ?? 0), 0)
    : data.wos.filter((w) => scopedWoIds.has(w.id)).reduce((a, w) => a + (w.quantity ?? 0), 0);
  const good = scopedJobs.reduce((a, j) => a + (j.good_qty ?? 0), 0);
  const ng = scopedJobs.reduce((a, j) => a + (j.ng_qty ?? 0), 0);
  const actual = good + ng;
  const now = Date.now();
  const delayed = scopedJobs.filter(
    (j) => j.status !== "COMPLETED" && j.plan_end && new Date(j.plan_end).getTime() < now,
  ).length;
  const achievement = planned ? Math.round((good / planned) * 100) : 0;
  const quality = actual ? Math.round((good / actual) * 100) : 0;

  return (
    <>
      <PageTitle
        title="DASHBOARD"
        sub={`KPI sản xuất — WORKSHOP: ${workshopFilter} · STATUS: ${statusFilter} · ${scopedMachines.length} máy — tự làm mới mỗi 60 giây`}
      />
      <div className="flex flex-wrap gap-2">
        <Kpi label="RUNNING" value={count("RUN")} to="/timeline" search={{ status: "RUN", machine: undefined }} />
        <Kpi label="WAITING" value={count("WAIT")} tone="text-muted-foreground" to="/timeline" search={{ status: "WAIT", machine: undefined }} />
        <Kpi label="SETUP" value={count("SETUP")} tone="text-setup" to="/timeline" search={{ status: "SETUP", machine: undefined }} />
        <Kpi label="BREAKDOWN" value={count("BREAKDOWN")} tone="text-destructive" to="/timeline" search={{ status: "BREAKDOWN", machine: undefined }} />

        <Kpi label="DELAY JOBS" value={delayed} tone="text-destructive" to="/shinko" />

      </div>
      <div className="flex flex-wrap gap-2">
        <Kpi label="PLANNED QTY" value={planned} />
        <Kpi label="ACTUAL QTY" value={actual} />
        <Kpi label="GOOD QTY" value={good} />
        <Kpi label="NG QTY" value={ng} tone="text-destructive" />
        <Kpi label="ACHIEVEMENT %" value={`${achievement}%`} />
        <Kpi label="QUALITY %" value={`${quality}%`} />
      </div>

      <div className="mes-card flex min-h-0 flex-1 flex-col overflow-hidden p-2">
        <h2 className="mb-2 text-xs font-bold">MACHINE STATUS / 設備状況</h2>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-bold text-muted-foreground">STATUS:</span>
            {(["ALL", "RUN", "WAIT", "SETUP", "BREAKDOWN", "MAINTENANCE", "OFFLINE"] as const).map((s) => {
              const n = s === "ALL" ? workshopMachines.length : count(s);
              const on = statusFilter === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded border px-2 py-0.5 text-[10px] font-bold transition-colors ${
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"
                  }`}
                >
                  {s} ({n})
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-bold text-muted-foreground">WORKSHOP:</span>
            {workshops.map((w) => {
              const n = w === "ALL" ? data.machines.length : countWorkshop(w);
              const on = workshopFilter === w;
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWorkshopFilter(w)}
                  className={`rounded border px-2 py-0.5 text-[10px] font-bold transition-colors ${
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"
                  }`}
                >
                  {w} ({n})
                </button>
              );
            })}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
            {data.machines
              .filter((m) => statusFilter === "ALL" || m.status === statusFilter)
              .filter((m) => workshopFilter === "ALL" || (m.workshop ?? "OTHER") === workshopFilter)
              .map((m) => (
                <Link
                  key={m.id}
                  to="/timeline"
                  search={{ machine: m.code, status: undefined }}
                  className="cursor-pointer rounded border border-border p-2 transition-colors hover:border-primary"
                  title="Bấm để xem lịch máy của máy này"
                >

                  <div className="text-[11px] font-bold">{m.code}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{m.name}</div>
                  <span
                    className={`mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-bold ${machineStatusClass[m.status] ?? ""}`}
                  >
                    {m.status}
                  </span>
                </Link>
              ))}
          </div>
        </div>
      </div>
    </>
  );
}
