# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-ui-redesign.spec.ts >> Admin UI Redesign >> Pagination and sorting controls work
- Location: test\e2e\admin-ui-redesign.spec.ts:225:7

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e6]:
      - generic [ref=e7]:
        - heading "Admin Dashboard" [level=1] [ref=e8]
        - paragraph [ref=e9]: 飞书机器人实例管理后台
      - generic [ref=e10]: v1.3.0
  - main [ref=e11]:
    - generic [ref=e12]:
      - generic [ref=e13]:
        - textbox "搜索项目名称或 Chat ID..." [ref=e14]
        - combobox [ref=e15]:
          - text: 筛选状态
          - img [ref=e17]
        - button "刷新数据" [ref=e19]:
          - img [ref=e20]
          - text: 刷新数据
      - generic [ref=e24]:
        - generic [ref=e25]:
          - heading "机器人实例" [level=2] [ref=e26]
          - paragraph [ref=e27]: 点击实例查看详情或执行操作
        - table [ref=e28]:
          - rowgroup [ref=e29]:
            - row "Chat ID Session Mode Project Name Last Active Status" [ref=e30]:
              - columnheader "Chat ID" [ref=e31]
              - columnheader "Session Mode" [ref=e32]
              - columnheader "Project Name" [ref=e33]
              - columnheader "Last Active" [ref=e34]
              - columnheader "Status" [ref=e35]
              - columnheader [ref=e36]
          - rowgroup [ref=e37]:
            - row "test_core_chat active Core Test Project 2026/5/7 16:12:10 queued 创建 Agent Run 查看日志 配置项目 删除" [ref=e38]:
              - cell "test_core_chat" [ref=e39]:
                - button "test_core_chat" [ref=e40]
              - cell "active" [ref=e41]
              - cell "Core Test Project" [ref=e42]
              - cell "2026/5/7 16:12:10" [ref=e43]
              - cell "queued" [ref=e44]
              - cell "创建 Agent Run 查看日志 配置项目 删除" [ref=e45]:
                - generic [ref=e46]:
                  - button "创建 Agent Run" [ref=e47]
                  - button "查看日志" [ref=e48]
                  - button "配置项目" [ref=e49]
                  - button "删除" [ref=e50]
            - row "oc_a67d8bf658d58e65a7e63f153a693540 pending_config 未绑定项目 2026/5/7 18:37:30 queued 创建 Agent Run 查看日志 配置项目 删除" [ref=e51]:
              - cell "oc_a67d8bf658d58e65a7e63f153a693540" [ref=e52]:
                - button "oc_a67d8bf658d58e65a7e63f153a693540" [ref=e53]
              - cell "pending_config" [ref=e54]
              - cell "未绑定项目" [ref=e55]
              - cell "2026/5/7 18:37:30" [ref=e56]
              - cell "queued" [ref=e57]
              - cell "创建 Agent Run 查看日志 配置项目 删除" [ref=e58]:
                - generic [ref=e59]:
                  - button "创建 Agent Run" [ref=e60]
                  - button "查看日志" [ref=e61]
                  - button "配置项目" [ref=e62]
                  - button "删除" [ref=e63]
            - row "test_chat_456 pending_config 未绑定项目 2026/5/7 12:14:02 queued 创建 Agent Run 查看日志 配置项目 删除" [ref=e64]:
              - cell "test_chat_456" [ref=e65]:
                - button "test_chat_456" [ref=e66]
              - cell "pending_config" [ref=e67]
              - cell "未绑定项目" [ref=e68]
              - cell "2026/5/7 12:14:02" [ref=e69]
              - cell "queued" [ref=e70]
              - cell "创建 Agent Run 查看日志 配置项目 删除" [ref=e71]:
                - generic [ref=e72]:
                  - button "创建 Agent Run" [ref=e73]
                  - button "查看日志" [ref=e74]
                  - button "配置项目" [ref=e75]
                  - button "删除" [ref=e76]
      - generic [ref=e78]:
        - generic [ref=e79]:
          - heading "Agent 运行记录" [level=2] [ref=e80]
          - paragraph [ref=e81]: 最近的 Agent 运行任务
        - paragraph [ref=e83]: "加载失败: API error: 404"
