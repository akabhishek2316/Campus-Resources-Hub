import Link from 'next/link';
import { Crest } from './Crest';
import { CELL, COLLEGE } from '@/lib/brand';

export function Footer({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <footer className="mt-12 border-t-4 border-gold bg-bench-dark text-blue-100">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <Crest size={34} />
            <p className="font-serif text-lg font-semibold text-white">{COLLEGE}</p>
          </div>
          <p className="mt-3 text-sm">
            {CELL}. Making sure the equipment and rooms our campus already owns reach the people who
            need them.
          </p>
        </div>
        <div>
          <p className="font-medium text-white">Quick links</p>
          <ul className="mt-3 space-y-2 text-sm">
            {signedIn ? (
              <>
                <li>
                  <Link href="/resources" className="hover:text-white">
                    Browse resources
                  </Link>
                </li>
                <li>
                  <Link href="/bookings" className="hover:text-white">
                    My bookings
                  </Link>
                </li>
                <li>
                  <Link href="/notifications" className="hover:text-white">
                    Notifications
                  </Link>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link href="/" className="hover:text-white">
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-white">
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link href="/signup" className="hover:text-white">
                    Register
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
        <div>
          <p className="font-medium text-white">Need help?</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>Lab owners and technicians handle booking questions.</li>
            <li>The admin office verifies college IDs and training certificates.</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-blue-200">
        {new Date().getFullYear()} {COLLEGE}. All demo data in this prototype is fictional.
      </div>
    </footer>
  );
}
