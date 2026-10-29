# ResourcesHub: project document (draft, fill the [brackets])

## 1. Selected use case
One college sharing lab equipment, workshop tools and rooms across departments: 3D printers, oscilloscopes, DSLR kits, GPU workstations, soldering stations and the seminar hall.

## 2. Target users and owners
Students and project teams who cannot afford or access equipment. Owners are lab heads and department staff; technicians run handovers; admins verify people and training.

## 3. Why the problem matters (add your own evidence)
- Survey of [30] students from [college]: [x]% needed equipment they could not access; [y]% did not know what exists.
- Photos or notes of idle labs: [add].
- Owners fear damage, misuse and unfair use, so default to saying no.

## 4. Proposed solution
A booking platform built around trust: automatic eligibility and fair-use checks, human approval with mandatory reasons, OTP handover with before and after photos, human-reviewed incidents, and an append-only audit trail.

## 5. Complete workflow
List > Discover > Request > Automatic checks > Owner or manager review (approve, reject, waitlist with reason) > Student records condition and receives OTP > Staff verify OTP and check in > Student returns and records condition > Staff confirm return > Incidents (delay, damage) reviewed by a human > Shared history. See README section 4.

## 6. Features built during the hackathon
All features in README section 5. Not built: payments, email delivery, multi-college support, listing edit, photo retention job.

## 7. Technology and architecture
Next.js 14 and TypeScript front end and server actions; Supabase Postgres, Auth, Storage; RLS for read protection; service-role writes after explicit permission checks; Postgres exclusion constraint against double booking; audit trigger for immutability. Architecture diagram: [insert].

## 8. AI and external services
Gemini API (optional): natural-language resource matching and incident evidence summaries. Both are advisory with a non-AI fallback. Claude was used to help generate the code (disclosed).

## 9. Privacy, security and fairness
Role-based access on server and database; private storage with signed URLs; proofs visible only to admins; only necessary data collected; fictional demo data. Fairness: weekly caps, per-day limit on busy items, visible priority score and waitlist rank, owner override with logged reason. No access, safety or penalty decision is automatic.

## 10. Known limitations
See README section 9.

## 11. Future development
Email and WhatsApp notifications, IoT smart-lock handover, cross-college sharing, credit-based allocation, hashed OTPs, retention policy for photos, calendar view.

## 12. Testing instructions
URL: [deployed link]. Accounts and walkthrough: README sections 3 and 4.

## 13. Team and roles
[Name: role and contribution] ...

## 14. Disclosures
Libraries: Next.js, React, Tailwind CSS, Supabase client libraries, IBM Plex fonts. AI-assisted code generation (Claude). No pre-existing templates or code.


## Training requests
Owners can ask the admin to add a training their shared item needs. The admin approves or rejects with a reason; approved trainings become selectable as listing requirements. All steps are audited.
