// lib/compliance/manual.ts
// Admin-triggered, on-demand compliance checks.
// Returns full raw vendor payloads for PDF generation.
// No data is persisted here — that is the caller's responsibility.

const VENDOR_TIMEOUT_MS = 25_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export type ManualDvsOutcome = "VERIFIED" | "REVIEW REQUIRED" | "FAILED" | "SKIPPED";
export type ManualAmlOutcome = "CLEAR" | "REVIEW REQUIRED" | "FAILED";

export type ManualDvsResult = {
  outcome: ManualDvsOutcome;
  checkType: string;
  resultCode: string | null;
  referenceId: string | null;
  rawResponse: unknown;
  errorMessage?: string;
};

export type ManualAmlResult = {
  outcome: ManualAmlOutcome;
  matchCount: number;
  possibleMatchCount: number;
  referenceId: string | null;
  listsScreened: string[];
  rawResponse: unknown;
  errorMessage?: string;
};

// ── Shared helpers ─────────────────────────────────────────────────────────────

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isAustralia(country: unknown): boolean {
  return ["australia", "au", "aus"].includes(normalize(country));
}

function isDvsCapableDoc(documentType: string | null): boolean {
  return documentType === "driver_license" || documentType === "passport";
}

/** Convert YYYY-MM-DD → DD/MM/YYYY for NameScan v3 */
function toNamescanDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function rapidIdBaseUrl(): string {
  const configured = process.env.RAPIDID_BASE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const env = process.env.RAPIDID_ENVIRONMENT ?? "sandbox";
  return `https://${env}.ridx.io`;
}

function rapidIdToken(): string {
  return process.env.RAPIDID_API_TOKEN ?? process.env.RAPIDID_DVS_API_TOKEN ?? "";
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<{ ok: boolean; status: number; body: unknown; rawText: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VENDOR_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: { "Cache-Control": "no-store", ...(init.headers ?? {}) },
    });

    const rawText = await response.text();
    let body: unknown = rawText;
    try { body = JSON.parse(rawText); } catch { /* keep raw text as body */ }

    return { ok: response.ok, status: response.status, body, rawText };
  } finally {
    clearTimeout(timer);
  }
}

// ── RapidID DVS ────────────────────────────────────────────────────────────────

type ProfileForDvs = {
  country?: string | null;
  document_type?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  dob?: string | null;
  license_number?: string | null;
  card_number?: string | null;
  state_of_issue?: string | null;
  state?: string | null;
  passport_number?: string | null;
  expiry_date?: string | null;
  gender?: string | null;
};

