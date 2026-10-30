'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminTabs({ pending = 0 }: { pending?: number }) {
  const path = usePathname();
  const tabs = [
    { href: '/admin', label: 'Registration requests', badge: pending, on: path === '/admin' },
    { href: '/admin/users', label: 'All users', badge: 0, on: path.startsWith('/admin/users') },
  ];
  return (
    <div
      className="mb-5 flex gap-1 overflow-x-auto border-b border-paper-line"
      role="tablist"
      aria-label="Admin sections"
    >
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          role="tab"
          aria-selected={t.on}
          className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${t.on ? 'border-bench text-bench' : 'border-transparent text-ink-soft hover:text-ink'}`}
        >
          {t.label}
          {t.badge > 0 && (
            <span className="rounded-full bg-gold px-1.5 text-[11px] font-semibold text-bench-dark">
              {t.badge}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
