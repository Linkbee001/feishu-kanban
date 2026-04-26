# SDK Runtime Update 2026-04-26

## Summary

- PiMono execution now goes through the embedded `@mariozechner/pi-coding-agent` SDK runtime.
- The old CLI RPC bridge is no longer the primary execution path.
- `AgentRunProcessor` now waits for one SDK execution directly and then hands off to artifact sync.

## Implemented Changes

- Removed the poll queue from the runtime path:
  - `AGENT_STATUS_POLL_QUEUE`
  - `agent-status-poll.processor`
- Reworked `PiMonoAdapter` to:
  - load the ESM SDK from the CommonJS Nest app through native dynamic import
  - manage manager sessions by `runtimeSessionKey`
  - reopen persisted local session files when `sessionStoreRef` already exists
  - expose a custom `emit_outputs` tool for structured `AgentOutput[]`
  - support cross-process cancellation through Redis-backed cancel signals
- Updated `group_agent_sessions` runtime synchronization to persist:
  - `pi_session_id`
  - `session_store_driver`
  - `session_store_ref`
  - `memory_summary`

## Operational Notes

- Manager sessions only.
- Local file session store only.
- No CLI fallback path maintained in the active runtime flow.
- Artifact sync and Feishu write-back remain on the existing backend-controlled path.