export async function runManualDvsCheck(profile: ProfileForDvs): Promise<ManualDvsResult> {
  if (!isAustralia(profile.country)) {
    return {
      outcome: "SKIPPED",
      checkType: "N/A — Non-Australian Customer",
      resultCode: null,
      referenceId: null,
      rawResponse: { skippedReason: "DVS only applies to Australian customers." },
    };
  }

  const docType = profile.document_type ?? "";
  if (!isDvsCapableDoc(docType)) {
    return {
      outcome: "SKIPPED",
      checkType: "N/A — No Supported Document",
      resultCode: null,
      referenceId: null,
      rawResponse: { skippedReason: `DVS not applicable for document type: ${docType || "none"}.` },
    };
  }

  const token = rapidIdToken();
  if (!token) {
    return {
      outcome: "FAILED",
      checkType: docType === "driver_license" ? "Driver Licence Verification" : "Passport Verification",
      resultCode: null,
      referenceId: null,
      rawResponse: { error: "RapidID token not configured." },
      errorMessage: "Set RAPIDID_API_TOKEN in server environment variables.",
    };
  }

  try {
    if (docType === "driver_license") {
      const payload = {
        BirthDate: profile.dob ?? "",
        GivenName: profile.first_name ?? "",
        FamilyName: profile.last_name ?? "",
        LicenceNumber: profile.license_number ?? "",
        CardNumber: profile.card_number ?? "",
        StateOfIssue: profile.state_of_issue ?? profile.state ?? "",
      };

      const result = await fetchWithTimeout(`${rapidIdBaseUrl()}/dvs/v1/driverLicence`, {
        method: "POST",
        headers: { "Content-Type": "application/json", token },
        body: JSON.stringify(payload),
      });

      if (!result.ok) {
        return {
          outcome: "FAILED",
          checkType: "Driver Licence Verification",
          resultCode: null,
          referenceId: null,
          rawResponse: result.body,
          errorMessage: `RapidID returned HTTP ${result.status}.`,
        };
      }

      const r = result.body as { VerifyDocumentResult?: { VerificationResultCode?: string; VerificationRequestNumber?: string; ActivityId?: string }; rapidID?: string };
      const code = r.VerifyDocumentResult?.VerificationResultCode ?? null;
      const ref  = r.rapidID ?? r.VerifyDocumentResult?.VerificationRequestNumber ?? r.VerifyDocumentResult?.ActivityId ?? null;

      return {
        outcome: code === "Y" ? "VERIFIED" : "REVIEW REQUIRED",
        checkType: "Driver Licence Verification",
        resultCode: code,
        referenceId: ref,
        rawResponse: result.body,
      };
    }

    // Passport
    if (docType === "passport") {
      const payload: Record<string, string | undefined> = {
        BirthDate: profile.dob ?? "",
        GivenName: profile.first_name ?? "",
        FamilyName: profile.last_name ?? "",
        TravelDocumentNumber: profile.passport_number ?? "",
        Gender: profile.gender ?? undefined,
        ExpiryDate: profile.expiry_date ?? undefined,
      };

      const result = await fetchWithTimeout(`${rapidIdBaseUrl()}/dvs/v1/passport`, {
        method: "POST",
        headers: { "Content-Type": "application/json", token },
        body: JSON.stringify(payload),
      });

      if (!result.ok) {
        return {
          outcome: "FAILED",
          checkType: "Passport Verification",
          resultCode: null,
          referenceId: null,
          rawResponse: result.body,
          errorMessage: `RapidID returned HTTP ${result.status}.`,
        };
      }

      const r = result.body as { VerifyDocumentResult?: { VerificationResultCode?: string; VerificationRequestNumber?: string; ActivityId?: string }; rapidID?: string };
      const code = r.VerifyDocumentResult?.VerificationResultCode ?? null;
      const ref  = r.rapidID ?? r.VerifyDocumentResult?.VerificationRequestNumber ?? r.VerifyDocumentResult?.ActivityId ?? null;

      return {
        outcome: code === "Y" ? "VERIFIED" : "REVIEW REQUIRED",
        checkType: "Passport Verification",
        resultCode: code,
        referenceId: ref,
        rawResponse: result.body,
      };
    }
  } catch (err) {
    return {
      outcome: "FAILED",
      checkType: docType === "driver_license" ? "Driver Licence Verification" : "Passport Verification",
      resultCode: null,
      referenceId: null,
      rawResponse: { error: String(err) },
      errorMessage: err instanceof Error ? err.message : "Unknown error calling RapidID.",
    };
  }

  return {
    outcome: "SKIPPED",
    checkType: "N/A",
    resultCode: null,
    referenceId: null,
    rawResponse: {},
  };
}

// ── NameScan AML ───────────────────────────────────────────────────────────────

type ProfileForAml = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  dob?: string | null;
  country?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
};

// Sapphire v3.1 scans all its lists automatically (no selectedLists param).
// This label is used for display in the PDF only.
const AML_LISTS = ["All NameScan Sapphire Lists (PEP, Sanctions, SIP, RCA, POI)"] as const;

