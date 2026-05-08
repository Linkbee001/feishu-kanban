# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-ui-redesign.spec.ts >> Admin UI Redesign >> Robot instance table columns display
- Location: test\e2e\admin-ui-redesign.spec.ts:135:7

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
        - generic [ref=e28]: 加载中...
      - generic [ref=e30]:
        - generic [ref=e31]:
          - heading "Agent 运行记录" [level=2] [ref=e32]
          - paragraph [ref=e33]: 最近的 Agent 运行任务
        - paragraph [ref=e35]: "加载失败: API error: 404"
```

# Test source

```ts
  42  |   });
  43  | 
  44  |   // D-02: Status labels show correct colors
  45  |   test('Status labels show correct colors', async ({ page }) => {
  46  |     await page.goto(`${BASE_URL}/admin`);
  47  |     await page.waitForLoadState('domcontentloaded');
  48  | 
  49  |     // Wait for tables to render
  50  |     const tables = page.locator('table');
  51  |     const tableCount = await tables.count();
  52  |     expect(tableCount).toBeGreaterThan(0);
  53  | 
  54  |     // Check status labels exist in tables
  55  |     // StatusLabel renders with classes like bg-status-running, bg-status-failed, etc.
  56  |     const runningLabels = page.locator('[class*="bg-status-running"]');
  57  |     const queuedLabels = page.locator('[class*="bg-status-queued"]');
  58  |     const succeededLabels = page.locator('[class*="bg-status-succeeded"]');
  59  |     const failedLabels = page.locator('[class*="bg-status-failed"]');
  60  | 
  61  |     // At least one table should have status labels
  62  |     const totalLabels =
  63  |       (await runningLabels.count()) +
  64  |       (await queuedLabels.count()) +
  65  |       (await succeededLabels.count()) +
  66  |       (await failedLabels.count());
  67  | 
  68  |     // Verify at least some status labels are present
  69  |     expect(totalLabels).toBeGreaterThan(0);
  70  |   });
  71  | 
  72  |   // D-03: Confirmation dialog appears for dangerous actions
  73  |   test('Confirmation dialog appears for dangerous actions', async ({ page }) => {
  74  |     await page.goto(`${BASE_URL}/admin`);
  75  |     await page.waitForLoadState('domcontentloaded');
  76  | 
  77  |     // Wait for first table (RobotInstanceTable) to render
  78  |     const tables = page.locator('table');
  79  |     const tableCount = await tables.count();
  80  |     expect(tableCount).toBeGreaterThan(0);
  81  | 
  82  |     const robotTable = tables.first();
  83  |     await expect(robotTable).toBeVisible();
  84  | 
  85  |     // Find and click delete button in first row
  86  |     const deleteButton = robotTable.locator('tbody tr').first().locator('button:has-text("删除")');
  87  | 
  88  |     if (await deleteButton.count() > 0) {
  89  |       await deleteButton.click();
  90  | 
  91  |       // Check for confirmation dialog (Radix AlertDialog has role="alertdialog")
  92  |       const dialog = page.locator('[role="alertdialog"]');
  93  |       await expect(dialog).toBeVisible({ timeout: 3000 });
  94  | 
  95  |       // Check for title "确认删除"
  96  |       await expect(dialog.locator('text=确认删除')).toBeVisible();
  97  | 
  98  |       // Check for Cancel button "取消"
  99  |       const cancelButton = dialog.locator('button:has-text("取消")');
  100 |       await expect(cancelButton).toBeVisible();
  101 | 
  102 |       // Check for Confirm button "确认"
  103 |       const confirmButton = dialog.locator('button:has-text("确认")');
  104 |       await expect(confirmButton).toBeVisible();
  105 | 
  106 |       // Click Cancel to close dialog without action
  107 |       await cancelButton.click();
  108 |       await expect(dialog).not.toBeVisible();
  109 |     }
  110 |   });
  111 | 
  112 |   // D-04: Manual refresh button fetches latest data
  113 |   test('Manual refresh button fetches latest data', async ({ page }) => {
  114 |     await page.goto(`${BASE_URL}/admin`);
  115 |     await page.waitForLoadState('domcontentloaded');
  116 | 
  117 |     // Wait for refresh button to appear
  118 |     const refreshButton = page.locator('button:has-text("刷新数据")');
  119 |     await expect(refreshButton).toBeVisible();
  120 | 
  121 |     // Set up network listener before clicking refresh
  122 |     const responsePromise = page.waitForResponse(
  123 |       (resp) => resp.url().includes('/api/admin/robot-instances') || resp.url().includes('/api/agent-runs')
  124 |     );
  125 | 
  126 |     // Click refresh button
  127 |     await refreshButton.click();
  128 | 
  129 |     // Wait for at least one API call to complete
  130 |     const response = await responsePromise;
  131 |     expect(response.ok()).toBeTruthy();
  132 |   });
  133 | 
  134 |   // D-05: Robot instance table columns display
  135 |   test('Robot instance table columns display', async ({ page }) => {
  136 |     await page.goto(`${BASE_URL}/admin`);
  137 |     await page.waitForLoadState('domcontentloaded');
  138 | 
  139 |     // Wait for first table (RobotInstanceTable) to render
  140 |     const tables = page.locator('table');
  141 |     const tableCount = await tables.count();
> 142 |     expect(tableCount).toBeGreaterThan(0);
      |                        ^ Error: expect(received).toBeGreaterThan(expected)
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
  241 |     expect(paginationCount).toBeGreaterThan(0);
  242 | 
```