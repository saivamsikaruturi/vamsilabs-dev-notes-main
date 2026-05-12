---
hide:
  - navigation
  - toc
---

<div class="vtn-admin-panel" id="admin-panel">

<div class="vtn-admin-header">
  <h2>Admin Dashboard</h2>
  <span id="admin-status" style="font-size: 0.8rem; color: var(--vtn-text-muted);">Loading...</span>
</div>

<!-- Access Gate -->
<div id="admin-gate" style="text-align: center; padding: 3rem;">
  <h3>Admin Access Required</h3>
  <p style="color: var(--vtn-text-muted); font-size: 0.9rem;">Sign in with an admin account to view metrics.</p>
  <button class="vtn-auth-btn" onclick="signInWithGoogle()" style="max-width: 300px; margin: 1rem auto;">
    Sign in with Google
  </button>
</div>

<!-- Dashboard Content (shown to admins) -->
<div id="admin-content" style="display: none;">

<!-- Metrics Summary -->
<div class="vtn-metrics-grid">
  <div class="vtn-metric-card">
    <span class="vtn-metric-value" id="metric-users">—</span>
    <span class="vtn-metric-label">Total Users</span>
  </div>
  <div class="vtn-metric-card">
    <span class="vtn-metric-value" id="metric-views">—</span>
    <span class="vtn-metric-label">Page Views (7d)</span>
  </div>
  <div class="vtn-metric-card">
    <span class="vtn-metric-value" id="metric-active">—</span>
    <span class="vtn-metric-label">Active Today</span>
  </div>
  <div class="vtn-metric-card">
    <span class="vtn-metric-value" id="metric-avg-time">—</span>
    <span class="vtn-metric-label">Avg. Time (min)</span>
  </div>
</div>

<!-- Popular Pages -->
<h3 class="vtn-admin-section-title">Most Viewed Pages (Last 7 Days)</h3>
<table class="vtn-admin-table">
  <thead>
    <tr>
      <th>Page</th>
      <th>Views</th>
      <th>Avg. Time</th>
    </tr>
  </thead>
  <tbody id="popular-pages">
    <tr><td colspan="3" style="text-align:center; color: var(--vtn-text-muted);">Loading...</td></tr>
  </tbody>
</table>

<!-- Recent Users -->
<h3 class="vtn-admin-section-title">Recent Users</h3>
<table class="vtn-admin-table">
  <thead>
    <tr>
      <th>User</th>
      <th>Email</th>
      <th>Provider</th>
      <th>Last Login</th>
    </tr>
  </thead>
  <tbody id="recent-users">
    <tr><td colspan="4" style="text-align:center; color: var(--vtn-text-muted);">Loading...</td></tr>
  </tbody>
</table>

<!-- Daily Active Users Chart -->
<h3 class="vtn-admin-section-title">Daily Active Users (Last 30 Days)</h3>
<div class="vtn-chart-placeholder" id="dau-chart">
  <canvas id="dau-canvas" width="800" height="250"></canvas>
</div>

<!-- Page Views by Section -->
<h3 class="vtn-admin-section-title">Views by Section</h3>
<div class="vtn-chart-placeholder" id="section-chart">
  <canvas id="section-canvas" width="800" height="250"></canvas>
</div>

</div>
</div>

