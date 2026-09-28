// Supabase Compatible Local Client
// Emulates Supabase Query Builder directly on Local Database!
import { localDB, type UserProfile, type Role } from "@/lib/local-db";

type FilterFn<T> = (item: T) => boolean;

class LocalQueryBuilder<T extends Record<string, any>> {
  private tableName: string;
  private filters: FilterFn<T>[] = [];
  private orderField?: string;
  private orderAsc: boolean = true;
  private limitCount?: number;
  private isSingle: boolean = false;
  private isMaybeSingle: boolean = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(_columns = "*") {
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((item) => item[column] === value);
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push((item) => item[column] !== value);
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push((item) => values.includes(item[column]));
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderField = column;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  private executeSelect(): { data: any; error: any } {
    let rows = localDB.getTable<T>(this.tableName);

    // Profile table mapping from users
    if (this.tableName === "profiles") {
      const users = localDB.getUsers();
      rows = users.map((u) => ({ id: u.id, full_name: u.full_name, employee_code: u.employee_code })) as any[];
    }

    // Apply filters
    for (const f of this.filters) {
      rows = rows.filter(f);
    }

    // Apply relations if work_orders requested in jobs
    if (this.tableName === "jobs") {
      const wos = localDB.getTable<any>("work_orders");
      const woMap = new Map(wos.map((w) => [w.id, w]));
      rows = rows.map((j) => ({
        ...j,
        work_orders: woMap.get(j.work_order_id) ?? null,
      })) as any[];
    }

    // Apply sorting
    if (this.orderField) {
      const field = this.orderField;
      const asc = this.orderAsc;
      rows.sort((a, b) => {
        const va = a[field];
        const vb = b[field];
        if (va == null && vb == null) return 0;
        if (va == null) return asc ? -1 : 1;
        if (vb == null) return asc ? 1 : -1;
        if (va < vb) return asc ? -1 : 1;
        if (va > vb) return asc ? 1 : -1;
        return 0;
      });
    }

    // Apply limit
    if (this.limitCount != null) {
      rows = rows.slice(0, this.limitCount);
    }

    if (this.isSingle) {
      return { data: rows[0] ?? null, error: rows.length ? null : new Error("Record not found") };
    }
    if (this.isMaybeSingle) {
      return { data: rows[0] ?? null, error: null };
    }

    return { data: rows, error: null };
  }

  async insert(record: Partial<T> | Partial<T>[]) {
    const list = Array.isArray(record) ? record : [record];
    const current = localDB.getTable<T>(this.tableName);
    const createdItems: T[] = [];

    for (const item of list) {
      const fullItem = {
        id: (item as any).id || `${this.tableName.slice(0, 3)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        created_at: new Date().toISOString(),
        ...item,
      } as T;
      current.push(fullItem);
      createdItems.push(fullItem);
    }

    localDB.setTable(this.tableName, current);

    return {
      select: (_cols = "*") => ({
        single: async () => ({ data: createdItems[0], error: null }),
        maybeSingle: async () => ({ data: createdItems[0] ?? null, error: null }),
        then: (resolve: any) => resolve({ data: createdItems, error: null }),
      }),
      then: (resolve: any) => resolve({ data: createdItems, error: null }),
      data: createdItems,
      error: null,
    };
  }

  update(patch: Partial<T>) {
    return {
      eq: async (column: string, val: any) => {
        const rows = localDB.getTable<T>(this.tableName);
        let updatedCount = 0;
        const next = rows.map((r) => {
          if (r[column] === val) {
            updatedCount++;
            return { ...r, ...patch, updated_at: new Date().toISOString() };
          }
          return r;
        });
        localDB.setTable(this.tableName, next);
        return { data: next.filter((r) => r[column] === val), error: null };
      },
    };
  }

  delete() {
    return {
      eq: async (column: string, val: any) => {
        const rows = localDB.getTable<T>(this.tableName);
        const next = rows.filter((r) => r[column] !== val);
        localDB.setTable(this.tableName, next);
        return { data: null, error: null };
      },
    };
  }

  // Support then for await query directly
  then(resolve: (value: { data: any; error: any }) => void) {
    resolve(this.executeSelect());
  }
}

// Mock Supabase Auth
class LocalAuth {
  async getSession() {
    const user = localDB.getCurrentUser();
    if (!user) return { data: { session: null }, error: null };
    return {
      data: {
        session: {
          access_token: "local-token",
          user: {
            id: user.id,
            email: user.email,
            user_metadata: { full_name: user.full_name, role: user.role },
          },
        },
      },
      error: null,
    };
  }

  async getUser() {
    const user = localDB.getCurrentUser();
    if (!user) return { data: { user: null }, error: null };
    return {
      data: {
        user: {
          id: user.id,
          email: user.email,
          user_metadata: { full_name: user.full_name, role: user.role },
        },
      },
      error: null,
    };
  }

  async signInWithPassword({ email }: { email: string; password?: string }) {
    const users = localDB.getUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
      localDB.setCurrentUser(user);
      return { data: { user }, error: null };
    }
    return { data: { user: null }, error: new Error("Tài khoản không tồn tại trên hệ thống local.") };
  }

  async signUp({ email, options }: { email: string; password?: string; options?: any }) {
    const users = localDB.getUsers();
    const newUser: UserProfile = {
      id: `usr-${Date.now()}`,
      email,
      full_name: options?.data?.full_name || email.split("@")[0],
      employee_code: `EMP-${Math.floor(100 + Math.random() * 900)}`,
      role: (options?.data?.role as Role) || "operator",
    };
    users.push(newUser);
    localDB.setTable("users", users);
    localDB.setCurrentUser(newUser);
    return {
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          user_metadata: { full_name: newUser.full_name, role: newUser.role },
        },
        session: { access_token: "local-token" },
      },
      error: null,
    };
  }

  async signOut() {
    localDB.setCurrentUser(null);
    return { error: null };
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    const user = localDB.getCurrentUser();
    callback("SIGNED_IN", user ? { user } : null);
    return {
      data: {
        subscription: {
          unsubscribe: () => {},
        },
      },
    };
  }
}

class LocalSupabaseClient {
  auth = new LocalAuth();

  from(table: string) {
    return new LocalQueryBuilder(table);
  }
}

export const supabase = new LocalSupabaseClient();
export type { Database } from "./types";
