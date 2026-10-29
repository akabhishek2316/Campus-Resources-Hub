import { createAdminClient } from './supabase/admin';

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const admin = createAdminClient();
  const { data } = await admin.storage.from('evidence').createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  (data ?? []).forEach((d: any) => {
    if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  });
  return out;
}

export async function uploadFiles(
  bookingOrFolder: string,
  prefix: string,
  files: File[]
): Promise<string[]> {
  const admin = createAdminClient();
  const paths: string[] = [];
  let i = 0;
  for (const f of files) {
    if (!f || f.size === 0) continue;
    if (f.size > 5 * 1024 * 1024) throw new Error('Each file must be under 5 MB.');
    const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${bookingOrFolder}/${prefix}-${Date.now()}-${i++}.${ext}`;
    const { error } = await admin.storage
      .from('evidence')
      .upload(path, Buffer.from(await f.arrayBuffer()), {
        contentType: f.type || 'application/octet-stream',
      });
    if (error) throw new Error(error.message);
    paths.push(path);
  }
  return paths;
}
