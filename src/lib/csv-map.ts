/**
 * Chuẩn hóa tên cột CSV (cả file cũ tiếng Việt lẫn bộ cột mới) về tên chuẩn.
 */

export const PLAN_COLUMNS = [
  "wo_number",
  "part_number",
  "part_name",
  "drawing_number",
  "customer",
  "quantity",
  "operation",
  "operation_seq",
  "machine_code",
  "machine_name",
  "workshop",
  "plan_start",
  "plan_end",
  "due_date",
  "priority",
  "status",
  "remark",
] as const;

export const ACTUAL_COLUMNS = [
  "wo_number",
  "operation_seq",
  "drawing_number",
  "part_number",
  "machine_code",
  "operator_code",
  "actual_start",
  "actual_end",
  "good_qty",
  "ng_qty",
  "job_status",
  "remark",
] as const;

/** key = header đã chuẩn hóa (chữ thường, bỏ dấu, bỏ ký tự lạ) */
const ALIASES: Record<string, string> = {
  // work order
  wo: "wo_number",
  wonumber: "wo_number",
  wono: "wo_number",
  solenh: "wo_number",
  malenh: "wo_number",
  // part
  mahang: "part_number",
  partnumber: "part_number",
  masanpham: "part_number",
  tenhang: "part_name",
  partname: "part_name",
  tensanpham: "part_name",
  mabanve: "drawing_number",
  drawingnumber: "drawing_number",
  banve: "drawing_number",
  // customer
  khachhang: "customer",
  customer: "customer",
  // qty
  qty: "quantity",
  quantity: "quantity",
  soluong: "quantity",
  soluongdat: "good_qty",
  goodqty: "good_qty",
  ok: "good_qty",
  soluonghong: "ng_qty",
  ngqty: "ng_qty",
  ng: "ng_qty",
  // operation
  tencongdoan: "operation",
  congdoan: "operation",
  operation: "operation",
  thutugc: "operation_seq",
  thutu: "operation_seq",
  operationseq: "operation_seq",
  // machine
  tenmay: "machine_code",
  may: "machine_code",
  machinecode: "machine_code",
  mamay: "machine_code",
  maygiacong: "machine_code",
  machinename: "machine_name",
  tenmaydaydu: "machine_name",
  workshop: "workshop",
  xuong: "workshop",
  // operator
  nguoigiacong: "operator_code",
  operatorcode: "operator_code",
  manhanvien: "operator_code",
  // plan time
  ngaybatdau: "plan_start",
  planstart: "plan_start",
  ngayketthuc: "plan_end",
  planend: "plan_end",
  duedate: "due_date",
  ngaygiao: "due_date",
  hangiao: "due_date",
  // actual time
  thoidiembatdau: "actual_start",
  actualstart: "actual_start",
  thoidiemhoanthanh: "actual_end",
  actualend: "actual_end",
  // status
  status: "status",
  trangthai: "job_status",
  jobstatus: "job_status",
  // misc
  priority: "priority",
  uutien: "priority",
  douutien: "priority",
  memo: "remark",
  ghichu: "remark",
  remark: "remark",
};

export function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function mapHeader(header: string): string | null {
  const key = normalizeHeader(header);
  if (!key) return null;
  return ALIASES[key] ?? null;
}

export type MappedRows = {
  rows: Record<string, string>[];
  recognized: { source: string; target: string }[];
  ignored: string[];
};

export function mapRows(raw: Record<string, string>[]): MappedRows {
  const recognized: { source: string; target: string }[] = [];
  const ignored: string[] = [];
  const headers = Object.keys(raw[0] ?? {});
  const pairs: [string, string][] = [];
  for (const h of headers) {
    const target = mapHeader(h);
    if (target) {
      recognized.push({ source: h, target });
      pairs.push([h, target]);
    } else if (h.trim()) {
      ignored.push(h);
    }
  }
  const rows = raw.map((r) => {
    const out: Record<string, string> = {};
    for (const [src, target] of pairs) {
      const v = (r[src] ?? "").trim();
      if (v && v.toLowerCase() !== "null" && !out[target]) out[target] = v;
    }
    return out;
  });
  return { rows, recognized, ignored };
}

export const PLAN_SAMPLE_CSV = [
  "wo_number,part_number,part_name,drawing_number,customer,quantity,operation,operation_seq,machine_code,machine_name,workshop,plan_start,plan_end,due_date,priority,status,remark",
  "WO-2601-101,P-1001,Base Plate,DWG-1001,DYNAMO,50,MILLING,1,MC-01,Mazak VCN-01,MC,2026-09-14 08:00,2026-09-14 16:00,2026-09-20,2,PLANNED,Lô thử",
  "WO-2601-102,P-1002,Shaft,DWG-1002,DYNAMO,120,TURNING,1,LT-01,Okuma LB-01,LT,2026-09-15 08:00,2026-09-16 12:00,2026-09-22,3,PLANNED,",
].join("\n");

export const ACTUAL_SAMPLE_CSV = [
  "wo_number,operation_seq,machine_code,operator_code,actual_start,actual_end,good_qty,ng_qty,job_status,remark",
  "WO-2601-101,1,MC-01,NV001,2026-09-14 08:12,2026-09-14 15:40,49,1,COMPLETED,",
  "WO-2601-102,1,LT-01,NV002,2026-09-15 08:05,,60,0,RUNNING,Đang chạy ca 2",
].join("\n");
