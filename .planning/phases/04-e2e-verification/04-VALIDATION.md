# Phase 04: E2E Verification + Admin Dashboard - Validation Architecture

**Created:** 2026-05-06
**Status:** Wave 0 gaps defined

---

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30.2.0 |
| Config file | test/e2e/jest-e2e.config.ts |
| Quick run command | `npm run test:e2e` |
| Full suite command | `npm run test` (all tests) |
| Timeout | 30000ms (E2E async flows) |

---

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Implementation Plan |
|--------|----------|-----------|-------------------|---------------------|
| D-01 | Message flow verification | E2E integration | `jest message-flow.e2e-spec.ts` | 04-04 |
| D-02 | Config flow verification | E2E integration | `jest config-flow.e2e-spec.ts` | 04-03 |
| D-03 | Agent Run verification | E2E integration | `jest agent-run.e2e-spec.ts` | 04-04 |
| D-04 | Admin API verification | E2E integration | `jest admin-api.e2e-spec.ts` | 04-03 |
| D-05 | 7 Pi services collaboration | Unit (existing) | `npm run test:pi-runtime` | Existing unit tests |
| D-06 | React + TypeScript frontend | Manual + build verify | `npm run build` (frontend) | 04-02, 04-06 |
| D-07 | TailwindCSS styling | Manual visual check | Frontend renders correctly | 04-02, 04-06 |
| D-08 | Embedded deployment | Build integration | NestJS serves frontend | 04-08 |
| D-09 | Feature modules functional | Manual E2E | Dashboard, instances, logs work | 04-06, 04-07 |
| D-10 | Quick delete endpoint | E2E integration | `jest cleanup.e2e-spec.ts` | 04-03, 04-05 |
| D-11 | Reset config endpoint | E2E integration | `jest cleanup.e2e-spec.ts` | 04-03, 04-05 |
| D-12 | Log viewer | Manual + endpoint test | Logs display in UI | 04-05, 04-07 |
| D-13 | Environment-based auth | Unit + E2E bypass | Auth bypass in tests works | 04-01, 04-06 |
| D-14 | Unified port access | Build integration | Frontend on same port as API | 04-08 |

---

## Sampling Rate

| Checkpoint | Test Command | Coverage |
|------------|--------------|----------|
| Per task commit | `npm run test` | Unit tests (quick) |
| Per wave merge | `npm run test:e2e` | E2E suite (runInBand) |
| Phase gate | Full suite + frontend build | All requirements |

---

## Wave 0 Gaps

Infrastructure missing before E2E tests can run:

- [ ] `test/e2e/` directory — E2E test location
- [ ] `test/e2e/setup/e2e-test.module.ts` — Test app module with auth bypass
- [ ] `test/e2e/setup/e2e-test.fixture.ts` — Test data fixtures
- [ ] `test/e2e/jest-e2e.config.ts` — Jest E2E configuration
- [ ] `frontend/` directory — React frontend project
- [ ] `frontend/vite.config.ts` — Vite configuration
- [ ] `frontend/tailwind.config.ts` — TailwindCSS configuration
- [ ] Frontend dependencies — React, TailwindCSS, Vite installed

**Existing infrastructure:**
- Jest config (jest.config.ts) ✓
- supertest (7.1.4) ✓
- Unit test patterns ✓
- Mock factories (conftest.ts) ✓
- JWT helper (scripts/jwt-helper.js) ✓

---

## Test Data Strategy

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Database | Dedicated test database | Queue state (Redis) not transactional |
| Cleanup | D-10 delete endpoints | Tests must cleanup via API |
| Chat IDs | `oc_e2e_test_${uuid}` | Unique prefix identifies test data |
| Isolation | Run in sequence (`--runInBand`) | No parallel DB conflicts |

---

## Validation Checklist (Phase Gate)

Before marking phase complete:

1. **E2E Tests Pass**
   - [ ] `npm run test:e2e` exits 0
   - [ ] All D-01 through D-04 tests pass
   - [ ] Cleanup tests (D-10, D-11) pass

2. **Frontend Build**
   - [ ] `cd frontend && npm run build` succeeds
   - [ ] frontend/dist/ contains index.html, assets

3. **Frontend Integration**
   - [ ] NestJS serves frontend at `/admin/*`
   - [ ] API calls from frontend work (same origin)
   - [ ] Auth bypass works in development

4. **Manual Verification**
   - [ ] Dashboard renders with TailwindCSS styles
   - [ ] Robot instance list displays correctly
   - [ ] Log viewer shows real-time logs
   - [ ] Delete/reset buttons work (D-10, D-11)

---

*Phase: 04-e2e-verification*
*Created: 2026-05-06*