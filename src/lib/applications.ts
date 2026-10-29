// Shared validation for registration and role applications.
export const STAFF_ROLES = ['owner'] as const;
export const ROLE_LABEL: Record<string, string> = {
  student: 'Student',
  owner: 'Resource owner',
  manager: 'Manager',
  admin: 'Admin',
};

// The three kinds of owner. Every screen shows the specific kind, never just "owner".
export const OWNER_TYPE_LABEL: Record<string, string> = {
  college_staff: 'College staff owner',
  organization: 'Organisation owner',
  individual: 'Individual owner',
};
export const OWNER_TYPE_SHORT: Record<string, string> = {
  college_staff: 'College staff',
  organization: 'Organisation',
  individual: 'Individual',
};

// "College staff owner", "Organisation owner", "Individual owner", "Student", "Manager", "Admin".
export function roleLabel(role: string | null | undefined, ownerType?: string | null): string {
  if (role === 'owner') return (ownerType && OWNER_TYPE_LABEL[ownerType]) || 'Resource owner';
  return ROLE_LABEL[role ?? ''] ?? String(role ?? '');
}
const OK_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export function checkDoc(file: File | null, label: string): string | null {
  if (!file || file.size === 0) return `${label} is required.`;
  if (!(file.type.startsWith('image/') || OK_TYPES.includes(file.type)))
    return `${label} must be a PDF, Word file or photo.`;
  if (file.size > 3 * 1024 * 1024) return `${label} must be under 3 MB.`;
  return null;
}
