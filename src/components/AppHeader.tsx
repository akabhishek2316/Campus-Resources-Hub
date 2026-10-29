'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Crest, Icon, ICONS } from './Crest';
import { SubmitButton } from './SubmitButton';

type NavLink = { href: string; label: string };

export function AppHeader({
  links,
  unread,
  name,
  role,
  short,
  signOutAction,
}: {
  links: NavLink[];
  unread: number;
  name: string;
  role: string;
  short: string;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // The clicked link lights up immediately; it stays lit until the new page has actually arrived.
  const [clicked, setClicked] = useState<string | null>(null);
  useEffect(() => {
    setOpen(false);
    setClicked(null);
  }, [pathname]);
  const current = clicked ?? pathname;
  const active = (href: string) =>
    current === href || (href !== '/admin' && current.startsWith(href + '/'));
  const loading = (href: string) => clicked !== null && clicked !== pathname && active(href);
  const go = (href: string) => () => {
    if (href !== pathname) setClicked(href);
  };
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const linkCls = (a: boolean) =>
    `rounded-md px-3 py-2 text-sm font-medium transition-colors ${a ? 'bg-white/15 text-white shadow-[inset_0_-3px_0_#E8A317]' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`;

  return (
    <header className="sticky top-0 z-40 border-b-4 border-gold bg-bench-dark text-white shadow-md">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <Link
          href="/resources"
          onClick={go('/resources')}
          className="flex shrink-0 items-center gap-2.5"
        >
          <Crest size={30} />
          <span className="leading-tight">
            <span className="block font-serif text-lg font-semibold">{short} ResourcesHub</span>
            <span className="hidden text-[11px] text-blue-200 sm:block">
              Equipment and Spaces Sharing Cell
            </span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 xl:flex" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={go(l.href)}
              className={`${linkCls(active(l.href))} inline-flex items-center gap-1.5`}
              aria-current={active(l.href) ? 'page' : undefined}
            >
              {l.label}
              {loading(l.href) && (
                <span
                  className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-gold"
                  aria-hidden="true"
                />
              )}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-3 xl:flex">
          <Link
            href="/notifications"
            onClick={go('/notifications')}
            className={`relative rounded-md p-2 ${active('/notifications') ? 'bg-white/15 shadow-[inset_0_-3px_0_#E8A317]' : 'hover:bg-white/10'}`}
            aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
          >
            <Icon paths={ICONS.bell} />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 rounded-full bg-gold px-1.5 text-[10px] font-semibold text-bench-dark">
                {unread}
              </span>
            )}
          </Link>
          <div className="flex items-center gap-2" title={name}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-xs font-semibold text-bench-dark">
              {initials}
            </span>
            <span className="rounded bg-white/10 px-2 py-0.5 text-xs">{role}</span>
          </div>
          <form action={signOutAction}>
            <SubmitButton
              className="rounded-lg border border-white/30 px-3 py-1.5 text-sm transition hover:bg-white/10 active:scale-95 inline-flex items-center gap-2"
              pendingText="Signing out..."
            >
              Sign out
            </SubmitButton>
          </form>
        </div>

        <button
          className="ml-auto rounded-md p-2 hover:bg-white/10 xl:hidden"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-bench-dark px-4 pb-4 pt-2 xl:hidden">
          <div className="mb-2 flex items-center gap-3 rounded-lg bg-white/10 p-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-sm font-semibold text-bench-dark">
              {initials}
            </span>
            <div>
              <p className="text-sm font-medium">{name}</p>
              <p className="text-xs text-blue-200">{role}</p>
            </div>
          </div>
          <nav className="grid gap-1" aria-label="Mobile">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={go(l.href)}
                className={`flex items-center justify-between ${linkCls(active(l.href))}`}
                aria-current={active(l.href) ? 'page' : undefined}
              >
                {l.label}
                {loading(l.href) && (
                  <span
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-gold"
                    aria-hidden="true"
                  />
                )}
              </Link>
            ))}
            <Link
              href="/notifications"
              onClick={go('/notifications')}
              className={`block ${linkCls(active('/notifications'))}`}
            >
              Notifications{unread ? ` (${unread})` : ''}
            </Link>
          </nav>
          <form action={signOutAction} className="mt-3">
            <SubmitButton
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/30 py-2 text-sm transition hover:bg-white/10 active:scale-95"
              pendingText="Signing out..."
            >
              Sign out
            </SubmitButton>
          </form>
        </div>
      )}
    </header>
  );
}
