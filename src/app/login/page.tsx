import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth';
import { signIn } from '@/app/actions/auth';
import { SubmitButton } from '@/components/SubmitButton';
import { AuthShell } from '@/components/AuthShell';
import { Flash } from '@/components/ui';
import { COLLEGE_SHORT } from '@/lib/brand';

export default async function Login({
  searchParams,
}: {
  searchParams: { error?: string; msg?: string };
}) {
  if (await getProfile()) redirect('/resources');
  return (
    <AuthShell
      title="Sign in"
      subtitle={`Use your ${COLLEGE_SHORT} email to book labs, tools and rooms.`}
    >
      <Flash sp={searchParams} />
      <form action={signIn} className="card space-y-4">
        <div>
          <label className="label" htmlFor="email">
            College email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="input"
          />
        </div>
        <SubmitButton className="btn btn-primary w-full">Sign in</SubmitButton>
      </form>
      <p className="mt-4 text-sm text-ink-soft">
        New student?{' '}
        <Link href="/signup" className="font-medium text-bench underline">
          Register here
        </Link>
      </p>
      <details className="card mt-5 text-sm">
        <summary className="cursor-pointer font-medium text-bench">
          Demo accounts for judges
        </summary>
        <p className="mt-2 text-ink-soft">
          Password for all: <code className="font-mono">Demo@1234</code>
        </p>
        <ul className="mt-2 space-y-1 font-mono text-xs">
          {[
            'student1@demo.edu',
            'student2@demo.edu',
            'student3@demo.edu',
            'owner@demo.edu',
            'manager@demo.edu',
            'admin@demo.edu',
          ].map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </details>
    </AuthShell>
  );
}
