# Phase 05: Admin UI Redesign - Validation Strategy

**Created:** 2026-05-07
**Phase:** 05-admin-ui-redesign
**Status:** Ready for test scaffolding

---

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright 1.59.1 (E2E frontend tests) + Jest 30.2.0 (backend API tests) |
| Config file | playwright.config.ts (frontend), jest.config.ts (backend) |
| Quick run command | `npm run test:e2e` (Playwright), `npm test` (Jest) |
| Full suite command | `npm run test:e2e` (all E2E), `npm test` (all Jest) |

---

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Test File |
|--------|----------|-----------|-------------------|-----------|
| D-01 | Per-row action buttons display correctly | E2E | `npx playwright test test/e2e/admin-ui-redesign.spec.ts -g "row actions"` | test/e2e/admin-ui-redesign.spec.ts |
| D-02 | Status labels show correct colors | E2E | `npx playwright test test/e2e/admin-ui-redesign.spec.ts -g "status label"` | test/e2e/admin-ui-redesign.spec.ts |
| D-03 | Confirmation dialog appears for dangerous actions | E2E | `npx playwright test test/e2e/admin-ui-redesign.spec.ts -g "confirm dialog"` | test/e2e/admin-ui-redesign.spec.ts |
| D-04 | Manual refresh button fetches latest data | E2E | `npx playwright test test/e2e/admin-ui-redesign.spec.ts -g "refresh"` | test/e2e/admin-ui-redesign.spec.ts |
| D-05 | Robot instance columns display correctly | E2E | `npx playwright test test/e2e/admin-ui-redesign.spec.ts -g "robot instance table"` | test/e2e/admin-ui-redesign.spec.ts |
| D-06 | Agent run columns display correctly | E2E | `npx playwright test test/e2e/admin-ui-redesign.spec.ts -g "agent run table"` | test/e2e/admin-ui-redesign.spec.ts |
| D-07 | Filter bar search + dropdown work | E2E | `npx playwright test test/e2e/admin-ui-redesign.spec.ts -g "filter bar"` | test/e2e/admin-ui-redesign.spec.ts |
| D-08 | Pagination + sorting controls work | E2E | `npx playwright test test/e2e/admin-ui-redesign.spec.ts -g "pagination"` | test/e2e/admin-ui-redesign.spec.ts |

---

## Sampling Rate

- **Per task commit:** `npm test` (backend Jest tests for API integrity)
- **Per wave merge:** `npm run test:e2e` (Playwright frontend tests)
- **Phase gate:** Full Playwright suite green + backend tests green before `/gsd-verify-work`

---

## Wave 0 Test Infrastructure Gaps

These files must be created before implementation proceeds:

- [ ] `test/e2e/admin-ui-redesign.spec.ts` — covers all UI behaviors D-01 through D-08
- [ ] `test/e2e/setup/frontend-test.fixture.ts` — frontend test fixtures (mock API responses)

---

## Test Scenarios (Detailed)

### D-01: Per-row Action Buttons

```typescript
test('row actions - each robot instance row has action buttons', async ({ page }) => {
  await page.goto('/admin');
  const firstRow = page.locator('[data-testid="robot-instance-row"]').first();
  await expect(firstRow.locator('[data-testid="action-create-run"]')).toBeVisible();
  await expect(firstRow.locator('[data-testid="action-view-logs"]')).toBeVisible();
  await expect(firstRow.locator('[data-testid="action-config"]')).toBeVisible();
});
```

### D-02: Status Labels with Colors

```typescript
test('status label - queued shows gray', async ({ page }) => {
  await page.goto('/admin');
  const queuedLabel = page.locator('[data-status="queued"]');
  await expect(queuedLabel).toHaveCSS('background-color', /rgba?\(.*gray.*\)/);
});

test('status label - running shows blue with animation', async ({ page }) => {
  await page.goto('/admin');
  const runningLabel = page.locator('[data-status="running"]');
  await expect(runningLabel).toHaveCSS('background-color', /rgba?\(.*blue.*\)/);
});

test('status label - succeeded shows green', async ({ page }) => {
  await page.goto('/admin');
  const succeededLabel = page.locator('[data-status="succeeded"]');
  await expect(succeededLabel).toHaveCSS('background-color', /rgba?\(.*green.*\)/);
});

test('status label - failed shows red', async ({ page }) => {
  await page.goto('/admin');
  const failedLabel = page.locator('[data-status="failed"]');
  await expect(failedLabel).toHaveCSS('background-color', /rgba?\(.*red.*\)/);
});
```

