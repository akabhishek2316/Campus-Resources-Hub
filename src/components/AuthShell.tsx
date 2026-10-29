import Link from 'next/link';
import { Crest } from './Crest';
import { CELL, COLLEGE } from '@/lib/brand';

export function AuthShell({
  title,
  subtitle,
  children,
  points,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  points?: string[];
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-bench-dark via-bench to-[#2D6CC0] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gold/20" />
        <div className="absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-white/10" />
        <Link href="/" className="relative flex items-center gap-3">
          <Crest size={52} />
          <div>
            <p className="font-serif text-2xl font-semibold leading-tight">{COLLEGE}</p>
            <p className="text-sm text-blue-200">{CELL}</p>
          </div>
        </Link>
        <div className="relative max-w-md">
          <h2 className="font-serif text-4xl font-semibold leading-tight">
            Share what the campus already owns.
          </h2>
          <ul className="mt-6 space-y-3 text-blue-100">
            {(
              points ?? [
                'Book labs, tools, cameras and rooms from every department',
                'Clear rules, fair turns and a reason for every decision',
                'Every handover photographed and logged for both sides',
              ]
            ).map((p) => (
              <li key={p} className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gold" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-blue-200">Prototype with fictional demo data.</p>
      </aside>

      <section className="flex flex-col bg-paper">
        <div className="flex items-center gap-3 border-b-4 border-gold bg-bench-dark px-4 py-3 text-white lg:hidden">
          <Link href="/" className="flex items-center gap-2.5">
            <Crest size={30} />
            <span className="font-serif text-lg font-semibold">{COLLEGE}</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <Link href="/" className="text-sm text-ink-soft hover:text-ink">
              Back to home
            </Link>
            <h1 className="mt-3">{title}</h1>
            <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>
            <div className="mt-5">{children}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
