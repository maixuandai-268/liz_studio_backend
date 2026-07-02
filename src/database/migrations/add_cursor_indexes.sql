-- Migration: Add Composite Indexes for Cursor Pagination
-- Date: 2026-07-02
-- Description: Create indexes to optimize cursor-based pagination queries

-- Index for messages table
-- Used for: GET /api/v2/rooms/{roomId}/messages with cursor pagination
-- Query pattern: WHERE room_id = ? AND (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC
CREATE INDEX IF NOT EXISTS idx_messages_room_created_at_id 
ON messages (room_id ASC, created_at DESC, id DESC);

-- Index for notifications table
-- Used for: GET /api/v2/notifications with cursor pagination
-- Query pattern: WHERE user_id = ? AND (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at_id 
ON notifications (user_id ASC, created_at DESC, id DESC);

-- Optional: Index for faster channel-based message queries
CREATE INDEX IF NOT EXISTS idx_messages_channel_created_at_id 
ON messages (channel_id ASC, created_at DESC, id DESC);
WHERE channel_id IS NOT NULL;
