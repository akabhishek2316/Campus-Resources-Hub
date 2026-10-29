// Creates demo users and fictional demo data. Run once after schema.sql:  npm run seed
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const TZ = Number(process.env.NEXT_PUBLIC_TZ_OFFSET_MIN ?? 330);
const PASSWORD = 'Demo@1234';

const people = [
  {
    email: 'admin@demo.edu',
    name: 'Dr. Meera Admin',
    role: 'admin',
    verified: true,
    dept: 'Administration',
    cid: 'ADM001',
  },
  {
    email: 'owner@demo.edu',
    name: 'Prof. Rakesh Verma',
    role: 'owner',
    verified: true,
    dept: 'Electronics',
    cid: 'FAC101',
  },
  {
    email: 'manager@demo.edu',
    name: 'Anil Technician',
    role: 'manager',
    verified: true,
    dept: 'Electronics Lab',
    cid: 'TEC201',
  },
  {
    email: 'student1@demo.edu',
    name: 'Aarav Student',
    role: 'student',
    verified: true,
    dept: 'Computer Science',
    cid: 'CS2301',
  },
  {
    email: 'student2@demo.edu',
    name: 'Diya Student',
    role: 'student',
    verified: true,
    dept: 'Electronics',
    cid: 'EC2302',
  },
  {
    email: 'student3@demo.edu',
    name: 'Kabir Student',
    role: 'student',
    verified: false,
    dept: 'Mechanical',
    cid: 'ME2303',
  },
];

async function ensureUser(p) {
  const { data, error } = await db.auth.admin.createUser({
    email: p.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: p.name, department: p.dept, college_id: p.cid },
  });
  let id = data?.user?.id;
  if (error) {
    const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
    id = list.users.find((u) => u.email === p.email)?.id;
    if (!id) throw error;
    await db.auth.admin.updateUserById(id, { password: PASSWORD });
  }
  await db
    .from('profiles')
    .upsert({
      id,
      email: p.email,
      full_name: p.name,
      role: p.role,
      verified: p.verified,
      department: p.dept,
      college_id: p.cid,
    });
  return id;
}

// Local hour on a future weekday -> UTC ISO string
function slot(daysAhead, hour, hours) {
  const d = new Date(Date.now() + daysAhead * 86400000 + TZ * 60000);
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  const start = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour) - TZ * 60000
  );
  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + hours * 3600000).toISOString(),
  };
}

const ids = {};
for (const p of people) {
  ids[p.email] = await ensureUser(p);
  console.log('user ready:', p.email);
}
// Pending registration requests for the admin review demo (reset to pending every time you seed).
async function putDoc(path, text) {
  await db.storage
    .from('evidence')
    .upload(path, Buffer.from(text), { contentType: 'text/plain', upsert: true });
  return path;
}
const applicants = [
  {
    email: 'applicant.owner@demo.edu',
    name: 'Dr. Neha Sharma',
    role: 'student',
    verified: false,
    dept: 'Mechanical Engineering',
    cid: '',
    ownerType: 'college_staff',
    title: 'Associate Professor',
    emp: 'FAC245',
    share: 'Laser cutter and CNC router in the fabrication workshop.',
    docs: ['DEMO APPOINTMENT LETTER (fictional)', 'DEMO STAFF ID (fictional)'],
  },
  {
    email: 'applicant.org@demo.edu',
    name: 'Sana Iqbal',
    role: 'student',
    verified: false,
    dept: 'MakerHub Community Workshop',
    cid: '',
    ownerType: 'organization',
    org: 'MakerHub Community Workshop',
    addr: '12 Station Road, Lucknow',
    share: 'Laser cutter, vinyl cutter and soldering benches, available off-peak.',
    docs: ['DEMO GST CERTIFICATE (fictional)', 'DEMO PHOTO ID (fictional)'],
  },
  {
    email: 'applicant.individual@demo.edu',
    name: 'Imran Khan',
    role: 'student',
    verified: false,
    dept: 'Independent',
    cid: '',
    ownerType: 'individual',
    addr: '45 Gomti Nagar, Lucknow',
    share: 'Mirrorless camera with three lenses and a gimbal.',
    docs: [null, 'DEMO PHOTO ID (fictional)'],
  },
];
for (const a of applicants) {
  const id = await ensureUser(a);
  const doc1 = a.docs[0]
    ? await putDoc(
        `applications/${id}/doc1-demo.txt`,
        `${a.docs[0]}\n${a.name}\n${a.title ?? ''} ${a.org ?? ''}`
      )
    : null;
  const doc2 = await putDoc(`applications/${id}/doc2-demo.txt`, `${a.docs[1]}\n${a.name}`);
  await db
    .from('profiles')
    .update({
      requested_role: 'owner',
      application_status: 'pending',
      owner_type: a.ownerType,
      designation: a.title ?? null,
      employee_id: a.emp ?? null,
      organization_name: a.org ?? null,
      owner_address: a.addr ?? null,
      resource_share_list: a.share,
      application_note: a.share,
      cv_path: doc1,
      id_doc_path: doc2,
      application_review_note: null,
      is_active: true,
    })
    .eq('id', id);
  console.log('applicant ready:', a.email);
}
const kabir = ids['student3@demo.edu'];
const kabirDoc = await putDoc(
  `applications/${kabir}/college-id-card-demo.txt`,
  'DEMO COLLEGE ID CARD (fictional)\nKabir Student\nME2303'
);
await db
  .from('profiles')
  .update({
    requested_role: 'student',
    application_status: 'pending',
    college_id_doc_path: kabirDoc,
  })
  .eq('id', kabir);

