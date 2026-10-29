'use client';
import { useState, type FormEvent } from 'react';
import { compress } from './UploadForm';
import { Spinner } from './SubmitButton';

const ROLES = [
  { v: 'student', t: 'Student', d: 'Browse and book shared resources' },
  { v: 'owner', t: 'Resource Owner', d: 'Share equipment, spaces or tools' },
];

export function SignupForm({
  action,
  domain,
}: {
  action: (fd: FormData) => Promise<void>;
  domain?: string;
}) {
  const [role, setRole] = useState('student');
  const [ownerType, setOwnerType] = useState('college_staff');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const out = new FormData();
    for (const [k, v] of new FormData(e.currentTarget).entries()) {
      if (v instanceof File) {
        if (v.size === 0) continue;
        if (v.size > 3 * 1024 * 1024) {
          setErr(`${v.name} is larger than 3 MB. Upload a smaller file.`);
          setBusy(false);
          return;
        }
        out.append(k, await compress(v));
      } else out.append(k, v);
    }
    try {
      await action(out);
    } finally {
      setBusy(false);
    }
  }

  const owner = role === 'owner';
  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <fieldset>
        <legend className="label">I am registering as</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLES.map((r) => (
            <label
              key={r.v}
              className={`cursor-pointer rounded-lg border p-3 text-sm focus-within:ring-2 focus-within:ring-bench ${role === r.v ? 'border-bench bg-bench-light' : 'border-paper-line bg-white hover:bg-paper'}`}
            >
              <input
                type="radio"
                name="role"
                value={r.v}
                checked={role === r.v}
                onChange={() => setRole(r.v)}
                className="sr-only"
              />
              <span className="block font-medium">{r.t}</span>
              <span className="block text-xs text-ink-soft">{r.d}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor="full_name">
          {owner && ownerType === 'organization' ? 'Contact person full name' : 'Full name'}
        </label>
        <input id="full_name" name="full_name" autoComplete="name" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="email">
          {owner ? 'Email address' : 'College email'}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          placeholder={!owner && domain ? `name@${domain}` : 'name@example.com'}
        />
      </div>
      {!owner && (
        <>
          <div>
            <label className="label" htmlFor="department">
              Department
            </label>
            <input id="department" name="department" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="college_id">
              College ID number
            </label>
            <input id="college_id" name="college_id" required className="input" />
            <p className="hint mt-1">Enter the ID number printed on your college identity card.</p>
          </div>
          <div>
            <label className="label" htmlFor="college_id_doc">
              Upload college ID card
            </label>
            <input
              id="college_id_doc"
              name="college_id_doc"
              type="file"
              accept=".pdf,image/*"
              required
              className="text-sm"
            />
            <p className="hint mt-1">
              Upload a clear photo or PDF of your college ID card. Maximum 3 MB. The admin will
              review it before you can book.
            </p>
          </div>
        </>
      )}

      {owner && (
        <section className="space-y-4 rounded-lg border border-gold bg-gold-light/40 p-4">
          <div>
            <h3 className="font-semibold">Resource owner verification</h3>
            <p className="hint mt-1">
              Choose the type that best describes you. An admin will review your details before
              owner access is activated.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="owner_type">
              Owner type
            </label>
            <select
              id="owner_type"
              name="owner_type"
              value={ownerType}
              onChange={(e) => setOwnerType(e.target.value)}
              className="input"
              required
            >
              <option value="college_staff">College staff</option>
              <option value="organization">Organisation or business</option>
              <option value="individual">Individual</option>
            </select>
          </div>
          {ownerType === 'college_staff' && (
            <>
              <div>
                <label className="label" htmlFor="designation">
                  Job title
                </label>
                <input
                  id="designation"
                  name="designation"
                  required
                  className="input"
                  placeholder="e.g. HOD, Lab Head, Faculty"
                />
              </div>
              <div>
                <label className="label" htmlFor="employee_id">
                  Staff ID
                </label>
                <input id="employee_id" name="employee_id" required className="input" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="id_doc">
                    Staff ID card
                  </label>
                  <input
                    id="id_doc"
                    name="id_doc"
                    type="file"
                    accept=".pdf,image/*"
                    required
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="cv">
                    Appointment letter
                  </label>
                  <input
                    id="cv"
                    name="cv"
                    type="file"
                    accept=".pdf,.doc,.docx,image/*"
                    required
                    className="text-sm"
                  />
                </div>
              </div>
            </>
          )}
          {ownerType === 'organization' && (
            <>
              <div>
                <label className="label" htmlFor="organization_name">
                  Organisation / business name
                </label>
                <input
                  id="organization_name"
                  name="organization_name"
                  required
                  className="input"
                  placeholder="e.g. Makerspace, startup, NGO, shop"
                />
              </div>
              <div>
                <label className="label" htmlFor="owner_address">
                  Business address
                </label>
                <textarea
                  id="owner_address"
                  name="owner_address"
                  rows={2}
                  required
                  className="input"
                  placeholder="Full address"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="id_doc">
                    Owner photo ID
                  </label>
                  <input
                    id="id_doc"
                    name="id_doc"
                    type="file"
                    accept=".pdf,image/*"
                    required
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="cv">
                    Registration proof
                  </label>
                  <input
                    id="cv"
                    name="cv"
                    type="file"
                    accept=".pdf,.doc,.docx,image/*"
                    required
                    className="text-sm"
                  />
                  <p className="hint mt-1">GST, shop licence or society registration</p>
                </div>
              </div>
            </>
          )}
          {ownerType === 'individual' && (
            <>
              <div>
                <label className="label" htmlFor="owner_address">
                  Your address
                </label>
                <textarea
                  id="owner_address"
                  name="owner_address"
                  rows={2}
                  required
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="id_doc">
                  Photo ID
                </label>
                <input
                  id="id_doc"
                  name="id_doc"
                  type="file"
                  accept=".pdf,image/*"
                  required
                  className="text-sm"
                />
              </div>
              <div>
                <label className="label" htmlFor="resource_share_list">
                  What would you like to share?
                </label>
                <textarea
                  id="resource_share_list"
                  name="resource_share_list"
                  rows={3}
                  required
                  className="input"
                  placeholder="Brief list: camera, 3D printer, workshop tools, space, etc."
                />
              </div>
            </>
          )}
          <p className="hint">
            Documents must be clear and under 3 MB each. Only authorised admins can review them.
            Owner access remains pending until approval.
          </p>
        </section>
      )}

      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          minLength={8}
          autoComplete="new-password"
          required
          className="input"
        />
        <p className="hint mt-1">At least 8 characters.</p>
      </div>
      {err && (
        <p
          role="alert"
          className="rounded-lg border border-rust bg-rust-light px-3 py-2 text-sm text-rust"
        >
          {err}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className={`btn btn-primary w-full ${busy ? 'is-pending' : ''}`}
      >
        {busy && <Spinner />}
        <span>
          {busy
            ? 'Creating account...'
            : owner
              ? 'Submit owner details for review'
              : 'Create student account'}
        </span>
      </button>
    </form>
  );
}
