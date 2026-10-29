import type { SupabaseClient } from '@supabase/supabase-js';

export async function logAudit(
  admin: SupabaseClient,
  e: {
    actorId?: string | null;
    actorName?: string;
    action: string;
    entityType: string;
    entityId?: string;
    bookingId?: string | null;
    details?: Record<string, any>;
  }
) {
  await admin.from('audit_log').insert({
    actor_id: e.actorId ?? null,
    actor_name: e.actorName ?? 'System',
    action: e.action,
    entity_type: e.entityType,
    entity_id: e.entityId ?? null,
    booking_id: e.bookingId ?? null,
    details: e.details ?? {},
  });
}

export async function notify(
  admin: SupabaseClient,
  userId: string | null | undefined,
  message: string,
  link?: string
) {
  if (!userId) return;
  await admin.from('notifications').insert({ user_id: userId, message, link: link ?? null });
}