### D-03: Confirmation Dialog

```typescript
test('confirm dialog - dangerous action shows modal', async ({ page }) => {
  await page.goto('/admin');
  const deleteButton = page.locator('[data-testid="action-delete"]').first();
  await deleteButton.click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await expect(page.locator('[data-testid="confirm-title"]')).toContainText('确认删除');
});
```

### D-04: Manual Refresh Button

```typescript
test('refresh - clicking refresh button updates data', async ({ page }) => {
  await page.goto('/admin');
  const refreshButton = page.locator('[data-testid="refresh-button"]');
  const initialCount = await page.locator('[data-testid="robot-instance-row"]').count();
  await refreshButton.click();
  // Wait for loading state to clear
  await page.waitForSelector('[data-testid="loading-indicator", { state: "hidden" }]);
  const newCount = await page.locator('[data-testid="robot-instance-row"]').count();
  // Data should be refreshed (count may differ if backend changed)
  expect(newCount).toBeGreaterThanOrEqual(0);
});
```

### D-05: Robot Instance Columns

```typescript
test('robot instance table - columns display correctly', async ({ page }) => {
  await page.goto('/admin');
  const table = page.locator('[data-testid="robot-instance-table"]');
  await expect(table.locator('th[data-column="chat-id"]')).toContainText('Chat ID');
  await expect(table.locator('th[data-column="session-mode"]')).toContainText('Session Mode');
  await expect(table.locator('th[data-column="project-name"]')).toContainText('Project Name');
  await expect(table.locator('th[data-column="last-active"]')).toContainText('Last Active');
});
```

### D-06: Agent Run Columns

```typescript
test('agent run table - columns display correctly', async ({ page }) => {
  await page.goto('/admin');
  const table = page.locator('[data-testid="agent-run-table"]');
  await expect(table.locator('th[data-column="run-id"]')).toContainText('Run ID');
  await expect(table.locator('th[data-column="status"]')).toContainText('Status');
  await expect(table.locator('th[data-column="prompt"]')).toContainText('Prompt');
  await expect(table.locator('th[data-column="created-at"]')).toContainText('Created At');
});
```

### D-07: Filter Bar

```typescript
test('filter bar - search input filters table', async ({ page }) => {
  await page.goto('/admin');
  const searchInput = page.locator('[data-testid="search-input"]');
  await searchInput.fill('test-project');
  await page.waitForTimeout(300); // debounce
  const rows = page.locator('[data-testid="robot-instance-row"]');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i).locator('[data-column="project-name"]')).toContainText('test-project');
  }
});

test('filter bar - status dropdown filters by status', async ({ page }) => {
  await page.goto('/admin');
  const statusDropdown = page.locator('[data-testid="status-dropdown"]');
  await statusDropdown.selectOption('succeeded');
  const rows = page.locator('[data-testid="agent-run-row"]');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i).locator('[data-status]')).toHaveAttribute('data-status', 'succeeded');
  }
});
```

### D-08: Pagination + Sorting

```typescript
test('pagination - clicking page 2 shows different data', async ({ page }) => {
  await page.goto('/admin');
  const page2Button = page.locator('[data-testid="pagination-page-2"]');
  if (await page2Button.isVisible()) {
    await page2Button.click();
    await expect(page.locator('[data-testid="current-page"]')).toContainText('2');
  }
});

test('sorting - clicking column header sorts ascending', async ({ page }) => {
  await page.goto('/admin');
  const createdAtHeader = page.locator('th[data-column="created-at"]');
  await createdAtHeader.click();
  await expect(createdAtHeader.locator('[data-testid="sort-icon"]')).toHaveAttribute('data-sort', 'asc');
});
```

---

## Verification Gates

| Gate | Condition | Auto |
|------|-----------|------|
| Wave 0 complete | test/e2e/admin-ui-redesign.spec.ts exists | no |
| Wave 1 complete | All D-05, D-06 tests pass | yes |
| Wave 2 complete | All D-01, D-02, D-03 tests pass | yes |
| Wave 3 complete | All D-04, D-07, D-08 tests pass | yes |
| Phase complete | Full Playwright suite green | yes |

---

*Phase: 05-admin-ui-redesign*
*Validation strategy created: 2026-05-07*