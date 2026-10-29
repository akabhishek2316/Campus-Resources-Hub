'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile } from '@/lib/auth';
import { flash } from '@/lib/flash';
import { logAudit, notify } from '@/lib/audit';
import { uploadFiles } from '@/lib/storage';
import { checkDoc, roleLabel } from '@/lib/applications';

async function tellAdmins(admin: any, message: string) {
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  for (const a of admins ?? []) await notify(admin, a.id, message, '/admin');
}

// A signed-in student applies to become a resource owner. Same questions and checks as registration.
// Managers cannot apply: they join through an owner invitation.
export async function submitRoleApplication(fd: FormData) {
  const profile = await requireProfile(['student']);
  const back = '/apply';
  const g = (k: string) => String(fd.get(k) || '').trim();
  const ownerType = g('owner_type');
  const designation = g('designation'),
    employeeId = g('employee_id'),
    organizationName = g('organization_name');
  const ownerAddress = g('owner_address'),
    shareList = g('resource_share_list');
  const cv = fd.get('cv') as File | null;
  const idDoc = fd.get('id_doc') as File | null;

  if (g('role') !== 'owner')
    flash(
      back,
      'error',
      'Only resource-owner applications are accepted here. Managers must use an owner invitation.'
    );
  if (profile.application_status === 'pending' && profile.requested_role === 'owner')
    flash(back, 'error', 'You already have an owner request waiting for review.');
  if (!['college_staff', 'organization', 'individual'].includes(ownerType))
    flash(back, 'error', 'Choose an owner type.');
  if (ownerType === 'college_staff' && (!designation || !employeeId))
    flash(back, 'error', 'Job title and staff ID are required.');
  if (ownerType === 'organization' && (!organizationName || !ownerAddress))
    flash(back, 'error', 'Organisation name and address are required.');
  if (ownerType === 'individual' && (!ownerAddress || shareList.length < 5))
    flash(back, 'error', 'Address and a short list of what you want to share are required.');
  const proofError =
    ownerType === 'individual'
      ? null
      : checkDoc(
          cv,
          ownerType === 'college_staff' ? 'Appointment letter' : 'Organisation registration proof'
        );
  const idError = checkDoc(
    idDoc,
    ownerType === 'college_staff' ? 'Staff ID card' : 'Owner photo ID'
  );
  if (proofError || idError) flash(back, 'error', (proofError || idError)!);

  let cvPath: string | null = null,
    idPath: string | null = null;
  try {
    if (cv && cv.size > 0 && ownerType !== 'individual')
      [cvPath] = await uploadFiles(
        `applications/${profile.id}`,
        ownerType === 'college_staff' ? 'appointment-letter' : 'registration-proof',
        [cv]
      );
    [idPath] = await uploadFiles(
      `applications/${profile.id}`,
      ownerType === 'college_staff' ? 'staff-id' : 'owner-photo-id',
      [idDoc!]
    );
  } catch (e: any) {
    flash(back, 'error', e.message);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({
      requested_role: 'owner',
      application_status: 'pending',
      owner_type: ownerType,
      designation: designation || null,
      employee_id: employeeId || null,
      organization_name: organizationName || null,
      owner_address: ownerAddress || null,
      resource_share_list: shareList || null,
      application_note: shareList || null,
      cv_path: cvPath,
      id_doc_path: idPath,
      application_review_note: null,
      application_reviewed_at: null,
    })
    .eq('id', profile.id);
  if (error) flash(back, 'error', error.message);
  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: 'registration_submitted',
    entityType: 'user',
    entityId: profile.id,
    details: { requested_role: 'owner', owner_type: ownerType },
  });
  await tellAdmins(
    admin,
    `${profile.full_name} applied to become a ${roleLabel('owner', ownerType)}.`
  );
  flash('/resources', 'msg', 'Request sent. The admin will review your documents.');
}

// A student whose college ID was rejected (or never uploaded) sends it again.
export async function resubmitStudentId(fd: FormData) {
  const profile = await requireProfile(['student']);
  const back = '/apply';
  const collegeId = String(fd.get('college_id') || '').trim();
  const doc = fd.get('college_id_doc') as File | null;
  if (profile.verified) flash(back, 'msg', 'You are already verified.');
  if (profile.application_status === 'pending' && profile.requested_role === 'student')
    flash(back, 'error', 'Your college ID is already waiting for review.');
  if (!collegeId) flash(back, 'error', 'College ID number is required.');
  const err = checkDoc(doc, 'College ID card');
  if (err) flash(back, 'error', err);
  let path = '';
  try {
    [path] = await uploadFiles(`applications/${profile.id}`, 'college-id-card', [doc!]);
  } catch (e: any) {
    flash(back, 'error', e.message);
  }
  const admin = createAdminClient();
  await admin
    .from('profiles')
    .update({
      college_id: collegeId,
      college_id_doc_path: path,
      requested_role: 'student',
      application_status: 'pending',
      application_review_note: null,
      application_reviewed_at: null,
    })
    .eq('id', profile.id);
  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: 'registration_submitted',
    entityType: 'user',
    entityId: profile.id,
    details: { requested_role: 'student', resubmitted: true },
  });
  await tellAdmins(admin, `${profile.full_name} sent their college ID again for verification.`);
  flash('/resources', 'msg', 'College ID sent. The admin will review it.');
}
