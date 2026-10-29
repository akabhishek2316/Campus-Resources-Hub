import { SubmitButton } from '@/components/SubmitButton';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { markAllRead } from '@/app/actions/notifications';
import { fmtDateTime } from '@/lib/time';
import { Empty, PageBanner } from '@/components/ui';

export default async function Notifications() {
  const profile = await requireProfile();
  const supabase = createClient();
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(60);
  return (
    <div className="max-w-3xl">
      <PageBanner
        title="Notifications"
        subtitle="Approvals, reminders, waitlist moves and overdue alerts."
      >
        <form action={markAllRead}>
          <SubmitButton className="btn btn-gold" pendingText="Marking...">
            Mark all as read
          </SubmitButton>
        </form>
      </PageBanner>
      <div className="mt-5 space-y-2">
        {(data ?? []).length === 0 && (
          <Empty title="Nothing yet">
            Approvals, reminders and overdue alerts will appear here.
          </Empty>
        )}
        {(data ?? []).map((n: any) => (
          <div key={n.id} className={`card py-3 ${n.read ? '' : 'border-bench'}`}>
            <p className="text-sm">
              {n.link ? (
                <Link href={n.link} className="hover:underline">
                  {n.message}
                </Link>
              ) : (
                n.message
              )}
            </p>
            <p className="mt-1 text-xs text-ink-mute">{fmtDateTime(n.created_at)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
