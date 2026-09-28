import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle } from "@/components/AppShell";
import { fmtTime } from "@/lib/mes";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "Audit Log — DYNAMO VIETNAM MC - MES" },
      { name: "description", content: "Nhật ký thao tác quan trọng trên hệ thống MES: ai làm gì, lúc nào." },
      { property: "og:title", content: "Audit Log — DYNAMO VIETNAM MC - MES" },
      { property: "og:description", content: "Nhật ký thao tác hệ thống MES." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Audit,
});

function Audit() {
  const { data } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => {
      const [logs, profiles] = await Promise.all([
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("profiles").select("id, full_name"),
      ]);
      if (logs.error) throw logs.error;
      if (profiles.error) throw profiles.error;
      return { logs: logs.data, profiles: profiles.data };
    },
  });

  if (!data) return <p className="text-xs">Đang tải…</p>;

  return (
    <>
      <PageTitle title="AUDIT LOG" sub="200 thao tác gần nhất" />
      <div className="mes-card min-h-0 flex-1 overflow-auto">
        <table className="mes-table">
          <thead>
            <tr>
              <th>THỜI GIAN</th>
              <th>NGƯỜI THỰC HIỆN</th>
              <th>HÀNH ĐỘNG</th>
              <th>ĐỐI TƯỢNG</th>
              <th>CHI TIẾT</th>
            </tr>
          </thead>
          <tbody>
            {data.logs.map((l) => (
              <tr key={l.id}>
                <td>{fmtTime(l.created_at)}</td>
                <td>{data.profiles.find((p) => p.id === l.user_id)?.full_name || l.user_id?.slice(0, 8)}</td>
                <td>{l.action}</td>
                <td>
                  {l.entity} {l.entity_id?.slice(0, 8)}
                </td>
                <td className="max-w-[400px] truncate">{l.detail ? JSON.stringify(l.detail) : ""}</td>
              </tr>
            ))}
            {data.logs.length === 0 && (
              <tr>
                <td colSpan={5}>Chưa có thao tác nào được ghi nhận.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
