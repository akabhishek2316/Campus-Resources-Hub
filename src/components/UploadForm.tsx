'use client';
import { useState, type FormEvent } from 'react';
import { Spinner } from './SubmitButton';

// Shrinks photos in the browser (about 1280px JPEG) so uploads are fast and fit serverless limits.
export async function compress(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.78));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export function UploadForm({
  action,
  children,
  submitLabel,
  className = '',
}: {
  action: (fd: FormData) => Promise<void>;
  children: React.ReactNode;
  submitLabel: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const out = new FormData();
    for (const [k, v] of new FormData(e.currentTarget).entries()) {
      if (v instanceof File) {
        if (v.size > 0) out.append(k, await compress(v));
      } else out.append(k, v);
    }
    try {
      await action(out);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className={className}>
      {children}
      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className={`btn btn-primary ${busy ? 'is-pending' : ''}`}
      >
        {busy && <Spinner />}
        <span>{busy ? 'Uploading...' : submitLabel}</span>
      </button>
    </form>
  );
}