// One deactivated account so the Users list shows every kind of tag.
const former = await ensureUser({
  email: 'former.student@demo.edu',
  name: 'Rohan Former',
  role: 'student',
  verified: true,
  dept: 'Civil Engineering',
  cid: 'CE2001',
});
await db
  .from('profiles')
  .update({
    is_active: false,
    deactivated_at: new Date().toISOString(),
    deactivation_reason: 'Left the college (demo data)',
  })
  .eq('id', former);
// Demo accounts are always active after seeding.
await db
  .from('profiles')
  .update({ is_active: true, deactivated_at: null, deactivation_reason: null })
  .in('id', Object.values(ids));

await db
  .from('profiles')
  .update({ owner_type: 'college_staff', designation: 'Professor', employee_id: 'FAC101' })
  .eq('id', ids['owner@demo.edu']);
const [owner, manager, s1, s2, admin] = [
  'owner@demo.edu',
  'manager@demo.edu',
  'student1@demo.edu',
  'student2@demo.edu',
  'admin@demo.edu',
].map((e) => ids[e]);

// A pending training request so the admin can try the review screen (reset every seed).
await db
  .from('training_requests')
  .delete()
  .eq('requested_by', owner)
  .eq('name', 'Laser cutter safety');
await db
  .from('training_requests')
  .insert({
    requested_by: owner,
    name: 'Laser cutter safety',
    reason:
      'I want to share the department laser cutter. Users must know the fire and fume rules first.',
  });
const { data: managerAssignment } = await db
  .from('owner_managers')
  .select('id')
  .eq('owner_id', owner)
  .eq('manager_id', manager)
  .is('revoked_at', null)
  .maybeSingle();
if (!managerAssignment) {
  const { error: assignmentError } = await db
    .from('owner_managers')
    .insert({
      owner_id: owner,
      manager_id: manager,
      invited_by: owner,
      permissions: {
        booking_requests: true,
        check_in_out: true,
        incidents: true,
        manage_resources: false,
      },
    });
  if (assignmentError) throw assignmentError;
}

const { count } = await db.from('resources').select('id', { count: 'exact', head: true });
if (count > 0) {
  console.log('Resources already exist. Users refreshed, data left untouched.');
  process.exit(0);
}

const trainingNames = ['3D printer safety', 'Electronics lab safety', 'Camera equipment handling'];
await db.from('trainings').upsert(
  trainingNames.map((name) => ({ name })),
  { onConflict: 'name' }
);
const { data: tr } = await db.from('trainings').select('*');
const T = Object.fromEntries(tr.map((t) => [t.name, t.id]));

