import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Pages that work without signing in. /invite is public so a newly invited manager can open their link.
const PUBLIC_PREFIXES = ['/login', '/signup', '/invite', '/deactivated', '/api/cron'];

export async function middleware(request: NextRequest) {
  let refreshed: { name: string; value: string; options: any }[] = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(list) {
          refreshed = list as any;
          list.forEach(({ name, value }) => request.cookies.set(name, value));
        },
      },
    }
  );
  // The one and only network check of the session per request. Pages read the verified id from a header,
  // so they do not each call Supabase Auth again (this is what made every click slow).
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  // A network problem or a Supabase 5xx is not the same as "not signed in": let the request through instead of kicking the person out.
  const transient =
    !user &&
    !!userError &&
    (userError.name === 'AuthRetryableFetchError' || ((userError as any).status ?? 0) >= 500);

  const headers = new Headers(request.headers);
  headers.delete('x-user-id'); // never trust a value sent by the browser
  if (user) headers.set('x-user-id', user.id);
  const response = NextResponse.next({ request: { headers } });
  refreshed.forEach(({ name, value, options }) => response.cookies.set(name, value, options));

  const path = request.nextUrl.pathname;
  const isPublic = path === '/' || PUBLIC_PREFIXES.some((p) => path.startsWith(p));
  if (!user && !isPublic && !transient) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
