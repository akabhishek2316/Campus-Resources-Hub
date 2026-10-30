'use server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, canManage } from '@/lib/auth';
import { flash } from '@/lib/flash';
import { logAudit, notify } from '@/lib/audit';
import { uploadFiles } from '@/lib/storage';

export async function createResource(fd: FormData) {
  const profile = await requireProfile(['owner', 'admin']);
  const back = '/staff/resources/new';
  if (profile.role === 'owner' && !profile.verified)
    flash(
      back,
      'error',
      'Your owner account must be verified by an admin before you can list resources.'
    );
  const name = String(fd.get('name') || '').trim();
  const category = String(fd.get('category') || '').trim();
  const location = String(fd.get('location') || '').trim();
  const days = fd.getAll('days').map(Number);
  const startHour = Number(fd.get('start_hour'));
  const endHour = Number(fd.get('end_hour'));
  if (!name || !category || !location)
    flash(back, 'error', 'Name, category and location are required.');
  if (!days.length) flash(back, 'error', 'Choose at least one available weekday.');
  if (!(endHour > startHour)) flash(back, 'error', 'Closing hour must be later than opening hour.');

  const admin = createAdminClient();
  const managerId = String(fd.get('manager_id') || '') || null;
  if (managerId && profile.role === 'owner') {
    const { data: link } = await admin
      .from('owner_managers')
      .select('id')
      .eq('owner_id', profile.id)
      .eq('manager_id', managerId)
      .is('revoked_at', null)
      .maybeSingle();
    if (!link)
      flash(
        back,
        'error',
        'Choose a manager who has an active invitation accepted for your account.'
      );
  }
  const { data: r, error } = await admin
    .from('resources')
    .insert({
      owner_id: profile.id,
      manager_id: managerId,
      name,
      category,
      location,
      description: String(fd.get('description') || ''),
      rules: String(fd.get('rules') || ''),
      image_url: String(fd.get('image_url') || '') || null,
      requires_approval: fd.get('requires_approval') === 'on',
      high_demand: fd.get('high_demand') === 'on',
      max_hours_per_booking: Number(fd.get('max_hours') || 3),
      weekly_cap_hours: Number(fd.get('weekly_cap') || 8),
      max_active_bookings: Number(fd.get('max_active') || 2),
      deposit_note: String(fd.get('deposit_note') || '') || null,
    })
    .select('id')
    .single();
  if (error || !r) flash(back, 'error', error?.message || 'Could not save the resource.');

  await admin
    .from('availability_windows')
    .insert(
      days.map((d) => ({
        resource_id: r!.id,
        weekday: d,
        start_hour: startHour,
        end_hour: endHour,
      }))
    );
  const trainings = fd.getAll('trainings').map(String);
  if (trainings.length)
    await admin
      .from('resource_requirements')
      .insert(trainings.map((t) => ({ resource_id: r!.id, training_id: t })));
  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: 'resource_listed',
    entityType: 'resource',
    entityId: r!.id,
    details: { name },
  });
  redirect(
    `/resources/${r!.id}?msg=` + encodeURIComponent('Resource listed. Students can now find it.')
  );
}

export async function toggleResource(fd: FormData) {
  const profile = await requireProfile(['owner', 'admin']);
  const id = String(fd.get('id'));
  const admin = createAdminClient();
  const { data: r } = await admin.from('resources').select('*').eq('id', id).single();
  if (!r || !canManage(profile, r))
    flash('/staff/resources', 'error', 'You do not manage this resource.');
  await admin.from('resources').update({ active: !r.active }).eq('id', id);
  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: r.active ? 'resource_deactivated' : 'resource_activated',
    entityType: 'resource',
    entityId: id,
    details: { name: r.name },
  });
  flash(
    '/staff/resources',
    'msg',
    r.active ? 'Resource hidden from students.' : 'Resource is visible again.'
  );
}

export async function uploadCredential(fd: FormData) {
  const profile = await requireProfile();
  const trainingId = String(fd.get('training_id'));
  const file = fd.get('proof') as File | null;
  if (!file || file.size === 0)
    flash('/credentials', 'error', 'Choose a photo or PDF of your certificate.');
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('user_credentials')
    .select('status')
    .eq('user_id', profile.id)
    .eq('training_id', trainingId)
    .maybeSingle();
  if (existing?.status === 'approved')
    flash('/credentials', 'msg', 'This training is already approved.');
  let paths: string[] = [];
  try {
    paths = await uploadFiles(`credentials/${profile.id}`, trainingId.slice(0, 8), [file!]);
  } catch (e: any) {
    flash('/credentials', 'error', e.message);
  }
  await admin
    .from('user_credentials')
    .upsert(
      {
        user_id: profile.id,
        training_id: trainingId,
        proof_path: paths[0],
        status: 'pending',
        review_note: null,
        reviewed_by: null,
        reviewed_at: null,
      },
      { onConflict: 'user_id,training_id' }
    );
  const { data: t } = await admin.from('trainings').select('name').eq('id', trainingId).single();
  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: 'credential_uploaded',
    entityType: 'credential',
    entityId: trainingId,
    details: { training: t?.name },
  });
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  for (const a of admins ?? [])
    await notify(admin, a.id, `${profile.full_name} uploaded proof for ${t?.name}.`, '/admin');
  flash('/credentials', 'msg', 'Proof uploaded. An admin will review it.');
}
