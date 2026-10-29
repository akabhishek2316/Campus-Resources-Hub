import { requireProfile } from '@/lib/auth';
import { resubmitStudentId, submitRoleApplication } from '@/app/actions/applications';
import { UploadForm } from '@/components/UploadForm';
import { OwnerFields } from '@/components/OwnerFields';
import { Flash, PageBanner } from '@/components/ui';

export default async function Apply({
  searchParams,
}: {
  searchParams: { error?: string; msg?: string };
}) {
  const profile = await requireProfile(['student']);
  const status = profile.application_status;
  const ownerPending = status === 'pending' && profile.requested_role === 'owner';
  const idPending = status === 'pending' && profile.requested_role === 'student';
  return (
    <div className="max-w-3xl">
      <PageBanner
        title="Become a resource owner"
        subtitle="Resource owners list and manage equipment or spaces. The admin reviews your documents first. Managers can only join through an invitation from an owner."
      />
      <Flash sp={searchParams} />

      {!profile.verified && (
        <section className="card mb-5 space-y-3">
          <h2>College ID verification</h2>
          {idPending ? (
            <p className="text-sm text-amber2">
              Your college ID is waiting for the admin. You will be notified of the decision.
            </p>
          ) : (
            <>
              {status === 'rejected' && (
                <p className="rounded-lg bg-rust-light px-3 py-2 text-sm text-rust">
                  Your last request was rejected. Reason:{' '}
                  {profile.application_review_note || 'not given'}. Send a clearer ID below.
                </p>
              )}
              <UploadForm
                action={resubmitStudentId}
                submitLabel="Send college ID to admin"
                className="space-y-3"
              >
                <div>
                  <label className="label" htmlFor="college_id">
                    College ID number
                  </label>
                  <input
                    id="college_id"
                    name="college_id"
                    defaultValue={profile.college_id ?? ''}
                    required
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="college_id_doc">
                    College ID card (photo or PDF, up to 3 MB)
                  </label>
                  <input
                    id="college_id_doc"
                    name="college_id_doc"
                    type="file"
                    accept=".pdf,image/*"
                    required
                    className="text-sm"
                  />
                </div>
              </UploadForm>
            </>
          )}
        </section>
      )}

      {ownerPending ? (
        <div className="card border-gold bg-gold-light/50 text-sm">
          Your request to become a <b>resource owner</b> is waiting for the admin. You will be
          notified of the decision.
        </div>
      ) : (
        <>
          {status === 'rejected' && profile.requested_role === 'owner' && (
            <div className="card mb-4 border-rust bg-rust-light text-sm text-rust">
              Your last owner request was rejected. Reason:{' '}
              {profile.application_review_note || 'not given'}. Fix the problem and apply again.
            </div>
          )}
          <UploadForm
            action={submitRoleApplication}
            submitLabel="Send owner request to admin"
            className="card space-y-4"
          >
            <OwnerFields />
          </UploadForm>
        </>
      )}
    </div>
  );
}
