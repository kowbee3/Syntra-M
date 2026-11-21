/* =========================================================
   Syntra — built-in user guide
   Content lives in SECTIONS below; add a section by adding an
   entry. Open from anywhere with an element that has
   data-guide="<section id>", the ? button, or F1.
   ========================================================= */

(function () {
  'use strict';

  var X = window.Syntra;
  var $ = X.$, $$ = X.$$, icon = X.icon, esc = X.esc;

  function kbd(keys) { return keys.split(' ').map(function (k) { return '<kbd>' + k + '</kbd>'; }).join(''); }
  function tip(html) { return '<div class="g-tip">' + icon('info') + '<div>' + html + '</div></div>'; }
  function yes() { return '<span class="g-yes">' + icon('check') + '</span>'; }
  function no() { return '<span class="g-no">—</span>'; }

  var SECTIONS = [
    {
      id: 'start', title: 'Getting started', icon: 'book',
      html: function () {
        return '<h2>Getting started</h2>' +
          '<p>Syntra is a secure messaging app for desktop computers. Every message and call is end-to-end encrypted: only the people in the conversation can read it.</p>' +
          '<h3>Signing in</h3><ol>' +
          '<li>Choose your account type: <b>Standard User</b>, <b>Admin</b> or <b>Super Admin</b>. Pick the one your account was issued as.</li>' +
          '<li>Enter your username or DoD ID and your password, or use your CAC / PIV card.</li>' +
          '<li>Tick <b>Keep me signed in</b> only on a computer that is issued to you.</li></ol>' +
          '<h3>The screen</h3><ul>' +
          '<li><b>Left bar:</b> Chats, Channels, Directory, Calls and Saved. Admins also see the <b>Admin console</b>. At the bottom: this guide, dark mode, lock, settings and your profile.</li>' +
          '<li><b>Chat list:</b> your conversations. Pinned chats stay on top. Use the filters to show only unread, direct, group or priority messages.</li>' +
          '<li><b>Conversation:</b> messages, and the message box at the bottom. Click the name at the top to open details.</li></ul>' +
          '<p>On a narrow window or small screen, Syntra shows one panel at a time with a tab bar at the bottom. Use the back arrow to return to your chats.</p>' +
          tip('New to precedence? Read <a href="#" data-guide="precedence">Message precedence</a> before sending anything other than Routine.');
      }
    },
    {
      id: 'precedence', title: 'Message precedence', icon: 'alert',
      html: function () {
        return '<h2>Message precedence</h2>' +
          '<p>Precedence tells recipients how urgent a message is and how fast they should act on it. You choose it with the button just left of <b>Send</b>. It shows the current level, for example <span class="g-chip routine">Routine</span>.</p>' +
          '<h3>The four levels</h3>' +
          '<div class="g-table-wrap"><table class="g-table"><thead><tr><th>Level</th><th>Code</th><th>Use it for</th><th>Act within*</th><th>What Syntra does</th></tr></thead><tbody>' +
          '<tr><td><span class="g-chip routine">Routine</span></td><td><kbd>R</kbd></td><td>Normal day-to-day traffic: admin, logistics, coordination, questions.</td><td>Normal duty hours (about 6 h)</td><td>Sent normally. No tag.</td></tr>' +
          '<tr><td><span class="g-chip priority">Priority</span></td><td><kbd>P</kbd></td><td>Important, time-sensitive information that needs prompt action.</td><td>About 3 hours</td><td>Blue <b>PRIORITY</b> tag. Shows under the Priority filter.</td></tr>' +
          '<tr><td><span class="g-chip immediate">Immediate</span></td><td><kbd>O</kbd></td><td>Situations that seriously affect an ongoing mission, operation or security.</td><td>About 30 minutes</td><td>Orange tag and outline. Shows under the Priority filter.</td></tr>' +
          '<tr><td><span class="g-chip flash">Flash</span></td><td><kbd>Z</kbd></td><td>Emergencies only: threat to life or safety, enemy contact, mission-critical events.</td><td>As fast as possible (under 10 min)</td><td>Red <b>FLASH</b> tag and outline. Asks you to confirm before sending. Alerts recipients even if they set Do Not Disturb.</td></tr>' +
          '</tbody></table></div>' +
          '<p class="g-small">* Typical handling objectives from military message-handling doctrine. Always follow your unit’s SOP.</p>' +
          '<h3>Why letters like “R” and “Z”?</h3>' +
          '<p>Each level has a one-letter <b>prosign</b> used in military message handling: <b>R</b> Routine, <b>P</b> Priority, <b>O</b> Immediate, <b>Z</b> Flash. They let experienced operators recognise urgency at a glance. Syntra shows the full name on the button and lists the letters in the menu for anyone who knows them.</p>' +
          '<h3>How to set it</h3><ol>' +
          '<li>Type your message.</li>' +
          '<li>Click the precedence button (it shows <b>Routine</b> by default) and pick a level.</li>' +
          '<li>Press <b>Send</b>. For Flash, confirm when asked.</li></ol>' +
          '<p>Precedence goes back to Routine after each message, so you never send a Flash by accident.</p>' +
          '<h3>Good practice</h3><ul>' +
          '<li>Use the <b>lowest level that fits</b>. If everything is urgent, nothing is.</li>' +
          '<li>Don’t raise precedence to get a faster reply to a routine question.</li>' +
          '<li>Put the key fact in the first line: who, what, where, and what action you need.</li></ul>' +
          '<h3>Examples</h3><ul class="g-examples">' +
          '<li><span class="g-chip routine">Routine</span> “Range card for next week is posted.”</li>' +
          '<li><span class="g-chip priority">Priority</span> “Rally point moved to grid 38S MB 4512 8833. Brief your section before 1000.”</li>' +
          '<li><span class="g-chip immediate">Immediate</span> “Weather hold until 1400. Secure all equipment now.”</li>' +
          '<li><span class="g-chip flash">Flash</span> “Comms down on the southern net. Retrans team needed at Hill 402 now.”</li></ul>' +
          tip('There is also a higher level, Flash Override (Y), reserved for national command authorities. It is not available in Syntra.');
      }
    },
    {
      id: 'messaging', title: 'Messaging', icon: 'chat',
      html: function () {
        return '<h2>Messaging</h2>' +
          '<h3>Start a conversation</h3><p>Click the pencil icon above your chat list (' + kbd('Ctrl N') + '). Pick one person for a direct chat, or several to create a group. You can also open anyone from the <b>Directory</b>.</p>' +
          '<h3>Send</h3><p>Press ' + kbd('Enter') + ' to send and ' + kbd('Shift Enter') + ' for a new line. You can switch to ' + kbd('Ctrl Enter') + ' in Settings › General Settings › Keyboard. Unsent text is kept as a draft.</p>' +
          '<h3>Message actions</h3><p>Hover over a message (or right-click, or press and hold on a touch screen) to:</p><ul>' +
          '<li><b>React</b> with an emoji. Double-click a message for a quick 👍.</li>' +
          '<li><b>Reply</b> to quote it. Press ' + kbd('↑') + ' in an empty message box to reply to the last message you received.</li>' +
          '<li><b>Forward</b>, <b>Copy</b>, <b>Pin</b> it to the top of the chat, or <b>Save</b> it to your Saved list.</li>' +
          '<li><b>Message info</b> shows when it was delivered and read.</li></ul>' +
          '<h3>Ticks</h3><ul><li>' + icon('clock') + ' Sending</li><li>' + icon('check') + ' Sent</li><li>' + icon('check2') + ' Delivered</li><li><span class="g-read">' + icon('check2') + '</span> Read</li></ul>' +
          '<h3>Attachments</h3><p>Use the paperclip to send a document, a photo or a grid location. Your Super Admin may turn some types off.</p>' +
          '<h3>Find things</h3><p>' + kbd('Ctrl K') + ' searches all chats. ' + kbd('Ctrl F') + ' searches inside the open conversation.</p>' +
          '<h3>Channels</h3><p>Channels are for announcements. Everyone can read and react, but usually only Admins can post.</p>';
      }
    },
    {
      id: 'calls', title: 'Calls', icon: 'phone',
      html: function () {
        return '<h2>Calls</h2><p>Use the phone or camera icon at the top of a conversation to start an encrypted voice or video call. During a call you can mute your microphone, turn the camera on or off, and end the call. Past calls are listed under <b>Calls</b>; click one to call back.</p>';
      }
    },
    {
      id: 'security', title: 'Security & privacy', icon: 'shield',
      html: function () {
        return '<h2>Security & privacy</h2>' +
          '<h3>Encryption</h3><p>Messages and calls are end-to-end encrypted. Not even Syntra’s servers can read them.</p>' +
          '<h3>Safety numbers</h3><p>To be sure you are talking to the right person, open their details and choose <b>View safety number</b>. Compare it with their screen in person, or scan the code. Then choose <b>Mark as verified</b>. A ' + icon('shield') + ' shield appears next to verified contacts.</p>' +
          '<h3>Disappearing messages</h3><p>In a conversation’s details, set a timer so messages delete themselves after they are read. A ' + icon('timer') + ' icon shows when it is on.</p>' +
          '<h3>Screen lock</h3><p>Syntra locks itself after a period of inactivity. Lock it yourself with ' + kbd('Ctrl L') + ' whenever you leave your desk.</p>' +
          '<h3>Classification banner</h3><p>The coloured bar at the top shows the highest classification allowed on this system. Never send information above that level.</p>' +
          '<h3>Lost or stolen computer</h3><p>Tell an Admin straight away. They can remotely lock the device or wipe Syntra’s data from it.</p>' +
          '<h3>Signing out</h3><p>Open the ' + icon('menu') + ' menu › <b>More</b> › <b>Sign Out</b>, or scroll to the bottom of <b>Settings</b>. If you are locked out of the lock screen, use <b>Forgot PIN? Sign out</b>.</p>';
      }
    },
    {
      id: 'customize', title: 'Customizing Syntra', icon: 'settings',
      html: function () {
        return '<h2>Customizing Syntra</h2><p>Open Settings from the ' + icon('menu') + ' menu, the gear icon, your avatar, or ' + kbd('Ctrl ,') + '. Settings slide in over your chat list so you can see changes in the open chat straight away. Use ' + icon('search') + ' to search all settings.</p><ul>' +
          '<li><b>Notifications and Sounds:</b> alerts, sounds, hiding message text, Flash confirmation.</li>' +
          '<li><b>Data and Storage:</b> storage used, clearing the cache, automatic downloads, and backing up your settings to a file.</li>' +
          '<li><b>Privacy and Security:</b> read receipts, typing indicators, default disappearing timer, screen lock.</li>' +
          '<li><b>General Settings:</b> text size, chat wallpaper, power saving (animations), color theme and accent, Day / Dark / <b>Night ops</b> / System theme, time format, send key, bubbles, font and layout.</li>' +
          '<li><b>Chat Folders:</b> choose which filters (Unread, Direct, Groups, Priority) appear above your chats.</li>' +
          '<li><b>Emoji and Reactions:</b> large emoji, and the quick reaction used when you double-click a message.</li>' +
          '<li><b>Speakers and Camera</b>, <b>Devices</b> (sign out other sessions), <b>Language</b>, <b>Accessibility</b> and <b>Keyboard Shortcuts</b>.</li></ul>' +
          '<p>The ' + icon('menu') + ' menu also has quick switches under <b>More</b>: dark mode, reduce animations, lock and sign out.</p>' +
          tip('Settings marked ' + icon('lock') + ' <b>Managed</b> are enforced by your Super Admin and can’t be changed.');
      }
    },
    {
      id: 'roles', title: 'Account types', icon: 'group',
      html: function () {
        var rows = [
          ['Messaging, calls, groups and channels', 1, 1, 1],
          ['Personal settings', 1, 1, 1],
          ['Create groups and manage groups you own', 1, 1, 1],
          ['Post in announcement channels', 0, 1, 1],
          ['Approve, suspend and reactivate accounts', 0, 'Standard Users', 'Everyone'],
          ['Temporary accounts for attached personnel', 0, 1, 1],
          ['Remote-lock or wipe lost devices', 0, 1, 1],
          ['Review reported messages', 0, 1, 1],
          ['Activity log', 0, 'User activity', 'Full, incl. system'],
          ['Make or remove Admins', 0, 0, 1],
          ['Security policy (enforced settings, attachments)', 0, 'View only', 1],
          ['System broadcasts and service accounts', 0, 0, 1]
        ];
        var cell = function (v) { return '<td>' + (v === 1 ? yes() : v === 0 ? no() : '<span class="g-partial">' + v + '</span>') + '</td>'; };
        return '<h2>Account types</h2><p>Syntra has three account types. Each one includes everything the one before it can do.</p>' +
          '<div class="g-roles">' +
          '<div class="g-role"><span class="role-badge role-user">Standard User</span><p>Everyday messaging and calls. Owns and manages the groups they create.</p></div>' +
          '<div class="g-role"><span class="role-badge role-admin">Admin</span><p>Unit manager. Looks after Standard User accounts, devices, channels and reported messages.</p></div>' +
          '<div class="g-role"><span class="role-badge role-superadmin">Super Admin</span><p>System owner. Appoints Admins, sets security policy for everyone and sees the full activity log.</p></div></div>' +
          '<div class="g-table-wrap"><table class="g-table g-matrix"><thead><tr><th>Feature</th><th>Standard User</th><th>Admin</th><th>Super Admin</th></tr></thead><tbody>' +
          rows.map(function (r) { return '<tr><td>' + r[0] + '</td>' + cell(r[1]) + cell(r[2]) + cell(r[3]) + '</tr>'; }).join('') +
          '</tbody></table></div>' +
          tip('Keep the number of Super Admins small (two or three), and make sure Admins are different people from the Super Admin wherever possible.');
      }
    },
    {
      id: 'admin', title: 'Admin console', icon: 'console',
      html: function () {
        return '<h2>Admin console</h2><p><i>For Admins and Super Admins.</i> Open it from the ' + icon('console') + ' icon in the left bar or with ' + kbd('Ctrl 5') + '. A number on the icon means something needs your attention.</p>' +
          '<h3>Users & devices</h3><ul>' +
          '<li><b>Approve or deny</b> new account requests.</li>' +
          '<li><b>Add user</b> creates an account. Turn on <b>Temporary access</b> for attached or visiting personnel; it ends automatically.</li>' +
          '<li>Use the ' + icon('more') + ' menu on a row to suspend an account, reset its sign-in, <b>remote-lock</b> a lost device or <b>wipe</b> Syntra from it.</li></ul>' +
          '<h3>Groups & moderation</h3><p>Create channels, choose whether only admins can post, and archive groups. <b>Reported messages</b> lets you dismiss a report, warn the sender or remove the message for everyone.</p>' +
          '<h3>Activity log</h3><p>Shows sign-ins, account changes and other actions. Search it or export it as CSV for an audit.</p>' +
          '<h3>Security policy (Super Admin)</h3><p>Pick a value and switch on <b>Enforce</b> to apply it to every user and lock it in their Settings. You can also block attachment types.</p>' +
          '<h3>System (Super Admin)</h3><p>Make or remove Admins, send a broadcast to all users, and manage service accounts (automated accounts that post alerts).</p>';
      }
    },
    {
      id: 'shortcuts', title: 'Keyboard shortcuts', icon: 'key',
      html: function () {
        var list = [['Ctrl K', 'Search all chats'], ['Ctrl N', 'New message'], ['Ctrl F', 'Search in conversation'], ['Ctrl 1', 'Chats'], ['Ctrl 2', 'Channels'], ['Ctrl 3', 'Directory'], ['Ctrl 4', 'Calls'], ['Ctrl 5', 'Admin console'],
          ['Alt ↑', 'Previous chat'], ['Alt ↓', 'Next chat'], ['↑', 'Reply to last message (empty box)'], ['Ctrl D', 'Toggle dark mode'], ['Ctrl ,', 'Settings'], ['Ctrl L', 'Lock Syntra'], ['F1', 'This guide'], ['Esc', 'Close / cancel / go back']];
        return '<h2>Keyboard shortcuts</h2><div class="g-keys">' + list.map(function (k) {
          return '<div class="info-field"><span>' + k[1] + '</span><span>' + kbd(k[0]) + '</span></div>';
        }).join('') + '</div>';
      }
    }
  ];

  function open(section) {
    var sec = SECTIONS.filter(function (s) { return s.id === section; })[0] || SECTIONS[0];
    var m = X.openModal(icon('book') + ' User guide',
      '<div class="settings guide"><nav class="settings-nav">' +
        '<div class="search g-search">' + icon('search') + '<input type="text" id="gSearch" placeholder="Search the guide"></div>' +
        SECTIONS.map(function (s) { return '<button data-gsec="' + s.id + '">' + icon(s.icon) + '<span>' + s.title + '</span></button>'; }).join('') +
        '<p class="g-none hidden" id="gNone">No matches</p>' +
      '</nav><div class="settings-pane guide-pane" id="gPane"></div></div>', '', 'wide guide-modal');

    function show(id) {
      var s = SECTIONS.filter(function (x) { return x.id === id; })[0];
      var p = $('#gPane', m);
      p.innerHTML = s.html();
      p.scrollTop = 0;
      p.classList.remove('swap'); void p.offsetWidth; p.classList.add('swap');
      $$('[data-gsec]', m).forEach(function (b) { b.classList.toggle('active', b.dataset.gsec === id); });
      var q = $('#gSearch', m).value.trim();
      if (q) highlight(p, q);
    }
    function highlight(root, q) {
      var re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function (n) {
        if (!re.test(n.nodeValue)) return;
        var span = document.createElement('span');
        span.innerHTML = esc(n.nodeValue).replace(re, function (x) { return '<mark>' + x + '</mark>'; });
        n.parentNode.replaceChild(span, n);
      });
      var first = root.querySelector('mark'); if (first) first.scrollIntoView({ block: 'center' });
    }

    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-gsec]'); if (b) show(b.dataset.gsec);
      var link = e.target.closest('#gPane [data-guide]');
      if (link) { e.preventDefault(); e.stopPropagation(); show(link.dataset.guide); }
    });
    $('#gSearch', m).addEventListener('input', function () {
      var q = this.value.trim().toLowerCase(), firstHit = null;
      SECTIONS.forEach(function (s) {
        var hit = !q || (s.title + ' ' + s.html().replace(/<[^>]+>/g, ' ')).toLowerCase().indexOf(q) !== -1;
        $('[data-gsec="' + s.id + '"]', m).classList.toggle('hidden', !hit);
        if (hit && !firstHit) firstHit = s.id;
      });
      $('#gNone', m).classList.toggle('hidden', !!firstHit);
      if (firstHit) show(firstHit);
    });
    show(sec.id);
  }

  window.SyntraGuide = { open: open, sections: SECTIONS };
})();
