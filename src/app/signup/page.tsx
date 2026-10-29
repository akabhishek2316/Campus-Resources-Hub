import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth';
import { signUp } from '@/app/actions/auth';
import { SignupForm } from '@/components/SignupForm';
import { AuthShell } from '@/components/AuthShell';
import { Flash } from '@/components/ui';

export default async function Signup({
  searchParams,
}: {
  searchParams: { error?: string; msg?: string };
}) {
  if (await getProfile()) redirect('/resources');
  return (
    <AuthShell
      title="Create your account"
      subtitle="Students are verified with their college ID. Resource owners upload job documents for admin approval. Managers join only through an owner invitation."
      points={[
        'Choose your role: student or resource owner',
        'Students: college email and college ID',
        'Owners: choose College staff, Organisation/business or Individual and upload the matching proof',
      ]}
    >
      <Flash sp={searchParams} />
      <SignupForm action={signUp} domain={process.env.ALLOWED_EMAIL_DOMAIN} />
      <p className="mt-4 text-sm text-ink-soft">
        Already registered?{' '}
        <Link href="/login" className="font-medium text-bench underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
