import Link from 'next/link';
import { Crest } from './Crest';
import { COLLEGE_SHORT } from '@/lib/brand';

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b-4 border-gold bg-bench-dark text-white shadow-md">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Crest size={30} />
          <span className="leading-tight">
            <span className="block font-serif text-lg font-semibold">
              {COLLEGE_SHORT} ResourcesHub
            </span>
            <span className="hidden text-[11px] text-blue-200 sm:block">
              Equipment and Spaces Sharing Cell
            </span>
          </span>
        </Link>
        <nav
          className="ml-6 hidden items-center gap-5 text-sm text-blue-100 md:flex"
          aria-label="Sections"
        >
          <a href="/#how" className="hover:text-white">
            How it works
          </a>
          <a href="/#features" className="hover:text-white">
            Features
          </a>
          <a href="/#roles" className="hover:text-white">
            Who it is for
          </a>
          <a href="/#fair" className="hover:text-white">
            Fair and safe
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-lg border border-white/30 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-gold px-3 py-1.5">
            Register
          </Link>
        </div>
      </div>
    </header>
  );
}
