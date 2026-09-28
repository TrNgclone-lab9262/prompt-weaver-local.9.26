import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useRole } from "@/hooks/useAuth";
import { logAudit } from "@/lib/audit";
import {
  MACHINE_STATUSES,
  machineStatusClass,
  machineLabel,
  fmtTime,
  type MachineStatus,
} from "@/lib/mes";

const statusBorderClass: Record<MachineStatus, string> = {
  RUN: "border-l-run",
  WAIT: "border-l-wait",
  SETUP: "border-l-setup",
  BREAKDOWN: "border-l-breakdown",
  MAINTENANCE: "border-l-maintenance",
  OFFLINE: "border-l-offline",
};

export const Route = createFileRoute("/_authenticated/machines")({
  head: () => ({
    meta: [
      { title: "Machine Status — DYNAMO VIETNAM MC - MES" },
      { name: "description", content: "Theo dõi và cập nhật trạng thái máy: chạy, chờ, setup, hỏng máy, bảo trì, ngừng." },
      { property: "og:title", content: "Machine Status — DYNAMO VIETNAM MC - MES" },
      { property: "og:description", content: "Trạng thái thiết bị và báo hỏng máy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Machines,
});

function Machines() {
  const { userId, isManager } = useRole();
  const qc = useQueryClient();
  const [note, setNote] = useState<Record<string, string>>({});
  const [edit, setEdit] = useState<Record<string, { name: string; workshop: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | MachineStatus>("ALL");

  const { data } = useQuery({
    queryKey: ["machines"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [machines, logs] = await Promise.all([
        supabase.from("machines").select("*").order("sort_order"),
        supabase.from("machine_status_log").select("*").order("created_at", { ascending: false }).limit(30),
      ]);
      if (machines.error) throw machines.error;
      if (logs.error) throw logs.error;
      return { machines: machines.data, logs: logs.data };
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("machines")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      const { error: logError } = await supabase.from("machine_status_log").insert({
        machine_id: id,
        status,
        note: note[id] ?? null,
        created_by: userId ?? null,
      });
      if (logError) throw logError;
      await logAudit("MACHINE_STATUS", "machine", id, { status, note: note[id] });
    },
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["machines"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const saveInfo = useMutation({
    mutationFn: async ({ id, name, workshop }: { id: string; name: string; workshop: string }) => {
      const { error } = await supabase
        .from("machines")
        .update({ name: name.trim(), workshop: workshop.trim() || "MC", updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      await logAudit("MACHINE_EDIT", "machine", id, { name, workshop });
    },
    onSuccess: (_d, v) => {
      setError(null);
      setEdit((e) => {
        const next = { ...e };
        delete next[v.id];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["machines"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(MACHINE_STATUSES.map((status) => [status, 0])) as Record<MachineStatus, number>;
    for (const machine of data?.machines ?? []) {
      if (MACHINE_STATUSES.includes(machine.status as MachineStatus)) {
        counts[machine.status as MachineStatus] += 1;
      }
    }
    return counts;
  }, [data?.machines]);

  const visibleMachines = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (data?.machines ?? []).filter((machine) => {
      const matchesStatus = statusFilter === "ALL" || machine.status === statusFilter;
      const searchable = `${machine.code} ${machine.name ?? ""} ${machine.workshop ?? ""}`.toLocaleLowerCase();
      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [data?.machines, search, statusFilter]);

  if (!data) return <p className="text-xs">Đang tải…</p>;

  return (
    <section className="mes-card flex min-h-0 flex-1 flex-col overflow-hidden border border-border">
      <div className="shrink-0 border-b border-border bg-card p-2.5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 lg:flex lg:flex-wrap lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <PageTitle title="MACHINE STATUS" sub="設備状況" />
            <span className="shrink-0 text-[10px] font-bold text-muted-foreground">
              {visibleMachines.length}/{data.machines.length} MÁY
            </span>
          </div>
          <label className="relative min-w-0 lg:order-last lg:w-64">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <span className="sr-only">Tìm máy</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm mã, tên hoặc xưởng…"
              className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-8 text-[11px] outline-none focus:ring-1 focus:ring-ring"
            />
            {search && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-8 w-8"
                onClick={() => setSearch("")}
                title="Xóa tìm kiếm"
              >
                <X />
              </Button>
            )}
          </label>
        </div>
        <div className="mt-2 flex min-w-0 gap-1 overflow-x-auto pb-0.5">
          <Button
            type="button"
            size="sm"
            variant={statusFilter === "ALL" ? "default" : "outline"}
            className="h-7 shrink-0 px-2 text-[10px]"
            onClick={() => setStatusFilter("ALL")}
          >
            TẤT CẢ {data.machines.length}
          </Button>
          {MACHINE_STATUSES.map((status) => (
            <Button
              key={status}
              type="button"
              size="sm"
              variant={statusFilter === status ? "default" : "outline"}
              className="h-7 shrink-0 px-2 text-[10px]"
              onClick={() => setStatusFilter(status)}
            >
              <span className={`size-2 rounded-full ${machineStatusClass[status]}`} />
              {status} {statusCounts[status]}
            </Button>
          ))}
        </div>
        {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-muted/40 p-2 [scrollbar-gutter:stable]">
        {visibleMachines.length ? (
          <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {visibleMachines.map((m) => {
              const editing = edit[m.id];
              const statusBusy = setStatus.isPending && setStatus.variables?.id === m.id;
              const editBusy = saveInfo.isPending && saveInfo.variables?.id === m.id;
              const status = MACHINE_STATUSES.includes(m.status as MachineStatus)
                ? (m.status as MachineStatus)
                : "OFFLINE";

              return (
                <article
                  key={m.id}
                  className={`relative h-32 overflow-hidden rounded-md border border-l-4 border-border bg-card p-2 shadow-sm transition-shadow hover:shadow-md ${statusBorderClass[status]}`}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1">
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-bold" title={m.code}>{m.code}</div>
                      <div className="truncate text-[10px] font-medium" title={m.name ?? ""}>{m.name || "Chưa có tên máy"}</div>
                      <div className="truncate text-[9px] text-muted-foreground">Xưởng: {m.workshop || "-"}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${machineStatusClass[m.status] ?? ""}`}>
                        {m.status}
                      </span>
                      {isManager && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setEdit((current) => ({ ...current, [m.id]: { name: m.name ?? "", workshop: m.workshop ?? "" } }))}
                          title="Sửa tên và xưởng"
                        >
                          <Pencil />
                        </Button>
                      )}
                    </div>
                  </div>
                  <input
                    value={note[m.id] ?? ""}
                    onChange={(event) => setNote((current) => ({ ...current, [m.id]: event.target.value }))}
                    placeholder="Ghi chú / lý do"
                    className="mt-2 h-7 w-full rounded border border-input bg-background px-2 text-[10px] outline-none focus:ring-1 focus:ring-ring"
                  />
                  <select
                    value={m.status}
                    disabled={statusBusy}
                    onChange={(event) => setStatus.mutate({ id: m.id, status: event.target.value })}
                    aria-label={`Đổi trạng thái ${m.code}`}
                    className="mt-1.5 h-7 w-full rounded border border-input bg-background px-1.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                  >
                    {MACHINE_STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>

                  {editing && (
                    <div className="absolute inset-0 z-10 flex flex-col bg-card p-2">
                      <div className="text-[10px] font-bold">SỬA {m.code}</div>
                      <input
                        value={editing.name}
                        onChange={(event) => setEdit((current) => ({ ...current, [m.id]: { ...editing, name: event.target.value } }))}
                        placeholder="Tên máy"
                        className="mt-1 h-7 rounded border border-input bg-background px-2 text-[10px] outline-none focus:ring-1 focus:ring-ring"
                      />
                      <input
                        value={editing.workshop}
                        onChange={(event) => setEdit((current) => ({ ...current, [m.id]: { ...editing, workshop: event.target.value } }))}
                        placeholder="Xưởng"
                        className="mt-1 h-7 rounded border border-input bg-background px-2 text-[10px] outline-none focus:ring-1 focus:ring-ring"
                      />
                      <div className="mt-auto flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[9px]"
                          onClick={() => setEdit((current) => {
                            const next = { ...current };
                            delete next[m.id];
                            return next;
                          })}
                        >
                          <X /> HỦY
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-6 px-2 text-[9px]"
                          disabled={editBusy}
                          onClick={() => saveInfo.mutate({ id: m.id, name: editing.name, workshop: editing.workshop })}
                        >
                          <Check /> LƯU
                        </Button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="grid h-full min-h-28 place-items-center text-[11px] text-muted-foreground">
            Không tìm thấy máy phù hợp.
          </div>
        )}
      </div>

      <div className="flex h-48 shrink-0 flex-col border-t border-border bg-card sm:h-52">
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted px-3 py-1.5">
          <h2 className="text-[10px] font-bold">LỊCH SỬ TRẠNG THÁI GẦN ĐÂY</h2>
          <span className="text-[9px] text-muted-foreground">30 CẬP NHẬT MỚI NHẤT</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="mes-table">
          <thead>
            <tr>
              <th>THỜI GIAN</th>
              <th>MÁY</th>
              <th>TRẠNG THÁI</th>
              <th>GHI CHÚ</th>
            </tr>
          </thead>
          <tbody>
            {data.logs.map((l) => (
              <tr key={l.id}>
                <td>{fmtTime(l.created_at)}</td>
                <td>{machineLabel(data.machines.find((m) => m.id === l.machine_id))}</td>
                <td>{l.status}</td>
                <td>{l.note}</td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
