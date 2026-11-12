import { appManifest } from "@/lib/app-manifest";

export const dynamic = "force-static";
export function generateStaticParams() {
  return [{ locale: "fa" }, { locale: "en" }];
}

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== "fa" && locale !== "en") return new Response("Not found", { status: 404 });
  return new Response(JSON.stringify(appManifest(locale)), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
