# Technical Debt & Concerns

**Last mapped:** 2026-05-02

## High Priority Concerns

### Large File: pi-mono.adapter.ts

**Issue:** `src/modules/agent/pi-mono.adapter.ts` is ~113KB (very large)

**Impact:**
- Difficult to navigate and understand
- High cognitive load for developers
- Difficult to test comprehensively
- Merge conflicts likely

**Recommendation:**
- Split into smaller focused modules
- Extract provider-specific adapters
- Separate skill handling, session management

### TypeScript Strictness Relaxed

**Issues in `tsconfig.json`:**
- `noImplicitAny: false` - Allows implicit `any` types
- `strictPropertyInitialization: false` - Allows uninitialized properties

**Impact:**
- Reduced type safety
- Potential runtime null/undefined errors
- Less IDE support

**Recommendation:**
- Gradually enable these flags
- Fix errors incrementally

## Medium Priority Concerns

### No E2E Tests

**Issue:** No `*.e2e-spec.ts` files in test directory

**Impact:**
- Integration gaps not tested
- API endpoints not validated end-to-end
- Queue flows not tested holistically

**Recommendation:**
- Add E2E tests for critical flows:
  - Webhook → Agent → Artifact flow
  - Confirmation request lifecycle
  - Group session management

### Demo Directory

**Issue:** `demo/` directory exists with OpenClaw extensions

**Impact:**
- Not excluded from all tooling correctly
- Contains unrelated code
- May cause confusion

**Current handling:**
- Excluded from Jest tests
- Excluded from TypeScript compilation

### Notification Queue Undefined

**Issue:** `NOTIFICATION_QUEUE` defined but no processor

**Impact:**
- Queue jobs may accumulate unprocessed
- Dead letter scenario

**Recommendation:**
- Implement processor or remove queue definition

## Low Priority Concerns

### Legacy Migrations

**Issue:** Multiple migration files with iterative changes

**Evidence:**
```
20260428100000_group_runtime_runtime_profiles/
20260430183000_remove_agent_profiles/  # Removes what previous added
```

**Impact:**
- Migration history is noisy
- Schema evolution visible in migrations

**Recommendation:**
- Consider squashing migrations for new projects
- Keep history for this project

### Documentation Sprawl

**Issue:** Many design/planning documents in `docs/`

**Files:**
- Multiple PRD versions
- Multiple design iterations
- Status snapshots
- Refactor plans

**Impact:**
- Unclear which docs are current
- Historical noise

**Recommendation:**
- Archive older versions
- Mark current documents clearly
- Consider `.planning/` for active design

### Config Module Global

**Issue:** ConfigModule imported as `isGlobal: true`

**Impact:**
- Config available everywhere without explicit import
- Implicit dependencies

**Recommendation:**
- Document this pattern
- Consider explicit imports for clarity

## Security Considerations

### Credential Storage

**Issue:** `REPO_SECRET_MAP_JSON` contains credential references

**Mitigation:**
- JSON format allows flexible mapping
- Credentials resolved at runtime
- Not hardcoded in source

**Recommendation:**
- Document credential rotation process
- Add validation for credential format

### Feishu Signature Verification

**Implementation:** Signature verified in webhook handler

**Strengths:**
- Timestamp + nonce + signature verification
- Event token verification
- Encrypted payload handling

**Recommendation:**
- Document security requirements clearly

### Admin JWT

**Issue:** Simple JWT secret for admin auth

**Recommendation:**
- Document key rotation process
- Consider key strength requirements

## Performance Considerations

### Agent Run Timeout

**Setting:** `AGENT_RUN_TIMEOUT_SECONDS: 1800` (30 minutes)

**Impact:**
- Long-running agents may timeout
- Queue workers blocked

**Recommendation:**
- Monitor actual run times
- Adjust timeout based on data

### Digest Limits

**Settings:**
- `DIGEST_FOLDER_SCAN_LIMIT: 500`
- `DIGEST_DOC_CONTENT_LIMIT: 20`
- `DIGEST_BITABLE_ROW_LIMIT: 2000`

**Impact:**
- Large projects may have incomplete digests
- Limits prevent runaway processing

**Recommendation:**
- Document these limits
- Consider dynamic adjustment

### Redis Connection

**Issue:** Single Redis URL for all queues

**Impact:**
- Shared connection pool
- Potential bottlenecks under load

**Recommendation:**
- Monitor Redis metrics
- Consider connection pooling config

## Known Technical Debt

### Status: Unimplemented Features

Based on docs, these may be in progress:
- Notification queue processor
- WebSocket event mode (vs webhook)
- Runtime audit features

### Architecture Evolution

**From docs:**
- Manager agent design evolving
- Runtime convergence planned
- Hybrid context refactor planned

**Recommendation:**
- Track planned changes in ROADMAP
- Document decisions in ADRs