export const AU_DRIVER_LICENCE_ISSUER_OPTIONS = [
  { value: "ACT", label: "Access Canberra (Road User Services)" },
  { value: "NSW", label: "Transport for NSW (issued via Service NSW)" },
  { value: "NT", label: "Motor Vehicle Registry (MVR)" },
  { value: "QLD", label: "Department of Transport and Main Roads (TMR)" },
  { value: "SA", label: "Department for Infrastructure and Transport (issued via Service SA)" },
  { value: "TAS", label: "Department of State Growth (issued via Service Tasmania)" },
  { value: "VIC", label: "VicRoads" },
  { value: "WA", label: "Department of Transport (DoT)" },
] as const;

const AU_STATE_NAME_TO_CODE: Record<string, string> = {
  ACT: "ACT",
  "AUSTRALIAN CAPITAL TERRITORY": "ACT",
  NSW: "NSW",
  "NEW SOUTH WALES": "NSW",
  NT: "NT",
  "NORTHERN TERRITORY": "NT",
  QLD: "QLD",
  QUEENSLAND: "QLD",
  SA: "SA",
  "SOUTH AUSTRALIA": "SA",
  TAS: "TAS",
  TASMANIA: "TAS",
  VIC: "VIC",
  VICTORIA: "VIC",
  WA: "WA",
  "WESTERN AUSTRALIA": "WA",
};

export function normalizeAustralianState(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim().toUpperCase();
  return AU_STATE_NAME_TO_CODE[normalized] ?? String(value ?? "").trim();
}

export function formatAustralianDriverLicenceIssuer(value: string | null | undefined): string {
  const normalized = normalizeAustralianState(value);
  const match = AU_DRIVER_LICENCE_ISSUER_OPTIONS.find((option) => option.value === normalized);
  return match?.label ?? String(value ?? "").trim();
}