/* =========================================================
   Syntra — Admin console (front-end only)
   ---------------------------------------------------------
   Visible to Admin and Super Admin. Features of roles we chose
   not to have are folded in here:

   Admin (unit manager)
     - Users: approve requests, suspend/reactivate, reset sign-in,
       remote-lock lost devices, temporary (guest) accounts
     - Groups & channels: create channels, posting rights, archive
     - Moderation: handle reported messages        (was "Moderator")
     - Activity log for users                      (was "Auditor", partial)

   Super Admin (system owner) — everything Admin has, plus
     - Manage Admins and assign roles
     - Security policy: enforce settings for all   (was "Security officer")
     - Full activity log incl. system events       (was "Auditor")
     - Service accounts and system broadcasts      (was "Service account")
     - System status
   ========================================================= */

(function () {
  'use strict';

  var X = window.Syntra;
  var $ = X.$, $$ = X.$$, esc = X.esc, icon = X.icon, D = X.D, S = X.S;
  var current = null;

  var SECTIONS = [
    { id: 'overview', label: 'Overview',            icon: 'activity', perm: 'console', sub: 'Status and things that need attention' },
    { id: 'users',    label: 'Users & devices',     icon: 'group',    perm: 'users',   sub: 'Approve, suspend and manage accounts' },
    { id: 'groups',   label: 'Groups & moderation', icon: 'megaphone', perm: 'groups', sub: 'Channels, posting rights and reports' },
    { id: 'audit',    label: 'Activity log',        icon: 'file',     perm: 'audit',   sub: 'Who did what, and when' },
    { id: 'policy',   label: 'Security policy',     icon: 'shield',   perm: 'console', sub: 'Settings enforced for every user' },
    { id: 'system',   label: 'System',              icon: 'server',   perm: 'system',  sub: 'Admins, broadcasts and service accounts' }
  ];

  // ---------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------
  function sections() { return SECTIONS.filter(function (s) { return X.can(s.perm); }); }
  function acc(id) { return D.accounts.filter(function (a) { return a.id === id; })[0]; }
  function info(a) {
    var u = D.users[a.id];
    return u ? { name: u.name, rank: u.rank, unit: u.unit, color: u.color } : a;
  }
  function accName(a) { var i = info(a); return i.rank + ' ' + i.name; }
  function accAvatar(a, cls) {
    var i = info(a);
    return '<span class="avatar ' + (cls || 'sm') + '" style="--av:' + i.color + '">' + X.initials(i.name) + '</span>';
  }
  function when(ts) { return X.fmtDay(ts) + ' ' + X.fmtTime(ts); }
  function actorName(a) {
    if (a === 'me') return X.fullName(X.me);
    if (a === 'superadmin') return 'Super Admin';
    if (a === 'service') return 'Service account';
    var x = acc(a); return x ? accName(x) : a;
  }
  function log(action, target, level) {
    D.audit.unshift({ ts: Date.now(), actor: 'me', action: action, target: target || '', device: 'This computer', level: level });
  }
  function pendingCount() {
    if (!X.can('console')) return 0;
    return D.accounts.filter(function (a) { return a.status === 'pending'; }).length + D.reports.length;
  }
  // Admins manage Standard Users only; Super Admins manage everyone but themselves
  function canManage(a) {
    if (a.id === 'me') return false;
    return X.can('users.admins') || a.role === 'user';
  }
  function roleBadge(r) { return '<span class="role-badge role-' + r + '">' + X.roleLabel(r) + '</span>'; }
  var STATUS = {
    active:    ['ok',   'Active'],
    pending:   ['warn', 'Pending approval'],
    suspended: ['off',  'Suspended'],
    locked:    ['bad',  'Device locked']
  };
  function statusBadge(s) { return '<span class="status s-' + STATUS[s][0] + '">' + STATUS[s][1] + '</span>'; }
  function card(title, body, extra) {
    return '<section class="a-card"><div class="a-card-head"><h3>' + title + '</h3>' + (extra || '') + '</div>' + body + '</section>';
  }
  function refreshAll() { render(); X.renderList(); }

  // ---------------------------------------------------------
  // Sidebar navigation
  // ---------------------------------------------------------
  function navHTML() {
    var counts = {
      users: D.accounts.filter(function (a) { return a.status === 'pending'; }).length,
      groups: D.reports.length
    };
    return '<li class="list-section">Signed in as ' + X.roleLabel() + '</li>' + sections().map(function (s) {
      var n = counts[s.id];
      return '<li class="conv admin-nav' + (s.id === current ? ' active' : '') + '" data-admin="' + s.id + '">' +
        '<span class="avatar group admin-ico">' + icon(s.icon) + '</span>' +
        '<div class="conv-main"><div class="conv-top"><span class="conv-name">' + s.label + '</span></div>' +
        '<div class="conv-bottom"><span class="conv-preview">' + s.sub + '</span>' +
        (n ? '<span class="unread-badge">' + n + '</span>' : '') + '</div></div></li>';
    }).join('');
  }

  // ---------------------------------------------------------
  // Open / close / render
  // ---------------------------------------------------------
  function open(id) {
    var s = sections().filter(function (x) { return x.id === id; })[0] || sections()[0];
    current = s.id;
    $('#chatInner').classList.add('hidden');
    $('#emptyState').classList.add('hidden');
    X.showEl($('#adminPane'));
    $('#app').classList.add('chat-open');
    render(true);
    X.renderList();
  }
  function close() { current = null; closeMenu(); }

  function render(animate) {
    var pane = $('#adminPane');
    if (!current || pane.classList.contains('hidden')) return;
    var s = SECTIONS.filter(function (x) { return x.id === current; })[0];
    var scroll = $('.admin-body', pane) ? $('.admin-body', pane).scrollTop : 0;
    pane.innerHTML =
      '<header class="admin-head">' +
        '<button class="icon-btn back-btn" data-admin-back title="Back">' + icon('back') + '</button>' +
        '<div class="admin-title"><h2>' + s.label + '</h2><p>' + s.sub + '</p></div>' +
        roleBadge(X.getSession().role) +
      '</header>' +
      '<div class="admin-body' + (animate ? ' swap' : '') + '">' + VIEWS[current]() + '</div>';
    if (!animate) $('.admin-body', pane).scrollTop = scroll;
  }

  // ---------------------------------------------------------
  // Views
  // ---------------------------------------------------------
  var VIEWS = {};

  VIEWS.overview = function () {
    var a = D.accounts;
    var stats = [
      ['group',  a.filter(function (x) { return x.status === 'active'; }).length + 1, 'Active accounts', 'users'],
      ['user',   a.filter(function (x) { return x.status === 'pending'; }).length, 'Awaiting approval', 'users'],
      ['lock',   a.filter(function (x) { return x.status === 'locked'; }).length, 'Locked devices', 'users'],
      ['flag',   D.reports.length, 'Reported messages', 'groups']
    ];
    var html = '<div class="stat-grid">' + stats.map(function (s) {
      return '<button class="stat" data-goto="' + s[3] + '">' + icon(s[0]) + '<b>' + s[1] + '</b><span>' + s[2] + '</span></button>';
    }).join('') + '</div>';

    var duties = X.can('system')
      ? ['Everything an Admin can do, for all units', 'Assign and remove Admins', 'Enforce security policy for every user', 'See the full activity log, including system events', 'Send system-wide broadcasts and manage service accounts']
      : ['Approve account requests and set up temporary access', 'Suspend accounts and remote-lock lost devices', 'Create channels and control who can post', 'Review reported messages', 'View the user activity log'];
    html += card('What you can do as ' + X.roleLabel(),
      '<ul class="duty-list">' + duties.map(function (d) { return '<li>' + icon('check') + d + '</li>'; }).join('') + '</ul>' +
      '<button class="link-btn" data-guide="roles">' + icon('help') + 'Compare roles in the user guide</button>');

    var recent = visibleAudit().slice(0, 5);
    html += card('Recent activity', auditRows(recent), '<button class="link-btn" data-goto="audit">View all</button>');
    return html;
  };

  VIEWS.users = function () {
    var f = VIEWS.users.filter || 'all';
    var q = (VIEWS.users.q || '').toLowerCase();
    var mine = { id: 'me', role: X.getSession().role, status: 'active', device: 'This computer', lastSeen: Date.now() };
    var list = [mine].concat(D.accounts).filter(function (a) {
      if (f === 'temporary' && !a.temporary) return false;
      if (f !== 'all' && f !== 'temporary' && a.status !== f) return false;
      if (!q) return true;
      var i = a.id === 'me' ? X.me : info(a);
      return (i.rank + ' ' + i.name + ' ' + i.unit).toLowerCase().indexOf(q) !== -1;
    });
    var filters = [['all', 'All'], ['active', 'Active'], ['pending', 'Pending'], ['locked', 'Locked'], ['suspended', 'Suspended'], ['temporary', 'Temporary']];
    var html = '<div class="a-toolbar">' +
      '<div class="search a-search">' + icon('search') + '<input type="text" id="aUserSearch" placeholder="Search name or unit" value="' + esc(VIEWS.users.q || '') + '"></div>' +
      '<div class="chips">' + filters.map(function (x) { return '<button class="chip' + (f === x[0] ? ' active' : '') + '" data-ufilter="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<button class="btn primary" data-act="add-user">' + icon('plus') + 'Add user</button></div>';

    html += '<div class="utable"><div class="urow uhead"><span>Name</span><span>Unit</span><span>Account type</span><span>Status</span><span>Device · last seen</span><span></span></div>' +
      list.map(function (a) {
        var i = a.id === 'me' ? X.me : info(a);
        var avatar = a.id === 'me' ? X.userAvatar(X.me, 'sm') : accAvatar(a);
        var extra = a.temporary ? '<span class="tag">Temporary · until ' + new Date(a.expires).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + '</span>' : '';
        var seen = a.status === 'pending' ? 'Requested ' + X.fmtListTime(a.requested) : esc(a.device || '—') + ' · ' + X.fmtListTime(a.lastSeen);
        var actions = canManage(a)
          ? (a.status === 'pending'
              ? '<button class="btn sm primary" data-act="approve" data-id="' + a.id + '">Approve</button><button class="btn sm" data-act="deny" data-id="' + a.id + '">Deny</button>'
              : '<button class="icon-btn" data-menu="' + a.id + '" title="Actions">' + icon('more') + '</button>')
          : '<span class="muted-note">' + (a.id === 'me' ? 'You' : 'Super Admin only') + '</span>';
        return '<div class="urow">' +
          '<span class="u-name">' + avatar + '<span><b>' + esc(i.rank + ' ' + i.name) + (a.id === 'me' ? ' (you)' : '') + '</b>' + extra +
            (a.note ? '<small class="u-note">' + esc(a.note) + '</small>' : '') + '</span></span>' +
          '<span class="u-unit" data-label="Unit">' + esc(i.unit) + '</span>' +
          '<span data-label="Type">' + roleBadge(a.role) + '</span>' +
          '<span data-label="Status">' + statusBadge(a.status) + '</span>' +
          '<span class="u-seen" data-label="Device">' + seen + '</span>' +
          '<span class="u-actions">' + actions + '</span></div>';
      }).join('') + (list.length ? '' : '<div class="list-empty">No accounts match.</div>') + '</div>';
    if (!X.can('users.admins')) html += '<p class="set-note">As an Admin you manage Standard Users. Admin and Super Admin accounts are managed by the Super Admin.</p>';
    return html;
  };

  VIEWS.groups = function () {
    var convs = D.conversations.filter(function (c) { return c.type === 'group'; }).concat(D.channels);
    var rows = convs.map(function (c) {
      var members = c.type === 'channel' ? c.members : c.members.length;
      return '<div class="grow">' + X.avatarHTML(c, 'sm') +
        '<div class="g-main"><b>' + esc(c.name) + '</b><small>' + (c.type === 'channel' ? 'Channel' : 'Group') + ' · ' + members + ' members' +
          (c.disappearing ? ' · disappearing on' : '') + '</small></div>' +
        (c.type === 'channel'
          ? '<label class="g-toggle"><span>Only admins post</span><span class="switch"><input type="checkbox" data-act="readonly" data-id="' + c.id + '"' + (c.readOnly ? ' checked' : '') + '><span></span></span></label>'
          : '<span></span>') +
        '<div class="g-actions"><button class="btn sm" data-act="open-conv" data-id="' + c.id + '">Open</button>' +
        '<button class="icon-btn" data-act="archive" data-id="' + c.id + '" title="Archive">' + icon('trash') + '</button></div></div>';
    }).join('');
    var html = card('Groups & channels', '<div class="glist">' + rows + '</div>',
      '<button class="btn sm primary" data-act="new-channel">' + icon('plus') + 'New channel</button>');

    var reports = D.reports.map(function (r) {
      var c = X.getConv(r.convId), m = c && X.findMsg(c, r.msgId);
      var sender = m ? X.fullName(X.user(m.from)) : 'Unknown';
      return '<div class="report">' +
        '<div class="report-msg"><small>' + esc(sender) + ' in ' + esc(c ? X.convTitle(c) : '—') + '</small><p>' + esc(m ? (m.text || 'Attachment') : 'Message no longer exists') + '</p></div>' +
        '<div class="report-meta">' + icon('flag') + 'Reported by ' + esc(actorName(r.reporter)) + ' · ' + esc(r.reason) + ' · ' + X.fmtListTime(r.ts) + '</div>' +
        '<div class="report-actions"><button class="btn sm" data-act="dismiss" data-id="' + r.id + '">Dismiss</button>' +
        '<button class="btn sm" data-act="warn" data-id="' + r.id + '">Warn sender</button>' +
        '<button class="btn sm danger" data-act="remove-msg" data-id="' + r.id + '">Remove message</button></div></div>';
    }).join('');
    html += card('Reported messages' + (D.reports.length ? ' <span class="count">' + D.reports.length + '</span>' : ''),
      reports || '<p class="empty-note">' + icon('check') + 'Nothing to review.</p>');
    return html;
  };

  function visibleAudit() {
    return D.audit.filter(function (e) { return X.can('audit.system') || e.level !== 'system'; });
  }
  function auditRows(list) {
    if (!list.length) return '<p class="empty-note">No activity.</p>';
    return '<div class="atable">' + list.map(function (e) {
      return '<div class="arow"><span class="a-time">' + when(e.ts) + '</span>' +
        '<span class="a-what"><b>' + esc(actorName(e.actor)) + '</b> ' + esc(e.action.charAt(0).toLowerCase() + e.action.slice(1)) +
        (e.target ? ' <span class="a-target">' + esc(e.target) + '</span>' : '') +
        (e.level === 'system' ? ' <span class="tag">System</span>' : '') + '</span>' +
        '<span class="a-dev">' + esc(e.device) + '</span></div>';
    }).join('') + '</div>';
  }

  VIEWS.audit = function () {
    var q = (VIEWS.audit.q || '').toLowerCase();
    var list = visibleAudit().filter(function (e) {
      return !q || (actorName(e.actor) + ' ' + e.action + ' ' + e.target).toLowerCase().indexOf(q) !== -1;
    });
    return '<div class="a-toolbar"><div class="search a-search">' + icon('search') +
      '<input type="text" id="aAuditSearch" placeholder="Search activity" value="' + esc(VIEWS.audit.q || '') + '"></div>' +
      '<button class="btn" data-act="export-audit">' + icon('download') + 'Export CSV</button></div>' +
      auditRows(list) +
      (X.can('audit.system') ? '' : '<p class="set-note">System-level events (policy changes, role assignments) are visible to the Super Admin.</p>');
  };

  var POLICY_KEYS = ['classification', 'autoLock', 'defaultTimer', 'readReceipts', 'linkPreviews', 'hidePreviews', 'flashOverride'];
  var draft = {};
  function policyControl(e, v, dis) {
    var d = dis ? ' disabled' : '';
    if (e.type === 'toggle') return '<label class="switch"><input type="checkbox" data-pval="' + e.key + '"' + (v ? ' checked' : '') + d + '><span></span></label>';
    return '<select data-pval="' + e.key + '"' + d + '>' + e.options.map(function (o) {
      return '<option value="' + o[0] + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('') + '</select>';
  }
  VIEWS.policy = function () {
    var edit = X.can('policy');
    var html = edit ? '' : '<div class="a-banner">' + icon('lock') + 'Security policy is managed by the Super Admin. You can view it but not change it.</div>';
    html += card('Enforced settings',
      '<p class="a-help">When a setting is enforced, every user gets this value and cannot change it in their own Settings.</p>' +
      POLICY_KEYS.map(function (k) {
        var e = S.entry(k), on = S.isLocked(k);
        var v = on ? S.getPolicy(k) : (k in draft ? draft[k] : S.get(k));
        return '<div class="set-row"><div class="set-label"><b>' + e.label + '</b><small>' + (e.hint || '') + '</small></div>' +
          policyControl(e, v, !edit) +
          '<label class="enforce"><span>Enforce</span><span class="switch"><input type="checkbox" data-enforce="' + k + '"' + (on ? ' checked' : '') + (edit ? '' : ' disabled') + '><span></span></span></label></div>';
      }).join(''));
    var att = [['allowFiles', 'Documents', 'file'], ['allowPhotos', 'Photos', 'image'], ['allowLocation', 'Grid locations', 'map']];
    html += card('Allowed attachments',
      '<p class="a-help">Turn off attachment types that should never be shared on this network.</p>' +
      att.map(function (a) {
        return '<div class="set-row"><div class="set-label"><b>' + icon(a[2]) + a[1] + '</b></div><label class="switch"><input type="checkbox" data-allow="' + a[0] + '"' +
          (S.getPolicy(a[0]) !== false ? ' checked' : '') + (edit ? '' : ' disabled') + '><span></span></label></div>';
      }).join(''));
    if (edit) html += '<button class="btn danger" data-act="reset-policy">' + icon('reset') + 'Reset policy to defaults</button>';
    return html;
  };

  VIEWS.system = function () {
    var admins = D.accounts.filter(function (a) { return a.role === 'admin'; });
    var users = D.accounts.filter(function (a) { return a.role === 'user' && a.status === 'active'; });
    var html = card('Admins',
      '<div class="glist">' +
        '<div class="grow">' + X.userAvatar(X.me, 'sm') + '<div class="g-main"><b>' + esc(X.fullName(X.me)) + ' (you)</b><small>' + esc(X.me.unit) + '</small></div>' + roleBadge('superadmin') + '<span></span></div>' +
        admins.map(function (a) {
          return '<div class="grow">' + accAvatar(a) + '<div class="g-main"><b>' + esc(accName(a)) + '</b><small>' + esc(info(a).unit) + '</small></div>' +
            roleBadge('admin') + '<div class="g-actions"><button class="btn sm" data-act="demote" data-id="' + a.id + '">Remove admin</button></div></div>';
        }).join('') +
      '</div>' +
      '<div class="a-inline"><select id="aPromote">' + users.map(function (a) { return '<option value="' + a.id + '">' + esc(accName(a)) + '</option>'; }).join('') + '</select>' +
      '<button class="btn primary" data-act="promote">' + icon('plus') + 'Make Admin</button></div>');

    html += card('System broadcast',
      '<p class="a-help">Sends an announcement to every user through Battalion Announcements.</p>' +
      '<textarea id="aBroadcast" class="a-textarea" rows="3" placeholder="e.g. Network maintenance tonight 2200–2300. Expect short outages."></textarea>' +
      '<div class="a-inline"><select id="aBroadcastPrec">' + ['routine', 'priority', 'immediate', 'flash'].map(function (p) {
        return '<option value="' + p + '">' + X.PREC[p].label + '</option>';
      }).join('') + '</select><button class="btn primary" data-act="broadcast">' + icon('megaphone') + 'Send broadcast</button></div>');

    html += card('Service accounts',
      '<p class="a-help">Automated accounts that post alerts. They cannot sign in interactively.</p><div class="glist">' +
      D.serviceAccounts.map(function (s) {
        return '<div class="grow"><span class="avatar group sm" style="--av:#55605a">' + icon('server') + '</span>' +
          '<div class="g-main"><b>' + esc(s.name) + '</b><small>' + esc(s.desc) + ' · last run ' + X.fmtListTime(s.lastRun) + '</small></div>' +
          '<label class="g-toggle"><span>' + (s.enabled ? 'Enabled' : 'Disabled') + '</span><span class="switch"><input type="checkbox" data-act="svc" data-id="' + s.id + '"' + (s.enabled ? ' checked' : '') + '><span></span></span></label>' +
          '<div class="g-actions"><button class="btn sm" data-act="rotate" data-id="' + s.id + '">Rotate key</button></div></div>';
      }).join('') + '</div>');

    var status = [['Message server', 'Operational', 'ok'], ['Key server', 'Operational', 'ok'], ['Directory sync', 'Paused', 'warn'], ['Connected devices', '187', 'ok']];
    html += card('System status', '<div class="stat-grid small">' + status.map(function (s) {
      return '<div class="stat static"><span class="dot-status s-' + s[2] + '"></span><b>' + s[1] + '</b><span>' + s[0] + '</span></div>';
    }).join('') + '</div>');
    return html;
  };

  // ---------------------------------------------------------
  // Row action menu
  // ---------------------------------------------------------
  var menuEl = null;
  function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
  function openMenu(btn, id) {
    closeMenu();
    var a = acc(id); if (!a) return;
    var items = [];
    if (a.status === 'active') {
      items.push(['suspend', 'ban', 'Suspend account']);
      items.push(['lock-device', 'lock', 'Remote-lock device']);
      items.push(['reset-signin', 'key', 'Reset sign-in']);
    }
    if (a.status === 'locked') { items.push(['unlock-device', 'lock', 'Unlock device']); items.push(['wipe', 'trash', 'Wipe Syntra data on device', 1]); }
    if (a.status === 'suspended') items.push(['reactivate', 'check', 'Reactivate account']);
    if (a.temporary) items.push(['extend', 'clock', 'Extend access 30 days']);
    if (X.can('users.admins') && a.status !== 'pending') items.push(a.role === 'admin' ? ['demote', 'user', 'Change to Standard User'] : ['promote-one', 'console', 'Make Admin']);
    items.push(['remove', 'trash', 'Remove account', 1]);
    menuEl = document.createElement('div');
    menuEl.className = 'ctx-menu admin-menu';
    menuEl.innerHTML = items.map(function (it) {
      return '<button data-act="' + it[0] + '" data-id="' + id + '"' + (it[3] ? ' class="danger"' : '') + '>' + icon(it[1]) + it[2] + '</button>';
    }).join('');
    document.body.appendChild(menuEl);
    var r = btn.getBoundingClientRect();
    menuEl.style.left = Math.max(8, Math.min(r.right - menuEl.offsetWidth, window.innerWidth - menuEl.offsetWidth - 8)) + 'px';
    menuEl.style.top = (r.bottom + menuEl.offsetHeight + 8 > window.innerHeight ? r.top - menuEl.offsetHeight - 4 : r.bottom + 4) + 'px';
  }

  // ---------------------------------------------------------
  // Actions
  // ---------------------------------------------------------
  function act(name, id, el) {
    var a = acc(id);
    switch (name) {
      case 'approve': a.status = 'active'; a.device = 'Pending first sign-in'; a.lastSeen = Date.now(); log('Approved account', accName(a)); X.toast(icon('check') + accName(a) + ' approved'); break;
      case 'deny': return ask('Deny this request?', accName(a) + ' will not get a Syntra account.', 'Deny', 'ban', function () { D.accounts.splice(D.accounts.indexOf(a), 1); log('Denied account request', accName(a)); });
      case 'suspend': a.status = 'suspended'; log('Suspended account', accName(a)); X.toast(icon('ban') + accName(a) + ' suspended'); break;
      case 'reactivate': a.status = 'active'; log('Reactivated account', accName(a)); break;
      case 'lock-device': a.status = 'locked'; a.note = 'Locked remotely by ' + X.fullName(X.me); log('Remote-locked device', accName(a) + ' · ' + a.device); X.toast(icon('lock') + 'Device locked'); break;
      case 'unlock-device': a.status = 'active'; a.note = ''; log('Unlocked device', accName(a)); break;
      case 'wipe': return ask('Wipe this device?', 'All Syntra data on ' + accName(a) + '\'s device will be erased. This cannot be undone.', 'Wipe device', 'trash', function () { a.status = 'suspended'; a.note = 'Device wiped'; log('Wiped device', accName(a)); X.toast(icon('trash') + 'Wipe command sent'); });
      case 'reset-signin': log('Reset sign-in', accName(a)); X.toast(icon('key') + accName(a) + ' must set a new password at next sign-in'); break;
      case 'extend': a.expires += 30 * 86400000; log('Extended temporary access', accName(a)); X.toast(icon('clock') + 'Access extended'); break;
      case 'remove': return ask('Remove this account?', accName(a) + ' will lose access to Syntra.', 'Remove account', 'trash', function () { D.accounts.splice(D.accounts.indexOf(a), 1); log('Removed account', accName(a)); });
      case 'promote-one': a.role = 'admin'; log('Promoted to Admin', accName(a), 'system'); X.toast(accName(a) + ' is now an Admin'); break;
      case 'promote': var p = acc($('#aPromote').value); if (!p) return; p.role = 'admin'; log('Promoted to Admin', accName(p), 'system'); X.toast(accName(p) + ' is now an Admin'); break;
      case 'demote': a.role = 'user'; log('Removed Admin role', accName(a), 'system'); X.toast(accName(a) + ' is now a Standard User'); break;
      case 'add-user': addUserModal(); return;

      case 'open-conv':
        var c = X.getConv(id);
        X.setView(c.type === 'channel' ? 'channels' : 'chats');
        X.openConv(id); return;
      case 'readonly': X.getConv(id).readOnly = el.checked; log(el.checked ? 'Limited posting to admins' : 'Allowed everyone to post', X.getConv(id).name); break;
      case 'archive':
        var cv = X.getConv(id);
        return ask('Archive “' + cv.name + '”?', 'Members will no longer see it.', 'Archive', 'trash', function () {
          if (cv.type === 'channel') D.channels.splice(D.channels.indexOf(cv), 1); else D.conversations.splice(D.conversations.indexOf(cv), 1);
          if (X.state.activeId === id) X.state.activeId = null;
          log('Archived ' + cv.type, cv.name);
        });
      case 'new-channel': newChannelModal(); return;
      case 'dismiss': D.reports = D.reports.filter(function (r) { return r.id !== id; }); log('Dismissed a report'); break;
      case 'warn':
        var rw = D.reports.filter(function (r) { return r.id === id; })[0];
        var cw = X.getConv(rw.convId), mw = cw && X.findMsg(cw, rw.msgId);
        D.reports = D.reports.filter(function (r) { return r.id !== id; });
        log('Warned sender', mw ? X.fullName(X.user(mw.from)) : ''); X.toast(icon('flag') + 'Warning sent'); break;
      case 'remove-msg':
        var rr = D.reports.filter(function (r) { return r.id === id; })[0];
        var cr = X.getConv(rr.convId);
        if (cr) cr.messages = cr.messages.filter(function (m) { return m.id !== rr.msgId; });
        D.reports = D.reports.filter(function (r) { return r.id !== id; });
        log('Removed reported message', cr ? X.convTitle(cr) : ''); X.toast(icon('trash') + 'Message removed for everyone'); break;

      case 'export-audit':
        var csv = 'time,actor,action,target,device\n' + visibleAudit().map(function (e) {
          return [new Date(e.ts).toISOString(), actorName(e.actor), e.action, e.target, e.device].map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(',');
        }).join('\n');
        var link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        link.download = 'syntra-activity-log.csv'; link.click();
        log('Exported activity log'); break;

      case 'reset-policy': return ask('Reset security policy?', 'Every enforced setting is released and attachments are allowed again.', 'Reset policy', 'reset', function () { S.resetPolicy(); draft = {}; log('Reset security policy', 'All users', 'system'); });

      case 'broadcast':
        var txt = $('#aBroadcast').value.trim();
        if (!txt) { X.toast(icon('alert') + 'Write a message first'); return; }
        var prec = $('#aBroadcastPrec').value;
        var ch = X.getConv('ch1');
        if (ch) { var msg = { id: X.uid(), from: 'me', ts: Date.now(), text: txt, status: 'delivered' }; if (prec !== 'routine') msg.prec = prec; ch.messages.push(msg); }
        log('Sent system broadcast (' + X.PREC[prec].label + ')', 'All users', 'system');
        X.toast(icon('megaphone') + 'Broadcast sent to all users'); break;
      case 'svc': var s = D.serviceAccounts.filter(function (x) { return x.id === id; })[0]; s.enabled = el.checked; log((s.enabled ? 'Enabled' : 'Disabled') + ' service account', s.name, 'system'); break;
      case 'rotate': var s2 = D.serviceAccounts.filter(function (x) { return x.id === id; })[0]; log('Rotated service account key', s2.name, 'system'); X.toast(icon('key') + 'New key issued for ' + s2.name); break;
    }
    refreshAll();
  }

  // Confirm with the in-app dialog, then run fn and refresh
  function ask(title, message, label, ico, fn) {
    X.confirm({ title: title, message: message, confirmLabel: label, danger: true, icon: ico })
      .then(function (ok) { if (ok) { fn(); refreshAll(); } });
  }

  function addUserModal() {
    var types = '<option value="user">Standard User</option>' + (X.can('users.admins') ? '<option value="admin">Admin</option>' : '');
    var m = X.openModal('Add user',
      '<div class="modal-body">' +
        '<div class="field-row"><div class="field"><label>Rank</label><input type="text" id="nuRank" placeholder="SGT"></div>' +
        '<div class="field" style="flex:3"><label>Full name</label><input type="text" id="nuName" placeholder="First Last"></div></div>' +
        '<div class="field"><label>Unit</label><input type="text" id="nuUnit" placeholder="A Co, 2-14 Signal Bn"></div>' +
        '<div class="field"><label>Account type</label><select id="nuRole">' + types + '</select></div>' +
        '<div class="set-row"><div class="set-label"><b>Temporary access</b><small>For attached or visiting personnel. Access ends automatically.</small></div>' +
          '<label class="switch"><input type="checkbox" id="nuTemp"><span></span></label></div>' +
        '<div class="field hidden" id="nuDaysField"><label>Access length</label><select id="nuDays"><option value="7">7 days</option><option value="14">14 days</option><option value="30" selected>30 days</option><option value="90">90 days</option></select></div>' +
      '</div>',
      '<button class="btn" data-close>Cancel</button><button class="btn primary" id="nuGo">Create account</button>');
    $('#nuTemp', m).addEventListener('change', function () { $('#nuDaysField', m).classList.toggle('hidden', !this.checked); });
    $('#nuGo', m).addEventListener('click', function () {
      var name = $('#nuName', m).value.trim();
      if (!name) { $('#nuName', m).focus(); return; }
      var a = {
        id: 'n' + Date.now(), name: name, rank: $('#nuRank', m).value.trim().toUpperCase() || 'PVT',
        unit: $('#nuUnit', m).value.trim() || X.me.unit, color: '#5f6f8f', role: $('#nuRole', m).value,
        status: 'active', device: 'Pending first sign-in', lastSeen: Date.now()
      };
      if ($('#nuTemp', m).checked) { a.temporary = true; a.expires = Date.now() + parseInt($('#nuDays', m).value, 10) * 86400000; }
      D.accounts.push(a);
      log('Created ' + (a.temporary ? 'temporary ' : '') + 'account', accName(a), a.role === 'admin' ? 'system' : undefined);
      X.closeModal(); refreshAll();
      X.toast(icon('check') + 'Account created for ' + esc(accName(a)));
    });
  }

  function newChannelModal() {
    var m = X.openModal('New channel',
      '<div class="modal-body"><div class="field"><label>Channel name</label><input type="text" id="ncName" placeholder="e.g. Range Control"></div>' +
      '<div class="set-row"><div class="set-label"><b>Only admins can post</b><small>Everyone else can read and react</small></div><label class="switch"><input type="checkbox" id="ncRo" checked><span></span></label></div></div>',
      '<button class="btn" data-close>Cancel</button><button class="btn primary" id="ncGo2">Create</button>');
    $('#ncGo2', m).addEventListener('click', function () {
      var name = $('#ncName', m).value.trim();
      if (!name) { $('#ncName', m).focus(); return; }
      D.channels.push({ id: 'ch' + Date.now(), type: 'channel', name: name, members: 1, admins: ['me'], unread: 0, muted: false, disappearing: 0, color: '#4a5c7a', readOnly: $('#ncRo', m).checked,
        messages: [{ id: X.uid(), type: 'system', ts: Date.now(), text: 'You created this channel' }] });
      log('Created channel', name);
      X.closeModal(); refreshAll();
    });
  }

  // ---------------------------------------------------------
  // Events (delegated on the pane)
  // ---------------------------------------------------------
  var pane = $('#adminPane');
  pane.addEventListener('click', function (e) {
    if (e.target.closest('[data-admin-back]')) { X.leaveAdminPane(); X.renderList(); return; }
    var go = e.target.closest('[data-goto]'); if (go) { open(go.dataset.goto); return; }
    var uf = e.target.closest('[data-ufilter]'); if (uf) { VIEWS.users.filter = uf.dataset.ufilter; render(); return; }
    var mb = e.target.closest('[data-menu]'); if (mb) { e.stopPropagation(); openMenu(mb, mb.dataset.menu); return; }
    var b = e.target.closest('button[data-act]'); if (b) act(b.dataset.act, b.dataset.id, b);
  });
  pane.addEventListener('change', function (e) {
    var el = e.target;
    if (el.matches('input[data-act]')) { act(el.dataset.act, el.dataset.id, el); return; }
    if (el.dataset.pval) {
      var k = el.dataset.pval, v = el.type === 'checkbox' ? el.checked : el.value;
      draft[k] = v;
      if (S.isLocked(k)) { S.setPolicy(k, v); log('Changed policy: ' + S.entry(k).label, 'All users', 'system'); }
      return;
    }
    if (el.dataset.enforce) {
      var key = el.dataset.enforce;
      var ctl = $('[data-pval="' + key + '"]', pane);
      var val = ctl.type === 'checkbox' ? ctl.checked : ctl.value;
      S.setPolicy(key, el.checked ? val : undefined);
      log((el.checked ? 'Enforced' : 'Stopped enforcing') + ' policy: ' + S.entry(key).label, 'All users', 'system');
      X.toast(icon('shield') + S.entry(key).label + (el.checked ? ' is now enforced for all users' : ' is no longer enforced'));
      return;
    }
    if (el.dataset.allow) {
      S.setPolicy(el.dataset.allow, el.checked);
      log((el.checked ? 'Allowed' : 'Blocked') + ' attachment type: ' + el.dataset.allow.replace('allow', ''), 'All users', 'system');
    }
  });
  pane.addEventListener('input', function (e) {
    if (e.target.id === 'aUserSearch' || e.target.id === 'aAuditSearch') {
      var view = e.target.id === 'aUserSearch' ? VIEWS.users : VIEWS.audit;
      view.q = e.target.value;
      var pos = e.target.selectionStart;
      render();
      var inp = $('#' + e.target.id); inp.focus(); inp.setSelectionRange(pos, pos);
    }
  });
  document.addEventListener('click', function (e) {
    if (!menuEl) return;
    var b = e.target.closest('.admin-menu button[data-act]');
    if (b) { var a = b.dataset.act, id = b.dataset.id; closeMenu(); act(a, id, b); return; }
    if (!e.target.closest('.admin-menu')) closeMenu();
  });
  window.addEventListener('resize', closeMenu);
  pane.addEventListener('scroll', closeMenu, true);

  window.SyntraAdmin = {
    navHTML: navHTML, open: open, close: close, refresh: function () { render(); },
    current: function () { return current; }, pendingCount: pendingCount
  };
})();
