import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth';
import { PublicHeader } from '@/components/PublicHeader';
import { Footer } from '@/components/Footer';
import { Icon, ICONS } from '@/components/Crest';
import { COLLEGE } from '@/lib/brand';

const STEPS = [
  [
    'Owner lists it',
    'A lab head lists equipment or a room with opening hours, rules and the training needed.',
  ],
  [
    'Student finds it',
    'Search, filter or describe what you need. Each card tells you if you can book it right now.',
  ],
  [
    'System checks',
    'Training, ID verification, opening hours, clashes and fair-use limits are tested instantly.',
  ],
  [
    'A person decides',
    'The owner approves, rejects or waitlists, and always writes the reason you will read.',
  ],
  [
    'Handover with proof',
    'You record the condition with photos, show a one-time code, and staff check you in.',
  ],
  [
    'Return and history',
    'Return with photos. Any delay or damage is reviewed by a human. Both sides keep the full record.',
  ],
];

const FEATURES = [
  {
    icon: ICONS.search,
    color: 'bg-indigo-100 text-indigo-700',
    t: 'Smart discovery',
    d: 'Search by words like "I need to print an enclosure" and see what you are eligible for.',
  },
  {
    icon: ICONS.shield,
    color: 'bg-teal-100 text-teal-700',
    t: 'Eligibility checks',
    d: 'Verified college ID and approved training certificates, checked on every request.',
  },
  {
    icon: ICONS.scale,
    color: 'bg-violet-100 text-violet-700',
    t: 'Fair allocation',
    d: 'Weekly caps, one booking a day on busy items and a visible priority score.',
  },
  {
    icon: ICONS.key,
    color: 'bg-amber-100 text-amber-700',
    t: 'OTP handover',
    d: 'A one-time code proves the right person collected the right item.',
  },
  {
    icon: ICONS.camera,
    color: 'bg-rose-100 text-rose-700',
    t: 'Before and after photos',
    d: 'Condition is recorded on both sides, so damage disputes have evidence.',
  },
  {
    icon: ICONS.bell,
    color: 'bg-sky-100 text-sky-700',
    t: 'Timely notifications',
    d: 'Approvals, reminders, waitlist moves and overdue alerts, as they happen.',
  },
  {
    icon: ICONS.list,
    color: 'bg-orange-100 text-orange-700',
    t: 'Incident handling',
    d: 'Late returns and damage are flagged automatically and resolved by staff.',
  },
  {
    icon: ICONS.log,
    color: 'bg-emerald-100 text-emerald-700',
    t: 'Audit trail',
    d: 'Every approval, check-in and decision is recorded and cannot be edited.',
  },
];

const ROLES = [
  [
    'Students',
    'border-indigo-500',
    [
      'Find equipment you could not afford',
      'See exactly why a request was approved or waitlisted',
      'Collect with an OTP and keep your own history',
    ],
  ],
  [
    'Lab owners',
    'border-teal-500',
    [
      'List resources with rules and requirements',
      'Approve, reject or waitlist with a reason',
      'Stay in control of your property',
    ],
  ],
  [
    'Technicians',
    'border-orange-500',
    [
      'Run check-in and return confirmation',
      'Compare before and after photos',
      'Review and resolve incidents',
    ],
  ],
  [
    'Admins',
    'border-rose-500',
    [
      'Verify college IDs and training proofs',
      'Manage roles and owners',
      'Read the audit log and usage statistics',
    ],
  ],
] as const;

