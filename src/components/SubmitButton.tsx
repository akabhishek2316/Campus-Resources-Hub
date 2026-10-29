'use client';
import { useFormStatus } from 'react-dom';

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`animate-spin ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// Shows a spinner and "Working..." on the button that was pressed, and blocks double clicks.
// For forms with several buttons (approve / reject) only the pressed one shows the spinner.
export function SubmitButton({
  children,
  className = 'btn btn-primary',
  name,
  value,
  pendingText = 'Working...',
  title,
}: {
  children: React.ReactNode;
  className?: string;
  name?: string;
  value?: string;
  pendingText?: string;
  title?: string;
}) {
  const { pending, data } = useFormStatus();
  const mine = pending && (!name || !data?.has(name) || data.get(name) === value);
  return (
    <button
      type="submit"
      name={name}
      value={value}
      title={title}
      disabled={pending}
      aria-busy={mine}
      className={`${className} ${mine ? 'is-pending' : ''}`}
    >
      {mine && <Spinner />}
      <span>{mine ? pendingText : children}</span>
    </button>
  );
}
