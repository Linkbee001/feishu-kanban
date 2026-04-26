export function renderProjectBindingToolPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Feishu Kanban 测试控制台</title>
  <style>
    :root {
      --bg: #f6f1e8;
      --paper: rgba(255, 251, 245, 0.88);
      --panel: rgba(255, 255, 255, 0.74);
      --line: rgba(21, 31, 38, 0.1);
      --ink: #162129;
      --muted: #67757d;
      --accent: #136b58;
      --accent-soft: rgba(19, 107, 88, 0.12);
      --warn: #c96541;
      --warn-soft: rgba(201, 101, 65, 0.13);
      --good: #1f7759;
      --good-soft: rgba(31, 119, 89, 0.14);
      --dark: #17222b;
      --shadow: 0 28px 90px rgba(48, 37, 20, 0.14);
      --radius-xl: 28px;
      --radius-lg: 22px;
      --radius-md: 16px;
      --radius-pill: 999px;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      color: var(--ink);
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(201, 101, 65, 0.18), transparent 26%),
        radial-gradient(circle at top right, rgba(19, 107, 88, 0.18), transparent 28%),
        linear-gradient(180deg, #fbf6ef 0%, var(--bg) 100%);
      min-height: 100vh;
    }

    .shell {
      width: min(1480px, calc(100% - 28px));
      margin: 18px auto 28px;
      display: grid;
      gap: 18px;
    }

    .hero,
    .panel {
      background: var(--paper);
      border: 1px solid rgba(255, 255, 255, 0.62);
      box-shadow: var(--shadow);
      backdrop-filter: blur(18px);
    }

    .hero {
      border-radius: var(--radius-xl);
      position: relative;
      overflow: hidden;
      min-height: 248px;
    }

    .hero::before,
    .hero::after {
      content: "";
      position: absolute;
      border-radius: 999px;
      pointer-events: none;
    }

    .hero::before {
      width: 360px;
      height: 360px;
      right: -80px;
      top: -110px;
      background: radial-gradient(circle, rgba(19, 107, 88, 0.22), transparent 72%);
    }

    .hero::after {
      width: 280px;
      height: 280px;
      left: -60px;
      bottom: -120px;
      background: radial-gradient(circle, rgba(201, 101, 65, 0.18), transparent 72%);
    }

    .hero-inner {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 20px;
      align-items: end;
      padding: 24px 24px 28px;
    }

    .eyebrow {
      margin: 0 0 10px;
      color: var(--accent);
      font-size: 12px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-weight: 800;
    }

    h1 {
      margin: 0;
      font-size: clamp(34px, 4.2vw, 58px);
      line-height: 0.94;
      letter-spacing: -0.04em;
      max-width: 11ch;
    }

    .hero-copy p {
      margin: 14px 0 0;
      max-width: 66ch;
      color: var(--muted);
      line-height: 1.72;
      font-size: 15px;
    }

    .hero-side {
      justify-self: end;
      width: min(420px, 100%);
      display: grid;
      gap: 12px;
    }

    .poster {
      border-radius: 24px;
      padding: 18px;
      background:
        linear-gradient(145deg, rgba(19, 107, 88, 0.13), rgba(255, 255, 255, 0.72)),
        linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.18));
      border: 1px solid rgba(255, 255, 255, 0.55);
      display: grid;
      gap: 12px;
    }

    .poster-title {
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 700;
    }

    .poster-grid {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .poster-chip {
      padding: 12px 14px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.76);
      border: 1px solid rgba(21, 31, 38, 0.08);
    }

    .poster-chip strong {
      display: block;
      font-size: 12px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 6px;
    }

    .poster-chip span {
      display: block;
      font-size: 22px;
      line-height: 1;
      font-weight: 800;
      letter-spacing: -0.04em;
    }

    .layout {
      display: grid;
      grid-template-columns: 360px minmax(0, 1fr);
      gap: 18px;
      align-items: start;
    }

    .panel {
      border-radius: var(--radius-xl);
      overflow: hidden;
    }

    .panel-head {
      padding: 18px 20px 14px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0));
    }

    .panel-head h2,
    .panel-head h3 {
      margin: 0;
      font-size: 17px;
      line-height: 1.2;
    }

    .panel-head p {
      margin: 8px 0 0;
      color: var(--muted);
      line-height: 1.65;
      font-size: 13px;
    }

    .panel-body {
      padding: 18px 20px 20px;
    }

    .stack {
      display: grid;
      gap: 14px;
    }

    .split {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .triple {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    label {
      display: grid;
      gap: 7px;
      font-size: 12px;
      font-weight: 800;
      color: var(--muted);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    input,
    textarea,
    select {
      width: 100%;
      border: 1px solid rgba(21, 31, 38, 0.12);
      border-radius: 14px;
      min-height: 46px;
      padding: 12px 14px;
      font: inherit;
      color: var(--ink);
      background: rgba(255, 255, 255, 0.88);
      outline: none;
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }

    textarea {
      min-height: 92px;
      resize: vertical;
    }

    input:focus,
    textarea:focus,
    select:focus {
      border-color: rgba(19, 107, 88, 0.38);
      box-shadow: 0 0 0 4px rgba(19, 107, 88, 0.08);
    }

    .button-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    button {
      appearance: none;
      border: 0;
      border-radius: var(--radius-pill);
      padding: 12px 16px;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
      transition: transform 120ms ease, opacity 120ms ease;
    }

    button:hover { transform: translateY(-1px); }
    button:disabled { opacity: 0.58; transform: none; cursor: wait; }
    button.primary { background: var(--accent); color: #f7fbf9; }
    button.secondary { background: #e9ddcc; color: var(--ink); }
    button.warn { background: var(--warn); color: #fff7f3; }
    button.ghost { background: rgba(255, 255, 255, 0.72); color: var(--ink); }

    .hint {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.65;
    }

    .workflow {
      display: grid;
      gap: 14px;
    }

    .step-card {
      border: 1px solid rgba(21, 31, 38, 0.08);
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.6);
      padding: 14px;
      display: grid;
      gap: 12px;
    }

    .step-head {
      display: grid;
      gap: 6px;
    }

    .step-kicker {
      color: var(--accent);
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-weight: 800;
    }

    .step-title {
      font-size: 16px;
      font-weight: 800;
    }

    .step-desc {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.65;
    }

    .action-note {
      padding: 12px 14px;
      border-radius: 16px;
      background: rgba(21, 31, 38, 0.04);
      color: var(--muted);
      font-size: 12px;
      line-height: 1.65;
    }

    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }

    .tab-btn {
      padding: 10px 14px;
      border-radius: var(--radius-pill);
      background: rgba(255, 255, 255, 0.72);
      color: var(--muted);
      border: 1px solid rgba(21, 31, 38, 0.08);
      font-weight: 800;
    }

    .tab-btn.active {
      background: var(--accent);
      color: white;
      border-color: transparent;
    }

    .tab-panel {
      display: none;
    }

    .tab-panel.active {
      display: block;
    }

    .toolbar {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }

    .toolbar-group {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }

    .status-line {
      min-height: 20px;
      color: var(--muted);
      font-size: 13px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 0 10px;
      border-radius: var(--radius-pill);
      font-size: 12px;
      font-weight: 800;
      background: rgba(21, 31, 38, 0.07);
      color: var(--ink);
    }

    .chip.good {
      background: var(--good-soft);
      color: var(--good);
    }

    .chip.warn {
      background: var(--warn-soft);
      color: var(--warn);
    }

    .metrics {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      margin-bottom: 18px;
    }

    .metric {
      border-radius: 20px;
      background: var(--panel);
      border: 1px solid rgba(21, 31, 38, 0.08);
      padding: 15px 16px;
      display: grid;
      gap: 8px;
      min-height: 104px;
    }

    .metric-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      font-weight: 700;
    }

    .metric-value {
      font-size: 30px;
      line-height: 1;
      letter-spacing: -0.04em;
      font-weight: 800;
    }

    .metric-sub {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.5;
    }

    .zone-grid {
      display: grid;
      gap: 18px;
      grid-template-columns: 1.15fr 0.85fr;
      margin-bottom: 18px;
    }

    .section-card {
      border-radius: var(--radius-lg);
      background: var(--panel);
      border: 1px solid rgba(21, 31, 38, 0.08);
      overflow: hidden;
    }

    .section-head {
      padding: 16px 18px 12px;
      border-bottom: 1px solid var(--line);
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
    }

    .section-head strong {
      font-size: 15px;
    }

    .section-head span {
      color: var(--muted);
      font-size: 12px;
    }

    .section-body {
      padding: 16px 18px 18px;
      display: grid;
      gap: 12px;
    }

    .timeline {
      display: grid;
      gap: 12px;
    }

    .timeline-item {
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.78);
      border: 1px solid rgba(21, 31, 38, 0.08);
      padding: 14px 14px 15px;
      display: grid;
      gap: 10px;
    }

    .timeline-top {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
    }

    .timeline-title {
      font-size: 15px;
      font-weight: 800;
      line-height: 1.35;
    }

    .timeline-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 12px;
      color: var(--muted);
    }

    .timeline-body {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.65;
      word-break: break-word;
    }

    .kv {
      display: grid;
      gap: 8px;
    }

    .kv-row {
      display: grid;
      grid-template-columns: 120px minmax(0, 1fr);
      gap: 12px;
      align-items: start;
      font-size: 13px;
    }

    .kv-key { color: var(--muted); }
    .kv-value {
      font-weight: 700;
      word-break: break-word;
    }

    .empty {
      border-radius: 16px;
      border: 1px dashed rgba(21, 31, 38, 0.16);
      background: rgba(255, 255, 255, 0.4);
      color: var(--muted);
      padding: 18px;
      font-size: 13px;
      line-height: 1.6;
    }

    .checklist {
      display: grid;
      gap: 10px;
    }

    .check-item {
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.78);
      border: 1px solid rgba(21, 31, 38, 0.08);
      padding: 14px 14px 15px;
      display: grid;
      gap: 8px;
    }

    .check-top {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: center;
    }

    .check-title {
      font-size: 14px;
      font-weight: 800;
    }

    .check-desc {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.65;
    }

    .raw-box,
    .log-box {
      border-radius: 18px;
      background: var(--dark);
      color: #eaf3f8;
      padding: 16px;
      font-family: Consolas, "SFMono-Regular", monospace;
      font-size: 12px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      overflow: auto;
      max-height: 420px;
    }

    .link-list {
      display: grid;
      gap: 10px;
    }

    .link-item {
      border-radius: 16px;
      padding: 12px 14px;
      background: rgba(255, 255, 255, 0.76);
      border: 1px solid rgba(21, 31, 38, 0.08);
    }

    .link-item a {
      color: var(--accent);
      text-decoration: none;
      word-break: break-all;
    }

    .resource-grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .resource-box {
      border-radius: 18px;
      padding: 14px;
      background: rgba(255, 255, 255, 0.74);
      border: 1px solid rgba(21, 31, 38, 0.08);
      display: grid;
      gap: 8px;
    }

    .resource-box strong {
      font-size: 12px;
      color: var(--muted);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .resource-box span {
      font-weight: 800;
      word-break: break-word;
    }

    .pulse {
      animation: pulse 1.2s ease-in-out infinite alternate;
    }

    @keyframes pulse {
      from { opacity: 0.55; transform: translateY(0); }
      to { opacity: 1; transform: translateY(-1px); }
    }

    @media (max-width: 1220px) {
      .layout,
      .hero-inner,
      .zone-grid {
        grid-template-columns: 1fr;
      }

      .hero-side {
        justify-self: start;
      }
    }

    @media (max-width: 820px) {
      .split,
      .triple,
      .metrics,
      .resource-grid {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 560px) {
      .shell {
        width: min(100% - 14px, 1480px);
      }

      .split,
      .triple,
      .metrics,
      .resource-grid {
        grid-template-columns: 1fr;
      }

      .kv-row {
        grid-template-columns: 1fr;
        gap: 4px;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-copy">
          <div class="eyebrow">Feishu Kanban Test Console</div>
          <h1>测试、观察、回收，一屏完成</h1>
          <p>这个看板不再只是开发接口集合，而是围绕测试流程来组织：先看当前群是否健康，再按步骤执行初始化与请求验证，最后确认群资源和冗余入口是否被彻底清理。目标是让你在一次测试回合里少切工具、少查表、少猜状态。</p>
        </div>
        <div class="hero-side">
          <div class="poster">
            <div class="poster-title">使用节奏</div>
            <div class="poster-grid">
              <div class="poster-chip">
                <strong>1. 建立现场</strong>
                <span>Seed / Init</span>
              </div>
              <div class="poster-chip">
                <strong>2. 触发消息</strong>
                <span>Watch Run</span>
              </div>
              <div class="poster-chip">
                <strong>3. 检查状态</strong>
                <span>Session + Lock</span>
              </div>
              <div class="poster-chip">
                <strong>4. 收尾清理</strong>
                <span>Unbind + Cleanup</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="layout">
      <aside class="panel">
        <div class="panel-head">
          <h2>测试控制</h2>
          <p>左侧专注于输入测试上下文和执行动作。默认以一个群为单位操作，所有高频验证动作都放在一个固定流程里。</p>
        </div>
        <div class="panel-body">
          <div class="stack">
            <div class="split">
              <label>
                Admin Token
                <input id="adminToken" value="change-me" />
              </label>
              <label>
                自动刷新
                <select id="refreshInterval">
                  <option value="0">手动刷新</option>
                  <option value="3000">3 秒</option>
                  <option value="5000" selected>5 秒</option>
                  <option value="10000">10 秒</option>
                </select>
              </label>
            </div>

            <div class="split">
              <label>
                Chat ID
                <input id="chatId" placeholder="oc_xxx" value="oc_6736356cebd036d8c5685e9bd185e577" />
              </label>
              <label>
                Project ID
                <input id="projectId" placeholder="可选，用于补充查询范围" />
              </label>
            </div>

            <div class="button-row">
              <button class="primary" id="refreshMonitor">刷新状态</button>
              <button class="ghost" id="toggleAutoRefresh">暂停自动刷新</button>
            </div>

            <div class="status-line" id="monitorStatus">等待首次状态刷新。</div>

            <div class="workflow">
              <section class="step-card">
                <div class="step-head">
                  <div class="step-kicker">Step 1</div>
                  <div class="step-title">建立测试现场</div>
                  <div class="step-desc">先确认这个群现在是不是已经绑了项目，再决定是做开发态 Seed，还是走一次正式初始化。</div>
                </div>

                <div class="split">
                  <label>
                    项目名称
                    <input id="projectName" value="markdown编辑器项目" />
                  </label>
                  <label>
                    Owner Open ID
                    <input id="ownerOpenId" value="ou_bd37db7b6896207ac585806524cc2b75" />
                  </label>
                </div>

                <label>
                  项目描述
                  <textarea id="description">这是一个用于 Markdown 编辑协作的项目。</textarea>
                </label>

                <div class="split">
                  <label>
                    仓库地址
                    <input id="repoUrl" value="https://github.com/Linkbee001/markdown-refine.git" />
                  </label>
                  <label>
                    分支
                    <input id="repoBranch" value="main" />
                  </label>
                </div>

                <div class="button-row">
                  <button class="secondary" id="checkBinding">先查当前群绑定</button>
                  <button class="secondary" id="seedProject">开发态 Seed 最小现场</button>
                  <button class="primary" id="initProject">正式初始化这个群</button>
                </div>

                <div class="action-note">推荐顺序：先查当前群绑定。没有项目时先用 Seed 快速造现场；需要走真实链路时再点正式初始化。</div>
              </section>

              <section class="step-card">
                <div class="step-head">
                  <div class="step-kicker">Step 2</div>
                  <div class="step-title">检查当前是否适合继续测试</div>
                  <div class="step-desc">这一步不执行写操作，只帮你判断群会话、锁、最近运行和失败堆积是不是健康。</div>
                </div>
                <div class="checklist" id="verifyChecklist"></div>
                <div class="action-note">常见节奏：去飞书群发一条正式消息，再回来刷新状态，重点看 active session、lock、未收尾 run 和 artifact。</div>
              </section>

              <section class="step-card">
                <div class="step-head">
                  <div class="step-kicker">Step 3</div>
                  <div class="step-title">项目级回收</div>
                  <div class="step-desc">这组动作是按“当前群绑定的项目”来回收，适合做解绑验证和整组资源清理。</div>
                </div>

                <div class="button-row">
                  <button class="warn" id="unbindProject">只解绑当前群</button>
                  <button class="warn" id="cleanupProject">清理群关联资源</button>
                </div>

                <div class="action-note">只解绑当前群：会断开群绑定并清理群标签，不删除文档目录和多维表。清理群关联资源：会尝试删除群标签、文档目录、多维表 table，再删除整个多维表 app。</div>
              </section>

              <section class="step-card">
                <div class="step-head">
                  <div class="step-kicker">Step 4</div>
                  <div class="step-title">手动按资源 ID 回收</div>
                  <div class="step-desc">当项目已经解绑，或者你只想补清某个残留资源时，用这一组低层动作直接删指定资源。</div>
                </div>

                <div class="split">
                  <label>
                    资源类型
                    <select id="resourceType">
                      <option value="folder">folder</option>
                      <option value="bitable">bitable</option>
                      <option value="bitableTable">bitableTable</option>
                    </select>
                  </label>
                  <label>
                    资源 ID
                    <input id="resourceId" placeholder="folderToken / appToken / tableId" />
                  </label>
                </div>

                <label>
                  表格所属 App Token
                  <input id="resourceAppToken" placeholder="仅 bitableTable 清理时需要" />
                </label>

                <div class="button-row">
                  <button class="warn" id="cleanupById">删除指定资源 ID</button>
                </div>

                <div class="action-note" id="manualCleanupHint">当前选择会直接删除整个文件夹、整个多维表 app，或单独一张 bitable table。右侧回执会明确告诉你删的是哪一层。</div>
              </section>
            </div>

            <div class="link-list" id="links"></div>
          </div>
        </div>
      </aside>

      <section class="panel">
        <div class="panel-head">
          <h2>观察看板</h2>
          <p>右侧是按测试任务流重排后的状态面板：概况、会话与锁、最近运行、资源与回收痕迹。你应该能在这里一眼看清楚当前群“能不能测、测到了哪、有没有收干净”。</p>
        </div>
        <div class="panel-body">
          <div class="toolbar">
            <div class="toolbar-group">
              <span class="chip" id="queryBadge">全局视图</span>
              <span class="status-line" id="generatedAt">未加载</span>
            </div>
            <div class="toolbar-group">
              <span class="chip good" id="focusHint">建议先建立现场</span>
            </div>
          </div>

          <section class="metrics" id="metrics"></section>

          <section class="zone-grid">
            <div class="section-card">
              <div class="section-head">
                <strong>群会话与锁</strong>
                <span id="sessionCountText">0 sessions</span>
              </div>
              <div class="section-body" id="sessionsPanel"></div>
            </div>

            <div class="section-card">
              <div class="section-head">
                <strong>当前项目与资源</strong>
                <span>绑定关系</span>
              </div>
              <div class="section-body" id="projectPanel"></div>
            </div>
          </section>

          <section class="zone-grid">
            <div class="section-card">
              <div class="section-head">
                <strong>最近运行</strong>
                <span id="runCountText">0 runs</span>
              </div>
              <div class="section-body" id="runsPanel"></div>
            </div>

            <div class="section-card">
              <div class="section-head">
                <strong>最近消息</strong>
                <span id="messageCountText">0 messages</span>
              </div>
              <div class="section-body" id="messagesPanel"></div>
            </div>
          </section>

          <section class="zone-grid">
            <div class="section-card">
              <div class="section-head">
                <strong>沉淀产物</strong>
                <span id="artifactCountText">0 artifacts</span>
              </div>
              <div class="section-body" id="artifactsPanel"></div>
            </div>

            <div class="section-card">
              <div class="section-head">
                <strong>确认与回收痕迹</strong>
                <span id="confirmationCountText">0 confirmations</span>
              </div>
              <div class="section-body" id="confirmationsPanel"></div>
            </div>
          </section>

          <section class="zone-grid">
            <div class="section-card">
              <div class="section-head">
                <strong>资源清理观察</strong>
                <span>解绑后重点看这里</span>
              </div>
              <div class="section-body">
                <div class="resource-grid" id="resourcePanel"></div>
                <div class="log-box" id="actionLog">等待动作日志...</div>
              </div>
            </div>

            <div class="section-card">
              <div class="section-head">
                <strong>原始快照</strong>
                <span>方便复制问题现场</span>
              </div>
              <div class="section-body">
                <div class="raw-box" id="rawSnapshot">{ "ok": true, "message": "等待监控快照..." }</div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </section>
  </main>

  <script>
    const $ = (id) => document.getElementById(id);

    const fields = {
      adminToken: $('adminToken'),
      refreshInterval: $('refreshInterval'),
      chatId: $('chatId'),
      projectId: $('projectId'),
      projectName: $('projectName'),
      ownerOpenId: $('ownerOpenId'),
      description: $('description'),
      repoUrl: $('repoUrl'),
      repoBranch: $('repoBranch'),
      resourceType: $('resourceType'),
      resourceId: $('resourceId'),
      resourceAppToken: $('resourceAppToken'),
    };

    const elements = {
      monitorStatus: $('monitorStatus'),
      manualCleanupHint: $('manualCleanupHint'),
      queryBadge: $('queryBadge'),
      generatedAt: $('generatedAt'),
      focusHint: $('focusHint'),
      metrics: $('metrics'),
      sessionsPanel: $('sessionsPanel'),
      projectPanel: $('projectPanel'),
      runsPanel: $('runsPanel'),
      messagesPanel: $('messagesPanel'),
      artifactsPanel: $('artifactsPanel'),
      confirmationsPanel: $('confirmationsPanel'),
      resourcePanel: $('resourcePanel'),
      verifyChecklist: $('verifyChecklist'),
      rawSnapshot: $('rawSnapshot'),
      actionLog: $('actionLog'),
      links: $('links'),
      sessionCountText: $('sessionCountText'),
      runCountText: $('runCountText'),
      messageCountText: $('messageCountText'),
      artifactCountText: $('artifactCountText'),
      confirmationCountText: $('confirmationCountText'),
    };

    let lastSnapshot = null;
    let autoTimer = null;
    let autoPaused = false;
    const actionLines = [];

    function updateManualCleanupHint() {
      const resourceType = fields.resourceType.value;
      let text = '当前选择会直接删除整个文件夹、整个多维表 app，或单独一张 bitable table。右侧回执会明确告诉你删的是哪一层。';
      if (resourceType === 'bitable') {
        text = 'bitable 会删除整个多维表 app。适合处理整个项目看板残留，也会连带让该 app 下的表一起不可用。';
      } else if (resourceType === 'bitableTable') {
        text = 'bitableTable 只删除单张表，不会删除整个多维表 app。如果你想彻底回收整个多维表，请选择 bitable。';
      } else if (resourceType === 'folder') {
        text = 'folder 会删除整个项目文档目录。适合处理飞书文档目录残留。';
      }
      elements.manualCleanupHint.textContent = text;
    }

    function escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function nowText() {
      return new Date().toLocaleString('zh-CN', { hour12: false });
    }

    function logAction(title, payload) {
      const line = '[' + nowText() + '] ' + title + '\\n' + (typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
      actionLines.unshift(line);
      while (actionLines.length > 20) actionLines.pop();
      elements.actionLog.textContent = actionLines.join('\\n\\n');
    }

    function setStatus(text, live = false) {
      elements.monitorStatus.textContent = text;
      elements.monitorStatus.classList.toggle('pulse', Boolean(live));
    }

    function formatDate(value) {
      if (!value) return '未记录';
      try {
        return new Date(value).toLocaleString('zh-CN', { hour12: false });
      } catch {
        return String(value);
      }
    }

    function buildQueryString(params) {
      const search = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).trim() !== '') {
          search.set(key, String(value));
        }
      });
      return search.toString();
    }

    async function request(method, path, body) {
      const headers = {
        Authorization: 'Bearer ' + fields.adminToken.value.trim(),
      };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetch(path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = text;
      }
      if (!response.ok) {
        throw new Error(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
      }
      return data;
    }

    function chip(label, tone) {
      return '<span class="chip ' + (tone || '') + '">' + escapeHtml(label) + '</span>';
    }

    function empty(message) {
      return '<div class="empty">' + escapeHtml(message) + '</div>';
    }

    function formPayload() {
      return {
        name: fields.projectName.value.trim(),
        description: fields.description.value.trim(),
        ownerOpenId: fields.ownerOpenId.value.trim(),
        feishuChatId: fields.chatId.value.trim(),
        createdBy: fields.ownerOpenId.value.trim(),
        repoUrl: fields.repoUrl.value.trim(),
        repoBranch: fields.repoBranch.value.trim() || 'main',
      };
    }

    function cleanupPayload() {
      return {
        resourceType: fields.resourceType.value.trim(),
        resourceId: fields.resourceId.value.trim(),
        appToken: fields.resourceAppToken.value.trim() || undefined,
      };
    }

    function requireFields(mode) {
      const data = formPayload();
      const missing = [];
      if (!fields.adminToken.value.trim()) missing.push('Admin Token');
      if (!data.feishuChatId && mode !== 'cleanupById') missing.push('Chat ID');
      if ((mode === 'seed' || mode === 'init') && !data.name) missing.push('项目名称');
      if ((mode === 'seed' || mode === 'init') && !data.ownerOpenId) missing.push('Owner Open ID');
      if (mode === 'cleanupById') {
        if (!fields.resourceType.value.trim()) missing.push('资源类型');
        if (!fields.resourceId.value.trim()) missing.push('资源 ID');
      }
      if (missing.length) {
        throw new Error('缺少必填项：' + missing.join('、'));
      }
      return data;
    }

    function renderMetrics(snapshot) {
      const counts = snapshot.counts;
      const cards = [
        [
          '活动会话',
          counts.sessions,
          '当前仍可接收或处理消息的群 session 数量，不包含已 disabled 的历史会话。',
          'busy ' + counts.busySessions + ' / lock ' + counts.lockedChats,
        ],
        [
          '未收尾 Run',
          counts.runningRuns,
          '最近 run 中状态仍处于 queued、running 或 syncing 的执行数量。也就是还没完整收尾的任务。',
          '当前群活跃 ' + (counts.activeSessionRuns ?? 0) + ' / 失败 ' + counts.failedRuns,
        ],
        [
          '产物同步',
          counts.syncedArtifacts,
          '已经成功沉淀到飞书或本地记录的 artifact 数量，不是 run 数量。',
          '失败 ' + counts.failedArtifacts,
        ],
        [
          '待确认',
          counts.pendingConfirmations,
          '仍在等待人工确认的动作数量，例如任务拆解或高风险写入确认。',
          '历史会话 ' + (counts.disabledSessions ?? 0),
        ],
      ];
      elements.metrics.innerHTML = cards.map(([label, value, desc, sub]) => (
        '<article class="metric">' +
          '<div class="metric-label">' + escapeHtml(label) + '</div>' +
          '<div class="metric-value">' + escapeHtml(value) + '</div>' +
          '<div class="metric-sub">' + escapeHtml(desc) + '</div>' +
          '<div class="metric-sub">' + escapeHtml(sub) + '</div>' +
        '</article>'
      )).join('');
    }

    function renderSessions(sessions) {
      elements.sessionCountText.textContent = sessions.length + ' sessions';
      if (!sessions.length) {
        const disabledCount = lastSnapshot?.disabledSessions?.length ?? 0;
        elements.sessionsPanel.innerHTML = empty(
          disabledCount
            ? ('当前没有活动群会话。已发现 ' + disabledCount + ' 条 disabled 历史会话痕迹。')
            : '当前没有活动群会话。可以先 Seed 或正式初始化一个群。'
        );
        return;
      }
      elements.sessionsPanel.innerHTML = '<div class="timeline">' + sessions.map((session) => {
        const statusTone = session.status === 'idle' ? 'good' : 'warn';
        const lockTone = session.lock?.locked ? 'warn' : 'good';
        return (
          '<article class="timeline-item">' +
            '<div class="timeline-top">' +
              '<div class="timeline-title">' + escapeHtml(session.project?.name || session.feishuChatId) + '</div>' +
              '<div>' + chip(session.sessionMode, '') + ' ' + chip(session.status, statusTone) + ' ' + chip(session.lock?.locked ? 'lock:on' : 'lock:off', lockTone) + '</div>' +
            '</div>' +
            '<div class="kv">' +
              '<div class="kv-row"><div class="kv-key">Chat ID</div><div class="kv-value">' + escapeHtml(session.feishuChatId) + '</div></div>' +
              '<div class="kv-row"><div class="kv-key">Runtime</div><div class="kv-value">' + escapeHtml(session.runtimeSessionKey) + '</div></div>' +
              '<div class="kv-row"><div class="kv-key">Pi Session</div><div class="kv-value">' + escapeHtml(session.piSessionId || '未写入') + '</div></div>' +
              '<div class="kv-row"><div class="kv-key">Store</div><div class="kv-value">' + escapeHtml(session.sessionStoreDriver || '未写入') + '</div></div>' +
              '<div class="kv-row"><div class="kv-key">Store Ref</div><div class="kv-value">' + escapeHtml(session.sessionStoreRef || '未写入') + '</div></div>' +
              '<div class="kv-row"><div class="kv-key">Current Run</div><div class="kv-value">' + escapeHtml(session.currentAgentRunId || '空闲') + '</div></div>' +
              '<div class="kv-row"><div class="kv-key">Environment</div><div class="kv-value">' + escapeHtml(session.activeEnvironment?.name || '未绑定') + '</div></div>' +
              '<div class="kv-row"><div class="kv-key">Lock TTL</div><div class="kv-value">' + escapeHtml(session.lock?.locked ? String(session.lock.ttlMs) + ' ms' : '未上锁') + '</div></div>' +
              '<div class="kv-row"><div class="kv-key">Last Error</div><div class="kv-value">' + escapeHtml(session.lastError || '无') + '</div></div>' +
            '</div>' +
          '</article>'
        );
      }).join('') + '</div>';
    }

    function renderProject(project, sessions) {
      if (!project) {
        const disabledCount = (lastSnapshot?.disabledSessions || []).length;
        elements.projectPanel.innerHTML = empty(
          disabledCount
            ? '当前群还没有绑定正式项目。这个群已经解绑，右侧只保留 disabled 历史会话作为审计痕迹。'
            : '当前群还没有绑定正式项目。'
        );
        return;
      }
      const session = sessions[0] || null;
      const envItems = (project.environments || []).map((env) => (
        '<article class="timeline-item">' +
          '<div class="timeline-top">' +
            '<div class="timeline-title">' + escapeHtml(env.name) + '</div>' +
            '<div>' + chip(env.type, '') + ' ' + chip(env.status, env.status === 'active' ? 'good' : 'warn') + '</div>' +
          '</div>' +
          '<div class="timeline-meta">' +
            '<span>' + escapeHtml(env.repoUrl || '未配置仓库') + '</span>' +
            '<span>branch ' + escapeHtml(env.repoBranch || '未配置') + '</span>' +
          '</div>' +
        '</article>'
      )).join('');

      elements.projectPanel.innerHTML =
        '<div class="resource-grid">' +
          '<div class="resource-box"><strong>Project ID</strong><span>' + escapeHtml(project.id) + '</span></div>' +
          '<div class="resource-box"><strong>文档标签 ID</strong><span>' + escapeHtml(project.docChatTabId || '未记录') + '</span></div>' +
          '<div class="resource-box"><strong>看板标签 ID</strong><span>' + escapeHtml(project.bitableChatTabId || '未记录') + '</span></div>' +
        '</div>' +
        '<div class="kv">' +
          '<div class="kv-row"><div class="kv-key">项目名</div><div class="kv-value">' + escapeHtml(project.name) + '</div></div>' +
          '<div class="kv-row"><div class="kv-key">状态</div><div class="kv-value">' + escapeHtml(project.status) + '</div></div>' +
          '<div class="kv-row"><div class="kv-key">默认环境</div><div class="kv-value">' + escapeHtml(project.defaultEnvironmentId || '未设置') + '</div></div>' +
          '<div class="kv-row"><div class="kv-key">文档目录</div><div class="kv-value">' + escapeHtml(project.docFolderToken || '未记录') + '</div></div>' +
          '<div class="kv-row"><div class="kv-key">任务看板</div><div class="kv-value">' + escapeHtml(project.bitableAppToken || '未记录') + '</div></div>' +
          '<div class="kv-row"><div class="kv-key">会话模式</div><div class="kv-value">' + escapeHtml(session?.sessionMode || '未创建 session') + '</div></div>' +
          '<div class="kv-row"><div class="kv-key">Pi Session</div><div class="kv-value">' + escapeHtml(session?.piSessionId || '未写入') + '</div></div>' +
        '</div>' +
        '<div class="timeline">' + (envItems || empty('没有环境信息')) + '</div>';
    }

    function renderRuns(runs) {
      elements.runCountText.textContent = runs.length + ' runs';
      if (!runs.length) {
        elements.runsPanel.innerHTML = empty('还没有运行记录。可以在飞书群发一条正式消息后回来查看。');
        return;
      }
      elements.runsPanel.innerHTML = '<div class="timeline">' + runs.map((run) => (
        '<article class="timeline-item">' +
          '<div class="timeline-top">' +
            '<div class="timeline-title">' + escapeHtml(run.intent) + '</div>' +
            '<div>' + chip(run.status, ['succeeded'].includes(run.status) ? 'good' : ['failed', 'timeout', 'canceled'].includes(run.status) ? 'warn' : '') + '</div>' +
          '</div>' +
          '<div class="timeline-meta">' +
            '<span>Run ID ' + escapeHtml(run.id) + '</span>' +
            '<span>Kernel SDK direct</span>' +
            '<span>' + escapeHtml(formatDate(run.createdAt)) + '</span>' +
          '</div>' +
          '<div class="timeline-body">' + escapeHtml(run.outputSummary || run.errorMessage || run.prompt || '') + '</div>' +
        '</article>'
      )).join('') + '</div>';
    }

    function renderMessages(messages) {
      elements.messageCountText.textContent = messages.length + ' messages';
      if (!messages.length) {
        elements.messagesPanel.innerHTML = empty('暂无消息来源记录。');
        return;
      }
      elements.messagesPanel.innerHTML = '<div class="timeline">' + messages.map((message) => (
        '<article class="timeline-item">' +
          '<div class="timeline-top">' +
            '<div class="timeline-title">' + escapeHtml(message.sourceType + ' · ' + message.senderOpenId) + '</div>' +
            '<div>' + chip(formatDate(message.receivedAt), '') + '</div>' +
          '</div>' +
          '<div class="timeline-body">' + escapeHtml(message.rawText) + '</div>' +
        '</article>'
      )).join('') + '</div>';
    }

    function renderArtifacts(artifacts) {
      elements.artifactCountText.textContent = artifacts.length + ' artifacts';
      if (!artifacts.length) {
        elements.artifactsPanel.innerHTML = empty('暂无沉淀产物。');
        return;
      }
      elements.artifactsPanel.innerHTML = '<div class="timeline">' + artifacts.map((artifact) => (
        '<article class="timeline-item">' +
          '<div class="timeline-top">' +
            '<div class="timeline-title">' + escapeHtml(artifact.title) + '</div>' +
            '<div>' + chip(artifact.type, '') + ' ' + chip(artifact.status, artifact.status === 'synced' ? 'good' : artifact.status === 'failed' ? 'warn' : '') + '</div>' +
          '</div>' +
          '<div class="timeline-meta">' +
            '<span>Run ' + escapeHtml(artifact.agentRunId || '无') + '</span>' +
            '<span>' + escapeHtml(formatDate(artifact.createdAt)) + '</span>' +
          '</div>' +
        '</article>'
      )).join('') + '</div>';
    }

    function renderConfirmations(confirmations) {
      elements.confirmationCountText.textContent = confirmations.length + ' confirmations';
      if (!confirmations.length) {
        elements.confirmationsPanel.innerHTML = empty('没有待确认动作，也没有确认痕迹。');
        return;
      }
      elements.confirmationsPanel.innerHTML = '<div class="timeline">' + confirmations.map((item) => (
        '<article class="timeline-item">' +
          '<div class="timeline-top">' +
            '<div class="timeline-title">' + escapeHtml(item.actionType) + '</div>' +
            '<div>' + chip(item.status, item.status === 'confirmed' ? 'good' : item.status === 'pending' ? 'warn' : '') + '</div>' +
          '</div>' +
          '<div class="timeline-meta">' +
            '<span>message ' + escapeHtml(item.messageSource?.feishuMessageId || '无') + '</span>' +
            '<span>expires ' + escapeHtml(formatDate(item.expiresAt)) + '</span>' +
          '</div>' +
        '</article>'
      )).join('') + '</div>';
    }

    function renderResourcePanel(snapshot) {
      const project = snapshot.project || {};
      const session = (snapshot.sessions || [])[0] || {};
      const boxes = [
        ['群文档目录', project.docFolderToken || '未绑定'],
        ['任务看板 App', project.bitableAppToken || '未绑定'],
        ['任务看板 Table', project.bitableTableId || '未记录'],
        ['会话模式', session.sessionMode || '未创建'],
        ['Pi Session', session.piSessionId || '未写入'],
        ['Session Store', session.sessionStoreDriver || '未写入'],
        ['群文档标签', project.docChatTabId || '未记录'],
        ['看板标签', project.bitableChatTabId || '未记录'],
        ['当前锁', session.lock?.locked ? '仍持有' : '空闲'],
      ];
      elements.resourcePanel.innerHTML = boxes.map(([k, v]) => (
        '<div class="resource-box"><strong>' + escapeHtml(k) + '</strong><span>' + escapeHtml(v) + '</span></div>'
      )).join('');
    }

    function deriveChecklist(snapshot) {
      const project = snapshot.project;
      const session = (snapshot.sessions || [])[0];
      const counts = snapshot.counts || {};
      return [
        {
          title: '群已建立测试现场',
          ok: Boolean(project),
          desc: project ? '项目、环境和群绑定都已存在，可以直接进入消息验证。' : '当前群还没有绑定项目，先做开发态 Seed 或正式初始化。',
        },
        {
          title: '群会话已进入正式模式',
          ok: session?.sessionMode === 'active',
          desc: session ? ('当前 session_mode 为 ' + session.sessionMode + '。') : '还没有创建 session。',
        },
        {
          title: '没有遗留锁',
          ok: !session?.lock?.locked,
          desc: session?.lock?.locked ? '当前 Redis 锁仍被占用，重复测试前建议先等 run 完成。' : '当前锁为空闲，可以继续发起测试。',
        },
        {
          title: '最近运行链路可观察',
          ok: (snapshot.runs || []).length > 0,
          desc: (snapshot.runs || []).length > 0 ? '右侧已经有 run，可继续看 artifact 和状态迁移。' : '还没有运行记录，去飞书群发一条正式消息再刷新。',
        },
        {
          title: '没有明显堆积的异常',
          ok: (counts.failedRuns || 0) === 0 && (counts.failedArtifacts || 0) === 0,
          desc: ((counts.failedRuns || 0) + (counts.failedArtifacts || 0)) > 0
            ? '最近存在失败 run 或失败 artifact，建议先排查后再做回收验证。'
            : '目前没有失败堆积，适合继续做清理链路测试。',
        },
      ];
    }

    function renderChecklist(snapshot) {
      const items = deriveChecklist(snapshot);
      elements.verifyChecklist.innerHTML = items.map((item) => (
        '<article class="check-item">' +
          '<div class="check-top">' +
            '<div class="check-title">' + escapeHtml(item.title) + '</div>' +
            '<div>' + chip(item.ok ? '通过' : '待处理', item.ok ? 'good' : 'warn') + '</div>' +
          '</div>' +
          '<div class="check-desc">' + escapeHtml(item.desc) + '</div>' +
        '</article>'
      )).join('');
    }

    function renderLinks(data) {
      elements.links.innerHTML = '';
      const links = [];
      if (data && typeof data === 'object') {
        if (data.docFolderUrl) links.push(['项目文档', data.docFolderUrl]);
        if (data.bitableUrl) links.push(['任务看板', data.bitableUrl]);
      }
      links.forEach(([label, href]) => {
        const block = document.createElement('div');
        block.className = 'link-item';
        block.innerHTML = '<strong>' + escapeHtml(label) + '</strong><br /><a target="_blank" rel="noreferrer" href="' + href + '">' + href + '</a>';
        elements.links.appendChild(block);
      });
    }

    function updateFocus(snapshot) {
      const session = (snapshot.sessions || [])[0];
      let text = '建议先建立现场';
      if (!snapshot.project && (snapshot.disabledSessions || []).length > 0) {
        text = '当前群已解绑，仅保留历史 disabled 会话痕迹';
      } else if (!snapshot.project) {
        text = '建议先做 Seed 或正式初始化';
      } else if (session?.sessionMode !== 'active') {
        text = '建议先把群切到 active 会话';
      } else if ((snapshot.runs || []).length === 0) {
        text = '建议去飞书群发一条正式消息';
      } else if (snapshot.counts.lockedChats > 0) {
        text = '当前有锁，等 run 收尾后再做下一步';
      } else {
        text = '当前适合做解绑和资源清理验证';
      }
      elements.focusHint.textContent = text;
    }

    function renderSnapshot(snapshot) {
      lastSnapshot = snapshot;
      elements.queryBadge.textContent = snapshot.query.chatId
        ? ('Chat · ' + snapshot.query.chatId)
        : snapshot.query.projectId
          ? ('Project · ' + snapshot.query.projectId)
          : '全局视图';
      elements.generatedAt.textContent = '最近快照：' + formatDate(snapshot.generatedAt);
      renderMetrics(snapshot);
      renderSessions(snapshot.sessions || []);
      renderProject(snapshot.project || null, snapshot.sessions || []);
      renderRuns(snapshot.runs || []);
      renderMessages(snapshot.messages || []);
      renderArtifacts(snapshot.artifacts || []);
      renderConfirmations(snapshot.confirmations || []);
      renderResourcePanel(snapshot);
      renderChecklist(snapshot);
      updateFocus(snapshot);
      elements.rawSnapshot.textContent = JSON.stringify(snapshot, null, 2);
    }

    async function fetchMonitor() {
      const query = buildQueryString({
        chatId: fields.chatId.value.trim() || undefined,
        projectId: fields.projectId.value.trim() || undefined,
      });
      const data = await request('GET', '/api/dev/monitor' + (query ? ('?' + query) : ''));
      renderSnapshot(data);
      setStatus('状态已刷新。', true);
      logAction('刷新监控', { query: data.query, generatedAt: data.generatedAt });
    }

    function resetAutoRefresh() {
      if (autoTimer) clearInterval(autoTimer);
      autoTimer = null;
      if (autoPaused) return;
      const interval = Number(fields.refreshInterval.value || 0);
      if (!interval) return;
      autoTimer = setInterval(() => {
        fetchMonitor().catch((error) => setStatus('自动刷新失败：' + (error.message || String(error))));
      }, interval);
    }

    async function runAction(label, work) {
      setStatus(label + '中...');
      try {
        const data = await work();
        renderLinks(data);
        elements.rawSnapshot.textContent = JSON.stringify(data, null, 2);
        logAction(label + '完成', data);
        setStatus(label + '完成。');
        await fetchMonitor().catch(() => undefined);
      } catch (error) {
        const text = error.message || String(error);
        elements.rawSnapshot.textContent = text;
        logAction(label + '失败', text);
        setStatus(label + '失败：' + text);
      }
    }

    $('refreshMonitor').addEventListener('click', () => {
      fetchMonitor().catch((error) => setStatus('刷新失败：' + (error.message || String(error))));
    });

    $('toggleAutoRefresh').addEventListener('click', (event) => {
      autoPaused = !autoPaused;
      event.currentTarget.textContent = autoPaused ? '恢复自动刷新' : '暂停自动刷新';
      setStatus(autoPaused ? '自动刷新已暂停。' : '自动刷新已恢复。');
      resetAutoRefresh();
    });

    fields.refreshInterval.addEventListener('change', resetAutoRefresh);
    fields.resourceType.addEventListener('change', updateManualCleanupHint);

    $('checkBinding').addEventListener('click', () => runAction('查询群绑定', async () => {
      requireFields('check');
      return request('GET', '/api/projects/by-chat/' + encodeURIComponent(fields.chatId.value.trim()));
    }));

    $('seedProject').addEventListener('click', () => runAction('开发态 Seed', async () => {
      requireFields('seed');
      return request('POST', '/api/dev/seed-project', formPayload());
    }));

    $('initProject').addEventListener('click', () => runAction('正式初始化', async () => {
      requireFields('init');
      return request('POST', '/api/projects/init-from-chat', formPayload());
    }));

    $('unbindProject').addEventListener('click', () => runAction('解绑当前群', async () => {
      requireFields('unbind');
      return request('POST', '/api/projects/by-chat/' + encodeURIComponent(fields.chatId.value.trim()) + '/unbind');
    }));

    $('cleanupProject').addEventListener('click', () => runAction('清理飞书资源', async () => {
      requireFields('unbind');
      return request('POST', '/api/projects/by-chat/' + encodeURIComponent(fields.chatId.value.trim()) + '/cleanup');
    }));

    $('cleanupById').addEventListener('click', () => runAction('按资源 ID 清理', async () => {
      requireFields('cleanupById');
      return request('POST', '/api/dev/cleanup-resource', cleanupPayload());
    }));

    Promise.resolve()
      .then(fetchMonitor)
      .catch((error) => setStatus('初始加载失败：' + (error.message || String(error))));
    updateManualCleanupHint();
    resetAutoRefresh();
  </script>
</body>
</html>`;
}
