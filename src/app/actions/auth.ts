'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { flash } from '@/lib/flash';
import { logAudit, notify } from '@/lib/audit';
import { uploadFiles } from '@/lib/storage';
import { checkDoc, roleLabel } from '@/lib/applications';

export async function signIn(fd: FormData) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(fd.get('email') || '').trim(),
    password: String(fd.get('password') || ''),
  });
  if (error)
    flash(
      '/login',
      'error',
      /banned/i.test(error.message)
        ? 'This account has been deactivated. Please contact the admin office.'
        : error.message
    );
  let inactive = false;
  try {
    const { data: p } = await createAdminClient()
      .from('profiles')
      .select('is_active')
      .eq('id', data.user!.id)
      .maybeSingle();
    inactive = p?.is_active === false;
  } catch {
    /* the page-level check still applies */
  }
  if (inactive) {
    await supabase.auth.signOut({ scope: 'local' });
    flash('/login', 'error', 'This account has been deactivated. Please contact the admin office.');
  }
  redirect('/resources');
}

export async function signUp(fd: FormData) {
  const email = String(fd.get('email') || '')
    .trim()
    .toLowerCase();
  const password = String(fd.get('password') || '');
  const fullName = String(fd.get('full_name') || '').trim();
  const department = String(fd.get('department') || '').trim();
  const role = String(fd.get('role') || 'student');
  const collegeId = String(fd.get('college_id') || '').trim();
  const ownerType = String(fd.get('owner_type') || '');
  const designation = String(fd.get('designation') || '').trim();
  const employeeId = String(fd.get('employee_id') || '').trim();
  const organizationName = String(fd.get('organization_name') || '').trim();
  const ownerAddress = String(fd.get('owner_address') || '').trim();
  const resourceShareList = String(fd.get('resource_share_list') || '').trim();
  const cv = fd.get('cv') as File | null;
  const idDoc = fd.get('id_doc') as File | null;
  const collegeIdDoc = fd.get('college_id_doc') as File | null;
  const isOwner = role === 'owner';

  if (!['student', 'owner'].includes(role))
    flash(
      '/signup',
      'error',
      'Public registration is available for students and resource owners only. Managers must use an owner invitation.'
    );
  if (!fullName || !email) flash('/signup', 'error', 'Name and email are required.');
  if (password.length < 8) flash('/signup', 'error', 'Password must be at least 8 characters.');
  if (!isOwner) {
    const domain = (process.env.ALLOWED_EMAIL_DOMAIN || '').trim().toLowerCase();
    if (domain && !email.endsWith('@' + domain))
      flash('/signup', 'error', `Students must use their college email address (@${domain}).`);
    if (!collegeId) flash('/signup', 'error', 'College ID number is required for students.');
    const collegeIdDocError = checkDoc(collegeIdDoc, 'College ID card');
    if (collegeIdDocError) flash('/signup', 'error', collegeIdDocError);
  } else {
    if (!['college_staff', 'organization', 'individual'].includes(ownerType))
      flash('/signup', 'error', 'Choose an owner type.');
    if (ownerType === 'college_staff' && (!designation || !employeeId))
      flash('/signup', 'error', 'Job title and staff ID are required.');
    if (ownerType === 'organization' && (!organizationName || !ownerAddress))
      flash('/signup', 'error', 'Organisation name and address are required.');
    if (ownerType === 'individual' && (!ownerAddress || resourceShareList.length < 5))
      flash(
        '/signup',
        'error',
        'Address and a short list of resources you want to share are required.'
      );
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
    if (proofError || idError) flash('/signup', 'error', (proofError || idError)!);
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, department, college_id: isOwner ? '' : collegeId } },
  });
  if (error) flash('/signup', 'error', error.message);
  const user = data.user;
  if (!user) flash('/signup', 'error', 'Could not create the account. Try again.');

  const admin = createAdminClient();
  let cvPath: string | null = null;
  let idPath: string | null = null;
  let collegeIdDocPath: string | null = null;
  let uploadFailed = false;
  try {
    if (!isOwner && collegeIdDoc && collegeIdDoc.size > 0) {
      [collegeIdDocPath] = await uploadFiles(`applications/${user!.id}`, 'college-id-card', [
        collegeIdDoc,
      ]);
    }
  } catch {
    uploadFailed = true;
  }
  if (isOwner) {
    try {
      if (cv && cv.size > 0)
        [cvPath] = await uploadFiles(
          `applications/${user!.id}`,
          ownerType === 'college_staff' ? 'appointment-letter' : 'registration-proof',
          [cv]
        );
      if (idDoc && idDoc.size > 0)
        [idPath] = await uploadFiles(
          `applications/${user!.id}`,
          ownerType === 'college_staff' ? 'staff-id' : 'owner-photo-id',
          [idDoc]
        );
    } catch {
      uploadFailed = true;
    }
  }

  if (!uploadFailed) {
    const { error: profileError } = await admin
      .from('profiles')
      .update({
        requested_role: role,
        application_status: 'pending',
        designation: designation || null,
        employee_id: employeeId || null,
        application_note: resourceShareList || null,
        owner_type: isOwner ? ownerType : null,
        organization_name: organizationName || null,
        owner_address: ownerAddress || null,
        resource_share_list: resourceShareList || null,
        cv_path: cvPath,
        id_doc_path: idPath,
        college_id_doc_path: collegeIdDocPath,
      })
      .eq('id', user!.id);
    if (profileError)
      flash(
        '/signup',
        'error',
        `Account created but profile setup failed: ${profileError.message}. Contact support before retrying.`
      );
    await logAudit(admin, {
      actorId: user!.id,
      actorName: fullName || email,
      action: 'registration_submitted',
      entityType: 'user',
      entityId: user!.id,
      details: { requested_role: role, owner_type: ownerType || null },
    });
    const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
    for (const a of admins ?? [])
      await notify(
        admin,
        a.id,
        `New registration request: ${fullName || email} as ${roleLabel(role, ownerType)}.`,
        '/admin'
      );
  }

  if (uploadFailed)
    flash(
      '/login',
      'error',
      'Your account was created but a document could not be uploaded. Contact the admin to complete verification.'
    );
  if (!data.session) flash('/login', 'msg', 'Account created. Confirm your email, then sign in.');
  redirect(
    '/resources?msg=' +
      encodeURIComponent(
        isOwner
          ? 'Owner application submitted. The admin will review your owner type and documents before enabling resource-owner access.'
          : 'Welcome. The admin office will verify your college ID, and then you can book.'
      )
  );
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut({ scope: 'local' }); // only this browser, never the person's other devices
  redirect('/login');
}
