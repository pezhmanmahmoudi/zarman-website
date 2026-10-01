import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LottiePreviewGallery } from "@/components/dashboard/LottiePreviewGallery";

export const metadata: Metadata = {
  title: "Dashboard Lottie preview",
  robots: { index: false, follow: false },
};

export default function LottiePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <LottiePreviewGallery />;
}
