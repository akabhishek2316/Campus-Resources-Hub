'use server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile } from '@/lib/auth';

export async function markAllRead() {
  const profile = await requireProfile();
  await createAdminClient()
    .from('notifications')
    .update({ read: true })
    .eq('user_id', profile.id)
    .eq('read', false);
  revalidatePath('/notifications');
}
