// Local Database Storage Adapter
// Thay the hoan toan Supabase Cloud bang Local Storage chay 100% tren may local.

export type Role = "admin" | "leader" | "operator";

export type Machine = {
  id: string;
  code: string;
  name: string;
  workshop: string;
  status: string;
  sort_order: number;
  updated_at: string;
};

export type WorkOrder = {
  id: string;
  wo_number: string;
  customer: string | null;
  part_number: string;
  part_name: string | null;
  drawing_number: string | null;
  quantity: number;
  priority: number;
  due_date: string | null;
  machine_id: string | null;
  operation: string | null;
  status: string;
  remark: string | null;
  created_at: string;
};

export type Job = {
  id: string;
  work_order_id: string;
  machine_id: string | null;
  operator_id: string | null;
  plan_start: string | null;
  plan_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  status: string;
  good_qty: number;
  ng_qty: number;
  remark: string | null;
  created_at: string;
};

export type MachineStatusLog = {
  id: string;
  machine_id: string;
  status: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type AuditLog = {
  id: string;
  user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
};

export type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  employee_code: string;
  role: Role;
};

export const DEFAULT_USERS: UserProfile[] = [
  {
    id: "usr-admin-01",
    email: "admin@dynamo.local",
    full_name: "Nguyễn Văn An (Quản Đốc)",
    employee_code: "ADM-001",
    role: "admin",
  },
  {
    id: "usr-leader-01",
    email: "leader@dynamo.local",
    full_name: "Trần Hùng (Tổ Trưởng MC)",
    employee_code: "TL-001",
    role: "leader",
  },
  {
    id: "usr-operator-01",
    email: "operator@dynamo.local",
    full_name: "Lê Văn Bình (Thợ Máy CNC)",
    employee_code: "OP-001",
    role: "operator",
  },
];

const DEFAULT_MACHINES: Machine[] = [
  { id: "m-01", code: "MC-01", name: "MAZAK VCN-410", workshop: "MC", status: "RUN", sort_order: 1, updated_at: new Date().toISOString() },
  { id: "m-02", code: "MC-02", name: "MAZAK VCN-530", workshop: "MC", status: "RUN", sort_order: 2, updated_at: new Date().toISOString() },
  { id: "m-03", code: "MC-03", name: "BROTHER S700X1", workshop: "MC", status: "WAIT", sort_order: 3, updated_at: new Date().toISOString() },
  { id: "m-04", code: "MC-04", name: "OKUMA GENOS M560", workshop: "MC", status: "SETUP", sort_order: 4, updated_at: new Date().toISOString() },
  { id: "m-05", code: "MC-05", name: "MORI SEIKI NVX5080", workshop: "MC", status: "RUN", sort_order: 5, updated_at: new Date().toISOString() },
  { id: "m-06", code: "LT-01", name: "MAZAK QTN-200", workshop: "LATHE", status: "BREAKDOWN", sort_order: 6, updated_at: new Date().toISOString() },
  { id: "m-07", code: "LT-02", name: "OKUMA LB3000", workshop: "LATHE", status: "RUN", sort_order: 7, updated_at: new Date().toISOString() },
  { id: "m-08", code: "GR-01", name: "OKAMOTO PSG-52", workshop: "GRIND", status: "MAINTENANCE", sort_order: 8, updated_at: new Date().toISOString() },
];

