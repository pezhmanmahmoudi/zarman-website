import type { MetadataRoute } from "next";
import { appManifest } from "@/lib/app-manifest";

// Persian is the site's default language; English pages link /api/manifest/en.
export default function manifest(): MetadataRoute.Manifest {
  return appManifest("fa");
}
