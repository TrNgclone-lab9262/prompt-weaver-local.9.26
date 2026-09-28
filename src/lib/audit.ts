import { supabase } from "@/integrations/supabase/client";

export async function logAudit(
  action: string,
  entity: string,
  entityId?: string | null,
  detail?: Record<string, unknown>,
) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("audit_logs").insert({
    user_id: data.user.id,
    action,
    entity,
    entity_id: entityId ?? null,
    detail: detail ? JSON.parse(JSON.stringify(detail)) : null,
  });
}
