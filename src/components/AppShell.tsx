import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useAuth";
import type { Role } from "@/lib/mes";

type NavItem = { to: string; label: string; roles: Role[] };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "📊 DASHBOARD", roles: ["admin", "leader", "operator"] },
  { to: "/timeline", label: "📅 TIMELINE", roles: ["admin", "leader", "operator"] },
  { to: "/shinko", label: "📋 進行リスト", roles: ["admin", "leader", "operator"] },
  { to: "/work-orders", label: "🗂 WORK ORDERS", roles: ["admin", "leader"] },
  { to: "/my-jobs", label: "🛠 MY JOBS", roles: ["admin", "leader", "operator"] },
  { to: "/machines", label: "⚙️ MACHINES", roles: ["admin", "leader", "operator"] },
  { to: "/import", label: "⬆️ IMPORT CSV", roles: ["admin", "leader"] },
  { to: "/audit", label: "🧾 AUDIT LOG", roles: ["admin", "leader"] },
];

function Clock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString("ja-JP", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="rounded-md border-2 border-primary-foreground bg-foreground px-3 py-1 font-mono text-base font-bold text-run">
      {now || "--:--:--"}
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { role, session } = useRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const items = NAV.filter((item) => !role || item.roles.includes(role));

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 bg-primary px-3 py-1.5 text-primary-foreground">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-2 text-sm font-bold">DYNAMO VIETNAM MC - MES</span>
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded bg-card px-3 py-1 text-[11px] font-bold text-primary"
              activeProps={{ className: "rounded px-3 py-1 text-[11px] font-bold bg-warning text-foreground border border-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase">
            {session?.user.email} · {role ?? "..."}
          </span>
          <button onClick={signOut} className="rounded bg-card px-3 py-1 text-[11px] font-bold text-primary">
            LOGOUT
          </button>
          <Clock />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col gap-2 p-2">{children}</main>
    </div>
  );
}

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <h1 className="text-sm font-bold">{title}</h1>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}
