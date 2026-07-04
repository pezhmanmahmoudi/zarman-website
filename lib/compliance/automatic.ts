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

function rapidIdBaseUrl() {
  const configuredBase = process.env.RAPIDID_BASE_URL?.replace(/\/$/, "");
  if (configuredBase) return configuredBase;

  const environment = process.env.RAPIDID_ENVIRONMENT || "sandbox";
  return `https://${environment}.ridx.io`;
}

function rapidIdToken() {
  return process.env.RAPIDID_API_TOKEN || process.env.RAPIDID_DVS_API_TOKEN || "";
}

async function fetchJsonWithTimeout(url: string, init: RequestInit) {
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
    try {
      body = JSON.parse(text);
    } catch {
      // Some vendor errors are plain text; keep the raw body for diagnostics.
    }

    if (!response.ok) {
      throw new Error(`Vendor request failed with ${response.status}: ${text.slice(0, 500)}`);
    }

    return body;
  } finally {
    clearTimeout(timer);
  }
}

function resultCodeFromRapidId(response: unknown) {
  const result = response as {
    VerifyDocumentResult?: {
      VerificationResultCode?: string;
      VerificationRequestNumber?: string;
      ActivityId?: string;
    };
    rapidID?: string;
  };
  return {
    code: result.VerifyDocumentResult?.VerificationResultCode ?? null,
    reference:
      result.rapidID ??
      result.VerifyDocumentResult?.VerificationRequestNumber ??
      result.VerifyDocumentResult?.ActivityId ??
      null,
  };
}

async function runRapidIdCheck(subject: KycSubject): Promise<VendorCheckResult> {
  if (!isAustralia(subject.country)) {
    return {
      provider: "rapidid",
      outcome: "skipped",
      message: "RapidID DVS skipped because the customer is outside Australia.",
    };
  }

  const token = rapidIdToken();
  if (!token) {
    return {
      provider: "rapidid",
      outcome: "failed",
      message: "RapidID token is not configured. Set RAPIDID_API_TOKEN in server environment variables.",
    };
  }

  if (subject.document_type === "driver_license") {
    const response = await fetchJsonWithTimeout(`${rapidIdBaseUrl()}/dvs/v1/driverLicence`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token,
      },
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
      message: code === "Y" ? "RapidID driver licence DVS verified." : `RapidID driver licence DVS returned ${code ?? "unknown"}.`,
      reference,
    };
  }

  if (subject.document_type === "passport") {
    if (!subject.gender) {
      return {
        provider: "rapidid",
        outcome: "review",
        message: "RapidID passport DVS requires gender, but the current KYC form does not collect it.",
      };
    }

    const response = await fetchJsonWithTimeout(`${rapidIdBaseUrl()}/dvs/v1/passport`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token,
      },
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
      message: code === "Y" ? "RapidID passport DVS verified." : `RapidID passport DVS returned ${code ?? "unknown"}.`,
      reference,
    };
  }

  return {
    provider: "rapidid",
    outcome: "skipped",
    message: "RapidID DVS skipped because no supported identity document was supplied.",
  };
}

function amlOutcomeFromResponse(response: unknown) {
  const result = response as {
    status?: string;
    result?: string;
    matches?: unknown[];
    possibleMatches?: unknown[];
    reference?: string;
    id?: string;
    scanId?: string;
  };
  const status = normalize(result.status || result.result);
  const matches = Array.isArray(result.matches) ? result.matches : [];
  const possibleMatches = Array.isArray(result.possibleMatches) ? result.possibleMatches : [];

  if (matches.length > 0 || possibleMatches.length > 0) return "review";
  if (["clear", "passed", "pass", "no_match", "no match", "none"].includes(status)) return "passed";
  if (["match", "possible_match", "review", "hit"].includes(status)) return "review";
  return "passed";
}

async function runNameScanCheck(subject: KycSubject): Promise<VendorCheckResult> {
  const endpoint = process.env.NAMESCAN_API_URL;
  const apiKey = process.env.NAMESCAN_API_KEY;

  if (!endpoint || !apiKey) {
    return {
      provider: "namescan",
      outcome: "failed",
      message: "NameScan is not configured. Set NAMESCAN_API_URL and NAMESCAN_API_KEY in server environment variables.",
    };
  }

  const response = await fetchJsonWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      lists: ["OFAC", "DFAT", "UN", "EU", "PEP"],
      subject: {
        id: subject.id,
        fullName: fullName(subject),
        firstName: subject.first_name,
        lastName: subject.last_name,
        dateOfBirth: subject.dob,
        country: subject.country,
        address: [subject.address, subject.city, subject.state, subject.postcode].filter(Boolean).join(", "),
      },
    }),
  });

  const outcome = amlOutcomeFromResponse(response);
  const result = response as { reference?: string; id?: string; scanId?: string };
  return {
    provider: "namescan",
    outcome,
    message: outcome === "passed" ? "NameScan PEP/sanctions screening passed." : "NameScan PEP/sanctions screening requires review.",
    reference: result.reference ?? result.scanId ?? result.id ?? null,
  };
}

export async function runAutomaticComplianceChecks(subject: KycSubject): Promise<AutomaticComplianceResult> {
  const settled = await Promise.allSettled([runRapidIdCheck(subject), runNameScanCheck(subject)]);
  const checks = settled.map((result, index): VendorCheckResult => {
    if (result.status === "fulfilled") return result.value;

    return {
      provider: index === 0 ? "rapidid" : "namescan",
      outcome: "failed",
      message: result.reason instanceof Error ? result.reason.message : "Compliance vendor check failed.",
    };
  });

  const needsReview = checks.some((check) => check.outcome === "review" || check.outcome === "failed");
  return {
    status: needsReview ? "needs_review" : "clear",
    checks,
  };
}
