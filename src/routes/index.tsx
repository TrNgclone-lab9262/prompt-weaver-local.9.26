import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DYNAMO VIETNAM MC - MES — Plan vs Actual Production Control" },
      {
        name: "description",
        content:
          "Hệ thống MES cho nhà máy cơ khí chính xác: timeline sản xuất, Plan vs Actual, KPI, 進行リスト và quản lý lệnh sản xuất theo 3 vai trò.",
      },
      { property: "og:title", content: "DYNAMO VIETNAM MC - MES — Plan vs Actual Production Control" },
      {
        property: "og:description",
        content: "Timeline sản xuất, Plan vs Actual, KPI và quản lý lệnh sản xuất theo vai trò.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="mes-card w-full max-w-xl p-8 text-center">
        <p className="text-[11px] font-bold tracking-widest text-primary">DYNAMO VIETNAM MC</p>
        <h1 className="mt-2 text-2xl font-bold">MES — Plan vs Actual Production Control</h1>
        <p className="mt-3 text-xs text-muted-foreground">
          Timeline máy · Plan vs Actual · KPI · 進行リスト (Shinko Risuto) · Work Order · My Jobs ·
          Machine Status — phân quyền ADMIN / LEADER / OPERATOR.
        </p>
        <Link
          to="/auth"
          className="mt-6 inline-block rounded bg-primary px-6 py-2 text-sm font-bold text-primary-foreground"
        >
          Đăng nhập hệ thống
        </Link>
      </div>
    </div>
  );
}
