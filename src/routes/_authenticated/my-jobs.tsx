import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle } from "@/components/AppShell";
import { useRole } from "@/hooks/useAuth";
import { logAudit } from "@/lib/audit";
import { fmtTime, machineLabel } from "@/lib/mes";

export const Route = createFileRoute("/_authenticated/my-jobs")({
  head: () => ({
    meta: [
      { title: "My Jobs — DYNAMO VIETNAM MC - MES" },
      { name: "description", content: "Màn hình thợ máy: bắt đầu, tạm dừng, hoàn thành công việc và nhập số lượng đạt / NG." },
      { property: "og:title", content: "My Jobs — DYNAMO VIETNAM MC - MES" },
      { property: "og:description", content: "Thực hiện công việc gia công tại xưởng." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyJobs,
});

type JobPatch = {
  status?: string;
  actual_start?: string | null;
  actual_end?: string | null;
  good_qty?: number;
  ng_qty?: number;
  remark?: string | null;
};

function MyJobs() {
  const { userId, isManager } = useRole();
  const qc = useQueryClient();
  const [mine, setMine] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState<Record<string, { good: string; ng: string; remark: string }>>({});

  const { data } = useQuery({
    queryKey: ["my-jobs"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [jobs, machines] = await Promise.all([
        supabase
          .from("jobs")
          .select("*, work_orders(wo_number, part_number, part_name, quantity)")
          .order("plan_start"),
        supabase.from("machines").select("id, code, name").order("sort_order"),
      ]);
      if (jobs.error) throw jobs.error;
      if (machines.error) throw machines.error;
      return { jobs: jobs.data, machines: machines.data };
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch, action }: { id: string; patch: JobPatch; action: string }) => {
      const { error } = await supabase.from("jobs").update(patch).eq("id", id);
      if (error) throw error;
      await logAudit(action, "job", id, patch);
    },
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["my-jobs"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const claim = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("jobs").update({ operator_id: userId ?? null }).eq("id", id);
      if (error) throw error;
      await logAudit("CLAIM", "job", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-jobs"] }),
    onError: (e: Error) => setError(e.message),
  });

  if (!data) return <p className="text-xs">Đang tải công việc…</p>;

  const jobs = data.jobs.filter((j) => (mine ? j.operator_id === userId : true));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageTitle title="MY JOBS" sub="Thực hiện công việc gia công" />
        <label className="flex items-center gap-1 text-[11px] font-bold">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
          Chỉ công việc của tôi
        </label>
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      <div className="mes-card min-h-0 flex-1 overflow-auto p-2">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((j) => {
            const wo = j.work_orders as unknown as {
              wo_number: string;
              part_number: string;
              part_name: string | null;
              quantity: number;
            } | null;
            const mineJob = j.operator_id === userId;
            const e = entry[j.id] ?? { good: String(j.good_qty), ng: String(j.ng_qty), remark: j.remark ?? "" };
            const set = (patch: Partial<typeof e>) => setEntry({ ...entry, [j.id]: { ...e, ...patch } });
            return (
              <div key={j.id} className="rounded border border-border p-2">
                <div className="flex items-center justify-between">
                  <Link to="/shinko" search={{ wo: j.work_order_id }} className="text-[12px] font-bold text-primary underline">{wo?.part_number}</Link>
                  <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-bold">{j.status}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {wo?.wo_number} · {wo?.part_name} · SL {wo?.quantity} ·{" "}
                  {j.machine_id ? machineLabel(data.machines.find((m) => m.id === j.machine_id)) : "chưa gán máy"}
                </div>
                <div className="text-[10px]">
                  Plan: {fmtTime(j.plan_start)} → {fmtTime(j.plan_end)} · Actual: {fmtTime(j.actual_start)} →{" "}
                  {j.actual_end ? fmtTime(j.actual_end) : "—"}
                </div>

                {!j.operator_id && (
                  <button
                    onClick={() => claim.mutate(j.id)}
                    className="mt-2 rounded border border-input px-2 py-1 text-[10px] font-bold"
                  >
                    NHẬN VIỆC
                  </button>
                )}

                {(mineJob || isManager) && (
                  <>
                    <div className="mt-2 flex gap-1">
                      <button
                        onClick={() =>
                          update.mutate({
                            id: j.id,
                            action: "START",
                            patch: { status: "RUNNING", actual_start: j.actual_start ?? new Date().toISOString() },
                          })
                        }
                        className="rounded bg-run px-2 py-1 text-[10px] font-bold text-primary-foreground"
                      >
                        START
                      </button>
                      <button
                        onClick={() => update.mutate({ id: j.id, action: "PAUSE", patch: { status: "PAUSED" } })}
                        className="rounded bg-warning px-2 py-1 text-[10px] font-bold text-foreground"
                      >
                        PAUSE
                      </button>
                      <button
                        onClick={() =>
                          update.mutate({
                            id: j.id,
                            action: "COMPLETE",
                            patch: {
                              status: "COMPLETED",
                              actual_end: new Date().toISOString(),
                              good_qty: Number(e.good) || 0,
                              ng_qty: Number(e.ng) || 0,
                              remark: e.remark,
                            },
                          })
                        }
                        className="rounded bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground"
                      >
                        COMPLETE
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      <input
                        value={e.good}
                        onChange={(ev) => set({ good: ev.target.value })}
                        placeholder="Good"
                        className="rounded border border-input px-1 py-1 text-[11px]"
                      />
                      <input
                        value={e.ng}
                        onChange={(ev) => set({ ng: ev.target.value })}
                        placeholder="NG"
                        className="rounded border border-input px-1 py-1 text-[11px]"
                      />
                      <input
                        value={e.remark}
                        onChange={(ev) => set({ remark: ev.target.value })}
                        placeholder="Remark"
                        className="rounded border border-input px-1 py-1 text-[11px]"
                      />
                    </div>
                    <button
                      onClick={() =>
                        update.mutate({
                          id: j.id,
                          action: "ENTRY",
                          patch: {
                            good_qty: Number(e.good) || 0,
                            ng_qty: Number(e.ng) || 0,
                            remark: e.remark,
                          },
                        })
                      }
                      className="mt-1 w-full rounded border border-input px-2 py-1 text-[10px] font-bold"
                    >
                      LƯU SẢN LƯỢNG
                    </button>
                  </>
                )}
              </div>
            );
          })}
          {jobs.length === 0 && <p className="text-[11px] text-muted-foreground">Chưa có công việc nào.</p>}
        </div>
      </div>
    </>
  );
}
