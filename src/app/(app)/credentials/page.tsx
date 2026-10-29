import { PageBanner } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { uploadCredential } from '@/app/actions/resources';
import { UploadForm } from '@/components/UploadForm';
import { Flash, StatusBadge } from '@/components/ui';

export default async function Credentials({
  searchParams,
}: {
  searchParams: { error?: string; msg?: string };
}) {
  const profile = await requireProfile();
  const supabase = createClient();
  const [{ data: trainings }, { data: creds }] = await Promise.all([
    supabase.from('trainings').select('*').order('name'),
    supabase.from('user_credentials').select('*').eq('user_id', profile.id),
  ]);
  const byTraining = new Map((creds ?? []).map((c: any) => [c.training_id, c]));
  return (
    <div className="max-w-3xl">
      <PageBanner
        title="My training and verification"
        subtitle="Upload a photo or PDF of your certificate. An admin reviews it, and you are told the outcome. Proofs are private and only admins can open them."
      />
      <div className="mt-4">
        <Flash sp={searchParams} />
      </div>
      <div className="card mb-4 flex items-center justify-between">
        <div>
          <p className="font-medium">College ID</p>
          <p className="text-sm text-ink-soft">
            {profile.college_id ? `ID ${profile.college_id}` : 'No ID number on file'}
          </p>
        </div>
        <span
          className={`badge ${profile.verified ? 'bg-leaf-light text-leaf' : 'bg-amber2-light text-amber2'}`}
        >
          {profile.verified ? 'Verified' : 'Waiting for admin'}
        </span>
      </div>
      <div className="space-y-3">
        {(trainings ?? []).map((t: any) => {
          const c: any = byTraining.get(t.id);
          return (
            <div key={t.id} className="card">
              <div className="flex items-center justify-between">
                <h2 className="text-base">{t.name}</h2>
                {c ? (
                  <StatusBadge status={c.status} />
                ) : (
                  <span className="badge bg-paper text-ink-soft border border-paper-line">
                    Not submitted
                  </span>
                )}
              </div>
              {c?.review_note && (
                <p className="mt-2 text-sm text-ink-soft">Reviewer note: {c.review_note}</p>
              )}
              {(!c || c.status === 'rejected') && (
                <UploadForm
                  action={uploadCredential}
                  submitLabel="Upload proof"
                  className="mt-3 flex flex-wrap items-end gap-3"
                >
                  <input type="hidden" name="training_id" value={t.id} />
                  <div>
                    <label className="label" htmlFor={`p-${t.id}`}>
                      Certificate (photo or PDF)
                    </label>
                    <input
                      id={`p-${t.id}`}
                      name="proof"
                      type="file"
                      accept="image/*,application/pdf"
                      required
                      className="text-sm"
                    />
                  </div>
                </UploadForm>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