await db.from('user_credentials').insert([
  {
    user_id: s2,
    training_id: T['3D printer safety'],
    status: 'approved',
    reviewed_by: admin,
    reviewed_at: new Date().toISOString(),
  },
  {
    user_id: s2,
    training_id: T['Electronics lab safety'],
    status: 'approved',
    reviewed_by: admin,
    reviewed_at: new Date().toISOString(),
  },
]);

const defs = [
  {
    name: 'Prusa 3D printer',
    category: 'Tool',
    location: 'Makerspace, Block B 102',
    description: 'FDM printer for prototypes and enclosures. Filament included for small prints.',
    rules: 'Supervised starts only. Never leave a running print unattended. Wear closed shoes.',
    requires_approval: true,
    high_demand: true,
    max_hours_per_booking: 3,
    weekly_cap_hours: 6,
    deposit_note: 'Rs. 200 refundable deposit for filament',
    days: [1, 2, 3, 4, 5],
    s: 10,
    e: 17,
    req: ['3D printer safety'],
  },
  {
    name: 'Canon DSLR kit',
    category: 'Camera',
    location: 'Media Lab, Block A 210',
    description: 'DSLR body, two lenses, tripod and two batteries.',
    rules: 'Return with batteries charged. Report any lens scratches at once.',
    requires_approval: true,
    high_demand: false,
    max_hours_per_booking: 4,
    weekly_cap_hours: 8,
    deposit_note: null,
    days: [1, 2, 3, 4, 5],
    s: 9,
    e: 18,
    req: [],
  },
  {
    name: 'Seminar Hall A',
    category: 'Space',
    location: 'Main Block, Ground Floor',
    description: 'Seats 120 with projector, sound system and podium.',
    rules: 'Leave the room as you found it. Organisers are responsible for AV equipment.',
    requires_approval: true,
    high_demand: false,
    max_hours_per_booking: 4,
    weekly_cap_hours: 8,
    deposit_note: 'Rs. 500 refundable deposit, collected by the owner',
    days: [1, 2, 3, 4, 5, 6],
    s: 9,
    e: 18,
    req: [],
  },
  {
    name: 'Digital oscilloscope station',
    category: 'Device',
    location: 'Electronics Lab, Block B 204',
    description: '100 MHz four-channel oscilloscope with probes and a function generator.',
    rules: 'Use supplied probes only. No mains-powered circuits without the technician.',
    requires_approval: false,
    high_demand: false,
    max_hours_per_booking: 3,
    weekly_cap_hours: 6,
    deposit_note: null,
    days: [1, 2, 3, 4, 5],
    s: 10,
    e: 17,
    req: ['Electronics lab safety'],
  },
  {
    name: 'GPU workstation',
    category: 'Computer',
    location: 'AI Lab, Block C 301',
    description: 'Workstation with a 24 GB GPU for model training and rendering.',
    rules: 'Keep jobs under the booking length. Save work to your own storage.',
    requires_approval: true,
    high_demand: true,
    max_hours_per_booking: 4,
    weekly_cap_hours: 8,
    deposit_note: null,
    days: [1, 2, 3, 4, 5],
    s: 9,
    e: 19,
    req: [],
  },
  {
    name: 'Soldering and rework station',
    category: 'Tool',
    location: 'Electronics Lab, Block B 204',
    description: 'Temperature-controlled soldering iron, hot air station and fume extractor.',
    rules: 'Fume extractor must be on. Tidy the bench after use.',
    requires_approval: true,
    high_demand: false,
    max_hours_per_booking: 3,
    weekly_cap_hours: 6,
    deposit_note: null,
    days: [1, 2, 3, 4, 5],
    s: 10,
    e: 17,
    req: ['Electronics lab safety'],
  },
];

