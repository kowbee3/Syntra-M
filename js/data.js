/* =========================================================
   Syntra — mock data (front-end only, no backend)
   Replace with API calls once the backend exists.
   ========================================================= */

(function () {
  // Build a timestamp N days ago at hh:mm local time
  function at(daysAgo, hh, mm) {
    var d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hh, mm, 0, 0);
    return d.getTime();
  }
  function minsAgo(m) { return Date.now() - m * 60000; }

  // ---- Unit structure (parent = the unit above). Used to scope Admins and channels.
  var units = {
    bn: { id: 'bn', name: '2-14 Signal Bn',        short: 'Battalion', parent: null },
    hq: { id: 'hq', name: 'HQ Co, 2-14 Signal Bn', short: 'HQ Co',     parent: 'bn' },
    a:  { id: 'a',  name: 'A Co, 2-14 Signal Bn',  short: 'A Co',      parent: 'bn' },
    b:  { id: 'b',  name: 'B Co, 2-14 Signal Bn',  short: 'B Co',      parent: 'bn' }
  };

  var me = {
    id: 'me',
    unitId: 'hq',
    name: 'Alex Morgan',
    rank: 'SSG',
    unit: 'HQ Co, 2-14 Signal Bn',
    role: 'Communications NCO',
    callsign: 'RELAY 6',
    status: 'online',
    color: '#2f6b4f'
  };

  var users = {
    u1: { id: 'u1', unitId: 'a', name: 'Jordan Hale',    rank: 'CPT', unit: 'A Co, 2-14 Signal Bn', role: 'Company Commander', callsign: 'ALPHA 6',  status: 'online',  color: '#3d6fb4', verified: true },
    u2: { id: 'u2', unitId: 'a', name: 'Riley Santos',   rank: 'SFC', unit: 'A Co, 2-14 Signal Bn', role: 'Platoon Sergeant',  callsign: 'ALPHA 27', status: 'away',    color: '#b4693d', verified: true },
    u3: { id: 'u3', unitId: 'bn', name: 'Casey Nguyen',   rank: '1LT', unit: 'S4, 2-14 Signal Bn',   role: 'Logistics Officer', callsign: 'BUFFALO 4', status: 'online', color: '#8a4fb0', verified: false },
    u4: { id: 'u4', unitId: 'hq', name: 'Taylor Brooks',  rank: 'SPC', unit: 'HQ Co, 2-14 Signal Bn', role: 'Network Specialist', callsign: 'RELAY 14', status: 'dnd',   color: '#b03d5c', verified: true },
    u5: { id: 'u5', unitId: 'bn', name: 'Morgan Ellis',   rank: 'MAJ', unit: 'S3, 2-14 Signal Bn',   role: 'Operations Officer', callsign: 'TITAN 3', status: 'offline', color: '#3d8f8f', verified: true },
    u6: { id: 'u6', unitId: 'b', name: 'Sam Okafor',     rank: 'SGT', unit: 'B Co, 2-14 Signal Bn', role: 'Team Leader',        callsign: 'BRAVO 21', status: 'online', color: '#6f8f3d', verified: false },
    u7: { id: 'u7', unitId: 'bn', name: 'Avery Kim',      rank: 'CW2', unit: 'S6, 2-14 Signal Bn',   role: 'Network Technician', callsign: 'RELAY 2', status: 'away',    color: '#5c5cb0', verified: true },
    u9:  { id: 'u9', unitId: 'bn', name: 'Cameron Shaw',  rank: 'LTC', unit: '2-14 Signal Bn', role: 'Battalion Commander', callsign: 'TITAN 6', status: 'online', color: '#7a3d5c', verified: true },
    u10: { id: 'u10', unitId: 'bn', name: 'Jesse Moreno', rank: 'CSM', unit: '2-14 Signal Bn', role: 'Command Sergeant Major', callsign: 'TITAN 7', status: 'away', color: '#5c7a3d', verified: true },
    u8: { id: 'u8', unitId: 'hq', name: 'Drew Patel',     rank: 'PFC', unit: 'HQ Co, 2-14 Signal Bn', role: 'Radio Operator',    callsign: 'RELAY 19', status: 'offline', color: '#b08a3d', verified: false }
  };

  var conversations = [
    {
      id: 'c1', type: 'direct', userId: 'u1', unread: 2, pinned: true, muted: false, disappearing: 0,
      pinnedMsgId: 'm1-3',
      messages: [
        { id: 'm1-1', from: 'u1', ts: at(1, 7, 42), text: 'Morning. Need a status on the SATCOM terminal before the 0900 sync.' },
        { id: 'm1-2', from: 'me', ts: at(1, 7, 51), text: 'Roger. Terminal is up, link margin nominal. Running a full diagnostic now.', status: 'read' },
        { id: 'm1-3', from: 'u1', ts: at(1, 8, 2), text: 'Field exercise rally point moved to Grid 38S MB 4512 8833. Brief your section.', prec: 'priority' },
        { id: 'm1-4', from: 'me', ts: at(1, 8, 4), text: 'Copy all. Will brief at 1000.', status: 'read', reactions: { '👍': ['u1'] } },
        { id: 'm1-5', from: 'u1', ts: minsAgo(34), text: 'Sending the updated comms card. Review and confirm frequencies.' },
        { id: 'm1-6', from: 'u1', ts: minsAgo(33), type: 'file', file: { name: 'Comms_Card_Rev3.pdf', size: '412 KB' }, text: '' }
      ]
    },
    {
      id: 'c2', type: 'group', name: 'Alpha Company Ops', members: ['me', 'u1', 'u2', 'u4', 'u6', 'u8'], admins: ['u1'],
      unread: 5, pinned: true, muted: false, disappearing: 86400, color: '#3d6f5c',
      messages: [
        { id: 'm2-0', type: 'system', ts: at(3, 9, 0), text: 'CPT Hale set disappearing messages to 24 hours' },
        { id: 'm2-1', from: 'u2', ts: at(0, 6, 15), text: 'Formation at 0630, motor pool. PT uniform.' },
        { id: 'm2-2', from: 'u6', ts: at(0, 6, 18), text: 'Bravo team accounted for. 8/8.', reactions: { '✅': ['u2', 'u1'] } },
        { id: 'm2-3', from: 'me', ts: at(0, 6, 20), text: 'HQ comms section 5/5.', status: 'read' },
        { id: 'm2-4', from: 'u1', ts: minsAgo(55), text: 'All stations: weather hold in effect until 1400. Secure equipment and remain in assembly area.', prec: 'immediate' },
        { id: 'm2-5', from: 'u4', ts: minsAgo(40), text: 'Generators covered and grounded.', replyTo: 'm2-4' },
        { id: 'm2-6', from: 'u8', ts: minsAgo(22), type: 'image', text: 'Antenna mast secured.' },
        { id: 'm2-7', from: 'u2', ts: minsAgo(9), text: 'Good work. Hot chow at 1200 at the DFAC tent.' },
        { id: 'm2-8', from: 'u6', ts: minsAgo(4), text: 'Roger that 👍' }
      ]
    },
    {
      id: 'c3', type: 'direct', userId: 'u3', unread: 0, pinned: false, muted: false, disappearing: 0,
      messages: [
        { id: 'm3-1', from: 'u3', ts: at(2, 14, 10), text: 'Your class IX request for the radio batteries went through.' },
        { id: 'm3-2', from: 'me', ts: at(2, 14, 22), text: 'Thanks ma\'am. ETA?', status: 'read' },
        { id: 'm3-3', from: 'u3', ts: at(2, 14, 30), text: 'Thursday convoy. 40x BA-5590.' },
        { id: 'm3-4', from: 'me', ts: at(0, 9, 12), text: 'Can we add 2x spare handsets to that order?', status: 'delivered' }
      ]
    },
    {
      id: 'c4', type: 'group', name: 'S6 Network Cell', members: ['me', 'u4', 'u7', 'u8'], admins: ['u7', 'me'],
      unread: 0, pinned: false, muted: true, disappearing: 0, color: '#5c5cb0',
      messages: [
        { id: 'm4-1', from: 'u7', ts: at(1, 16, 0), text: 'Crypto changeover tonight at 2359Z. Confirm keys loaded on all nodes.', prec: 'priority' },
        { id: 'm4-2', from: 'u4', ts: at(1, 16, 20), text: 'Node 1 and 2 loaded and verified.' },
        { id: 'm4-3', from: 'me', ts: at(1, 16, 35), text: 'Node 3 loaded. Node 4 pending — will report by 2000.', status: 'read' },
        { id: 'm4-4', from: 'u8', ts: at(1, 19, 48), text: 'Node 4 complete.', reactions: { '🔥': ['u7'], '👍': ['me', 'u4'] } }
      ]
    },
    {
      id: 'c5', type: 'direct', userId: 'u5', unread: 1, pinned: false, muted: false, disappearing: 3600,
      messages: [
        { id: 'm5-1', from: 'u5', ts: minsAgo(140), text: 'FLASH — Comms degraded on the southern net. Need a retrans team pushed to Hill 402 ASAP.', prec: 'flash' }
      ]
    },
    {
      id: 'c6', type: 'direct', userId: 'u2', unread: 0, pinned: false, muted: false, disappearing: 0,
      messages: [
        { id: 'm6-1', from: 'u2', ts: at(4, 11, 0), text: 'Range card for next week is up on the board.' },
        { id: 'm6-2', from: 'me', ts: at(4, 11, 5), text: 'Saw it, thanks Sergeant.', status: 'read' }
      ]
    },
    {
      id: 'c7', type: 'direct', userId: 'u6', unread: 0, pinned: false, muted: false, disappearing: 0,
      messages: [
        { id: 'm7-1', from: 'me', ts: at(6, 15, 30), text: 'Drop the cable spools at HQ when you can.', status: 'read' },
        { id: 'm7-2', from: 'u6', ts: at(6, 15, 41), type: 'location', loc: '38S MB 4470 8790', text: 'At this location now.' }
      ]
    }
  ];

  var channels = [
    {
      id: 'ch1', type: 'channel', name: 'Battalion Announcements', unit: 'bn', posters: ['u9', 'u10', 'u5'], members: 412, admins: [], unread: 1, muted: false, disappearing: 0, color: '#7a5c2f', readOnly: true,
      messages: [
        { id: 'mc1-1', from: 'u9', ts: at(2, 8, 0), text: 'Reminder: Annual security training is due by the end of the month. Completion certificates go to S2.' },
        { id: 'mc1-2', from: 'u5', ts: at(0, 7, 0), text: 'Battalion formation Friday 0700, parade field. Duty uniform.', prec: 'priority' }
      ]
    },
    {
      id: 'ch2', type: 'channel', name: 'S6 Maintenance Bulletins', unit: 'bn', posters: ['u7'], members: 58, admins: [], unread: 0, muted: true, disappearing: 0, color: '#2f5c7a', readOnly: true,
      messages: [
        { id: 'mc2-1', from: 'u7', ts: at(5, 10, 0), text: 'Firmware 4.2.1 approved for all field radios. Schedule updates through your section NCO.' }
      ]
    }
    ,
    {
      id: 'ch3', type: 'channel', name: 'A Co Announcements', unit: 'a', posters: ['u1', 'u2'], members: 128, admins: [], unread: 1, muted: false, disappearing: 0, color: '#3d6fb4', readOnly: true,
      messages: [
        { id: 'mc3-1', from: 'u1', ts: at(1, 17, 0), text: 'Weapons maintenance Thursday 1300 at the arms room. All platoons.' },
        { id: 'mc3-2', from: 'u2', ts: minsAgo(80), text: 'Platoon sergeants: turn in leave forms to the orderly room by 1600.', prec: 'priority' }
      ]
    },
    {
      id: 'ch4', type: 'channel', name: 'B Co Announcements', unit: 'b', posters: ['u6'], members: 121, admins: [], unread: 0, muted: false, disappearing: 0, color: '#6f8f3d', readOnly: true,
      messages: [
        { id: 'mc4-1', from: 'u6', ts: at(2, 9, 30), text: 'Vehicle dispatch moved to 0800 tomorrow.' }
      ]
    },
    {
      id: 'ch5', type: 'channel', name: 'HQ Co Announcements', unit: 'hq', posters: [], members: 96, admins: [], unread: 0, muted: false, disappearing: 0, color: '#2f6b4f', readOnly: true,
      messages: [
        { id: 'mc5-0', type: 'system', ts: at(3, 8, 0), text: 'Channel created. An HQ Co admin can choose who posts here.' }
      ]
    }
  ];

  var calls = [
    { userId: 'u1', dir: 'in', kind: 'voice', ts: minsAgo(90), duration: '4:12' },
    { userId: 'u5', dir: 'missed', kind: 'voice', ts: minsAgo(150) },
    { userId: 'u4', dir: 'out', kind: 'video', ts: at(1, 18, 20), duration: '12:48' },
    { userId: 'u3', dir: 'out', kind: 'voice', ts: at(2, 13, 5), duration: '1:03' },
    { userId: 'u7', dir: 'missed', kind: 'video', ts: at(3, 21, 40) }
  ];

  var autoReplies = [
    'Roger.',
    'Copy, wilco.',
    'Acknowledged. Will update shortly.',
    'Understood. Standing by.',
    'Good copy. Thanks.',
    'Received. Moving on it now.'
  ];

  // ---- Sign-in personas (demo): who "me" becomes for each role
  var personas = {
    // scope: the unit an Admin manages (it and every unit under it). null = everything (Super Admin)
    superadmin: { username: 'r.vance',  name: 'Robin Vance', rank: 'CW3', unit: 'S6, 2-14 Signal Bn',    unitId: 'bn', scope: null, role: 'System Owner',                     callsign: 'NETOPS 1', color: '#5c3d8f' },
    admin:      { username: 'a.morgan', name: 'Alex Morgan', rank: 'SSG', unit: 'HQ Co, 2-14 Signal Bn', unitId: 'hq', scope: 'hq', role: 'Communications NCO · HQ Co admin', callsign: 'RELAY 6',  color: '#2f6b4f' },
    user:       { username: 'j.cruz',   name: 'Jamie Cruz',  rank: 'SPC', unit: 'A Co, 2-14 Signal Bn',  unitId: 'a',  role: 'Radio Operator',                   callsign: 'ALPHA 31', color: '#3d7f8f' }
  };

  // ---- Account directory (Admin console). ids u1..u8 map to users above.
  var accounts = [
    { id: 'u1', role: 'user',  status: 'active', device: 'Win 11 · LT-4471', lastSeen: minsAgo(3) },
    { id: 'u2', role: 'user',  status: 'active', device: 'Win 11 · LT-4502', lastSeen: minsAgo(25) },
    { id: 'u3', role: 'user',  status: 'active', device: 'Win 11 · LT-3920', lastSeen: minsAgo(8) },
    { id: 'u4', role: 'user',  status: 'active', device: 'Win 10 · WS-0113', lastSeen: minsAgo(60) },
    { id: 'u5', role: 'admin', scope: 'bn', status: 'active', device: 'Win 11 · LT-0007', lastSeen: minsAgo(140) },
    { id: 'u6', role: 'user',  status: 'active', device: 'Win 11 · LT-5120', lastSeen: minsAgo(2) },
    { id: 'u7', role: 'admin', scope: 'bn', status: 'active', device: 'Win 11 · WS-0201', lastSeen: minsAgo(45) },
    { id: 'u9', role: 'user', status: 'active', device: 'Win 11 · LT-0001', lastSeen: minsAgo(15) },
    { id: 'u10', role: 'user', status: 'active', device: 'Win 11 · LT-0002', lastSeen: minsAgo(70) },
    { id: 'u8', role: 'user',  status: 'locked', device: 'Win 10 · LT-2288', lastSeen: at(2, 18, 0), note: 'Device reported lost' },
    { id: 'x1', unitId: 'a', name: 'Quinn Rivera', rank: 'PV2', unit: 'A Co, 2-14 Signal Bn', color: '#8f6b3d', role: 'user', status: 'pending', requested: minsAgo(300) },
    { id: 'x2', unitId: 'a', name: 'Lee Harmon',   rank: 'CPT', unit: '1-22 IN (attached to A Co)',   color: '#3d5c8f', role: 'user', status: 'active', temporary: true, expires: at(-14, 23, 59), device: 'Win 11 · LN-9001', lastSeen: minsAgo(400) },
    { id: 'x3', unitId: 'b', name: 'Pat Doyle',    rank: 'SGT', unit: 'B Co, 2-14 Signal Bn', color: '#7a7a7a', role: 'user', status: 'suspended', device: 'Win 11 · LT-3307', lastSeen: at(9, 10, 0) }
  ];

  // ---- Audit trail. level 'system' entries are visible to the Super Admin only.
  var audit = [
    { ts: minsAgo(2),   actor: 'u6', action: 'Signed in',                         target: '',            device: 'LT-5120' },
    { ts: minsAgo(12),  actor: 'service', action: 'NETOPS Monitor posted an alert', target: 'S6 Network Cell', device: 'server', level: 'system' },
    { ts: minsAgo(55),  actor: 'u1', action: 'Sent IMMEDIATE message',           target: 'Alpha Company Ops', device: 'LT-4471' },
    { ts: minsAgo(140), actor: 'u5', action: 'Sent FLASH message',               target: 'MAJ Ellis → direct', device: 'LT-0007' },
    { ts: minsAgo(300), actor: 'x1', action: 'Requested an account',             target: '',            device: 'LT-6610' },
    { ts: at(1, 16, 5), actor: 'u7', action: 'Changed group admins',             target: 'S6 Network Cell', device: 'WS-0201' },
    { ts: at(2, 18, 30), actor: 'u7', action: 'Remote-locked device',            target: 'PFC Patel · LT-2288', device: 'WS-0201' },
    { ts: at(3, 9, 0),  actor: 'u1', action: 'Set disappearing messages to 24 hours', target: 'Alpha Company Ops', device: 'LT-4471' },
    { ts: at(4, 8, 15), actor: 'superadmin', action: 'Enforced policy: Screen lock 15 minutes', target: 'All users', device: 'WS-0001', level: 'system' },
    { ts: at(5, 10, 0), actor: 'u7', action: 'Created channel',                  target: 'S6 Maintenance Bulletins', device: 'WS-0201' },
    { ts: at(9, 10, 2), actor: 'x3', action: 'Failed sign-in (5 attempts)',      target: '',            device: 'LT-3307' },
    { ts: at(9, 10, 5), actor: 'u5', action: 'Suspended account',                target: 'SGT Doyle',   device: 'LT-0007' },
    { ts: at(10, 14, 0), actor: 'superadmin', action: 'Promoted to Admin',       target: 'CW2 Kim',     device: 'WS-0001', level: 'system' },
    { ts: at(12, 9, 30), actor: 'u5', action: 'Approved temporary account (30 days)', target: 'CPT Harmon', device: 'LT-0007' }
  ];

  // ---- Messages reported by users (moderation queue)
  var reports = [
    { id: 'r1', convId: 'c2',  msgId: 'm2-8',  reporter: 'u2', reason: 'Off-topic in an operations group', ts: minsAgo(3) },
    { id: 'r2', convId: 'ch1', msgId: 'mc1-1', reporter: 'u8', reason: 'Outdated information',            ts: at(1, 9, 0) }
  ];

  // ---- Automated accounts that post alerts (managed by the Super Admin)
  var serviceAccounts = [
    { id: 's1', name: 'WX-ALERT',       desc: 'Posts weather holds to Battalion Announcements', enabled: true,  lastRun: minsAgo(55) },
    { id: 's2', name: 'NETOPS Monitor', desc: 'Posts network outage alerts to S6 Network Cell',  enabled: true,  lastRun: minsAgo(12) },
    { id: 's3', name: 'ACCOUNT-SYNC',   desc: 'Syncs the personnel directory every 6 hours',      enabled: false, lastRun: at(3, 6, 0) }
  ];

  window.SyntraData = {
    me: me, users: users, conversations: conversations, channels: channels, calls: calls, autoReplies: autoReplies,
    units: units, personas: personas, accounts: accounts, audit: audit, reports: reports, serviceAccounts: serviceAccounts
  };
})();
