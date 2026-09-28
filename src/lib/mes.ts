export type Role = "admin" | "leader" | "operator";

export const MACHINE_STATUSES = [
  "RUN",
  "WAIT",
  "SETUP",
  "BREAKDOWN",
  "MAINTENANCE",
  "OFFLINE",
] as const;
export type MachineStatus = (typeof MACHINE_STATUSES)[number];

export const machineStatusClass: Record<string, string> = {
  RUN: "bg-run text-primary-foreground",
  WAIT: "bg-wait text-foreground",
  SETUP: "bg-setup text-primary-foreground",
  BREAKDOWN: "bg-breakdown text-destructive-foreground",
  MAINTENANCE: "bg-maintenance text-primary-foreground",
  OFFLINE: "bg-offline text-primary-foreground",
};

export const WO_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "HOLD", "CANCELLED"] as const;
export const JOB_STATUSES = ["PLANNED", "RUNNING", "PAUSED", "COMPLETED"] as const;

/** Deterministic color per part number, like the original HTML board. */
export function stringToColor(str: string | null | undefined): string {
  if (!str) return "hsl(150, 60%, 35%)";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 131 + str.charCodeAt(i)) | 0;
  }
  return `hsl(${Math.abs(hash * 137) % 360}, 70%, 38%)`;
}

/** Parses M/D/YYYY, D-M-YYYY and YYYY-MM-DD (with optional HH:mm) as in the legacy CSV files. */
export function parseLegacyDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw || raw.toLowerCase() === "null") return null;
  const bits = raw.split(/\s+/);
  const datePart = (bits[0] ?? "").replace(/\./g, "/");
  const parts = datePart.includes("/") ? datePart.split("/") : datePart.split("-");
  if (parts.length !== 3) return null;
  const p0 = parts[0] ?? "";
  const p1 = parts[1] ?? "";
  const p2 = parts[2] ?? "";
  let y: string, m: string, d: string;
  if (p0.length === 4) {
    y = p0;
    m = p1;
    d = p2;
  } else {
    y = p2.length === 2 ? `20${p2}` : p2;
    const first = Number(p0);
    const second = Number(p1);
    if (first > 12 && second <= 12) {
      d = p0;
      m = p1;
    } else {
      m = p0;
      d = p1;
    }
  }
  let hh = 0;
  let mm = 0;
  if (bits[1]) {
    const t = bits[1].split(":");
    hh = Number(t[0]) || 0;
    mm = Number(t[1]) || 0;
  }
  const date = new Date(Number(y), Number(m) - 1, Number(d), hh, mm);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Minimal CSV parser handling quoted cells. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((row) =>
      row
        .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        .map((cell) => cell.replace(/^"(.*)"$/, "$1").trim()),
    );
  if (rows.length < 2) return [];
  const headers = (rows[0] ?? []).map((h) => (h || "").replace(/^\uFEFF/, "").trim());
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = row[i] ?? "";
    });
    return obj;
  });
}

export function fmtTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(
    d.getHours(),
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function startOfDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

export function machineLabel(
  m: { code: string; name?: string | null } | null | undefined,
): string {
  if (!m) return "-";
  const name = (m.name ?? "").trim();
  return name && name !== m.code ? `${m.code} — ${name}` : m.code;
}
