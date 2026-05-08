-- Add pending_config to GroupSessionMode enum
-- Required for Phase 06 Group Config feature

ALTER TYPE "GroupSessionMode" ADD VALUE 'pending_config';
