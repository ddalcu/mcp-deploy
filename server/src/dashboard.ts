export function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>mcp-deploy</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: system-ui, -apple-system, sans-serif;
    background: #0d1117;
    color: #c9d1d9;
    min-height: 100vh;
  }

  .header {
    padding: 20px 24px;
    border-bottom: 1px solid #21262d;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header h1 {
    font-size: 1.2rem;
    font-weight: 600;
    color: #e6edf3;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .refresh-info {
    font-size: 0.75rem;
    color: #484f58;
  }

  .btn {
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid #30363d;
    background: #21262d;
    color: #c9d1d9;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .btn:hover { background: #30363d; }

  .container { max-width: 1100px; margin: 0 auto; padding: 24px; }

  /* Auth form */
  .auth-wrap {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 60vh;
  }

  .auth-box {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 32px;
    width: 100%;
    max-width: 380px;
    text-align: center;
  }

  .auth-box h2 {
    font-size: 1.1rem;
    color: #e6edf3;
    margin-bottom: 6px;
  }

  .auth-box p {
    font-size: 0.8rem;
    color: #484f58;
    margin-bottom: 20px;
  }

  .auth-box input {
    width: 100%;
    padding: 10px 12px;
    border-radius: 6px;
    border: 1px solid #30363d;
    background: #0d1117;
    color: #c9d1d9;
    font-size: 0.9rem;
    margin-bottom: 12px;
  }

  .auth-box input:focus {
    outline: none;
    border-color: #58a6ff;
  }

  .auth-box .btn-primary {
    width: 100%;
    padding: 10px;
    background: #238636;
    border-color: #2ea043;
    color: #fff;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .auth-box .btn-primary:hover { background: #2ea043; }

  .auth-error {
    color: #f85149;
    font-size: 0.8rem;
    margin-bottom: 12px;
    display: none;
  }

  /* Table */
  .table-wrap {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    overflow: hidden;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  thead th {
    text-align: left;
    padding: 12px 16px;
    border-bottom: 1px solid #30363d;
    color: #484f58;
    font-weight: 500;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  tbody tr {
    cursor: pointer;
    transition: background 0.1s;
  }

  tbody tr:hover { background: #1c2128; }

  tbody td {
    padding: 10px 16px;
    border-bottom: 1px solid #21262d;
    vertical-align: middle;
  }

  tbody tr:last-child td { border-bottom: none; }

  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .badge-running { background: #23312e; color: #3fb950; }
  .badge-stopped { background: #31201f; color: #f85149; }

  .app-url {
    color: #58a6ff;
    text-decoration: none;
    font-size: 0.8rem;
  }

  .app-url:hover { text-decoration: underline; }

  .resource { color: #484f58; font-size: 0.8rem; }

  /* Expanded log row */
  .log-row td {
    padding: 0;
    cursor: default;
  }

  .log-row:hover { background: transparent; }

  .log-content {
    background: #0d1117;
    border-top: 1px solid #21262d;
    padding: 16px;
    max-height: 300px;
    overflow-y: auto;
    font-family: ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace;
    font-size: 0.75rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
    color: #8b949e;
  }

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: 60px 24px;
  }

  .empty-state p {
    color: #484f58;
    font-size: 0.9rem;
    margin-bottom: 8px;
  }

  .empty-state code {
    background: #161b22;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.8rem;
  }

  /* Loading */
  .loading {
    text-align: center;
    padding: 40px;
    color: #484f58;
  }

  @media (max-width: 700px) {
    .container { padding: 16px; }
    thead th, tbody td { padding: 8px 10px; }
    .hide-mobile { display: none; }
  }
</style>
</head>
<body>

<div class="header">
  <h1>mcp-deploy</h1>
  <div class="header-right" id="headerRight" style="display:none">
    <span class="refresh-info" id="refreshInfo"></span>
    <button class="btn" id="refreshBtn" onclick="refresh()">Refresh</button>
    <button class="btn" id="logoutBtn" onclick="logout()">Logout</button>
  </div>
</div>

<div class="container">
  <div id="authView" class="auth-wrap">
    <div class="auth-box">
      <h2>Dashboard Login</h2>
      <p>Enter your API key to view deployments</p>
      <div class="auth-error" id="authError">Invalid API key</div>
      <form id="authForm" onsubmit="return handleLogin(event)">
        <input type="password" id="keyInput" placeholder="API key" autocomplete="off" required>
        <button type="submit" class="btn btn-primary">Connect</button>
      </form>
    </div>
  </div>

  <div id="dashView" class="display-none">
    <div id="content"></div>
  </div>
</div>

<script>
(function() {
  const REFRESH_INTERVAL = 30000;
  let apiKey = localStorage.getItem("mcp_api_key") || "";
  let refreshTimer = null;
  let expandedApp = null;

  const $ = (id) => document.getElementById(id);

  function headers() {
    return { "Authorization": "Bearer " + apiKey };
  }

  async function apiFetch(path) {
    const res = await fetch(path, { headers: headers() });
    if (res.status === 401) { logout(); throw new Error("Unauthorized"); }
    return res.json();
  }

  window.handleLogin = async function(e) {
    e.preventDefault();
    const key = $("keyInput").value.trim();
    if (!key) return false;

    apiKey = key;
    try {
      await apiFetch("/api/apps");
      localStorage.setItem("mcp_api_key", key);
      showDashboard();
    } catch {
      $("authError").style.display = "block";
      apiKey = "";
    }
    return false;
  };

  window.logout = function() {
    apiKey = "";
    localStorage.removeItem("mcp_api_key");
    if (refreshTimer) clearInterval(refreshTimer);
    expandedApp = null;
    $("headerRight").style.display = "none";
    $("authView").style.display = "";
    $("dashView").style.display = "none";
    $("authError").style.display = "none";
    $("keyInput").value = "";
  };

  function showDashboard() {
    $("authView").style.display = "none";
    $("dashView").style.display = "";
    $("headerRight").style.display = "flex";
    refresh();
    refreshTimer = setInterval(refresh, REFRESH_INTERVAL);
  }

  window.refresh = async function() {
    $("refreshInfo").textContent = "";
    try {
      const { apps } = await apiFetch("/api/apps");

      if (!apps || apps.length === 0) {
        $("content").innerHTML =
          '<div class="empty-state">' +
            "<p>No apps deployed yet.</p>" +
            '<p>Use the MCP tools or <code>POST /api/deploy</code> to deploy your first app.</p>' +
          "</div>";
        updateRefreshTime();
        return;
      }

      const statuses = await Promise.allSettled(
        apps.filter(function(a) { return a.state === "running"; })
            .map(function(a) { return apiFetch("/api/apps/" + a.name); })
      );

      var statusMap = {};
      statuses.forEach(function(s) {
        if (s.status === "fulfilled") statusMap[s.value.name] = s.value;
      });

      renderTable(apps, statusMap);
      updateRefreshTime();
    } catch (err) {
      if (err.message !== "Unauthorized") {
        $("content").innerHTML = '<div class="loading">Error loading apps</div>';
      }
    }
  };

  function updateRefreshTime() {
    var now = new Date();
    var hh = String(now.getHours()).padStart(2, "0");
    var mm = String(now.getMinutes()).padStart(2, "0");
    var ss = String(now.getSeconds()).padStart(2, "0");
    $("refreshInfo").textContent = "Updated " + hh + ":" + mm + ":" + ss;
  }

  function renderTable(apps, statusMap) {
    var html =
      '<div class="table-wrap"><table>' +
      "<thead><tr>" +
        "<th>Name</th>" +
        "<th>Status</th>" +
        '<th class="hide-mobile">Image</th>' +
        "<th>URL</th>" +
        '<th class="hide-mobile">CPU</th>' +
        '<th class="hide-mobile">Memory</th>' +
      "</tr></thead><tbody>";

    apps.forEach(function(app) {
      var isRunning = app.state === "running";
      var badgeClass = isRunning ? "badge-running" : "badge-stopped";
      var detail = statusMap[app.name];
      var cpu = detail ? detail.cpu : "-";
      var mem = detail ? detail.memory : "-";
      var expanded = expandedApp === app.name;

      html +=
        '<tr onclick="toggleLogs(\\'' + app.name + '\\')" data-app="' + app.name + '">' +
          "<td>" + esc(app.name) + "</td>" +
          '<td><span class="badge ' + badgeClass + '">' + esc(app.state) + "</span></td>" +
          '<td class="hide-mobile">' + esc(app.image) + "</td>" +
          '<td><a class="app-url" href="' + esc(app.url) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">' + esc(app.url.replace("https://", "")) + "</a></td>" +
          '<td class="hide-mobile resource">' + esc(String(cpu)) + "</td>" +
          '<td class="hide-mobile resource">' + esc(String(mem)) + "</td>" +
        "</tr>";

      if (expanded) {
        html +=
          '<tr class="log-row" data-logrow="' + app.name + '">' +
            '<td colspan="6"><div class="log-content" id="logs-' + app.name + '">Loading logs\u2026</div></td>' +
          "</tr>";
      }
    });

    html += "</tbody></table></div>";
    $("content").innerHTML = html;

    if (expandedApp) fetchLogs(expandedApp);
  }

  window.toggleLogs = async function(name) {
    if (expandedApp === name) {
      expandedApp = null;
    } else {
      expandedApp = name;
    }
    window.refresh();
  };

  async function fetchLogs(name) {
    var el = $("logs-" + name);
    if (!el) return;
    try {
      var data = await apiFetch("/api/apps/" + name + "/logs?tail=50");
      el.textContent = data.logs || "(no logs)";
    } catch {
      el.textContent = "Failed to load logs.";
    }
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  // Init
  if (apiKey) {
    $("content").innerHTML = '<div class="loading">Loading\u2026</div>';
    showDashboard();
  }
})();
</script>

</body>
</html>`;
}
