'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// A thin bar at the top of the screen that starts the moment you click a link or submit a form,
// so the app never looks frozen while the next page is being prepared.
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [state, setState] = useState<'idle' | 'running' | 'done'>('idle');
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const start = () => {
    clear();
    setState('running');
    timers.current.push(window.setTimeout(() => setState('idle'), 20000)); // safety net for actions that stay on the page
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const a = (e.target as HTMLElement | null)?.closest?.('a') as HTMLAnchorElement | null;
      if (!a || !a.href || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search)
        return;
      start();
    };
    const onSubmit = () => start();
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
      clear();
    };
  }, []);

  useEffect(() => {
    setState((s) => {
      if (s !== 'running') return s;
      clear();
      timers.current.push(window.setTimeout(() => setState('idle'), 350));
      return 'done';
    });
  }, [pathname, search]);

  if (state === 'idle') return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1">
      <div
        className={`h-full bg-gold shadow-[0_0_8px_#E8A317] ${state === 'running' ? 'nav-progress-run' : 'w-full opacity-0 transition-all duration-300'}`}
      />
    </div>
  );
}