<script>
// Admin Dashboard Logic
document.addEventListener('DOMContentLoaded', async () => {
  // Admin emails (configure these)
  const ADMIN_EMAILS = ['krishnavamsikaruturi8@gmail.com'];

  async function checkAdmin() {
    try {
      await initFirebase();

      auth.onAuthStateChanged(async (user) => {
        const gate = document.getElementById('admin-gate');
        const content = document.getElementById('admin-content');
        const status = document.getElementById('admin-status');

        if (!user) {
          gate.style.display = 'block';
          content.style.display = 'none';
          status.textContent = 'Not signed in';
          return;
        }

        if (!ADMIN_EMAILS.includes(user.email)) {
          gate.innerHTML = '<h3>Access Denied</h3><p style="color: var(--vtn-text-muted);">Your account does not have admin permissions.</p>';
          gate.style.display = 'block';
          content.style.display = 'none';
          status.textContent = 'Unauthorized: ' + user.email;
          return;
        }

        gate.style.display = 'none';
        content.style.display = 'block';
        status.textContent = 'Admin: ' + user.email;

        loadMetrics();
      });
    } catch (e) {
      document.getElementById('admin-gate').innerHTML =
        '<h3>Dashboard Unavailable</h3><p style="color: var(--vtn-text-muted);">Firebase is not configured. Add your Firebase config to auth.js to enable the admin dashboard.</p>';
    }
  }

  async function loadMetrics() {
    try {
      // Load user count
      const usersSnap = await db.collection('users').get();
      document.getElementById('metric-users').textContent = usersSnap.size;

      // Load page views (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const viewsSnap = await db.collection('pageViews')
        .where('timestamp', '>', weekAgo)
        .get();
      document.getElementById('metric-views').textContent = viewsSnap.size;

      // Active today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todaySnap = await db.collection('pageViews')
        .where('timestamp', '>', today)
        .get();
      const uniqueToday = new Set(todaySnap.docs.map(d => d.data().userId));
      document.getElementById('metric-active').textContent = uniqueToday.size;

      // Average time
      const engSnap = await db.collection('engagement')
        .where('timestamp', '>', weekAgo)
        .limit(500)
        .get();
      if (engSnap.size > 0) {
        const totalTime = engSnap.docs.reduce((sum, d) => sum + (d.data().timeSpentSeconds || 0), 0);
        const avgMin = (totalTime / engSnap.size / 60).toFixed(1);
        document.getElementById('metric-avg-time').textContent = avgMin;
      } else {
        document.getElementById('metric-avg-time').textContent = '0';
      }

      // Popular pages
      const pageCounts = {};
      viewsSnap.docs.forEach(d => {
        const page = d.data().page || '/';
        pageCounts[page] = (pageCounts[page] || 0) + 1;
      });
      const sorted = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
      const tbody = document.getElementById('popular-pages');
      tbody.innerHTML = sorted.map(([page, count]) =>
        `<tr><td>${page}</td><td>${count}</td><td>—</td></tr>`
      ).join('') || '<tr><td colspan="3">No data yet</td></tr>';

      // Recent users
      const recentUsersSnap = await db.collection('users')
        .orderBy('lastLogin', 'desc')
        .limit(10)
        .get();
      const usersBody = document.getElementById('recent-users');
      usersBody.innerHTML = recentUsersSnap.docs.map(d => {
        const data = d.data();
        const login = data.lastLogin ? data.lastLogin.toDate().toLocaleDateString() : '—';
        return `<tr><td>${data.displayName || '—'}</td><td>${data.email}</td><td>${data.provider}</td><td>${login}</td></tr>`;
      }).join('') || '<tr><td colspan="4">No users yet</td></tr>';

      // DAU Chart (simple bar chart with canvas)
      drawDAUChart(viewsSnap.docs);
      drawSectionChart(pageCounts);

    } catch (e) {
      console.error('Error loading metrics:', e);
    }
  }

  function drawDAUChart(docs) {
    const canvas = document.getElementById('dau-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Count unique users per day
    const dailyUsers = {};
    docs.forEach(d => {
      const data = d.data();
      if (data.timestamp) {
        const date = data.timestamp.toDate().toISOString().split('T')[0];
        if (!dailyUsers[date]) dailyUsers[date] = new Set();
        dailyUsers[date].add(data.userId);
      }
    });

    const days = Object.keys(dailyUsers).sort().slice(-7);
    const values = days.map(d => dailyUsers[d].size);
    const max = Math.max(...values, 1);

    ctx.clearRect(0, 0, width, height);
    const barWidth = (width - 80) / days.length;
    const chartHeight = height - 60;

    // Draw bars
    days.forEach((day, i) => {
      const barHeight = (values[i] / max) * chartHeight;
      const x = 50 + i * barWidth;
      const y = chartHeight - barHeight + 20;

      ctx.fillStyle = '#D4682A';
      ctx.fillRect(x + 5, y, barWidth - 10, barHeight);

      // Label
      ctx.fillStyle = '#6B6B6B';
      ctx.font = '11px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(day.slice(5), x + barWidth / 2, height - 10);

      // Value
      ctx.fillStyle = '#1A1A1A';
      ctx.font = 'bold 12px DM Sans, sans-serif';
      ctx.fillText(values[i], x + barWidth / 2, y - 5);
    });
  }

  function drawSectionChart(pageCounts) {
    const canvas = document.getElementById('section-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Group by section
    const sections = {};
    Object.entries(pageCounts).forEach(([page, count]) => {
      const parts = page.split('/').filter(Boolean);
      const section = parts[0] || 'home';
      sections[section] = (sections[section] || 0) + count;
    });

    const sorted = Object.entries(sections).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const max = Math.max(...sorted.map(s => s[1]), 1);

    ctx.clearRect(0, 0, width, height);
    const barHeight = (height - 40) / sorted.length;

    // Horizontal bars
    sorted.forEach(([section, count], i) => {
      const barWidth2 = (count / max) * (width - 150);
      const y = 20 + i * barHeight;

      ctx.fillStyle = '#D4682A';
      ctx.globalAlpha = 0.7 + (0.3 * (1 - i / sorted.length));
      ctx.fillRect(120, y + 5, barWidth2, barHeight - 15);
      ctx.globalAlpha = 1;

      // Section name
      ctx.fillStyle = '#1A1A1A';
      ctx.font = '12px DM Sans, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(section, 110, y + barHeight / 2 + 4);

      // Count
      ctx.fillStyle = '#6B6B6B';
      ctx.textAlign = 'left';
      ctx.fillText(count, 125 + barWidth2, y + barHeight / 2 + 4);
    });
  }

  checkAdmin();
});
</script>
