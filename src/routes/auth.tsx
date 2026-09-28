import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { localDB, DEFAULT_USERS, type UserProfile } from "@/lib/local-db";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Đăng nhập Local — DYNAMO VIETNAM MC - MES" },
      { name: "description", content: "Đăng nhập hệ thống DYNAMO VIETNAM MC - MES chạy offline." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    localDB.init();
    setUsers(localDB.getUsers());
  }, []);

  function selectUser(u: UserProfile) {
    localDB.setCurrentUser(u);
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="mes-card w-full max-w-md p-6 shadow-lg border border-border">
        <div className="mb-4 text-center">
          <p className="text-xs font-bold tracking-widest text-primary">DYNAMO VIETNAM MC</p>
          <h1 className="mt-1 text-xl font-bold">HỆ THỐNG MES NỘI BỘ (LOCAL)</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Hệ thống đang chạy 100% trên máy tính cá nhân. Hãy chọn tài khoản phân xưởng để vào làm việc ngay:
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {users.map((u) => {
            const roleBadge =
              u.role === "admin"
                ? "bg-destructive text-destructive-foreground"
                : u.role === "leader"
                ? "bg-warning text-foreground"
                : "bg-primary text-primary-foreground";

            return (
              <button
                key={u.id}
                onClick={() => selectUser(u)}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-left transition hover:border-primary hover:shadow-md"
              >
                <div>
                  <div className="font-semibold text-sm">{u.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {u.employee_code} · {u.email}
                  </div>
                </div>
                <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${roleBadge}`}>
                  {u.role}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 border-t border-border pt-4 text-center">
          <p className="text-[11px] text-muted-foreground">
            ✨ Cơ sở dữ liệu offline: Dữ liệu được lưu trữ trực tiếp trên trình duyệt của máy bạn. Không phụ thuộc mạng Internet hay Lovable Cloud.
          </p>
        </div>
      </div>
    </div>
  );
}
