-- Add state_of_issue column to profiles table for driver licence verification
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS state_of_issue TEXT;
