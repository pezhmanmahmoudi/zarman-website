// lib/compliance/automatic.ts
// Automatic compliance engine — runs at KYC submission time.
// Calls RapidID DVS (AU only) and NameScan AML in parallel and returns a
// structured result that kyc.actions.ts uses to update kyc_status.
// Nothing is stored here — persistence is the caller's responsibility.

type KycDocumentType = "driver_license" | "passport" | "none" | "";
type CheckOutcome = "passed" | "review" | "failed" | "skipped";

type KycSubject = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  mobile_number?: string | null;
  dob: string;
  country: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  document_type: KycDocumentType;
  license_number?: string | null;
  card_number?: string | null;
  state_of_issue?: string | null;
  passport_number?: string | null;
  expiry_date?: string | null;
  gender?: string | null;
};

type VendorCheckResult = {
  provider: "rapidid" | "namescan";
  outcome: CheckOutcome;
  message: string;
  reference?: string | null;
};

export type AutomaticComplianceResult = {
  status: "clear" | "needs_review";
  checks: VendorCheckResult[];
};

const VENDOR_TIMEOUT_MS = 25_000;

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isAustralia(country: unknown) {
  return ["australia", "au", "aus"].includes(normalize(country));
}

function fullName(subject: KycSubject) {
  return [subject.first_name, subject.last_name].filter(Boolean).join(" ").trim();
}

/** Convert YYYY-MM-DD → DD/MM/YYYY for NameScan v3 */
function toNamescanDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function rapidIdBaseUrl() {
  const configured = process.env.RAPIDID_BASE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const env = process.env.RAPIDID_ENVIRONMENT ?? "sandbox";
  return `https://${env}.ridx.io`;
}

function rapidIdToken() {
  return process.env.RAPIDID_API_TOKEN ?? process.env.RAPIDID_DVS_API_TOKEN ?? "";
}

async function fetchJsonWithTimeout(url: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VENDOR_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Cache-Control": "no-store",
        ...(init.headers ?? {}),
      },
    });

    const text = await response.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* keep raw */ }

    if (!response.ok) {
      throw new Error(`Vendor request failed ${response.status}: ${text.slice(0, 500)}`);
    }

    return body;
  } finally {
    clearTimeout(timer);
  }
}

function resultCodeFromRapidId(response: unknown): { code: string | null; reference: string | null } {
  const r = response as {
    VerifyDocumentResult?: {
      VerificationResultCode?: string;
      VerificationRequestNumber?: string;
      ActivityId?: string;
    };
    rapidID?: string;
  };
  return {
    code: r.VerifyDocumentResult?.VerificationResultCode ?? null,
    reference:
      r.rapidID ??
      r.VerifyDocumentResult?.VerificationRequestNumber ??
      r.VerifyDocumentResult?.ActivityId ??
      null,
  };
}

async function runRapidIdCheck(subject: KycSubject): Promise<VendorCheckResult> {
  if (!isAustralia(subject.country)) {
    return { provider: "rapidid", outcome: "skipped", message: "RapidID DVS skipped — customer is outside Australia." };
  }

  const token = rapidIdToken();
  if (!token) {
    return { provider: "rapidid", outcome: "failed", message: "RapidID token not configured. Set RAPIDID_API_TOKEN." };
  }

  if (subject.document_type === "driver_license") {
    const response = await fetchJsonWithTimeout(`${rapidIdBaseUrl()}/dvs/v1/driverLicence`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify({
        BirthDate: subject.dob,
        GivenName: subject.first_name ?? "",
        FamilyName: subject.last_name ?? "",
        LicenceNumber: subject.license_number ?? "",
        CardNumber: subject.card_number ?? "",
        StateOfIssue: subject.state_of_issue ?? subject.state,
      }),
    });
    const { code, reference } = resultCodeFromRapidId(response);
    return {
      provider: "rapidid",
      outcome: code === "Y" ? "passed" : "review",
      message: code === "Y" ? "RapidID driver licence DVS verified." : `RapidID driver licence DVS returned code: ${code ?? "unknown"}.`,
      reference,
    };
  }

  if (subject.document_type === "passport") {
    if (!subject.gender) {
      return { provider: "rapidid", outcome: "review", message: "RapidID passport DVS requires gender, which is not collected in the current KYC form." };
    }
    const response = await fetchJsonWithTimeout(`${rapidIdBaseUrl()}/dvs/v1/passport`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify({
        BirthDate: subject.dob,
        GivenName: subject.first_name ?? "",
        FamilyName: subject.last_name ?? "",
        TravelDocumentNumber: subject.passport_number ?? "",
        Gender: subject.gender,
        ExpiryDate: subject.expiry_date ?? undefined,
      }),
    });
    const { code, reference } = resultCodeFromRapidId(response);
    return {
      provider: "rapidid",
      outcome: code === "Y" ? "passed" : "review",
      message: code === "Y" ? "RapidID passport DVS verified." : `RapidID passport DVS returned code: ${code ?? "unknown"}.`,
      reference,
    };
  }

  return { provider: "rapidid", outcome: "skipped", message: "RapidID DVS skipped — no supported identity document supplied." };
}

function amlOutcomeFromResponse(response: unknown): CheckOutcome {
  const r = response as {
    status?: string;
    result?: string;
    matches?: unknown[];
    possibleMatches?: unknown[];
  };
  const status = normalize(r.status ?? r.result ?? "");
  const hasMatches = (Array.isArray(r.matches) && r.matches.length > 0) ||
                     (Array.isArray(r.possibleMatches) && r.possibleMatches.length > 0);

  if (hasMatches) return "review";
  if (["clear", "passed", "pass", "no_match", "no match", "none"].includes(status)) return "passed";
  if (["match", "possible_match", "review", "hit"].includes(status)) return "review";
  return "passed";
}

async function runNameScanCheck(subject: KycSubject): Promise<VendorCheckResult> {
  const endpoint = process.env.NAMESCAN_API_URL;
  const apiKey   = process.env.NAMESCAN_API_KEY;

  if (!endpoint || !apiKey) {
    return { provider: "namescan", outcome: "failed", message: "NameScan not configured. Set NAMESCAN_API_URL and NAMESCAN_API_KEY." };
  }

  const response = await fetchJsonWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      firstName:  subject.first_name ?? undefined,
      lastName:   subject.last_name  ?? undefined,
      dob:        toNamescanDate(subject.dob),
      country:    subject.country    ?? undefined,
    }),
  });

  const outcome  = amlOutcomeFromResponse(response);
  const r = response as { reference?: string; id?: string; scanId?: string };
  return {
    provider: "namescan",
    outcome,
    message: outcome === "passed" ? "NameScan PEP/sanctions screening passed." : "NameScan PEP/sanctions screening requires review.",
    reference: r.reference ?? r.scanId ?? r.id ?? null,
  };
}

export async function runAutomaticComplianceChecks(subject: KycSubject): Promise<AutomaticComplianceResult> {
  const settled = await Promise.allSettled([
    runRapidIdCheck(subject),
    runNameScanCheck(subject),
  ]);

  const checks = settled.map((result, i): VendorCheckResult => {
    if (result.status === "fulfilled") return result.value;
    return {
      provider: i === 0 ? "rapidid" : "namescan",
      outcome: "failed",
      message: result.reason instanceof Error ? result.reason.message : "Compliance vendor check failed.",
    };
  });

  const needsReview = checks.some((c) => c.outcome === "review" || c.outcome === "failed");
  return { status: needsReview ? "needs_review" : "clear", checks };
}
