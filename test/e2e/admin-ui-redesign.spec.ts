import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Admin UI Redesign', () => {
  // D-01: Per-row action buttons display correctly
  test('Per-row action buttons display correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for robot instance table to render
    const tables = page.locator('table');
    const tableCount = await tables.count();
    expect(tableCount).toBeGreaterThan(0);

    // Wait for first table (RobotInstanceTable) to have rows
    const robotTable = tables.first();
    await expect(robotTable).toBeVisible();

    // Check for action buttons in robot instance table
    const rows = robotTable.locator('tbody tr');
    const rowCount = await rows.count();

    if (rowCount > 0) {
      const firstRow = rows.first();
      // Check for 创建 Agent Run button
      const createButton = firstRow.locator('button:has-text("创建 Agent Run")');
      await expect(createButton).toBeVisible();

      // Check for 查看日志 button
      const viewLogsButton = firstRow.locator('button:has-text("查看日志")');
      await expect(viewLogsButton).toBeVisible();

      // Check for 配置项目 button
      const configureButton = firstRow.locator('button:has-text("配置项目")');
      await expect(configureButton).toBeVisible();

      // Check for 删除 button
      const deleteButton = firstRow.locator('button:has-text("删除")');
      await expect(deleteButton).toBeVisible();
    }
  });

  // D-02: Status labels show correct colors
  test('Status labels show correct colors', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for tables to render
    const tables = page.locator('table');
    const tableCount = await tables.count();
    expect(tableCount).toBeGreaterThan(0);

    // Check status labels exist in tables
    // StatusLabel renders with classes like bg-status-running, bg-status-failed, etc.
    const runningLabels = page.locator('[class*="bg-status-running"]');
    const queuedLabels = page.locator('[class*="bg-status-queued"]');
    const succeededLabels = page.locator('[class*="bg-status-succeeded"]');
    const failedLabels = page.locator('[class*="bg-status-failed"]');

    // At least one table should have status labels
    const totalLabels =
      (await runningLabels.count()) +
      (await queuedLabels.count()) +
      (await succeededLabels.count()) +
      (await failedLabels.count());

    // Verify at least some status labels are present
    expect(totalLabels).toBeGreaterThan(0);
  });

  // D-03: Confirmation dialog appears for dangerous actions
  test('Confirmation dialog appears for dangerous actions', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for first table (RobotInstanceTable) to render
    const tables = page.locator('table');
    const tableCount = await tables.count();
    expect(tableCount).toBeGreaterThan(0);

    const robotTable = tables.first();
    await expect(robotTable).toBeVisible();

    // Find and click delete button in first row
    const deleteButton = robotTable.locator('tbody tr').first().locator('button:has-text("删除")');

    if (await deleteButton.count() > 0) {
      await deleteButton.click();

      // Check for confirmation dialog (Radix AlertDialog has role="alertdialog")
      const dialog = page.locator('[role="alertdialog"]');
      await expect(dialog).toBeVisible({ timeout: 3000 });

      // Check for title "确认删除"
      await expect(dialog.locator('text=确认删除')).toBeVisible();

      // Check for Cancel button "取消"
      const cancelButton = dialog.locator('button:has-text("取消")');
      await expect(cancelButton).toBeVisible();

      // Check for Confirm button "确认"
      const confirmButton = dialog.locator('button:has-text("确认")');
      await expect(confirmButton).toBeVisible();

      // Click Cancel to close dialog without action
      await cancelButton.click();
      await expect(dialog).not.toBeVisible();
    }
  });

  // D-04: Manual refresh button fetches latest data
  test('Manual refresh button fetches latest data', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for refresh button to appear
    const refreshButton = page.locator('button:has-text("刷新数据")');
    await expect(refreshButton).toBeVisible();

    // Set up network listener before clicking refresh
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/admin/robot-instances') || resp.url().includes('/api/agent-runs')
    );

    // Click refresh button
    await refreshButton.click();

    // Wait for at least one API call to complete
    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
  });

  // D-05: Robot instance table columns display
  test('Robot instance table columns display', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for first table (RobotInstanceTable) to render
    const tables = page.locator('table');
    const tableCount = await tables.count();
    expect(tableCount).toBeGreaterThan(0);

    const robotTable = tables.first();
    await expect(robotTable).toBeVisible();

    // Check column headers exist in thead
    const headers = robotTable.locator('thead th');

    // Check for required columns: Chat ID, Session Mode, Project Name, Last Active, Status
    const headerTexts = await headers.allTextContents();

    // Verify required columns are present
    expect(headerTexts.some(h => h.includes('Chat ID'))).toBeTruthy();
    expect(headerTexts.some(h => h.includes('Session Mode'))).toBeTruthy();
    expect(headerTexts.some(h => h.includes('Project Name'))).toBeTruthy();
    expect(headerTexts.some(h => h.includes('Last Active'))).toBeTruthy();
    expect(headerTexts.some(h => h.includes('Status'))).toBeTruthy();
  });

  // D-06: Agent run table columns display
  test('Agent run table columns display', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for tables to render - AgentRunTable should be second table
    const tables = page.locator('table');
    const tableCount = await tables.count();

    // There should be at least 2 tables (RobotInstance + AgentRun)
    expect(tableCount).toBeGreaterThanOrEqual(2);

    // AgentRunTable is the second table (inside its own container with header)
    const agentRunContainer = page.locator('text=Agent 运行记录').locator('..').locator('..');
    const agentRunTable = agentRunContainer.locator('table');
    await expect(agentRunTable).toBeVisible();

    // Check column headers exist
    const headers = agentRunTable.locator('thead th');
    const headerTexts = await headers.allTextContents();

    // Verify required columns: Run ID, Status, Prompt, Created At
    expect(headerTexts.some(h => h.includes('Run ID'))).toBeTruthy();
    expect(headerTexts.some(h => h.includes('Status'))).toBeTruthy();
    expect(headerTexts.some(h => h.includes('Prompt'))).toBeTruthy();
    expect(headerTexts.some(h => h.includes('Created At'))).toBeTruthy();
  });

  // D-07: Filter bar search and dropdown work
  test('Filter bar search and dropdown work', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for filter bar to render
    const searchInput = page.locator('input[placeholder*="搜索"]');
    await expect(searchInput).toBeVisible();

    // Try typing in search
    await searchInput.fill('test');
    await page.waitForTimeout(300); // Wait for input to be processed

    // Check status dropdown (Radix Select)
    // The dropdown trigger has a custom SVG icon inside, not role="combobox"
    const dropdownTrigger = page.locator('button:has-text("筛选状态")').or(
      page.locator('.px-3.py-2.border.border-gray-200.rounded-lg').filter({ hasText: '筛选状态' })
    );

    if (await dropdownTrigger.count() > 0) {
      await expect(dropdownTrigger).toBeVisible();

      // Click to open dropdown
      await dropdownTrigger.click();

      // Wait for dropdown content to appear
      const dropdownContent = page.locator('[role="listbox"]');
      await expect(dropdownContent).toBeVisible({ timeout: 2000 });

      // Check for dropdown options
      const allOption = page.locator('[role="option"]:has-text("全部状态")');
      await expect(allOption).toBeVisible();
    }
  });

  // D-08: Pagination and sorting controls work
  test('Pagination and sorting controls work', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for tables to render
    const tables = page.locator('table');
    const tableCount = await tables.count();
    expect(tableCount).toBeGreaterThan(0);

    // Check pagination controls at bottom of AgentRunTable
    const paginationControls = page.locator('button:has-text("上一页")').or(
      page.locator('button:has-text("下一页")')
    );
    const paginationCount = await paginationControls.count();

    // Pagination should exist for AgentRunTable
    expect(paginationCount).toBeGreaterThan(0);

    // Test sorting by clicking a column header
    const robotTable = tables.first();
    const sortableHeaders = robotTable.locator('thead th');

    if (await sortableHeaders.count() > 0) {
      // Click the first sortable header (Chat ID)
      const firstHeader = sortableHeaders.first();
      const headerText = await firstHeader.textContent();

      // Skip the actions column (empty header)
      if (headerText && headerText.trim().length > 0) {
        await firstHeader.click();

        // Wait for sort to apply
        await page.waitForTimeout(200);

        // Check if sort indicator appears (↑ or ↓)
        const sortIndicator = firstHeader.locator('text=/[↑↓]/');
        const hasIndicator = await sortIndicator.count() > 0;

        // Sort indicator should be present after clicking
        // Note: The implementation adds ' ↑' or ' ↓' to the header text
        const updatedHeaderText = await firstHeader.textContent();
        expect(updatedHeaderText?.includes('↑') || updatedHeaderText?.includes('↓')).toBeTruthy();
      }
    }
  });
});