function seedInitialData() {
  const today = new Date();
  const dStr = (offsetDays: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const dtIso = (hour: number) => {
    const d = new Date(today);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };

  const workOrders: WorkOrder[] = [
    { id: "wo-1", wo_number: "WO-2601-001", customer: "DENSO", part_number: "P-1001", part_name: "BRACKET A", drawing_number: "DWG-1001", quantity: 200, priority: 1, due_date: dStr(2), machine_id: "m-01", operation: "MILLING", status: "IN_PROGRESS", remark: "Hàng gấp giao tuần này", created_at: dtIso(7) },
    { id: "wo-2", wo_number: "WO-2601-002", customer: "KYOCERA", part_number: "P-1002", part_name: "SHAFT B", drawing_number: "DWG-1002", quantity: 120, priority: 2, due_date: dStr(3), machine_id: "m-02", operation: "MILLING", status: "IN_PROGRESS", remark: "", created_at: dtIso(7) },
    { id: "wo-3", wo_number: "WO-2601-003", customer: "NIDEC", part_number: "P-1003", part_name: "HOUSING C", drawing_number: "DWG-1003", quantity: 80, priority: 1, due_date: dStr(1), machine_id: "m-03", operation: "MILLING", status: "PLANNED", remark: "Kiểm tra dao trước khi gia công", created_at: dtIso(7) },
    { id: "wo-4", wo_number: "WO-2601-004", customer: "DENSO", part_number: "P-1004", part_name: "PLATE D", drawing_number: "DWG-1004", quantity: 300, priority: 3, due_date: dStr(5), machine_id: "m-05", operation: "MILLING", status: "PLANNED", remark: "", created_at: dtIso(7) },
    { id: "wo-5", wo_number: "WO-2601-005", customer: "THK", part_number: "P-1005", part_name: "PIN E", drawing_number: "DWG-1005", quantity: 500, priority: 2, due_date: dStr(4), machine_id: "m-07", operation: "TURNING", status: "IN_PROGRESS", remark: "", created_at: dtIso(7) },
    { id: "wo-6", wo_number: "WO-2601-006", customer: "SMC", part_number: "P-1006", part_name: "RING F", drawing_number: "DWG-1006", quantity: 150, priority: 3, due_date: dStr(6), machine_id: "m-04", operation: "MILLING", status: "PLANNED", remark: "", created_at: dtIso(7) },
  ];

  const jobs: Job[] = [
    { id: "job-1", work_order_id: "wo-1", machine_id: "m-01", operator_id: "usr-operator-01", plan_start: dtIso(8), plan_end: dtIso(14), actual_start: dtIso(8), actual_end: dtIso(13), status: "COMPLETED", good_qty: 195, ng_qty: 5, remark: "Đã hoàn thành mẻ đầu", created_at: dtIso(7) },
    { id: "job-2", work_order_id: "wo-2", machine_id: "m-02", operator_id: "usr-operator-01", plan_start: dtIso(9), plan_end: dtIso(17), actual_start: dtIso(9), actual_end: null, status: "RUNNING", good_qty: 60, ng_qty: 2, remark: "Đang chạy dao tinh", created_at: dtIso(7) },
    { id: "job-3", work_order_id: "wo-3", machine_id: "m-03", operator_id: null, plan_start: dtIso(13), plan_end: dtIso(18), actual_start: null, actual_end: null, status: "PLANNED", good_qty: 0, ng_qty: 0, remark: "", created_at: dtIso(7) },
    { id: "job-4", work_order_id: "wo-4", machine_id: "m-05", operator_id: null, plan_start: dtIso(8), plan_end: dtIso(20), actual_start: null, actual_end: null, status: "PLANNED", good_qty: 0, ng_qty: 0, remark: "", created_at: dtIso(7) },
    { id: "job-5", work_order_id: "wo-5", machine_id: "m-07", operator_id: "usr-operator-01", plan_start: dtIso(7), plan_end: dtIso(16), actual_start: dtIso(7), actual_end: null, status: "RUNNING", good_qty: 220, ng_qty: 8, remark: "Nhiệt độ ổn định", created_at: dtIso(7) },
    { id: "job-6", work_order_id: "wo-6", machine_id: "m-04", operator_id: null, plan_start: dtIso(10), plan_end: dtIso(15), actual_start: null, actual_end: null, status: "PLANNED", good_qty: 0, ng_qty: 0, remark: "", created_at: dtIso(7) },
  ];

  return { workOrders, jobs };
}

// Storage Helper
class LocalDB {
  private get<T>(key: string, defaultValue: T): T {
    if (typeof window === "undefined") return defaultValue;
    const data = localStorage.getItem(`dynamo_mes_${key}`);
    if (!data) {
      this.set(key, defaultValue);
      return defaultValue;
    }
    try {
      return JSON.parse(data) as T;
    } catch {
      return defaultValue;
    }
  }

  private set<T>(key: string, val: T): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(`dynamo_mes_${key}`, JSON.stringify(val));
    }
  }

  init() {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("dynamo_mes_initialized")) {
      const { workOrders, jobs } = seedInitialData();
      this.set("users", DEFAULT_USERS);
      this.set("machines", DEFAULT_MACHINES);
      this.set("work_orders", workOrders);
      this.set("jobs", jobs);
      this.set("machine_status_log", []);
      this.set("audit_logs", []);
      this.set("current_user", DEFAULT_USERS[0]); // Mặc định là Admin
      localStorage.setItem("dynamo_mes_initialized", "true");
    }
  }

  // Auth methods
  getCurrentUser(): UserProfile | null {
    this.init();
    return this.get<UserProfile | null>("current_user", DEFAULT_USERS[0]);
  }

  setCurrentUser(user: UserProfile | null) {
    this.set("current_user", user);
  }

  getUsers(): UserProfile[] {
    this.init();
    return this.get<UserProfile[]>("users", DEFAULT_USERS);
  }

  // Generic Tables
  getTable<T>(table: string): T[] {
    this.init();
    return this.get<T[]>(table, []);
  }

  setTable<T>(table: string, rows: T[]): void {
    this.set(table, rows);
  }
}

export const localDB = new LocalDB();
