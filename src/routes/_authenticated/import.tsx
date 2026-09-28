import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle } from "@/components/AppShell";
import { logAudit } from "@/lib/audit";
import { parseCsv, parseLegacyDate } from "@/lib/mes";
import { ACTUAL_SAMPLE_CSV, PLAN_SAMPLE_CSV, mapRows } from "@/lib/csv-map";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({
    meta: [
      { title: "Import CSV — DYNAMO VIETNAM MC - MES" },
      {
        name: "description",
        content:
          "Nạp dữ liệu kế hoạch và thực tế từ file plan.csv và actual.csv, hỗ trợ cả tên cột cũ lẫn bộ cột chuẩn mới.",
      },
      { property: "og:title", content: "Import CSV — DYNAMO VIETNAM MC - MES" },
      { property: "og:description", content: "Nạp dữ liệu sản xuất từ file CSV vào hệ thống MES." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImportPage,
});

const WO_STATUS = new Set(["PLANNED", "IN_PROGRESS", "COMPLETED", "HOLD", "CANCELLED"]);
const JOB_STATUS = new Set(["PLANNED", "RUNNING", "PAUSED", "COMPLETED"]);

function num(v: string | undefined): number | null {
  if (v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function iso(v: string | undefined): string | null {
  return parseLegacyDate(v)?.toISOString() ?? null;
}

function dateOnly(v: string | undefined): string | null {
  const d = parseLegacyDate(v);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

async function ensureMachine(
  code: string,
  name: string | undefined,
  workshop: string | undefined,
  cache: Map<string, string>,
  renamed?: string[],
) {
  const key = code.trim();
  if (!key) return null;
  const newName = name?.trim() || "";
  const newWorkshop = workshop?.trim() || "";
  const cacheKey = `${key}|${newName}|${newWorkshop}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const { data } = await supabase
    .from("machines")
    .select("id, code, name, workshop")
    .eq("code", key)
    .maybeSingle();

  if (data) {
    const patch: { name?: string; workshop?: string } = {};
    if (newName && newName !== data.name) patch.name = newName;
    if (newWorkshop && newWorkshop !== data.workshop) patch.workshop = newWorkshop;
    if (Object.keys(patch).length) {
      const { error } = await supabase
        .from("machines")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", data.id);
      if (error) throw error;
      if (patch.name) renamed?.push(`${key}: "${data.name}" → "${patch.name}"`);
      if (patch.workshop) renamed?.push(`${key}: xưởng "${data.workshop}" → "${patch.workshop}"`);
    }
    cache.set(cacheKey, data.id);
    return data.id;
  }

  const { data: created, error } = await supabase
    .from("machines")
    .insert({ code: key, name: newName || key, workshop: newWorkshop || "MC" })
    .select("id")
    .single();
  if (error) throw error;
  renamed?.push(`${key}: tạo máy mới "${newName || key}"`);
  cache.set(cacheKey, created.id);
  return created.id;
}


async function findOperator(code: string | undefined, cache: Map<string, string | null>) {
  const key = (code ?? "").trim();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key)!;
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("employee_code", key)
    .maybeSingle();
  const id = data?.id ?? null;
  cache.set(key, id);
  return id;
}

function ImportPage() {
  const qc = useQueryClient();
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function push(...lines: string[]) {
    setLog((l) => [...l, ...lines]);
  }

  function reportColumns(
    label: string,
    recognized: { source: string; target: string }[],
    ignored: string[],
  ) {
    push(
      `— ${label} —`,
      `Cột nhận diện được (${recognized.length}): ${
        recognized.map((r) => `${r.source} → ${r.target}`).join(", ") || "không có"
      }`,
      `Cột bị bỏ qua (${ignored.length}): ${ignored.join(", ") || "không có"}`,
    );
  }

  async function importPlan(file: File) {
    setBusy(true);
    setLog([]);
    try {
      const { rows, recognized, ignored } = mapRows(parseCsv(await file.text()));
      reportColumns("plan.csv", recognized, ignored);
      const machineCache = new Map<string, string>();
      const machineChanges: string[] = [];
      const errors: string[] = [];
      let ok = 0;

      for (const [i, row] of rows.entries()) {
        const line = i + 2;
        try {
          const part = row["part_number"] ?? row["drawing_number"];
          if (!part) {
            errors.push(`Dòng ${line}: thiếu mã hàng (part_number).`);
            continue;
          }
          const machineId = await ensureMachine(
            row["machine_code"] ?? "",
            row["machine_name"],
            row["workshop"],
            machineCache,
            machineChanges,
          );
          const woNumber =
            row["wo_number"] || `${part}-${row["operation"] || "OP"}-${row["operation_seq"] || i + 1}`;
          const status = (row["status"] ?? "").toUpperCase();
          const priority = num(row["priority"]);

          const { data: wo, error } = await supabase
            .from("work_orders")
            .upsert(
              {
                wo_number: woNumber,
                part_number: part,
                part_name: row["part_name"] ?? null,
                drawing_number: row["drawing_number"] ?? null,
                customer: row["customer"] ?? null,
                quantity: num(row["quantity"]) ?? 0,
                machine_id: machineId,
                operation: row["operation"] ?? null,
                due_date: dateOnly(row["due_date"]),
                priority: priority ?? 3,
                status: WO_STATUS.has(status) ? status : "PLANNED",
                remark: row["remark"] ?? null,
              },
              { onConflict: "wo_number" },
            )
            .select("id")
            .single();
          if (error) throw error;

          const planStart = iso(row["plan_start"]);
          const planEnd = iso(row["plan_end"]);
          const { data: existing } = await supabase
            .from("jobs")
            .select("id")
            .eq("work_order_id", wo.id)
            .order("created_at", { ascending: true });
          const target = existing?.[0];
          if (target) {
            const { error: upErr } = await supabase
              .from("jobs")
              .update({ machine_id: machineId, plan_start: planStart, plan_end: planEnd })
              .eq("id", target.id);
            if (upErr) throw upErr;
          } else {
            const { error: jobError } = await supabase.from("jobs").insert({
              work_order_id: wo.id,
              machine_id: machineId,
              plan_start: planStart,
              plan_end: planEnd,
              status: "PLANNED",
            });
            if (jobError) throw jobError;
          }
          ok++;
        } catch (e) {
          errors.push(`Dòng ${line}: ${(e as Error).message}`);
        }
      }

      push(`plan.csv: đã nạp ${ok}/${rows.length} dòng, lỗi ${errors.length}.`, ...errors.slice(0, 30));
      if (machineChanges.length)
        push(`Máy được cập nhật (${machineChanges.length}): ${machineChanges.join("; ")}`);
      if (errors.length > 30) push(`… và ${errors.length - 30} lỗi khác.`);
      await logAudit("IMPORT", "plan_csv", null, { rows: ok, errors: errors.length });
      qc.invalidateQueries();
    } catch (e) {
      push(`Lỗi plan.csv: ${(e as Error).message}`);
    }
    setBusy(false);
  }

  async function importActual(file: File) {
    setBusy(true);
    setLog([]);
    try {
      const { rows, recognized, ignored } = mapRows(parseCsv(await file.text()));
      reportColumns("actual.csv", recognized, ignored);
      const machineCache = new Map<string, string>();
      const operatorCache = new Map<string, string | null>();
      const errors: string[] = [];
      let ok = 0;

      for (const [i, row] of rows.entries()) {
        const line = i + 2;
        try {
          const woNumber = row["wo_number"];
          const fallback = row["drawing_number"] ?? row["part_number"];
          let woId: string | null = null;

          if (woNumber) {
            const { data } = await supabase
              .from("work_orders")
              .select("id")
              .eq("wo_number", woNumber)
              .maybeSingle();
            woId = data?.id ?? null;
          }
          if (!woId && fallback) {
            const { data } = await supabase
              .from("work_orders")
              .select("id")
              .or(`drawing_number.eq.${fallback},part_number.eq.${fallback}`)
              .limit(1);
            woId = data?.[0]?.id ?? null;
          }
          if (!woId) {
            errors.push(`Dòng ${line}: không tìm thấy lệnh sản xuất (${woNumber || fallback || "trống"}).`);
            continue;
          }

          const machineId = row["machine_code"]
            ? await ensureMachine(row["machine_code"], undefined, undefined, machineCache)
            : null;
          const operatorId = await findOperator(row["operator_code"], operatorCache);
          const start = iso(row["actual_start"]);
          const end = iso(row["actual_end"]);
          const statusRaw = (row["job_status"] ?? "").toUpperCase();
          const status = JOB_STATUS.has(statusRaw) ? statusRaw : end ? "COMPLETED" : start ? "RUNNING" : "PLANNED";

          const seq = num(row["operation_seq"]);
          const { data: jobs } = await supabase
            .from("jobs")
            .select("id")
            .eq("work_order_id", woId)
            .order("created_at", { ascending: true });
          const job = seq && seq > 1 ? jobs?.[seq - 1] : jobs?.[0];

          const payload = {
            actual_start: start,
            actual_end: end,
            status,
            good_qty: num(row["good_qty"]) ?? 0,
            ng_qty: num(row["ng_qty"]) ?? 0,
            ...(machineId ? { machine_id: machineId } : {}),
            ...(operatorId ? { operator_id: operatorId } : {}),
            ...(row["remark"] ? { remark: row["remark"] } : {}),
          };

          if (job) {
            const { error } = await supabase.from("jobs").update(payload).eq("id", job.id);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from("jobs")
              .insert({ work_order_id: woId, ...payload });
            if (error) throw error;
          }
          if (row["operator_code"] && !operatorId) {
            errors.push(`Dòng ${line}: không tìm thấy nhân viên ${row["operator_code"]} (vẫn nạp phần còn lại).`);
          }
          ok++;
        } catch (e) {
          errors.push(`Dòng ${line}: ${(e as Error).message}`);
        }
      }

      push(`actual.csv: đã cập nhật ${ok}/${rows.length} dòng, cảnh báo/lỗi ${errors.length}.`, ...errors.slice(0, 30));
      if (errors.length > 30) push(`… và ${errors.length - 30} dòng khác.`);
      await logAudit("IMPORT", "actual_csv", null, { rows: ok, errors: errors.length });
      qc.invalidateQueries();
    } catch (e) {
      push(`Lỗi actual.csv: ${(e as Error).message}`);
    }
    setBusy(false);
  }

  return (
    <>
      <PageTitle title="IMPORT CSV" sub="Nạp dữ liệu kế hoạch và thực tế (hỗ trợ tên cột cũ và bộ cột chuẩn)" />
      <div className="mes-card p-3 text-[11px]">
        <p className="mb-2">
          <b>plan.csv</b> — cột chuẩn: wo_number, part_number, part_name, drawing_number, customer, quantity,
          operation, operation_seq, machine_code, machine_name, workshop, plan_start, plan_end, due_date,
          priority, status, remark. Tên cột cũ (Ma_Hang, Ten_May, Ngay_Bat_Dau…) vẫn dùng được.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && importPlan(e.target.files[0])}
          />
          <button
            type="button"
            className="underline"
            onClick={() => download("plan-mau.csv", PLAN_SAMPLE_CSV)}
          >
            Tải file mẫu plan.csv
          </button>
        </div>

        <p className="mt-4 mb-2">
          <b>actual.csv</b> — cột chuẩn: wo_number, operation_seq, machine_code, operator_code, actual_start,
          actual_end, good_qty, ng_qty, job_status, remark. Tên cột cũ (ma_ban_ve, may_gia_cong,
          thoi_diem_bat_dau…) vẫn dùng được.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && importActual(e.target.files[0])}
          />
          <button
            type="button"
            className="underline"
            onClick={() => download("actual-mau.csv", ACTUAL_SAMPLE_CSV)}
          >
            Tải file mẫu actual.csv
          </button>
        </div>

        <p className="mt-4 text-muted-foreground">
          Định dạng ngày giờ nên là YYYY-MM-DD HH:mm. Ô trống để rỗng, không ghi "null".
        </p>
      </div>
      <div className="mes-card min-h-0 flex-1 overflow-auto p-3 font-mono text-[11px]">
        {busy && <div>Đang xử lý…</div>}
        {log.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </>
  );
}