const R = {};
for (const d of defs) {
  const { data: r, error } = await db
    .from('resources')
    .insert({
      owner_id: owner,
      manager_id: manager,
      name: d.name,
      category: d.category,
      location: d.location,
      description: d.description,
      rules: d.rules,
      requires_approval: d.requires_approval,
      high_demand: d.high_demand,
      max_hours_per_booking: d.max_hours_per_booking,
      weekly_cap_hours: d.weekly_cap_hours,
      deposit_note: d.deposit_note,
    })
    .select('id')
    .single();
  if (error) throw error;
  R[d.name] = r.id;
  await db
    .from('availability_windows')
    .insert(d.days.map((w) => ({ resource_id: r.id, weekday: w, start_hour: d.s, end_hour: d.e })));
  if (d.req.length)
    await db
      .from('resource_requirements')
      .insert(d.req.map((n) => ({ resource_id: r.id, training_id: T[n] })));
  await db
    .from('audit_log')
    .insert({
      actor_id: owner,
      actor_name: 'Prof. Rakesh Verma',
      action: 'resource_listed',
      entity_type: 'resource',
      entity_id: r.id,
      details: { name: d.name },
    });
}

async function addBooking(b, audit = []) {
  const { data, error } = await db.from('bookings').insert(b).select('id').single();
  if (error) throw error;
  for (const a of audit)
    await db
      .from('audit_log')
      .insert({ booking_id: data.id, entity_type: 'booking', entity_id: data.id, ...a });
  return data.id;
}
const S1 = { id: s1, n: 'Aarav Student' },
  S2 = { id: s2, n: 'Diya Student' };
const sys = { actor_id: null, actor_name: 'System' };

// 1) Waitlist scenario on the GPU workstation: Diya approved, Aarav waitlisted for the same slot
const gpu = slot(3, 11, 2);
await addBooking(
  {
    resource_id: R['GPU workstation'],
    user_id: s2,
    start_at: gpu.start,
    end_at: gpu.end,
    purpose: 'Train a defect-detection model for my final-year project',
    purpose_type: 'course_project',
    status: 'approved',
    decision_reason: 'Final-year project with a submission deadline; first request received.',
    decided_by: owner,
    decided_at: new Date().toISOString(),
    priority_score: 50,
    priority_explanation:
      'Priority 50 = purpose "Course project" (+50) + waiting time (+0) - recent use of this resource, 0.0h in 30 days (-0).',
    otp: '482915',
  },
  [
    {
      actor_id: s2,
      actor_name: S2.n,
      action: 'booking_requested',
      details: { purpose: 'Train a defect-detection model' },
    },
    {
      actor_id: owner,
      actor_name: 'Prof. Rakesh Verma',
      action: 'approved',
      details: { reason: 'Final-year project with a submission deadline; first request received.' },
    },
  ]
);
await addBooking(
  {
    resource_id: R['GPU workstation'],
    user_id: s1,
    start_at: gpu.start,
    end_at: gpu.end,
    purpose: 'Try out a hobby image generator',
    purpose_type: 'personal',
    status: 'waitlisted',
    decision_reason:
      'That slot is already booked. You are on the waitlist and move to review if it frees up.',
    priority_score: 20,
    priority_explanation:
      'Priority 20 = purpose "Personal use" (+20) + waiting time (+0) - recent use of this resource, 0.0h in 30 days (-0).',
  },
  [
    {
      actor_id: s1,
      actor_name: S1.n,
      action: 'booking_requested',
      details: { purpose: 'Hobby image generator' },
    },
    { ...sys, action: 'waitlisted_on_request', details: { reason: 'Slot already booked' } },
  ]
);

// 2) A pending request on the DSLR for the owner queue
const cam = slot(2, 10, 3);
await addBooking(
  {
    resource_id: R['Canon DSLR kit'],
    user_id: s1,
    start_at: cam.start,
    end_at: cam.end,
    purpose: 'Record the department open-day photo walk',
    purpose_type: 'course_project',
    status: 'pending_review',
    decision_reason: 'All automatic checks passed. Waiting for the owner or manager.',
    priority_score: 50,
    priority_explanation:
      'Priority 50 = purpose "Course project" (+50) + waiting time (+0) - recent use of this resource, 0.0h in 30 days (-0).',
  },
  [
    {
      actor_id: s1,
      actor_name: S1.n,
      action: 'booking_requested',
      details: { purpose: 'Open-day photo walk' },
    },
  ]
);

