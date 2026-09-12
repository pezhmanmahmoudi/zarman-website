import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import TestimonialCarousel, { type Review } from "./TestimonialCarousel";

interface ReviewRow {
  rating: number | null;
  message: string | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
}

const getApprovedReviews = unstable_cache(async (): Promise<Review[]> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    // Public access uses the same anonymous key and RLS as the original widget.
    const client = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await client.from("testimonials")
      .select("rating, message, profiles(first_name, last_name)")
      .eq("status", "approved").order("created_at", { ascending: false }).limit(9);
    if (error || !data) return [];
    return (data as unknown as ReviewRow[])
      .filter((row) => typeof row.message === "string" && row.message.trim() && typeof row.rating === "number" && Number.isInteger(row.rating) && row.rating >= 1 && row.rating <= 5)
      .map((row) => ({
        name: [row.profiles?.first_name, row.profiles?.last_name ? `${row.profiles.last_name.charAt(0)}.` : ""].filter(Boolean).join(" "),
        text: row.message!, rating: row.rating!,
      }));
  } catch {
    return [];
  }
}, ["public-approved-reviews-v1"], { revalidate: 300 });

export default async function TestimonialSection({ locale }: { locale: string }) {
  const reviews = await getApprovedReviews();
  // Keep the original carousel design, populated exclusively with approved reviews.
  if (!reviews.length) return null;
  return <TestimonialCarousel locale={locale} reviews={reviews} />;
}
