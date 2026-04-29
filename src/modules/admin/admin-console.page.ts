export function renderAdminConsolePage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Robot Console</title>
  <style>
    :root {
      --bg: #f4efe7;
      --panel: rgba(255,255,255,0.88);
      --line: rgba(20,30,36,0.12);
      --ink: #17212a;
      --muted: #66757d;
      --accent: #146c59;
      --soft: rgba(20,108,89,0.1);
      --shadow: 0 24px 64px rgba(32, 26, 18, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(198,100,59,0.16), transparent 24%),
        radial-gradient(circle at top right, rgba(20,108,89,0.16), transparent 26%),
        linear-gradient(180deg, #fbf7f2, var(--bg));
    }
    .shell {
      width: min(1500px, calc(100% - 24px));
      margin: 12px auto 24px;
      display: grid;
      gap: 16px;
    }
    .hero, .panel {
      background: var(--panel);
      border: 1px solid rgba(255,255,255,0.72);
      box-shadow: var(--shadow);
      border-radius: 28px;
      backdrop-filter: blur(14px);
    }
    .hero { padding: 22px 24px; }
    .hero h1 { margin: 0; font-size: clamp(30px, 4vw, 50px); line-height: 0.95; letter-spacing: -0.04em; }
    .hero p { margin: 12px 0 0; color: var(--muted); max-width: 70ch; line-height: 1.7; }
    .layout { display: grid; grid-template-columns: 360px minmax(0,1fr); gap: 16px; }
    .panel { overflow: hidden; }
    .head { padding: 16px 18px 12px; border-bottom: 1px solid var(--line); }
    .head h2 { margin: 0; font-size: 16px; }
    .head p { margin: 8px 0 0; color: var(--muted); font-size: 13px; line-height: 1.6; }
    .body { padding: 16px 18px 18px; }
    .list { display: grid; gap: 10px; }
    .card {
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.82);
      border-radius: 18px;
      padding: 14px;
      cursor: pointer;
    }
    .card.active { border-color: rgba(20,108,89,0.4); box-shadow: inset 0 0 0 1px rgba(20,108,89,0.18); }
    .card h4 { margin: 0 0 8px; font-size: 15px; }
    .meta, .pill-row, .grid, .split { display: grid; gap: 10px; }
    .meta { color: var(--muted); font-size: 12px; }
    .pill-row { grid-template-columns: repeat(3, minmax(0,1fr)); }
    .pill {
      padding: 10px 12px;
      border-radius: 16px;
      background: var(--soft);
      font-size: 12px;
      font-weight: 700;
    }
    .grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .split { grid-template-columns: repeat(5, minmax(0,1fr)); }
    .stat, .kv, .row {
      border: 1px solid var(--line);
      border-radius: 16px;
      background: rgba(255,255,255,0.8);
      padding: 12px;
    }
    .stat strong, .kv strong { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
    .stat span, .kv span { font-size: 16px; font-weight: 700; word-break: break-word; }
    .tabs { display: flex; gap: 8px; flex-wrap: wrap; padding: 0 18px 14px; border-bottom: 1px solid var(--line); }
    .tabs button {
      border: 0;
      border-radius: 999px;
      background: rgba(20,108,89,0.08);
      color: var(--ink);
      padding: 10px 14px;
      font: inherit;
      cursor: pointer;
    }
    .tabs button.active { background: var(--accent); color: #fff; }
    .section { display: none; }
    .section.active { display: block; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
    th { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    input, textarea, select {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #fff;
      padding: 10px 12px;
      font: inherit;
    }
    textarea { min-height: 84px; resize: vertical; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .actions button {
      border: 0;
      border-radius: 999px;
      padding: 11px 16px;
      background: var(--accent);
      color: #fff;
      cursor: pointer;
      font: inherit;
      font-weight: 700;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: Consolas, "SFMono-Regular", monospace;
      font-size: 12px;
    }
    @media (max-width: 1100px) {
      .layout { grid-template-columns: 1fr; }
      .grid, .split, .pill-row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <h1>Robot Console</h1>
      <p>这是一套面向飞书群项目管理员机器人的正式控制台。它聚焦实例状态、成员画像、群策略、待办与最近运行痕迹，不再复用开发监控接口作为页面数据源。</p>
    </section>
    <div class="layout">
      <section class="panel">
        <div class="head">
          <h2>机器人实例</h2>
          <p>选择一个群实例查看基础信息、成员与角色、会话待办、运行日志和群策略。</p>
        </div>
        <div class="body">
          <div id="instance-list" class="list"></div>
        </div>
      </section>
      <section class="panel">
        <div class="head">
          <h2 id="detail-title">未选择实例</h2>
          <p id="detail-subtitle">从左侧选择一个群机器人实例开始。</p>
        </div>
        <div class="tabs">
          <button data-tab="basic" class="active">基本信息</button>
          <button data-tab="members">群成员与角色</button>
          <button data-tab="runtime">会话与待办</button>
          <button data-tab="logs">运行日志</button>
          <button data-tab="policy">群策略</button>
        </div>
        <div class="body">
          <section id="tab-basic" class="section active"></section>
          <section id="tab-members" class="section"></section>
          <section id="tab-runtime" class="section"></section>
          <section id="tab-logs" class="section"></section>
          <section id="tab-policy" class="section"></section>
        </div>
      </section>
    </div>
  </div>
  <script>
    const state = { instances: [], currentChatId: null, detail: null, runtime: null, logs: null, members: [], policy: null };
    const listEl = document.getElementById('instance-list');
    const titleEl = document.getElementById('detail-title');
    const subtitleEl = document.getElementById('detail-subtitle');
    const tabs = Array.from(document.querySelectorAll('[data-tab]'));
    tabs.forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.tab)));

    function switchTab(name) {
      tabs.forEach((button) => button.classList.toggle('active', button.dataset.tab === name));
      document.querySelectorAll('.section').forEach((section) => section.classList.toggle('active', section.id === 'tab-' + name));
    }

    async function loadInstances() {
      state.instances = await fetchJson('/api/admin/robot-instances');
      renderList();
      if (state.instances.length && !state.currentChatId) {
        await selectInstance(state.instances[0].chatId);
      }
    }

    async function selectInstance(chatId) {
      state.currentChatId = chatId;
      const encoded = encodeURIComponent(chatId);
      const [detailResult, runtimeResult, logsResult, membersResult, policyResult] = await Promise.allSettled([
        fetchJson('/api/admin/robot-instances/' + encoded),
        fetchJson('/api/admin/robot-instances/' + encoded + '/runtime'),
        fetchJson('/api/admin/robot-instances/' + encoded + '/logs'),
        fetchJson('/api/admin/robot-instances/' + encoded + '/members'),
        fetchJson('/api/admin/robot-instances/' + encoded + '/policy'),
      ]);
      if (detailResult.status !== 'fulfilled') {
        throw detailResult.reason;
      }
      state.detail = detailResult.value;
      state.runtime = runtimeResult.status === 'fulfilled' ? runtimeResult.value : { tasks: [], summary: {} };
      state.logs = logsResult.status === 'fulfilled' ? logsResult.value : { messages: [], runs: [], artifacts: [], confirmations: [] };
      state.members = membersResult.status === 'fulfilled' ? membersResult.value : [];
      state.policy = policyResult.status === 'fulfilled' ? policyResult.value : (state.detail.policy || {});
      renderList();
      renderDetail();
    }

    function renderList() {
      listEl.innerHTML = state.instances.map((item) => {
        const active = item.chatId === state.currentChatId ? 'active' : '';
        return '<article class="card ' + active + '" data-chat-id="' + escapeHtml(item.chatId) + '">' +
          '<h4>' + escapeHtml(item.robotName) + '</h4>' +
          '<div class="meta">' +
          '<span>项目: ' + escapeHtml(item.projectName || '未绑定项目') + '</span>' +
          '<span>群: ' + escapeHtml(item.chatId) + '</span>' +
          '<span>状态: ' + escapeHtml(item.sessionStatus) + ' / ' + escapeHtml(item.sessionMode) + '</span>' +
          '</div>' +
          '<div class="pill-row">' +
          '<div class="pill">Queued ' + item.taskCounts.queued + '</div>' +
          '<div class="pill">Running ' + item.taskCounts.running + '</div>' +
          '<div class="pill">Blocked ' + (item.taskCounts.blocked + item.taskCounts.waitingConfirmation) + '</div>' +
          '</div>' +
        '</article>';
      }).join('');
      listEl.querySelectorAll('[data-chat-id]').forEach((node) => {
        node.addEventListener('click', () => selectInstance(node.dataset.chatId));
      });
    }

    function renderDetail() {
      if (!state.detail) {
        return;
      }
      titleEl.textContent = state.detail.robotName;
      subtitleEl.textContent = state.detail.projectName + ' / ' + state.detail.chatId;
      renderBasic();
      renderMembers();
      renderRuntime();
      renderLogs();
      renderPolicy();
    }

    function renderBasic() {
      const item = state.detail;
      document.getElementById('tab-basic').innerHTML =
        '<div class="grid">' +
          kv('机器人名称', item.robotName) +
          kv('项目', item.projectName) +
          kv('Chat ID', item.chatId) +
          kv('当前环境', item.activeEnvironmentName || '未配置') +
          kv('会话模式', item.sessionMode) +
          kv('会话状态', item.sessionStatus) +
          kv('最近活跃', item.lastActiveAt || '-') +
          kv('最近错误', item.lastError || '-') +
        '</div>' +
        '<div style="height:12px"></div>' +
        '<div class="split">' +
          stat('Queued', item.taskCounts.queued) +
          stat('Running', item.taskCounts.running) +
          stat('Blocked', item.taskCounts.blocked) +
          stat('Waiting Confirmation', item.taskCounts.waitingConfirmation) +
          stat('Recent Skill', item.recentSkill || '-') +
        '</div>' +
        '<div style="height:12px"></div>' +
        '<div class="grid">' +
          kv('最近产物', item.recentArtifactSummary || '-') +
          kv('默认环境来源', item.policy?.defaultEnvironmentId || item.projectDefaultEnvironmentId || '-') +
        '</div>';
    }

    function renderMembers() {
      const rows = state.members.map((member) =>
        '<tr>' +
          '<td>' + escapeHtml(member.displayName) + '</td>' +
          '<td>' + escapeHtml(member.groupNickname || '-') + '</td>' +
          '<td><input data-field="projectRole" data-id="' + member.id + '" value="' + escapeAttr(member.projectRole || '') + '" /></td>' +
          '<td><input data-field="responsibility" data-id="' + member.id + '" value="' + escapeAttr(member.responsibility || '') + '" /></td>' +
          '<td><select data-field="permissionLevel" data-id="' + member.id + '">' +
            option(member.permissionLevel, 'member') + option(member.permissionLevel, 'admin') +
          '</select></td>' +
          '<td><input type="checkbox" data-field="isDecisionMaker" data-id="' + member.id + '" ' + (member.isDecisionMaker ? 'checked' : '') + ' /></td>' +
          '<td><input type="checkbox" data-field="isTaskAssignable" data-id="' + member.id + '" ' + (member.isTaskAssignable ? 'checked' : '') + ' /></td>' +
          '<td><button data-save-member="' + member.id + '">保存</button></td>' +
        '</tr>'
      ).join('');
      document.getElementById('tab-members').innerHTML =
        '<div class="actions" style="margin-bottom:12px"><button id="sync-members">同步飞书群成员</button></div>' +
        '<table><thead><tr><th>成员</th><th>群昵称</th><th>项目角色</th><th>职责</th><th>权限</th><th>决策者</th><th>可分配</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table>';
      document.getElementById('sync-members').addEventListener('click', async () => {
        await fetchJson('/api/admin/robot-instances/' + encodeURIComponent(state.currentChatId) + '/members/sync', {
          method: 'POST',
        });
        await selectInstance(state.currentChatId);
      });
      document.querySelectorAll('[data-save-member]').forEach((button) => {
        button.addEventListener('click', async () => {
          const id = button.dataset.saveMember;
          const payload = collectProfilePayload(id);
          await fetchJson('/api/admin/robot-instances/' + encodeURIComponent(state.currentChatId) + '/members/' + id, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          });
          await selectInstance(state.currentChatId);
        });
      });
    }

    function renderRuntime() {
      const runtime = state.runtime || { tasks: [] };
      const tasks = (runtime.tasks || []).map((task) =>
        '<tr>' +
          '<td>' + escapeHtml(task.title) + '</td>' +
          '<td>' + escapeHtml(task.status) + '</td>' +
          '<td>' + escapeHtml(task.intent) + '</td>' +
          '<td>' + escapeHtml(task.resultSummary || task.blockedReason || task.lastError || '-') + '</td>' +
        '</tr>'
      ).join('');
      document.getElementById('tab-runtime').innerHTML =
        '<div class="split">' +
          stat('Queued', runtime.summary?.queued ?? 0) +
          stat('Running', runtime.summary?.running ?? 0) +
          stat('Blocked', runtime.summary?.blocked ?? 0) +
          stat('Waiting Confirmation', runtime.summary?.waitingConfirmation ?? 0) +
          stat('Completed', runtime.summary?.completed ?? 0) +
        '</div>' +
        '<div style="height:12px"></div>' +
        '<table><thead><tr><th>标题</th><th>状态</th><th>Intent</th><th>说明</th></tr></thead><tbody>' + tasks + '</tbody></table>';
    }

    function renderLogs() {
      const logs = state.logs || {};
      document.getElementById('tab-logs').innerHTML =
        '<div class="grid">' +
          kv('最近消息', '<pre>' + escapeHtml((logs.messages || []).map(formatMessageText).join('\\n\\n') || '-') + '</pre>') +
          kv('最近 Run', '<pre>' + escapeHtml((logs.runs || []).map((item) => item.intent + ' / ' + item.status + ' / ' + (item.outputSummary || '-')).join('\\n\\n') || '-') + '</pre>') +
          kv('最近产物', '<pre>' + escapeHtml((logs.artifacts || []).map((item) => item.type + ' / ' + item.title + ' / ' + item.status).join('\\n\\n') || '-') + '</pre>') +
          kv('确认记录', '<pre>' + escapeHtml((logs.confirmations || []).map((item) => item.actionType + ' / ' + item.status).join('\\n\\n') || '-') + '</pre>') +
        '</div>';
    }

    function renderPolicy() {
      const policy = state.policy || {};
      document.getElementById('tab-policy').innerHTML =
        '<div class="grid">' +
          checkbox('enabled', '启用实例', policy.enabled) +
          checkbox('mentionOnly', '仅响应 @', policy.mentionOnly) +
          checkbox('allowAutoTaskCreation', '允许自动建待办', policy.allowAutoTaskCreation) +
          checkbox('allowTaskBoardWrite', '允许写任务板', policy.allowTaskBoardWrite) +
          checkbox('allowDocWrite', '允许写文档', policy.allowDocWrite) +
          checkbox('highRiskActionsRequireConfirmation', '高风险先确认', policy.highRiskActionsRequireConfirmation) +
        '</div>' +
        '<div style="height:12px"></div>' +
        '<div class="grid">' +
          '<div class="row"><strong>默认环境 ID</strong><input id="policy-default-environment" value="' + escapeAttr(policy.defaultEnvironmentId || '') + '" /></div>' +
          '<div class="row"><strong>允许技能</strong><textarea id="policy-allowed-skills">' + escapeHtml((policy.allowedSkills || []).join('\\n')) + '</textarea></div>' +
        '</div>' +
        '<div style="height:12px"></div>' +
        '<div class="actions"><button id="save-policy">保存策略</button></div>';
      document.getElementById('save-policy').addEventListener('click', async () => {
        await fetchJson('/api/admin/robot-instances/' + encodeURIComponent(state.currentChatId) + '/policy', {
          method: 'PATCH',
          body: JSON.stringify({
            enabled: checked('policy-enabled'),
            mentionOnly: checked('policy-mentionOnly'),
            allowAutoTaskCreation: checked('policy-allowAutoTaskCreation'),
            allowTaskBoardWrite: checked('policy-allowTaskBoardWrite'),
            allowDocWrite: checked('policy-allowDocWrite'),
            highRiskActionsRequireConfirmation: checked('policy-highRiskActionsRequireConfirmation'),
            defaultEnvironmentId: document.getElementById('policy-default-environment').value || null,
            allowedSkills: document.getElementById('policy-allowed-skills').value.split('\\n').map((item) => item.trim()).filter(Boolean),
          }),
        });
        await selectInstance(state.currentChatId);
      });
    }

    function formatMessageText(item) {
      const raw = String(item?.rawText || '').trim();
      const mentions = Array.isArray(item?.mentionsJson) ? item.mentionsJson : [];
      if (!raw) {
        return '-';
      }
      if (!mentions.length) {
        return raw;
      }
      let text = raw;
      mentions.forEach((mention, index) => {
        const placeholder = mention?.key || ('@_user_' + (index + 1));
        const name = mention?.name || mention?.displayName || mention?.id;
        if (!name) {
          return;
        }
        text = text.replace(placeholder, '@' + name);
      });
      return text;
    }

    function collectProfilePayload(id) {
      return {
        projectRole: value('projectRole', id),
        responsibility: value('responsibility', id),
        permissionLevel: value('permissionLevel', id),
        isDecisionMaker: checkedByField('isDecisionMaker', id),
        isTaskAssignable: checkedByField('isTaskAssignable', id),
      };
    }
    function value(field, id) { return document.querySelector('[data-field="' + field + '"][data-id="' + id + '"]').value || null; }
    function checkedByField(field, id) { return document.querySelector('[data-field="' + field + '"][data-id="' + id + '"]').checked; }
    function checked(id) { return document.getElementById(id).checked; }
    function checkbox(field, label, checkedValue) {
      return '<label class="row"><strong>' + label + '</strong><input id="policy-' + field + '" type="checkbox" ' + (checkedValue ? 'checked' : '') + ' /></label>';
    }
    function stat(label, value) { return '<div class="stat"><strong>' + escapeHtml(label) + '</strong><span>' + escapeHtml(String(value)) + '</span></div>'; }
    function kv(label, value) { return '<div class="kv"><strong>' + escapeHtml(label) + '</strong><span>' + value + '</span></div>'; }
    function option(current, value) { return '<option value="' + value + '" ' + (current === value ? 'selected' : '') + '>' + value + '</option>'; }
    async function fetchJson(url, init) {
      const response = await fetch(url, { headers: { 'content-type': 'application/json' }, ...init });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    }
    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[char]));
    }
    function escapeAttr(value) { return escapeHtml(value).replace(/'/g, '&#39;'); }
    loadInstances().catch((error) => {
      titleEl.textContent = '加载失败';
      subtitleEl.textContent = error.message;
    });
  </script>
</body>
</html>`;
}
