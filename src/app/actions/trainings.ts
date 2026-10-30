'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile } from '@/lib/auth';
import { flash } from '@/lib/flash';
import { logAudit, notify } from '@/lib/audit';

// Owner: "I want to share this item, and users need this training first. Please add it."
export async function requestTraining(fd: FormData) {
  const profile = await requireProfile(['owner']);
  const back = '/staff/trainings';
  const name = String(fd.get('name') || '').trim();
  const reason = String(fd.get('reason') || '').trim();
  if (name.length < 3) flash(back, 'error', 'Training name is too short.');
  if (reason.length < 10)
    flash(
      back,
      'error',
      'Say which item it is for and why users need it (at least 10 characters).'
    );
  const admin = createAdminClient();
  const { data: dup } = await admin
    .from('training_requests')
    .select('id')
    .eq('requested_by', profile.id)
    .eq('status', 'pending')
    .ilike('name', name)
    .maybeSingle();
  if (dup) flash(back, 'error', 'You already have a pending request with this name.');
  const { data: r, error } = await admin
    .from('training_requests')
    .insert({ requested_by: profile.id, name, reason })
    .select('id')
    .single();
  if (error || !r) flash(back, 'error', error?.message || 'Could not send the request.');
  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: 'training_requested',
    entityType: 'training_request',
    entityId: r!.id,
    details: { name, reason },
  });
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  for (const a of admins ?? [])
    await notify(admin, a.id, `${profile.full_name} requested a new training: ${name}.`, '/admin');
  flash(back, 'msg', 'Request sent. The admin will review it and you will be notified.');
}

// Admin: approve (creates the training, or reuses one with the same name) or reject with a reason.
export async function reviewTrainingRequest(fd: FormData) {
  const profile = await requireProfile(['admin']);
  const id = String(fd.get('id'));
  const approve = fd.get('decision') === 'approve';
  const note = String(fd.get('note') || '').trim();
  const finalName = String(fd.get('name') || '').trim();
  if (!approve && note.length < 5)
    flash(
      '/admin',
      'error',
      'Give a short reason when rejecting, so the owner knows what to change.'
    );
  const admin = createAdminClient();
  const { data: req } = await admin.from('training_requests').select('*').eq('id', id).single();
  if (!req || req.status !== 'pending')
    flash('/admin', 'error', 'This request was already reviewed.');

  let trainingId: string | null = null;
  if (approve) {
    const name = finalName.length >= 3 ? finalName : req.name;
    const { data: existing } = await admin
      .from('trainings')
      .select('id')
      .ilike('name', name)
      .maybeSingle();
    if (existing) trainingId = existing.id;
    else {
      const { data: t, error } = await admin
        .from('trainings')
        .insert({ name })
        .select('id')
        .single();
      if (error || !t) flash('/admin', 'error', error?.message || 'Could not create the training.');
      trainingId = t!.id;
      await logAudit(admin, {
        actorId: profile.id,
        actorName: profile.full_name,
        action: 'training_added',
        entityType: 'training',
        entityId: trainingId!,
        details: { name, from_request: id },
      });
    }
  }
  await admin
    .from('training_requests')
    .update({
      status: approve ? 'approved' : 'rejected',
      review_note: note || null,
      training_id: trainingId,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id);
  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: approve ? 'training_request_approved' : 'training_request_rejected',
    entityType: 'training_request',
    entityId: id,
    details: { name: req.name, note },
  });
  await notify(
    admin,
    req.requested_by,
    approve
      ? `Your training request "${req.name}" was approved. You can now tick it as required when you list a resource.${note ? ' Note: ' + note : ''}`
      : `Your training request "${req.name}" was rejected. Reason: ${note}`,
    approve ? '/staff/resources/new' : '/staff/trainings'
  );
  flash(
    '/admin',
    'msg',
    approve
      ? 'Training added and the owner was told.'
      : 'Request rejected and the owner was told why.'
  );
}
