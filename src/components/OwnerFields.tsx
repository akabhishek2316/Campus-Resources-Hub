'use client';
import { useState } from 'react';

// Owner verification fields (same questions as registration) for a student who applies later.
export function OwnerFields() {
  const [ownerType, setOwnerType] = useState('college_staff');
  const file = 'text-sm';
  return (
    <section className="space-y-4 rounded-lg border border-gold bg-gold-light/40 p-4">
      <input type="hidden" name="role" value="owner" />
      <div>
        <h3 className="font-semibold">Resource owner verification</h3>
        <p className="hint mt-1">
          An admin reviews your details and documents before owner access is activated.
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
          <div className="grid gap-3 sm:grid-cols-2">
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
                className={file}
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
                className={file}
              />
            </div>
          </div>
        </>
      )}
      {ownerType === 'organization' && (
        <>
          <div>
            <label className="label" htmlFor="organization_name">
              Organisation or business name
            </label>
            <input id="organization_name" name="organization_name" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="owner_address">
              Business address
            </label>
            <textarea id="owner_address" name="owner_address" rows={2} required className="input" />
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
                className={file}
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
                className={file}
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
            <textarea id="owner_address" name="owner_address" rows={2} required className="input" />
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
              className={file}
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
              placeholder="Brief list: camera, 3D printer, workshop tools, space"
            />
          </div>
        </>
      )}
      <p className="hint">
        Documents must be clear and under 3 MB each. Only admins can open them.
      </p>
    </section>
  );
}
