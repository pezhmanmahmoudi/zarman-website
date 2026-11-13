import { unstable_cache } from "next/cache";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import TestimonialCarousel, { type Review } from "./TestimonialCarousel";

const REVIEW_LIMIT = 9;

interface PublicReviewRow {
  rating: number | null;
  message: string | null;
  display_name: string | null;
}

interface LegacyReviewRow {
  rating: number | null;
  message: string | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
}

function isDisplayable(row: { rating: number | null; message: string | null }): row is { rating: number; message: string } {
  return typeof row.message === "string" && row.message.trim() !== ""
    && typeof row.rating === "number" && Number.isInteger(row.rating) && row.rating >= 1 && row.rating <= 5;
}

/** Approved reviews with only a short display name ("First L."). Customer profiles are never read publicly. */
async function readPublicReviews(client: SupabaseClient): Promise<Review[] | null> {
  const { data, error } = await client.rpc("get_public_testimonials", { p_limit: REVIEW_LIMIT });
  if (error || !Array.isArray(data)) return null;
  return (data as PublicReviewRow[]).filter(isDisplayable).map((row) => ({
    name: typeof row.display_name === "string" ? row.display_name : "", text: row.message!, rating: row.rating!,
  }));
}

/** Pre-migration-72 path, kept only so the app can deploy before the database. Remove after 72 is applied. */
async function readLegacyReviews(client: SupabaseClient): Promise<Review[]> {
  const { data, error } = await client.from("testimonials")
    .select("rating, message, profiles(first_name, last_name)")
    .eq("status", "approved").order("created_at", { ascending: false }).limit(REVIEW_LIMIT);
  if (error || !data) return [];
  return (data as unknown as LegacyReviewRow[]).filter(isDisplayable).map((row) => ({
    name: [row.profiles?.first_name, row.profiles?.last_name ? `${row.profiles.last_name.charAt(0)}.` : ""].filter(Boolean).join(" "),
    text: row.message!, rating: row.rating!,
  }));
}

const getApprovedReviews = unstable_cache(async (): Promise<Review[]> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const client = createClient(url, key, { auth: { persistSession: false } });
    return (await readPublicReviews(client)) ?? (await readLegacyReviews(client));
  } catch {
    return [];
  }
}, ["public-approved-reviews-v2"], { revalidate: 300 });

export default async function TestimonialSection({ locale }: { locale: string }) {
  const reviews = await getApprovedReviews();
  // Keep the original carousel design, populated exclusively with approved reviews.
  if (!reviews.length) return null;
  return <TestimonialCarousel locale={locale} reviews={reviews} />;
}
