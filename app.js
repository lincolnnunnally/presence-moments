// Presence App — simple, local-first MVP
const SAMPLE_MOMENTS = [
  {
    id: 's1',
    activity: 'Coffee',
    title: 'Quiet morning coffee',
    date: getFutureDate(1),
    time: '09:30',
    place: 'Local coffee shop (near Main St)',
    city: 'Stockbridge',
    capacity: 4,
    vibes: ['Quiet & accepting', 'Introvert-friendly', 'No agenda'],
    note: 'Just good coffee and easy conversation. No pressure to talk if you prefer quiet.',
    host: 'You (sample)',
    joined: 1
  },
  {
    id: 's2',
    activity: 'Walk',
    title: 'Evening walk & talk',
    date: getFutureDate(2),
    time: '18:00',
    place: 'City Park entrance',
    city: 'Conyers',
    capacity: 5,
    vibes: ['Encouraging', 'Open conversation'],
    note: 'Casual walk. Bring comfortable shoes. All welcome.',
    host: 'Community host',
    joined: 2
  },
  {
    id: 's3',
    activity: 'Meal',
    title: 'Simple shared meal',
    date: getFutureDate(3),
    time: '12:30',
    place: 'Casual restaurant patio',
    city: 'Stockbridge',
    capacity: 6,
    vibes: ['Faith-friendly open', 'Encouraging', 'No agenda'],
    note: 'Open table. Come as you are. We cover our own meals.',
    host: 'Outreach table',
    joined: 3
  },
  {
    id: 's4',
    activity: 'Game',
    title: 'Board games & laughs',
    date: getFutureDate(4),
    time: '19:00',
    place: 'Community room / café',
    city: 'Atlanta area',
    capacity: 8,
    vibes: ['Introvert-friendly', 'Quiet & accepting'],
    note: 'Light games, no competition pressure. Just presence and fun.',
    host: 'Game host',
    joined: 1
  }
];

function getFutureDate(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function loadMoments() {
  const stored = localStorage.getItem('presence_moments');
  let userMoments = stored ? JSON.parse(stored) : [];
  // Merge samples + user, avoid duplicates by id
  const all = [...SAMPLE_MOMENTS];
  userMoments.forEach(m => {
    if (!all.find(x => x.id === m.id)) all.push(m);
  });
  // Sort by date+time
  all.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return all;
}

function saveUserMoment(moment) {
  const stored = localStorage.getItem('presence_moments');
  const list = stored ? JSON.parse(stored) : [];
  list.push(moment);
  localStorage.setItem('presence_moments', JSON.stringify(list));
}

let currentFilter = 'all';
let currentDetailId = null;

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + name);
  if (el) el.classList.add('active');
  window.scrollTo(0, 0);
  if (name === 'home') renderMoments();
  if (name === 'host') {
    // Set default date to tomorrow
    const tomorrow = getFutureDate(1);
    document.getElementById('date').value = tomorrow;
    document.getElementById('time').value = '10:00';
  }
}

function renderMoments() {
  const list = document.getElementById('moments-list');
  const empty = document.getElementById('empty-state');
  const moments = loadMoments().filter(m => {
    if (currentFilter === 'all') return true;
    return m.activity === currentFilter || (currentFilter === 'Game' && m.activity === 'Game');
  });

  if (moments.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = moments.map(m => {
    const dateObj = new Date(m.date + 'T12:00:00');
    const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const vibesHtml = (m.vibes || []).slice(0, 3).map(v => `<span class="vibe-tag">${v}</span>`).join('');
    return `
      <article class="moment-card" onclick="openDetail('${m.id}')">
        <div class="moment-top">
          <span class="moment-activity">${activityEmoji(m.activity)} ${m.activity}</span>
          <span class="moment-time">${dateStr} · ${formatTime(m.time)}</span>
        </div>
        <div class="moment-title">${escapeHtml(m.title || m.activity + ' moment')}</div>
        <div class="moment-place">${escapeHtml(m.place)} · ${escapeHtml(m.city)}</div>
        <div class="moment-vibes">${vibesHtml}</div>
        <div class="moment-meta">
          <span>${m.joined || 1} / ${m.capacity} spots</span>
        </div>
      </article>
    `;
  }).join('');
}

function activityEmoji(a) {
  const map = { Coffee: '☕', Walk: '🚶', Meal: '🍽️', Game: '🎲', Other: '✨' };
  return map[a] || '✨';
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function openDetail(id) {
  const moments = loadMoments();
  const m = moments.find(x => x.id === id);
  if (!m) return;
  currentDetailId = id;
  const dateObj = new Date(m.date + 'T12:00:00');
  const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const vibesHtml = (m.vibes || []).map(v => `<span class="vibe-tag">${v}</span>`).join('');
  const content = document.getElementById('detail-content');
  content.innerHTML = `
    <div class="detail-card">
      <div class="detail-activity"><span class="moment-activity">${activityEmoji(m.activity)} ${m.activity}</span></div>
      <h2 class="detail-title">${escapeHtml(m.title || m.activity + ' moment')}</h2>
      <div class="detail-meta">
        ${dateStr} at ${formatTime(m.time)}<br>
        ${escapeHtml(m.place)} · ${escapeHtml(m.city)}<br>
        ${m.joined || 1} of ${m.capacity} people
      </div>
      <div class="detail-vibes">${vibesHtml}</div>
      ${m.note ? `<div class="detail-note">${escapeHtml(m.note)}</div>` : ''}
      <div class="detail-actions" id="join-area">
        <button class="btn primary full" onclick="joinMoment('${m.id}')">Request to Join</button>
        <p style="text-align:center;font-size:0.85rem;color:var(--text-muted);margin-top:8px;">
          Location details shared after host accepts. Culture of acceptance applies.
        </p>
      </div>
    </div>
  `;
  showView('detail');
}

function joinMoment(id) {
  const area = document.getElementById('join-area');
  area.innerHTML = `
    <div class="join-success">
      ✓ Request sent. The host will review it soon.<br>
      <small style="display:block;margin-top:8px;font-weight:400;color:var(--text-muted)">
        In a full version this notifies the host and unlocks chat + exact location on acceptance.
      </small>
    </div>
  `;
}

// Host form
document.getElementById('host-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const activity = document.querySelector('input[name="activity"]:checked').value;
  const title = document.getElementById('title').value.trim();
  const date = document.getElementById('date').value;
  const time = document.getElementById('time').value;
  const place = document.getElementById('place').value.trim();
  const city = document.getElementById('city').value.trim();
  const capacity = parseInt(document.getElementById('capacity').value, 10);
  const note = document.getElementById('note').value.trim();
  const vibes = Array.from(document.querySelectorAll('input[name="vibe"]:checked')).map(c => c.value);

  if (!document.getElementById('agree-charter').checked) {
    alert('Please agree to the Presence commitments to host.');
    return;
  }

  const moment = {
    id: 'u' + Date.now(),
    activity,
    title: title || null,
    date,
    time,
    place,
    city,
    capacity,
    vibes,
    note,
    host: 'You',
    joined: 1
  };

  saveUserMoment(moment);
  this.reset();
  document.getElementById('agree-charter').checked = false;
  showView('success');
});

// Filters
document.querySelectorAll('.filter-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderMoments();
  });
});

// Init
document.addEventListener('DOMContentLoaded', () => {
  renderMoments();
});
