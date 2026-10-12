import { getCustomerKycFileForAdmin } from "@/app/actions/kyc-evidence.actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };

  try {
    const { id } = await context.params;
    // The existing action authenticates the administrator, checks the submitted
    // upload and creates a fresh signed URL only when this link is opened.
    const url = await getCustomerKycFileForAdmin(id);
    return new Response(null, { status: 307, headers: { ...headers, Location: url } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Sign in again to continue.") {
      return new Response("Sign in to open this document.", { status: 401, headers });
    }
    if (message === "Administrator access required.") {
      return new Response("Administrator access required.", { status: 403, headers });
    }
    if (message === "Invalid document." || message === "Submitted file not found.") {
      return new Response("Document not found.", { status: 404, headers });
    }
    return new Response("Unable to open this document. Please try again.", { status: 503, headers });
  }
}
