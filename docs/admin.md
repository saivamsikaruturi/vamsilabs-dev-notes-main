---
hide:
  - navigation
  - toc
---

<div class="vtn-admin-panel" id="admin-panel">

<div class="vtn-admin-header">
  <h2>Admin Dashboard</h2>
  <span id="admin-status" style="font-size: 0.8rem; color: var(--vtn-text-muted);">Checking access...</span>
</div>

<!-- Access Gate (hidden by default, shown only if not signed in) -->
<div id="admin-gate" style="display:none; text-align: center; padding: 3rem;">
  <h3>Admin Access Required</h3>
  <p style="color: var(--vtn-text-muted); font-size: 0.9rem;">You need to be signed in as an admin to view this page.</p>
  <p style="color: var(--vtn-text-muted); font-size: 0.8rem; margin-top: 0.5rem;">If you're already signed in on the homepage, this will load automatically.</p>
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
<h3 class="vtn-admin-section-title">Daily Active Users (Last 7 Days)</h3>
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
(function() {
  function initAdmin() {
    if (typeof initFirebase === 'undefined') {
      setTimeout(initAdmin, 300);
      return;
    }

    initFirebase().then(function() {
      auth.onAuthStateChanged(function(user) {
        var gate = document.getElementById('admin-gate');
        var content = document.getElementById('admin-content');
        var status = document.getElementById('admin-status');

        if (!gate || !content || !status) return;

        if (!user) {
          gate.style.display = 'block';
          content.style.display = 'none';
          status.textContent = 'Not signed in';
          return;
        }

        if (!ADMIN_EMAILS.includes(user.email)) {
          gate.style.display = 'block';
          gate.innerHTML = '<h3>Access Denied</h3><p style="color: var(--vtn-text-muted);">Your account (' + user.email + ') does not have admin permissions.</p>';
          content.style.display = 'none';
          status.textContent = 'Unauthorized';
          return;
        }

        gate.style.display = 'none';
        content.style.display = 'block';
        status.textContent = 'Admin: ' + user.email;
        loadMetrics();
      });
    }).catch(function(e) {
      var gate = document.getElementById('admin-gate');
      if (gate) gate.innerHTML = '<h3>Dashboard Unavailable</h3><p style="color: var(--vtn-text-muted);">Firebase failed to load.</p>';
      gate.style.display = 'block';
    });
  }

  function loadMetrics() {
    var brandColor = getComputedStyle(document.documentElement).getPropertyValue('--vtn-brand').trim() || '#B45309';

    db.collection('users').get().then(function(usersSnap) {
      document.getElementById('metric-users').textContent = usersSnap.size;

      var weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return db.collection('pageViews').where('timestamp', '>', weekAgo).get().then(function(viewsSnap) {
        document.getElementById('metric-views').textContent = viewsSnap.size;

        var today = new Date();
        today.setHours(0, 0, 0, 0);
        return db.collection('pageViews').where('timestamp', '>', today).get().then(function(todaySnap) {
          var uniqueToday = {};
          todaySnap.docs.forEach(function(d) { uniqueToday[d.data().userId] = true; });
          document.getElementById('metric-active').textContent = Object.keys(uniqueToday).length;

          return db.collection('engagement').where('timestamp', '>', weekAgo).limit(500).get().then(function(engSnap) {
            if (engSnap.size > 0) {
              var totalTime = 0;
              engSnap.docs.forEach(function(d) { totalTime += (d.data().timeSpentSeconds || 0); });
              document.getElementById('metric-avg-time').textContent = (totalTime / engSnap.size / 60).toFixed(1);
            } else {
              document.getElementById('metric-avg-time').textContent = '0';
            }

            // Popular pages
            var pageCounts = {};
            viewsSnap.docs.forEach(function(d) {
              var page = d.data().page || '/';
              pageCounts[page] = (pageCounts[page] || 0) + 1;
            });
            var sorted = Object.entries(pageCounts).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 10);
            var tbody = document.getElementById('popular-pages');
            tbody.innerHTML = sorted.map(function(item) {
              return '<tr><td>' + item[0] + '</td><td>' + item[1] + '</td><td>—</td></tr>';
            }).join('') || '<tr><td colspan="3">No data yet</td></tr>';

            // Recent users
            return db.collection('users').orderBy('lastLogin', 'desc').limit(10).get().then(function(recentSnap) {
              var usersBody = document.getElementById('recent-users');
              usersBody.innerHTML = recentSnap.docs.map(function(d) {
                var data = d.data();
                var login = data.lastLogin ? data.lastLogin.toDate().toLocaleDateString() : '—';
                return '<tr><td>' + (data.displayName || '—') + '</td><td>' + data.email + '</td><td>' + (data.provider || '—') + '</td><td>' + login + '</td></tr>';
              }).join('') || '<tr><td colspan="4">No users yet</td></tr>';

              drawDAUChart(viewsSnap.docs, brandColor);
              drawSectionChart(pageCounts, brandColor);
            });
          });
        });
      });
    }).catch(function(e) {
      console.error('Error loading metrics:', e);
    });
  }

  function drawDAUChart(docs, brandColor) {
    var canvas = document.getElementById('dau-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var width = canvas.width;
    var height = canvas.height;

    var dailyUsers = {};
    docs.forEach(function(d) {
      var data = d.data();
      if (data.timestamp) {
        var date = data.timestamp.toDate().toISOString().split('T')[0];
        if (!dailyUsers[date]) dailyUsers[date] = {};
        dailyUsers[date][data.userId] = true;
      }
    });

    var days = Object.keys(dailyUsers).sort().slice(-7);
    var values = days.map(function(d) { return Object.keys(dailyUsers[d]).length; });
    var max = Math.max.apply(null, values.concat([1]));

    ctx.clearRect(0, 0, width, height);
    var barWidth = (width - 80) / days.length;
    var chartHeight = height - 60;

    days.forEach(function(day, i) {
      var barHeight = (values[i] / max) * chartHeight;
      var x = 50 + i * barWidth;
      var y = chartHeight - barHeight + 20;

      ctx.fillStyle = brandColor;
      ctx.fillRect(x + 5, y, barWidth - 10, barHeight);

      ctx.fillStyle = '#78716C';
      ctx.font = '11px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(day.slice(5), x + barWidth / 2, height - 10);

      ctx.fillStyle = '#1C1917';
      ctx.font = 'bold 12px DM Sans, sans-serif';
      ctx.fillText(values[i], x + barWidth / 2, y - 5);
    });
  }

  function drawSectionChart(pageCounts, brandColor) {
    var canvas = document.getElementById('section-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var width = canvas.width;
    var height = canvas.height;

    var sections = {};
    Object.entries(pageCounts).forEach(function(entry) {
      var parts = entry[0].split('/').filter(Boolean);
      var section = parts[0] || 'home';
      sections[section] = (sections[section] || 0) + entry[1];
    });

    var sorted = Object.entries(sections).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 8);
    var max = Math.max.apply(null, sorted.map(function(s) { return s[1]; }).concat([1]));

    ctx.clearRect(0, 0, width, height);
    var barHeight = (height - 40) / sorted.length;

    sorted.forEach(function(item, i) {
      var barWidth2 = (item[1] / max) * (width - 150);
      var y = 20 + i * barHeight;

      ctx.fillStyle = brandColor;
      ctx.globalAlpha = 0.7 + (0.3 * (1 - i / sorted.length));
      ctx.fillRect(120, y + 5, barWidth2, barHeight - 15);
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#1C1917';
      ctx.font = '12px DM Sans, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(item[0], 110, y + barHeight / 2 + 4);

      ctx.fillStyle = '#78716C';
      ctx.textAlign = 'left';
      ctx.fillText(item[1], 125 + barWidth2, y + barHeight / 2 + 4);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdmin);
  } else {
    initAdmin();
  }
})();
</script>
