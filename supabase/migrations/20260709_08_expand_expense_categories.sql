-- ============================================================
-- Migration 08: Expand allowed expense categories
-- Purpose:
--   Keep DB check constraints aligned with UI category options.
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.expenses') IS NOT NULL THEN
    ALTER TABLE public.expenses
      DROP CONSTRAINT IF EXISTS expenses_category_check;

    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_category_check
      CHECK (category IN (
        'it_infrastructure',
        'office',
        'rent',
        'software',
        'bank_fees',
        'marketing',
        'salary',
        'tax',
        'miscellaneous'
      ));
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.recurring_expenses') IS NOT NULL THEN
    ALTER TABLE public.recurring_expenses
      DROP CONSTRAINT IF EXISTS recurring_expenses_category_check;

    ALTER TABLE public.recurring_expenses
      ADD CONSTRAINT recurring_expenses_category_check
      CHECK (category IN (
        'it_infrastructure',
        'office',
        'rent',
        'software',
        'bank_fees',
        'marketing',
        'salary',
        'tax',
        'miscellaneous'
      ));
  END IF;
END
$$;
