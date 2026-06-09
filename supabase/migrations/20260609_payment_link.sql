-- ============================================================
-- Migration: Add payment_link column to transactions table
-- Stores optional URL for edu/exam/university payments
-- ============================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_link text;