export default async function Home() {
  if (await getProfile()) redirect('/resources');
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <section className="relative overflow-hidden bg-gradient-to-br from-bench-dark via-bench to-[#2D6CC0] text-white">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gold/20" />
        <div className="absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-white/10" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="inline-block rounded-full bg-white/15 px-3 py-1 text-sm">{COLLEGE}</p>
            <h1 className="mt-5 !text-4xl !leading-tight !text-white sm:!text-5xl">
              Need equipment or a room? Book it here. Own something idle? Share it here.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-blue-100">
              ResourcesHub connects people who own cameras, 3D printers, labs and rooms with
              verified students who need them. Every request gets a clear yes or no, with the
              reason.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="btn btn-gold">
                Sign in to book
              </Link>
              <Link
                href="/signup"
                className="btn border-white/40 bg-transparent text-white hover:bg-white/10"
              >
                Register
              </Link>
              <a
                href="#how"
                className="btn border-transparent bg-transparent text-blue-100 hover:bg-white/10"
              >
                See how it works
              </a>
            </div>
          </div>

          <div className="space-y-4" aria-label="Example of what you will see">
            <div className="rounded-xl bg-white p-5 text-ink shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">Prusa 3D printer</p>
                  <p className="text-sm text-ink-soft">Tue 11:00 to 13:00, Makerspace</p>
                </div>
                <span className="badge bg-leaf-light text-leaf">Approved</span>
              </div>
              <p className="mt-3 text-sm text-ink-soft">
                Reason from the owner: final-year project with a submission deadline.
              </p>
              <div className="mt-3 flex items-center justify-between rounded-lg bg-bench-light px-4 py-3">
                <span className="text-sm text-bench-dark">Your check-in code</span>
                <span className="font-mono text-2xl font-medium tracking-[0.25em] text-bench-dark">
                  482915
                </span>
              </div>
            </div>
            <div className="ml-6 rounded-xl bg-white p-5 text-ink shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">GPU workstation</p>
                  <p className="text-sm text-ink-soft">Wed 15:00 to 17:00, AI Lab</p>
                </div>
                <span className="badge bg-steel-light text-steel">Waitlisted</span>
              </div>
              <p className="mt-3 text-sm text-ink-soft">
                You are #2 of 3. Priority 38 = research +40, waiting +2, recent use -4.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            [
              'The problem',
              'Labs, workshops and rooms are idle for long stretches while students and early teams cannot afford to rent or buy the same things.',
            ],
            [
              'Why a calendar is not enough',
              'Shared equipment needs trust: who is qualified, who has it, what condition it was in, and who is accountable if it breaks.',
            ],
            [
              'What ResourcesHub does',
              'It adds eligibility checks, fair turns, human approval, handover proof and an audit trail on top of booking.',
            ],
          ].map(([t, d]) => (
            <div key={t} className="card">
              <h2 className="text-bench-dark">{t}</h2>
              <p className="mt-2 text-sm text-ink-soft">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="scroll-mt-20 bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="font-serif text-3xl font-semibold text-bench-dark">How it works</h2>
          <p className="mt-2 max-w-2xl text-ink-soft">
            One complete journey, from listing to a shared record.
          </p>
          <ol className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="card flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bench font-semibold text-white">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{t}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-14 sm:px-6">
        <h2 className="font-serif text-3xl font-semibold text-bench-dark">What you get</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.t} className="card">
              <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${f.color}`}>
                <Icon paths={f.icon} />
              </span>
              <h3 className="mt-3 font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm text-ink-soft">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="roles" className="scroll-mt-20 bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="font-serif text-3xl font-semibold text-bench-dark">Who it is for</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map(([name, border, items]) => (
              <div key={name} className={`card border-t-4 ${border}`}>
                <h3 className="font-semibold">{name}</h3>
                <ul className="mt-3 space-y-2 text-sm text-ink-soft">
                  {items.map((x) => (
                    <li key={x} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="fair"
        className="mx-auto grid w-full max-w-7xl scroll-mt-20 gap-6 px-4 py-14 sm:px-6 lg:grid-cols-2"
      >
        <div className="card">
          <h2 className="font-serif text-2xl font-semibold text-bench-dark">Fair by design</h2>
          <p className="mt-2 text-sm text-ink-soft">
            When demand is higher than supply, nobody can hoard a slot. The rule is shown to
            everyone:
          </p>
          <p className="mt-4 rounded-lg bg-bench-light p-4 text-sm text-bench-dark">
            Priority = purpose (course project 50, research 40, personal 20) + days waiting (up to
            +10) - recent use of that resource (up to -30)
          </p>
          <p className="mt-3 text-sm text-ink-soft">
            Plus weekly hour caps, limits on active bookings, and one booking a day on high-demand
            items.
          </p>
        </div>
        <div className="card">
          <h2 className="font-serif text-2xl font-semibold text-bench-dark">
            Safe and accountable
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            {[
              'Owners stay in control: no approval without a person',
              'Penalties and suspensions are never automatic',
              'Photos and certificates are private and visible only to people involved',
              'The audit log is append-only: the database refuses edits and deletes',
              'AI only suggests and summarises; it never decides',
            ].map((x) => (
              <li key={x} className="flex gap-2">
                <span className="mt-0.5 text-leaf">
                  <Icon paths={ICONS.check} className="h-4 w-4" />
                </span>
                {x}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-gradient-to-r from-bench-dark to-bench py-12 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-5 px-4 sm:px-6 md:flex-row md:items-center">
          <div>
            <h2 className="font-serif text-2xl font-semibold">
              Ready to put idle equipment to work?
            </h2>
            <p className="mt-1 text-blue-100">Sign in, or create your account in a few minutes.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/login" className="btn btn-gold">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="btn border-white/40 bg-transparent text-white hover:bg-white/10"
            >
              Register
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
        <div className="card">
          <h2 className="text-bench-dark">Demo accounts for judges</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Password for all: <code className="font-mono">Demo@1234</code>
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <tbody>
                {[
                  [
                    'student1@demo.edu',
                    'Verified student without training (sees eligibility failures)',
                  ],
                  [
                    'student2@demo.edu',
                    'Verified student with 3D printer and electronics training',
                  ],
                  ['student3@demo.edu', 'Student waiting for verification'],
                  ['owner@demo.edu', 'Lab owner: lists resources, approves requests'],
                  ['manager@demo.edu', 'Technician: check-in, returns, incidents'],
                  ['admin@demo.edu', 'Admin: verification, audit log, statistics'],
                ].map(([e, d]) => (
                  <tr key={e} className="border-t border-paper-line">
                    <td className="td font-mono text-xs">{e}</td>
                    <td className="td text-ink-soft">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
