-- Migration 0001: botwow_emails table
-- Stores newsletter / email signup subscriptions for bot-wow.com
-- Created 2026-10-17

CREATE TABLE IF NOT EXISTS botwow_emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'newsletter',
  consent_marketing INTEGER NOT NULL DEFAULT 0,
  consent_transactional INTEGER NOT NULL DEFAULT 0,
  subscribed_at INTEGER NOT NULL,
  unsubscribed_at INTEGER,
  status TEXT NOT NULL DEFAULT 'subscribed',
  ip TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_botwow_emails_email ON botwow_emails(email);
CREATE INDEX IF NOT EXISTS idx_botwow_emails_status ON botwow_emails(status);
CREATE INDEX IF NOT EXISTS idx_botwow_emails_subscribed_at ON botwow_emails(subscribed_at);
