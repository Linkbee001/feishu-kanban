export function renderAdminConsolePage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Runtime Console</title>
  <style>
    :root {
      --bg: #f5efe6;
      --panel: rgba(255, 252, 248, 0.9);
      --line: rgba(33, 43, 51, 0.12);
      --ink: #17212a;
      --muted: #6b7780;
      --accent: #1d6b57;
      --accent-soft: rgba(29, 107, 87, 0.1);
      --warn: #aa5a22;
      --warn-soft: rgba(170, 90, 34, 0.12);
      --danger: #9a2f2f;
      --danger-soft: rgba(154, 47, 47, 0.1);
      --shadow: 0 24px 64px rgba(41, 29, 18, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(210, 117, 48, 0.14), transparent 24%),
        radial-gradient(circle at top right, rgba(29, 107, 87, 0.16), transparent 26%),
        linear-gradient(180deg, #fbf7f1, var(--bg));
    }
    .shell {
      width: min(1520px, calc(100% - 24px));
      margin: 14px auto 24px;
      display: grid;
      gap: 16px;
    }
    .hero, .panel {
      background: var(--panel);
      border: 1px solid rgba(255,255,255,0.7);
      border-radius: 28px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(12px);
    }
    .hero { padding: 24px 26px; }
    .hero h1 {
      margin: 0;
      font-size: clamp(32px, 4vw, 54px);
      line-height: 0.96;
      letter-spacing: -0.05em;
    }
    .hero p {
      margin: 12px 0 0;
      max-width: 78ch;
      line-height: 1.7;
      color: var(--muted);
    }
    .layout {
      display: grid;
      grid-template-columns: 360px minmax(0, 1fr);
      gap: 16px;
    }
    .panel { overflow: hidden; }
    .head {
      padding: 16px 18px 12px;
      border-bottom: 1px solid var(--line);
    }
    .head h2 {
      margin: 0;
      font-size: 16px;
    }
    .head p {
      margin: 8px 0 0;
      font-size: 13px;
      line-height: 1.6;
      color: var(--muted);
    }
    .body { padding: 16px 18px 18px; }
    .list, .grid, .stack, .stats, .split {
      display: grid;
      gap: 10px;
    }
    .list { gap: 12px; }
    .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .stats { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .split { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .card, .kv, .stat, .row, .event, .banner {
      border: 1px solid var(--line);
      border-radius: 18px;
      background: rgba(255,255,255,0.82);
    }
    .card {
      padding: 14px;
      cursor: pointer;
      transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
    }
    .card:hover {
      transform: translateY(-1px);
      border-color: rgba(29, 107, 87, 0.24);
    }
    .card.active {
      border-color: rgba(29, 107, 87, 0.42);
      box-shadow: inset 0 0 0 1px rgba(29, 107, 87, 0.18);
    }
    .card h4 {
      margin: 0 0 8px;
      font-size: 15px;
    }
    .meta {
      display: grid;
      gap: 6px;
      color: var(--muted);
      font-size: 12px;
    }
    .tag-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }
    .tag {
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 700;
      background: var(--accent-soft);
      color: var(--accent);
    }
    .tag.warn {
      background: var(--warn-soft);
      color: var(--warn);
    }
    .tag.danger {
      background: var(--danger-soft);
      color: var(--danger);
    }
    .kv, .stat, .row, .banner, .event {
      padding: 12px 13px;
    }
    .kv strong, .stat strong, .row strong, .banner strong {
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
      color: var(--muted);
    }
    .kv span, .stat span {
      display: block;
      font-size: 16px;
      font-weight: 700;
      word-break: break-word;
    }
    .banner {
      background: linear-gradient(135deg, rgba(29,107,87,0.12), rgba(255,255,255,0.9));
    }
    .tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      padding: 0 18px 14px;
      border-bottom: 1px solid var(--line);
    }
    .tabs button, .actions button {
      border: 0;
      border-radius: 999px;
      font: inherit;
      cursor: pointer;
    }
    .tabs button {
      padding: 10px 14px;
      background: rgba(29, 107, 87, 0.08);
      color: var(--ink);
    }
    .tabs button.active {
      background: var(--accent);
      color: #fff;
    }
    .actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .actions button {
      padding: 11px 16px;
      background: var(--accent);
      color: #fff;
      font-weight: 700;
    }
    .actions button.ghost {
      background: rgba(29, 107, 87, 0.12);
      color: var(--accent);
    }
    .section { display: none; }
    .section.active { display: block; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      text-align: left;
      padding: 10px 8px;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
    }
    th {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    input, textarea, select {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #fff;
      padding: 10px 12px;
      font: inherit;
    }
    textarea {
      min-height: 90px;
      resize: vertical;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 12px;
      font-family: Consolas, "SFMono-Regular", monospace;
    }
    .event {
      display: grid;
      gap: 6px;
    }
    .event-head {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
    }
    .event-type {
      font-weight: 700;
    }
    .event-time {
      font-size: 12px;
      color: var(--muted);
    }
    .muted {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.6;
    }
    .empty {
      padding: 18px;
      border: 1px dashed var(--line);
      border-radius: 18px;
      color: var(--muted);
      background: rgba(255,255,255,0.6);
    }
    @media (max-width: 1100px) {
      .layout { grid-template-columns: 1fr; }
      .grid, .stats, .split { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <h1>Runtime Console</h1>
      <p>这个看板按 runtime-first 管理方式组织信息。我们把会话真实状态、队列策略、repo 能力状态和 runtime 事件时间线放到一线视图里，方便直接观察当前机器人是“正在跑什么、还在等什么、下一步为什么会这样”。</p>
    </section>
    <div class="layout">
      <section class="panel">
        <div class="head">
          <h2>机器人实例</h2>
          <p>从左侧选择一个群实例，查看它的 runtime 快照、任务投影、repo 能力和群策略。</p>
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
          <button data-tab="basic" class="active">基础信息</button>
          <button data-tab="members">成员角色</button>
          <button data-tab="runtime">运行时</button>
          <button data-tab="logs">事件日志</button>
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
    const state = {
      instances: [],
      currentChatId: null,
      detail: null,
      runtime: null,
      logs: null,
      members: [],
      policy: null,
    };

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
      state.runtime = runtimeResult.status === 'fulfilled' ? runtimeResult.value : { tasks: [], summary: {}, runtimeEvents: [] };
      state.logs = logsResult.status === 'fulfilled' ? logsResult.value : { messages: [], runs: [], artifacts: [], confirmations: [], runtimeEvents: [] };
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
            '<span>Chat ID: ' + escapeHtml(item.chatId) + '</span>' +
            '<span>Session: ' + escapeHtml(item.sessionStatus || '-') + ' / ' + escapeHtml(item.sessionMode || '-') + '</span>' +
          '</div>' +
          '<div class="tag-row">' +
            tag(item.runtimeStatus || 'no-runtime') +
            tag(item.policy?.defaultQueueMode || 'collect') +
            repoTag(item.repoCapability?.state) +
          '</div>' +
          '<div class="tag-row">' +
            tag('queued ' + (item.taskCounts?.queued ?? 0)) +
            tag('running ' + (item.taskCounts?.running ?? 0)) +
            tag('blocked ' + ((item.taskCounts?.blocked ?? 0) + (item.taskCounts?.waitingConfirmation ?? 0)), 'warn') +
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
      subtitleEl.textContent = (state.detail.projectName || '未绑定项目') + ' / ' + state.detail.chatId;
      renderBasic();
      renderMembers();
      renderRuntime();
      renderLogs();
      renderPolicy();
    }

    function renderBasic() {
      const item = state.detail;
      const repo = item.repoCapability || {};
      const runtimeState = item.runtimeState || {};
      const basicHtml =
        banner(
          '当前实例概览',
          [
            'Runtime 状态: ' + valueOrDash(runtimeState.status),
            '默认 Queue Mode: ' + valueOrDash(item.policy?.defaultQueueMode),
            '最近 Run 类型: ' + valueOrDash(item.recentRunType),
            'Repo 能力: ' + valueOrDash(repo.state),
          ].join(' | ')
        ) +
        spacer() +
        '<div class="grid">' +
          kv('机器人名称', escapeHtml(item.robotName)) +
          kv('项目', escapeHtml(item.projectName || '未绑定项目')) +
          kv('Chat ID', escapeHtml(item.chatId)) +
          kv('当前环境', escapeHtml(item.activeEnvironmentName || '未配置')) +
          kv('Session 模式', escapeHtml(item.sessionMode || '-')) +
          kv('Session 状态', escapeHtml(item.sessionStatus || '-')) +
          kv('Runtime 状态', escapeHtml(runtimeState.status || '-')) +
          kv('最近活跃', escapeHtml(item.lastActiveAt || '-')) +
        '</div>' +
        spacer() +
        '<div class="stats">' +
          stat('Queued', item.taskCounts?.queued ?? 0) +
          stat('Running', item.taskCounts?.running ?? 0) +
          stat('Waiting', (item.taskCounts?.blocked ?? 0) + (item.taskCounts?.waitingConfirmation ?? 0)) +
          stat('Recent Skill', escapeHtml(item.recentSkill || '-')) +
        '</div>' +
        spacer() +
        '<div class="grid">' +
          kv('最近 Run 类型', escapeHtml(item.recentRunType || '-')) +
          kv('最近产物', escapeHtml(item.recentArtifactSummary || '-')) +
          kv('Queue Mode 默认值', escapeHtml(item.policy?.defaultQueueMode || '-')) +
          kv('最近错误', escapeHtml(item.lastError || '-')) +
        '</div>' +
        spacer() +
        '<div class="grid">' +
          kv('Repo 能力状态', escapeHtml(repo.state || '-')) +
          kv('底层同步状态', escapeHtml(repo.syncStatus || '-')) +
          kv('Repo 分支', escapeHtml(repo.repoBranch || '-')) +
          kv('Repo HEAD', escapeHtml(repo.repoHeadRef || '-')) +
          kv('Workspace 路径', escapeHtml(repo.workspacePath || '-')) +
          kv('Repo Mirror 路径', escapeHtml(repo.repoMirrorPath || '-')) +
          kv('最近同步时间', escapeHtml(repo.lastSyncAt || '-')) +
          kv('最近同步错误', escapeHtml(repo.lastError || '-')) +
        '</div>' +
        spacer() +
        '<div class="actions">' +
          (item.activeEnvironmentId && repo.repoConfigured
            ? '<button id="trigger-repo-sync">触发 Repo 同步</button>'
            : '<button class="ghost" disabled>当前环境未配置 Repo</button>') +
        '</div>';

      document.getElementById('tab-basic').innerHTML = basicHtml;

      const syncButton = document.getElementById('trigger-repo-sync');
      if (syncButton) {
        syncButton.addEventListener('click', async () => {
          syncButton.disabled = true;
          try {
            await fetchJson('/api/environments/' + encodeURIComponent(item.activeEnvironmentId) + '/repo-sync', {
              method: 'POST',
              body: JSON.stringify({ force: true }),
            });
            await selectInstance(state.currentChatId);
          } finally {
            syncButton.disabled = false;
          }
        });
      }
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
        '<table><thead><tr><th>成员</th><th>群昵称</th><th>项目角色</th><th>职责</th><th>权限</th><th>决策者</th><th>可分配</th><th>操作</th></tr></thead><tbody>' +
        rows +
        '</tbody></table>';

      document.getElementById('sync-members').addEventListener('click', async () => {
        await fetchJson('/api/admin/robot-instances/' + encodeURIComponent(state.currentChatId) + '/members/sync', { method: 'POST' });
        await selectInstance(state.currentChatId);
      });

      document.querySelectorAll('[data-save-member]').forEach((button) => {
        button.addEventListener('click', async () => {
          const id = button.dataset.saveMember;
          await fetchJson('/api/admin/robot-instances/' + encodeURIComponent(state.currentChatId) + '/members/' + id, {
            method: 'PATCH',
            body: JSON.stringify(collectProfilePayload(id)),
          });
          await selectInstance(state.currentChatId);
        });
      });
    }

    function renderRuntime() {
      const runtime = state.runtime || {};
      const runtimeState = runtime.runtimeState || {};
      const runtimeEvents = Array.isArray(runtime.runtimeEvents) ? runtime.runtimeEvents : [];
      const queue = Array.isArray(runtimeState.queue) ? runtimeState.queue : [];
      const tasks = Array.isArray(runtime.tasks) ? runtime.tasks : [];

      const queuedRows = queue.length
        ? queue.map((item) =>
            '<tr>' +
              '<td>' + escapeHtml(item.mode) + '</td>' +
              '<td>' + escapeHtml(item.summary || '-') + '</td>' +
              '<td>' + escapeHtml(item.enqueuedAt || '-') + '</td>' +
            '</tr>'
          ).join('')
        : '<tr><td colspan="3">当前没有排队消息</td></tr>';

      const taskRows = tasks.length
        ? tasks.map((task) =>
            '<tr>' +
              '<td>' + escapeHtml(task.title) + '</td>' +
              '<td>' + escapeHtml(task.status) + '</td>' +
              '<td>' + escapeHtml(task.intent) + '</td>' +
              '<td>' + escapeHtml(task.resultSummary || task.blockedReason || task.lastError || '-') + '</td>' +
            '</tr>'
          ).join('')
        : '<tr><td colspan="4">当前没有 runtime task projection</td></tr>';

      document.getElementById('tab-runtime').innerHTML =
        '<div class="banner"><strong>Session 真状态 vs Task 投影</strong><div class="muted">上半部分是 Pi runtime 的当前会话快照，下半部分是数据库里的 task projection。这样可以直接区分“会话此刻在做什么”和“投影层记录了什么”。</div></div>' +
        spacer() +
        '<div class="grid">' +
          kv('Runtime 状态', escapeHtml(runtimeState.status || '-')) +
          kv('当前 Turn', escapeHtml(runtimeState.currentTurn ? runtimeState.currentTurn.turnId : '-')) +
          kv('Turn 来源消息', escapeHtml(runtimeState.currentTurn?.messageSourceId || '-')) +
          kv('Waiting Reason', escapeHtml(runtimeState.waitingReason || '-')) +
          kv('队列长度', escapeHtml(String(queue.length))) +
          kv('Streaming', escapeHtml(String(Boolean(runtimeState.isStreaming)))) +
          kv('Compacting', escapeHtml(String(Boolean(runtimeState.isCompacting)))) +
          kv('Memory Summary', '<pre>' + escapeHtml(runtimeState.memorySummary || '-') + '</pre>') +
        '</div>' +
        spacer() +
        '<div class="stats">' +
          stat('Queued', runtime.summary?.queued ?? 0) +
          stat('Running', runtime.summary?.running ?? 0) +
          stat('Waiting', (runtime.summary?.blocked ?? 0) + (runtime.summary?.waitingConfirmation ?? 0)) +
          stat('Completed', runtime.summary?.completed ?? 0) +
        '</div>' +
        spacer() +
        '<div class="stack">' +
          '<div class="row"><strong>消息队列</strong><table><thead><tr><th>Mode</th><th>Summary</th><th>Enqueued At</th></tr></thead><tbody>' + queuedRows + '</tbody></table></div>' +
          '<div class="row"><strong>Task Projection</strong><table><thead><tr><th>标题</th><th>状态</th><th>Intent</th><th>说明</th></tr></thead><tbody>' + taskRows + '</tbody></table></div>' +
          '<div class="row"><strong>最近 Runtime Events</strong>' + renderEvents(runtimeEvents.slice(-8).reverse()) + '</div>' +
        '</div>';
    }

    function renderLogs() {
      const logs = state.logs || {};
      const runtimeEvents = Array.isArray(logs.runtimeEvents) ? logs.runtimeEvents : [];
      document.getElementById('tab-logs').innerHTML =
        '<div class="grid">' +
          kv('最近消息', '<pre>' + escapeHtml((logs.messages || []).map(formatMessageText).join('\\n\\n') || '-') + '</pre>') +
          kv('最近 Runs', '<pre>' + escapeHtml((logs.runs || []).map(formatRunText).join('\\n\\n') || '-') + '</pre>') +
          kv('最近产物', '<pre>' + escapeHtml((logs.artifacts || []).map((item) => item.type + ' / ' + item.title + ' / ' + item.status).join('\\n\\n') || '-') + '</pre>') +
          kv('确认记录', '<pre>' + escapeHtml((logs.confirmations || []).map((item) => item.actionType + ' / ' + item.status).join('\\n\\n') || '-') + '</pre>') +
        '</div>' +
        spacer() +
        '<div class="row"><strong>Runtime 事件时间线</strong>' + renderEvents(runtimeEvents) + '</div>';
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
          checkbox('highRiskActionsRequireConfirmation', '高风险动作先确认', policy.highRiskActionsRequireConfirmation) +
        '</div>' +
        spacer() +
        '<div class="grid">' +
          '<div class="row"><strong>默认环境 ID</strong><input id="policy-default-environment" value="' + escapeAttr(policy.defaultEnvironmentId || '') + '" /></div>' +
          '<label class="row"><strong>默认 Queue Mode</strong><select id="policy-default-queue-mode">' +
            queueModeOption(policy.defaultQueueMode, 'collect') +
            queueModeOption(policy.defaultQueueMode, 'followup') +
            queueModeOption(policy.defaultQueueMode, 'steer') +
            queueModeOption(policy.defaultQueueMode, 'interrupt') +
            queueModeOption(policy.defaultQueueMode, 'steer_backlog') +
          '</select></label>' +
          '<div class="row"><strong>允许技能</strong><textarea id="policy-allowed-skills">' + escapeHtml((policy.allowedSkills || []).join('\\n')) + '</textarea></div>' +
        '</div>' +
        spacer() +
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
            defaultQueueMode: document.getElementById('policy-default-queue-mode').value,
            allowedSkills: document.getElementById('policy-allowed-skills').value.split('\\n').map((item) => item.trim()).filter(Boolean),
          }),
        });
        await selectInstance(state.currentChatId);
      });
    }

    function renderEvents(events) {
      if (!events || !events.length) {
        return '<div class="empty">当前还没有 runtime 事件。</div>';
      }
      return '<div class="stack">' + events.map((event) =>
        '<article class="event">' +
          '<div class="event-head">' +
            '<span class="event-type">' + escapeHtml(event.eventType || event.type || '-') + '</span>' +
            '<span class="event-time">' + escapeHtml(event.createdAt || event.at || '-') + '</span>' +
          '</div>' +
          '<pre>' + escapeHtml(JSON.stringify(event.payload || {}, null, 2)) + '</pre>' +
        '</article>'
      ).join('') + '</div>';
    }

    function formatMessageText(item) {
      const raw = String(item?.rawText || '').trim();
      const mentions = Array.isArray(item?.mentionsJson) ? item.mentionsJson : [];
      if (!raw) return '-';
      if (!mentions.length) return raw;
      let text = raw;
      mentions.forEach((mention, index) => {
        const placeholder = mention?.key || ('@_user_' + (index + 1));
        const name = mention?.name || mention?.displayName || mention?.id;
        if (!name) return;
        text = text.replace(placeholder, '@' + name);
      });
      return text;
    }

    function formatRunText(item) {
      return [
        item.runType || 'formal_execution',
        item.intent || '-',
        item.status || '-',
        item.skillName || '-',
        item.outputSummary || '-',
      ].join(' / ');
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

    function value(field, id) {
      return document.querySelector('[data-field="' + field + '"][data-id="' + id + '"]').value || null;
    }

    function checkedByField(field, id) {
      return document.querySelector('[data-field="' + field + '"][data-id="' + id + '"]').checked;
    }

    function checked(id) {
      return document.getElementById(id).checked;
    }

    function checkbox(field, label, checkedValue) {
      return '<label class="row"><strong>' + escapeHtml(label) + '</strong><input id="policy-' + field + '" type="checkbox" ' + (checkedValue ? 'checked' : '') + ' /></label>';
    }

    function queueModeOption(current, value) {
      return '<option value="' + value + '" ' + (current === value ? 'selected' : '') + '>' + value + '</option>';
    }

    function tag(text, kind) {
      return '<span class="tag ' + (kind || '') + '">' + escapeHtml(String(text)) + '</span>';
    }

    function repoTag(stateName) {
      if (stateName === 'repo_error') return tag(stateName, 'danger');
      if (stateName === 'repo_initializing') return tag(stateName, 'warn');
      return tag(stateName || 'repo_unconfigured');
    }

    function banner(title, text) {
      return '<div class="banner"><strong>' + escapeHtml(title) + '</strong><div>' + escapeHtml(text) + '</div></div>';
    }

    function kv(label, value) {
      return '<div class="kv"><strong>' + escapeHtml(label) + '</strong><span>' + value + '</span></div>';
    }

    function stat(label, value) {
      return '<div class="stat"><strong>' + escapeHtml(label) + '</strong><span>' + escapeHtml(String(value)) + '</span></div>';
    }

    function spacer() {
      return '<div style="height:12px"></div>';
    }

    function valueOrDash(value) {
      return value == null || value === '' ? '-' : String(value);
    }

    async function fetchJson(url, init) {
      const response = await fetch(url, { headers: { 'content-type': 'application/json' }, ...init });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    }

    function option(current, value) {
      return '<option value="' + value + '" ' + (current === value ? 'selected' : '') + '>' + value + '</option>';
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
    }

    function escapeAttr(value) {
      return escapeHtml(value).replace(/'/g, '&#39;');
    }

    loadInstances().catch((error) => {
      titleEl.textContent = '加载失败';
      subtitleEl.textContent = error.message;
    });
  </script>
</body>
</html>`;
}
