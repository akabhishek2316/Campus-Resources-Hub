import { redirect } from 'next/navigation';

export function flash(path: string, kind: 'error' | 'msg', text: string): never {
  const sep = path.includes('?') ? '&' : '?';
  redirect(`${path}${sep}${kind}=${encodeURIComponent(text)}`);
}