// 3) An approved booking ready for the check-in demo (Aarav on the seminar hall)
const hall = slot(4, 14, 2);
await addBooking(
  {
    resource_id: R['Seminar Hall A'],
    user_id: s1,
    start_at: hall.start,
    end_at: hall.end,
    purpose: 'Coding club weekly workshop',
    purpose_type: 'personal',
    status: 'approved',
    decision_reason: 'Club session; hall is free that afternoon.',
    decided_by: owner,
    decided_at: new Date().toISOString(),
    priority_score: 20,
    priority_explanation:
      'Priority 20 = purpose "Personal use" (+20) + waiting time (+0) - recent use of this resource, 0.0h in 30 days (-0).',
    otp: '730264',
  },
  [
    {
      actor_id: s1,
      actor_name: S1.n,
      action: 'booking_requested',
      details: { purpose: 'Coding club weekly workshop' },
    },
    {
      actor_id: owner,
      actor_name: 'Prof. Rakesh Verma',
      action: 'approved',
      details: { reason: 'Club session; hall is free that afternoon.' },
    },
  ]
);

// 4) A finished booking with an open damage incident for the review demo
const past = new Date(Date.now() - 3 * 86400000);
const ps = new Date(past);
ps.setUTCHours(6, 0, 0, 0);
const pe = new Date(ps.getTime() + 2 * 3600000);
const retAt = new Date(pe.getTime() + 40 * 60000);
const pastId = await addBooking(
  {
    resource_id: R['Digital oscilloscope station'],
    user_id: s2,
    start_at: ps.toISOString(),
    end_at: pe.toISOString(),
    purpose: 'Measure ripple on my power supply project',
    purpose_type: 'course_project',
    status: 'returned',
    decision_reason:
      'Auto-approved: this resource needs no manual approval and every check passed.',
    priority_score: 50,
    priority_explanation:
      'Priority 50 = purpose "Course project" (+50) + waiting time (+0) - recent use of this resource, 0.0h in 30 days (-0).',
    otp: '115599',
    checked_in_at: ps.toISOString(),
    checked_in_by: manager,
    returned_at: retAt.toISOString(),
  },
  [
    {
      actor_id: s2,
      actor_name: S2.n,
      action: 'booking_requested',
      details: { purpose: 'Measure ripple' },
    },
    { ...sys, action: 'auto_approved', details: { reason: 'All checks passed' } },
    {
      actor_id: s2,
      actor_name: S2.n,
      action: 'before_condition_recorded',
      details: { rating: 5, note: 'All probes present' },
    },
    {
      actor_id: manager,
      actor_name: 'Anil Technician',
      action: 'checked_in',
      details: { result: 'OTP verified' },
    },
    {
      actor_id: s2,
      actor_name: S2.n,
      action: 'after_condition_recorded',
      details: { rating: 3, note: 'Probe clip cracked' },
    },
  ]
);
await db.from('condition_reports').insert([
  {
    booking_id: pastId,
    phase: 'before',
    rating: 5,
    notes: 'All four probes present and clean.',
    photo_paths: [],
    recorded_by: s2,
  },
  {
    booking_id: pastId,
    phase: 'after',
    rating: 3,
    notes: 'Channel 2 probe clip is cracked.',
    photo_paths: [],
    recorded_by: s2,
  },
]);
const { data: inc } = await db
  .from('incidents')
  .insert([
    {
      booking_id: pastId,
      resource_id: R['Digital oscilloscope station'],
      reported_by: s2,
      type: 'delay',
      description: 'Returned 40 minutes after the booked end time.',
      auto_flagged: true,
    },
    {
      booking_id: pastId,
      resource_id: R['Digital oscilloscope station'],
      reported_by: s2,
      type: 'damage',
      description: 'Condition rating dropped from 5 to 3. Notes: Channel 2 probe clip is cracked.',
      auto_flagged: true,
    },
  ])
  .select('id');
for (const i of inc)
  await db
    .from('audit_log')
    .insert({
      ...sys,
      action: 'incident_auto_flagged',
      entity_type: 'incident',
      entity_id: i.id,
      booking_id: pastId,
      details: { note: 'Needs human review' },
    });
await db
  .from('notifications')
  .insert([
    {
      user_id: manager,
      message: 'Incident flagged on Digital oscilloscope station: probe clip cracked.',
      link: `/incidents/${inc[1].id}`,
    },
  ]);

console.log('\nDone. Sign in with any demo account, password:', PASSWORD);