export async function runManualAmlCheck(profile: ProfileForAml): Promise<ManualAmlResult> {
  const endpoint = process.env.NAMESCAN_API_URL;
  const apiKey   = process.env.NAMESCAN_API_KEY;

  if (!endpoint || !apiKey) {
    return {
      outcome: "FAILED",
      matchCount: 0,
      possibleMatchCount: 0,
      referenceId: null,
      listsScreened: [],
      rawResponse: { error: "NameScan not configured." },
      errorMessage: "Set NAMESCAN_API_URL and NAMESCAN_API_KEY in server environment variables.",
    };
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  const address  = [profile.address, profile.city, profile.state, profile.postcode].filter(Boolean).join(", ");

  const requestBody = {
    firstName:  profile.first_name  ?? undefined,
    lastName:   profile.last_name   ?? undefined,
    dob:        toNamescanDate(profile.dob),
    country:    profile.country     ?? undefined,
  };

  try {
    const result = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify(requestBody),
    });

    if (!result.ok) {
      return {
        outcome: "FAILED",
        matchCount: 0,
        possibleMatchCount: 0,
        referenceId: null,
        listsScreened: [...AML_LISTS],
        rawResponse: result.body,
        errorMessage: `NameScan returned HTTP ${result.status}.`,
      };
    }

    const r = result.body as {
      status?: string;
      result?: string;
      hasMatches?: boolean;
      matches?: unknown[];
      possibleMatches?: unknown[];
      numberOfMatches?: number;
      numberOfPepMatches?: number;
      reference?: string;
      id?: string;
      scanId?: string;
    };

    const matches         = Array.isArray(r.matches) ? r.matches : [];
    const possibleMatches = Array.isArray(r.possibleMatches) ? r.possibleMatches : [];
    // NameScan v3 uses numberOfMatches instead of matches array in some responses
    const totalMatches    = matches.length + possibleMatches.length
      + (r.numberOfMatches ?? 0) + (r.numberOfPepMatches ?? 0);
    const status          = String(r.status ?? r.result ?? "").trim().toLowerCase();
    const hasHits         = r.hasMatches === true || totalMatches > 0;
    const reviewStatuses  = ["match", "possible_match", "review", "hit"];

    let outcome: ManualAmlOutcome = "CLEAR";
    if (hasHits || reviewStatuses.includes(status)) outcome = "REVIEW REQUIRED";

    return {
      outcome,
      matchCount: matches.length + (r.numberOfMatches ?? 0),
      possibleMatchCount: possibleMatches.length + (r.numberOfPepMatches ?? 0),
      referenceId: r.scanId ?? r.reference ?? r.id ?? null,
      listsScreened: [...AML_LISTS],
      rawResponse: result.body,
    };
  } catch (err) {
    return {
      outcome: "FAILED",
      matchCount: 0,
      possibleMatchCount: 0,
      referenceId: null,
      listsScreened: [],
      rawResponse: { error: String(err) },
      errorMessage: err instanceof Error ? err.message : "Unknown error calling NameScan.",
    };
  }
}

// ── Recipient AML check (NameScan) ──────────────────────────────────────────
// Used for both AU and IRT recipients — NameScan covers all jurisdictions.

export type RecipientForAml = {
  id: string;
  full_name?: string | null;   // IRT recipients
  account_name?: string | null; // AUD recipients
  direction: string;            // "aud" | "irt"
  irt_address?: string | null;
  residential_address?: string | null;
};

export async function runRecipientAmlCheck(recipient: RecipientForAml): Promise<ManualAmlResult> {
  const endpoint = process.env.NAMESCAN_API_URL;
  const apiKey   = process.env.NAMESCAN_API_KEY;

  if (!endpoint || !apiKey) {
    return {
      outcome: "FAILED",
      matchCount: 0,
      possibleMatchCount: 0,
      referenceId: null,
      listsScreened: [],
      rawResponse: { error: "NameScan not configured." },
      errorMessage: "Set NAMESCAN_API_URL and NAMESCAN_API_KEY in server environment variables.",
    };
  }

  // Resolve the best available name depending on recipient direction.
  // If we can split the name, send firstname + lastname.
  // Otherwise fall back to originalname (NameScan v3 full-name field).
  const resolvedName    = (recipient.full_name ?? recipient.account_name ?? "").trim();
  const resolvedAddress = (recipient.residential_address ?? recipient.irt_address ?? "").trim();
  const nameParts       = resolvedName.split(" ").filter(Boolean);

  const requestBody = nameParts.length >= 2
    ? {
        firstName:  nameParts[0],
        lastName:   nameParts.slice(1).join(" "),
      }
    : {
        originalName: resolvedName || undefined,
      };

  try {
    const result = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify(requestBody),
    });

    if (!result.ok) {
      return {
        outcome: "FAILED",
        matchCount: 0,
        possibleMatchCount: 0,
        referenceId: null,
        listsScreened: [...AML_LISTS],
        rawResponse: result.body,
        errorMessage: `NameScan returned HTTP ${result.status}.`,
      };
    }

    const r = result.body as {
      status?: string;
      result?: string;
      hasMatches?: boolean;
      matches?: unknown[];
      possibleMatches?: unknown[];
      numberOfMatches?: number;
      numberOfPepMatches?: number;
      reference?: string;
      id?: string;
      scanId?: string;
    };

    const matches         = Array.isArray(r.matches) ? r.matches : [];
    const possibleMatches = Array.isArray(r.possibleMatches) ? r.possibleMatches : [];
    const totalMatches    = matches.length + possibleMatches.length
      + (r.numberOfMatches ?? 0) + (r.numberOfPepMatches ?? 0);
    const status          = String(r.status ?? r.result ?? "").trim().toLowerCase();
    const hasHits         = r.hasMatches === true || totalMatches > 0;
    const reviewStatuses  = ["match", "possible_match", "review", "hit"];

    const outcome: ManualAmlOutcome = hasHits || reviewStatuses.includes(status) ? "REVIEW REQUIRED" : "CLEAR";

    return {
      outcome,
      matchCount: matches.length + (r.numberOfMatches ?? 0),
      possibleMatchCount: possibleMatches.length + (r.numberOfPepMatches ?? 0),
      referenceId: r.scanId ?? r.reference ?? r.id ?? null,
      listsScreened: [...AML_LISTS],
      rawResponse: result.body,
    };
  } catch (err) {
    return {
      outcome: "FAILED",
      matchCount: 0,
      possibleMatchCount: 0,
      referenceId: null,
      listsScreened: [],
      rawResponse: { error: String(err) },
      errorMessage: err instanceof Error ? err.message : "Unknown error calling NameScan for recipient.",
    };
  }
}

