import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle } from "@/components/AppShell";
import { useRole } from "@/hooks/useAuth";
import { logAudit } from "@/lib/audit";
import { fmtDate, machineLabel, WO_STATUSES } from "@/lib/mes";

export const Route = createFileRoute("/_authenticated/work-orders")({
  head: () => ({
    meta: [
      { title: "Work Orders — DYNAMO VIETNAM MC - MES" },
      { name: "description", content: "Tạo, sửa và điều phối lệnh sản xuất: mã hàng, số lượng, hạn giao và máy gia công." },
      { property: "og:title", content: "Work Orders — DYNAMO VIETNAM MC - MES" },
      { property: "og:description", content: "Quản lý lệnh sản xuất của nhà máy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WorkOrders,
});

const emptyForm = {
  wo_number: "",
  customer: "",
  part_number: "",
  part_name: "",
  drawing_number: "",
  quantity: 0,
  priority: 3,
  due_date: "",
  machine_id: "",
  operation: "",
  status: "PLANNED",
  remark: "",
};

function WorkOrders() {
  const { isManager } = useRole();
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...emptyForm });
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["work-orders"],
    queryFn: async () => {
      const [wos, machines] = await Promise.all([
        supabase.from("work_orders").select("*").order("due_date"),
        supabase.from("machines").select("id, code, name").order("sort_order"),
      ]);
      if (wos.error) throw wos.error;
      if (machines.error) throw machines.error;
      return { wos: wos.data, machines: machines.data };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        quantity: Number(form.quantity) || 0,
        priority: Number(form.priority) || 3,
        due_date: form.due_date || null,
        machine_id: form.machine_id || null,
      };
      if (editing) {
        const { error } = await supabase.from("work_orders").update(payload).eq("id", editing);
        if (error) throw error;
        await logAudit("UPDATE", "work_order", editing, { wo: form.wo_number });
      } else {
        const { data, error } = await supabase.from("work_orders").insert(payload).select("id").single();
        if (error) throw error;
        await logAudit("CREATE", "work_order", data.id, { wo: form.wo_number });
      }
    },
    onSuccess: () => {
      setForm({ ...emptyForm });
      setEditing(null);
      setError(null);
      qc.invalidateQueries({ queryKey: ["work-orders"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("work_orders").delete().eq("id", id);
      if (error) throw error;
      await logAudit("DELETE", "work_order", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-orders"] }),
    onError: (e: Error) => setError(e.message),
  });

  if (!data) return <p className="text-xs">Đang tải…</p>;

  const field = (k: keyof typeof emptyForm, label: string, type = "text") => (
    <label className="flex flex-col text-[10px] font-bold text-muted-foreground">
      {label}
      <input
        type={type}
        value={String(form[k] ?? "")}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
        className="rounded border border-input bg-card px-1.5 py-1 text-[11px] font-normal text-foreground"
      />
    </label>
  );

  return (
    <>
      <PageTitle title="WORK ORDERS" sub="Lệnh sản xuất" />
      {isManager && (
        <div className="mes-card p-2">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
            {field("wo_number", "WO NUMBER")}
            {field("customer", "KHÁCH HÀNG")}
            {field("part_number", "MÃ HÀNG")}
            {field("part_name", "TÊN HÀNG")}
            {field("drawing_number", "SỐ BẢN VẼ")}
            {field("quantity", "SỐ LƯỢNG", "number")}
            {field("priority", "ƯU TIÊN (1-5)", "number")}
            {field("due_date", "HẠN GIAO", "date")}
            {field("operation", "CÔNG ĐOẠN")}
            <label className="flex flex-col text-[10px] font-bold text-muted-foreground">
              MÁY
              <select
                value={form.machine_id}
                onChange={(e) => setForm({ ...form, machine_id: e.target.value })}
                className="rounded border border-input bg-card px-1.5 py-1 text-[11px] font-normal text-foreground"
              >
                <option value="">— chưa gán —</option>
                {data.machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {machineLabel(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-[10px] font-bold text-muted-foreground">
              TRẠNG THÁI
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="rounded border border-input bg-card px-1.5 py-1 text-[11px] font-normal text-foreground"
              >
                {WO_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            {field("remark", "GHI CHÚ")}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => save.mutate()}
              disabled={!form.wo_number || !form.part_number || save.isPending}
              className="rounded bg-primary px-4 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
            >
              {editing ? "LƯU THAY ĐỔI" : "TẠO WORK ORDER"}
            </button>
            {editing && (
              <button
                onClick={() => {
                  setEditing(null);
                  setForm({ ...emptyForm });
                }}
                className="rounded border border-input px-4 py-1.5 text-[11px] font-bold"
              >
                HỦY
              </button>
            )}
            {error && <span className="text-[11px] text-destructive">{error}</span>}
          </div>
        </div>
      )}

      <div className="mes-card min-h-0 flex-1 overflow-auto">
        <table className="mes-table">
          <thead>
            <tr>
              {["WO", "KHÁCH", "MÃ HÀNG", "TÊN", "SL", "ƯU TIÊN", "HẠN GIAO", "MÁY", "TRẠNG THÁI", ""].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.wos.map((w) => (
              <tr key={w.id}>
                <td>{w.wo_number}</td>
                <td>{w.customer}</td>
                <td><Link to="/shinko" search={{ wo: w.id }} className="font-bold text-primary underline">{w.part_number}</Link></td>
                <td>{w.part_name}</td>
                <td className="text-right">{w.quantity}</td>
                <td className="text-center">{w.priority}</td>
                <td>{fmtDate(w.due_date)}</td>
                <td>{machineLabel(data.machines.find((m) => m.id === w.machine_id))}</td>
                <td>{w.status}</td>
                <td>
                  {isManager && (
                    <div className="flex gap-2">
                      <button
                        className="text-primary underline"
                        onClick={() => {
                          setEditing(w.id);
                          setForm({
                            wo_number: w.wo_number,
                            customer: w.customer ?? "",
                            part_number: w.part_number,
                            part_name: w.part_name ?? "",
                            drawing_number: w.drawing_number ?? "",
                            quantity: w.quantity,
                            priority: w.priority,
                            due_date: w.due_date ?? "",
                            machine_id: w.machine_id ?? "",
                            operation: w.operation ?? "",
                            status: w.status,
                            remark: w.remark ?? "",
                          });
                        }}
                      >
                        Sửa
                      </button>
                      <button className="text-destructive underline" onClick={() => remove.mutate(w.id)}>
                        Xóa
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