```

# Test source

```ts
  141 |     const tableCount = await tables.count();
  142 |     expect(tableCount).toBeGreaterThan(0);
  143 | 
  144 |     const robotTable = tables.first();
  145 |     await expect(robotTable).toBeVisible();
  146 | 
  147 |     // Check column headers exist in thead
  148 |     const headers = robotTable.locator('thead th');
  149 | 
  150 |     // Check for required columns: Chat ID, Session Mode, Project Name, Last Active, Status
  151 |     const headerTexts = await headers.allTextContents();
  152 | 
  153 |     // Verify required columns are present
  154 |     expect(headerTexts.some(h => h.includes('Chat ID'))).toBeTruthy();
  155 |     expect(headerTexts.some(h => h.includes('Session Mode'))).toBeTruthy();
  156 |     expect(headerTexts.some(h => h.includes('Project Name'))).toBeTruthy();
  157 |     expect(headerTexts.some(h => h.includes('Last Active'))).toBeTruthy();
  158 |     expect(headerTexts.some(h => h.includes('Status'))).toBeTruthy();
  159 |   });
  160 | 
  161 |   // D-06: Agent run table columns display
  162 |   test('Agent run table columns display', async ({ page }) => {
  163 |     await page.goto(`${BASE_URL}/admin`);
  164 |     await page.waitForLoadState('domcontentloaded');
  165 | 
  166 |     // Wait for tables to render - AgentRunTable should be second table
  167 |     const tables = page.locator('table');
  168 |     const tableCount = await tables.count();
  169 | 
  170 |     // There should be at least 2 tables (RobotInstance + AgentRun)
  171 |     expect(tableCount).toBeGreaterThanOrEqual(2);
  172 | 
  173 |     // AgentRunTable is the second table (inside its own container with header)
  174 |     const agentRunContainer = page.locator('text=Agent 运行记录').locator('..').locator('..');
  175 |     const agentRunTable = agentRunContainer.locator('table');
  176 |     await expect(agentRunTable).toBeVisible();
  177 | 
  178 |     // Check column headers exist
  179 |     const headers = agentRunTable.locator('thead th');
  180 |     const headerTexts = await headers.allTextContents();
  181 | 
  182 |     // Verify required columns: Run ID, Status, Prompt, Created At
  183 |     expect(headerTexts.some(h => h.includes('Run ID'))).toBeTruthy();
  184 |     expect(headerTexts.some(h => h.includes('Status'))).toBeTruthy();
  185 |     expect(headerTexts.some(h => h.includes('Prompt'))).toBeTruthy();
  186 |     expect(headerTexts.some(h => h.includes('Created At'))).toBeTruthy();
  187 |   });
  188 | 
  189 |   // D-07: Filter bar search and dropdown work
  190 |   test('Filter bar search and dropdown work', async ({ page }) => {
  191 |     await page.goto(`${BASE_URL}/admin`);
  192 |     await page.waitForLoadState('domcontentloaded');
  193 | 
  194 |     // Wait for filter bar to render
  195 |     const searchInput = page.locator('input[placeholder*="搜索"]');
  196 |     await expect(searchInput).toBeVisible();
  197 | 
  198 |     // Try typing in search
  199 |     await searchInput.fill('test');
  200 |     await page.waitForTimeout(300); // Wait for input to be processed
  201 | 
  202 |     // Check status dropdown (Radix Select)
  203 |     // The dropdown trigger has a custom SVG icon inside, not role="combobox"
  204 |     const dropdownTrigger = page.locator('button:has-text("筛选状态")').or(
  205 |       page.locator('.px-3.py-2.border.border-gray-200.rounded-lg').filter({ hasText: '筛选状态' })
  206 |     );
  207 | 
  208 |     if (await dropdownTrigger.count() > 0) {
  209 |       await expect(dropdownTrigger).toBeVisible();
  210 | 
  211 |       // Click to open dropdown
  212 |       await dropdownTrigger.click();
  213 | 
  214 |       // Wait for dropdown content to appear
  215 |       const dropdownContent = page.locator('[role="listbox"]');
  216 |       await expect(dropdownContent).toBeVisible({ timeout: 2000 });
  217 | 
  218 |       // Check for dropdown options
  219 |       const allOption = page.locator('[role="option"]:has-text("全部状态")');
  220 |       await expect(allOption).toBeVisible();
  221 |     }
  222 |   });
  223 | 
  224 |   // D-08: Pagination and sorting controls work
  225 |   test('Pagination and sorting controls work', async ({ page }) => {
  226 |     await page.goto(`${BASE_URL}/admin`);
  227 |     await page.waitForLoadState('domcontentloaded');
  228 | 
  229 |     // Wait for tables to render
  230 |     const tables = page.locator('table');
  231 |     const tableCount = await tables.count();
  232 |     expect(tableCount).toBeGreaterThan(0);
  233 | 
  234 |     // Check pagination controls at bottom of AgentRunTable
  235 |     const paginationControls = page.locator('button:has-text("上一页")').or(
  236 |       page.locator('button:has-text("下一页")')
  237 |     );
  238 |     const paginationCount = await paginationControls.count();
  239 | 
  240 |     // Pagination should exist for AgentRunTable
> 241 |     expect(paginationCount).toBeGreaterThan(0);
      |                             ^ Error: expect(received).toBeGreaterThan(expected)
  242 | 
  243 |     // Test sorting by clicking a column header
  244 |     const robotTable = tables.first();
  245 |     const sortableHeaders = robotTable.locator('thead th');
  246 | 
  247 |     if (await sortableHeaders.count() > 0) {
  248 |       // Click the first sortable header (Chat ID)
  249 |       const firstHeader = sortableHeaders.first();
  250 |       const headerText = await firstHeader.textContent();
  251 | 
  252 |       // Skip the actions column (empty header)
  253 |       if (headerText && headerText.trim().length > 0) {
  254 |         await firstHeader.click();
  255 | 
  256 |         // Wait for sort to apply
  257 |         await page.waitForTimeout(200);
  258 | 
  259 |         // Check if sort indicator appears (↑ or ↓)
  260 |         const sortIndicator = firstHeader.locator('text=/[↑↓]/');
  261 |         const hasIndicator = await sortIndicator.count() > 0;
  262 | 
  263 |         // Sort indicator should be present after clicking
  264 |         // Note: The implementation adds ' ↑' or ' ↓' to the header text
  265 |         const updatedHeaderText = await firstHeader.textContent();
  266 |         expect(updatedHeaderText?.includes('↑') || updatedHeaderText?.includes('↓')).toBeTruthy();
  267 |       }
  268 |     }
  269 |   });
  270 | });
```