// ── Recipient RapidID AML check (AU recipients only) ───────────────────────
// RapidID person-search AML — uses name data only (no identity document needed).
// Endpoint: /aml/v1/person  (RapidID AML module, separate from DVS).

export type RecipientRapidIdResult = ManualAmlResult;

export async function runRecipientRapidIdCheck(recipient: RecipientForAml): Promise<RecipientRapidIdResult> {
  const token = rapidIdToken();
  if (!token) {
    return {
      outcome: "FAILED",
      matchCount: 0,
      possibleMatchCount: 0,
      referenceId: null,
      listsScreened: [],
      rawResponse: { error: "RapidID token not configured." },
      errorMessage: "Set RAPIDID_API_TOKEN in server environment variables.",
    };
  }

  const resolvedName    = (recipient.full_name ?? recipient.account_name ?? "").trim();
  const resolvedAddress = (recipient.residential_address ?? recipient.irt_address ?? "").trim();

  const payload = {
    FullName: resolvedName || undefined,
    Address:  resolvedAddress || undefined,
  };

  try {
    const result = await fetchWithTimeout(`${rapidIdBaseUrl()}/aml/v1/person`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify(payload),
    });

    // RapidID AML outcome parsing — mirrors the DVS structure but for AML responses.
    const r = result.body as {
      status?: string;
      result?: string;
      matches?: unknown[];
      possibleMatches?: unknown[];
      referenceId?: string;
      rapidID?: string;
      id?: string;
    };

    const matches         = Array.isArray(r.matches)         ? r.matches         : [];
    const possibleMatches = Array.isArray(r.possibleMatches) ? r.possibleMatches : [];
    const status          = String(r.status ?? r.result ?? "").trim().toLowerCase();
    const hasHits         = matches.length > 0 || possibleMatches.length > 0;
    const reviewStatuses  = ["match", "possible_match", "review", "hit"];

    // A non-OK response (e.g. 404 if the endpoint doesn't exist in sandbox) is
    // treated as FAILED so the admin sees the raw vendor payload in the PDF.
    if (!result.ok) {
      return {
        outcome: "FAILED",
        matchCount: 0,
        possibleMatchCount: 0,
        referenceId: null,
        listsScreened: ["RapidID AML"],
        rawResponse: result.body,
        errorMessage: `RapidID returned HTTP ${result.status}. Verify the AML endpoint is enabled on your account.`,
      };
    }

    const outcome: ManualAmlOutcome = hasHits || reviewStatuses.includes(status) ? "REVIEW REQUIRED" : "CLEAR";

    return {
      outcome,
      matchCount: matches.length,
      possibleMatchCount: possibleMatches.length,
      referenceId: r.rapidID ?? r.referenceId ?? r.id ?? null,
      listsScreened: ["RapidID AML"],
      rawResponse: result.body,
    };
  } catch (err) {
    return {
      outcome: "FAILED",
      matchCount: 0,
      possibleMatchCount: 0,
      referenceId: null,
      listsScreened: ["RapidID AML"],
      rawResponse: { error: String(err) },
      errorMessage: err instanceof Error ? err.message : "Unknown error calling RapidID AML.",
    };
  }
}
