import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle } from "@/components/AppShell";
import { Timeline, TimelineLegend, type TimelineBar } from "@/components/Timeline";
import {
  startOfDay,
  machineStatusClass,
  machineLabel,
  fmtDate,
  fmtTime,
} from "@/lib/mes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/timeline")({
  head: () => ({
    meta: [
      { title: "Production Timeline — DYNAMO VIETNAM MC - MES" },
      { name: "description", content: "Timeline sản xuất theo máy với thanh kế hoạch và thanh thực tế, vạch giờ hiện tại." },
      { property: "og:title", content: "Production Timeline — DYNAMO VIETNAM MC - MES" },
      { property: "og:description", content: "Timeline máy, Plan vs Actual theo ngày/tuần/tháng." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    status: typeof s["status"] === "string" ? s["status"] : undefined,
    machine: typeof s["machine"] === "string" ? s["machine"] : undefined,
  }),
  component: TimelinePage,
});


type Zoom = 1 | 7 | 30;

function TimelinePage() {
  const search = Route.useSearch();
  const [zoom, setZoom] = useState<Zoom>(7);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState(search.status ?? "ALL");
  const [machineFilter, setMachineFilter] = useState(search.machine ?? "ALL");

  const [selected, setSelected] = useState<TimelineBar | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);
  const [traySearch, setTraySearch] = useState("");

  const base = startOfDay(new Date());
  if (zoom === 7) base.setDate(base.getDate() - base.getDay() + 1);
  if (zoom === 30) base.setDate(1);
  base.setDate(base.getDate() + offset * zoom);

  const { data, isLoading } = useQuery({
    queryKey: ["timeline"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [machines, jobs] = await Promise.all([
        supabase.from("machines").select("*").order("sort_order"),
        supabase
          .from("jobs")
          .select("*, work_orders(wo_number, part_number, part_name, drawing_number, customer, quantity, due_date, status)")
          .order("plan_start"),
      ]);
      if (machines.error) throw machines.error;
      if (jobs.error) throw jobs.error;
      return { machines: machines.data, jobs: jobs.data };
    },
  });

  if (isLoading || !data) return <p className="text-xs">Đang tải timeline…</p>;

  const rows = data.machines
    .filter((m) => machineFilter === "ALL" || m.code === machineFilter)
    .filter((m) => statusFilter === "ALL" || m.status === statusFilter)
    .map((m) => ({ id: m.id, label: m.code, sublabel: `${m.name} · ${m.status}` }));

  const now = Date.now();
  type WorkOrderSummary = {
    wo_number: string;
    part_number: string;
    part_name: string | null;
    drawing_number: string | null;
    customer: string | null;
    quantity: number;
    due_date: string | null;
    status: string;
  };

  const bars: TimelineBar[] = data.jobs
    .filter((j) => j.machine_id)
    .map((j) => {
      const wo = j.work_orders as unknown as WorkOrderSummary | null;
      return {
        rowId: j.machine_id ?? "",
        key: j.id,
        title: `${wo?.part_number ?? "?"} · ${wo?.wo_number ?? ""}`,
        planStart: j.plan_start,
        planEnd: j.plan_end,
        actualStart: j.actual_start,
        actualEnd: j.actual_end,
        colorKey: wo?.part_number ?? j.id,
        workOrderId: j.work_order_id,
        delayed:
          j.status !== "COMPLETED" && !!j.plan_end && new Date(j.plan_end).getTime() < now,
      };
    });

  const selectedJob = selected ? data.jobs.find((job) => job.id === selected.key) : undefined;
  const selectedWorkOrder = selectedJob?.work_orders as unknown as WorkOrderSummary | null | undefined;
  const selectedJobs = selectedJob
    ? data.jobs.filter((job) => job.work_order_id === selectedJob.work_order_id)
    : [];
  const selectedRows = data.machines
    .filter((machine) => selectedJobs.some((job) => job.machine_id === machine.id))
    .map((machine) => ({
      id: machine.id,
      label: machine.code,
      sublabel: machine.name,
    }));
  const selectedBars: TimelineBar[] = selectedJobs.map((job) => ({
    rowId: job.machine_id ?? "",
    key: job.id,
    title: `${selectedWorkOrder?.part_number ?? "?"} · ${job.status}`,
    planStart: job.plan_start,
    planEnd: job.plan_end,
    actualStart: job.actual_start,
    actualEnd: job.actual_end,
    colorKey: selectedWorkOrder?.part_number ?? job.id,
    delayed:
      job.status !== "COMPLETED" && !!job.plan_end && new Date(job.plan_end).getTime() < now,
  }));
  const selectedTimes = selectedJobs
    .flatMap((job) => [job.plan_start, job.plan_end, job.actual_start, job.actual_end])
    .filter((value): value is string => !!value)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  const modalStart = startOfDay(
    selectedTimes.length ? new Date(Math.min(...selectedTimes)) : new Date(),
  );
  const modalEnd = selectedTimes.length ? Math.max(...selectedTimes) : modalStart.getTime();
  const modalDays = Math.max(
    1,
    Math.min(30, Math.ceil((modalEnd - modalStart.getTime()) / 86_400_000) + 1),
  );
  const totalGood = selectedJobs.reduce((sum, job) => sum + job.good_qty, 0);
  const totalNg = selectedJobs.reduce((sum, job) => sum + job.ng_qty, 0);
  const completion = selectedWorkOrder?.quantity
    ? Math.min(100, Math.round((totalGood / selectedWorkOrder.quantity) * 100))
    : 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageTitle title="PRODUCTION TIMELINE" sub="Plan vs Actual theo máy" />
        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          {([1, 7, 30] as Zoom[]).map((z) => (
            <button
              key={z}
              onClick={() => {
                setZoom(z);
                setOffset(0);
              }}
              className={`rounded px-2 py-1 font-bold ${zoom === z ? "bg-primary text-primary-foreground" : "bg-card"}`}
            >
              {z === 1 ? "NGÀY" : z === 7 ? "TUẦN" : "THÁNG"}
            </button>
          ))}
          <button onClick={() => setOffset(offset - 1)} className="rounded bg-card px-2 py-1 font-bold">
            ◀
          </button>
          <button onClick={() => setOffset(0)} className="rounded bg-card px-2 py-1 font-bold">
            HÔM NAY
          </button>
          <button onClick={() => setOffset(offset + 1)} className="rounded bg-card px-2 py-1 font-bold">
            ▶
          </button>
          <select
            value={machineFilter}
            onChange={(e) => setMachineFilter(e.target.value)}
            className="rounded border border-input bg-card px-1 py-1"
          >
            <option value="ALL">Tất cả máy</option>
            {data.machines.map((m) => (
              <option key={m.id} value={m.code}>
                {machineLabel(m)}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-input bg-card px-1 py-1"
          >
            <option value="ALL">Mọi trạng thái</option>
            {["RUN", "WAIT", "SETUP", "BREAKDOWN", "MAINTENANCE", "OFFLINE"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      <TimelineLegend />
      <Timeline rows={rows} bars={bars} rangeStart={base} days={zoom} onBarClick={setSelected} />
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="flex max-h-[90vh] max-w-[min(1100px,calc(100vw-24px))] flex-col gap-3 overflow-hidden p-0">
          <DialogHeader className="border-b bg-primary px-4 py-3 pr-12 text-left text-primary-foreground">
            <DialogTitle className="text-base">
              JOB TIMELINE — {selectedWorkOrder?.wo_number ?? selected?.title ?? ""}
            </DialogTitle>
            <DialogDescription className="text-xs text-primary-foreground/90">
              {selectedWorkOrder?.part_number ?? "-"} · {selectedWorkOrder?.part_name ?? "Chưa có tên hàng"}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 space-y-3 overflow-y-auto px-4 pb-4">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded border bg-border text-[11px] sm:grid-cols-4 lg:grid-cols-6">
              {[
                ["Khách hàng", selectedWorkOrder?.customer ?? "-"],
                ["Bản vẽ", selectedWorkOrder?.drawing_number ?? "-"],
                ["Số lượng KH", selectedWorkOrder?.quantity ?? 0],
                ["Đạt / NG", `${totalGood} / ${totalNg}`],
                ["Hoàn thành", `${completion}%`],
                ["Hạn giao", fmtDate(selectedWorkOrder?.due_date)],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 bg-card p-2">
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">{label}</div>
                  <div className="truncate font-bold" title={String(value)}>{value}</div>
                </div>
              ))}
            </div>

            <div className="h-2 overflow-hidden rounded bg-muted" aria-label={`Tiến độ ${completion}%`}>
              <div className="h-full bg-primary transition-all" style={{ width: `${completion}%` }} />
            </div>

            <section className="flex min-h-[250px] flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold">BIỂU ĐỒ CÔNG ĐOẠN</h2>
                <TimelineLegend />
              </div>
              <Timeline
                rows={selectedRows}
                bars={selectedBars}
                rangeStart={modalStart}
                days={modalDays}
              />
            </section>

            <section>
              <h2 className="mb-1 text-xs font-bold">CHI TIẾT CÔNG ĐOẠN ({selectedJobs.length})</h2>
              <div className="max-h-48 overflow-auto rounded border">
                <table className="mes-table">
                  <thead>
                    <tr>
                      {[
                        "MÁY",
                        "TRẠNG THÁI",
                        "KẾ HOẠCH BẮT ĐẦU",
                        "KẾ HOẠCH KẾT THÚC",
                        "THỰC TẾ BẮT ĐẦU",
                        "THỰC TẾ KẾT THÚC",
                        "ĐẠT",
                        "NG",
                      ].map((heading) => <th key={heading}>{heading}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedJobs.map((job) => {
                      const machine = data.machines.find((item) => item.id === job.machine_id);
                      return (
                        <tr key={job.id}>
                          <td className="font-bold">{machineLabel(machine)}</td>
                          <td>{job.status}</td>
                          <td>{fmtTime(job.plan_start)}</td>
                          <td>{fmtTime(job.plan_end)}</td>
                          <td>{fmtTime(job.actual_start)}</td>
                          <td>{job.actual_end ? fmtTime(job.actual_end) : job.actual_start ? "Đang chạy" : "-"}</td>
                          <td className="text-right">{job.good_qty}</td>
                          <td className="text-right">{job.ng_qty}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
      <div className="mes-card p-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTrayOpen(!trayOpen)}
            className="rounded bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground"
          >
            {trayOpen ? "▲ Thu gọn" : "▼ Danh sách máy"} ({data.machines.length})
          </button>
          {["RUN", "WAIT", "SETUP", "BREAKDOWN", "MAINTENANCE", "OFFLINE"].map((s) => {
            const count = data.machines.filter((m) => m.status === s).length;
            if (!count) return null;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? "ALL" : s)}
                title="Bấm để lọc timeline theo trạng thái này"
                className={`rounded px-2 py-0.5 text-[10px] font-bold ${machineStatusClass[s] ?? ""} ${statusFilter === s ? "ring-2 ring-ring" : ""}`}
              >
                {s} {count}
              </button>
            );
          })}
          {trayOpen && (
            <input
              value={traySearch}
              onChange={(e) => setTraySearch(e.target.value)}
              placeholder="Tìm mã/tên máy…"
              className="ml-auto rounded border border-input bg-card px-2 py-1 text-[11px]"
            />
          )}
        </div>
        {trayOpen && (
          <div className="mt-2 flex max-h-40 flex-wrap gap-1 overflow-y-auto">
            {data.machines
              .filter((m) => {
                const q = traySearch.trim().toLowerCase();
                return !q || m.code.toLowerCase().includes(q) || (m.name ?? "").toLowerCase().includes(q);
              })
              .map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMachineFilter(machineFilter === m.code ? "ALL" : m.code)}
                  title={`${machineLabel(m)} — bấm để lọc timeline theo máy này`}
                  className={`rounded px-2 py-0.5 text-[10px] font-bold ${machineStatusClass[m.status] ?? ""} ${machineFilter === m.code ? "ring-2 ring-ring" : ""}`}
                >
                  {m.code}
                </button>
              ))}
          </div>
        )}
      </div>
    </>
  );
}
