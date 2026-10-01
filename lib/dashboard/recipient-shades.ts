import type { RecipientDirection } from "@/app/[locale]/dashboard/dashboard.types";

export type RecipientShade = { ink: string; accent: string; soft: string; border: string; from: string; to: string; initials: string };

/** One bright family per country, ordered dark → light: AUD = yellow, Toman = blue. */
export const recipientShades: Record<RecipientDirection, RecipientShade[]> = {
  irt: [
    { ink: "#1e3fa8", accent: "#2f5bea", soft: "#eef3ff", border: "#d9e3fb", from: "#5b8cff", to: "#2f5bea", initials: "#ffffff" },
    { ink: "#1a5fb0", accent: "#2a86f0", soft: "#edf6ff", border: "#d5e8fb", from: "#5eb0ff", to: "#2a86f0", initials: "#ffffff" },
    { ink: "#0f6a9e", accent: "#1fa3ec", soft: "#eaf7ff", border: "#d0ebf9", from: "#6cc8ff", to: "#1fa3ec", initials: "#ffffff" },
    { ink: "#0c6690", accent: "#48bdf5", soft: "#ecf9ff", border: "#d3eef9", from: "#97dcff", to: "#48bdf5", initials: "#ffffff" },
    { ink: "#0e5c85", accent: "#7cc9f2", soft: "#f0faff", border: "#dbf1fb", from: "#c4eaff", to: "#85cff7", initials: "#0e5c85" },
  ],
  aud: [
    { ink: "#8a5a00", accent: "#e89400", soft: "#fff5df", border: "#f5e2b5", from: "#ffc533", to: "#e89400", initials: "#ffffff" },
    { ink: "#8a6000", accent: "#f0aa00", soft: "#fff7e0", border: "#f6e6b8", from: "#ffd34d", to: "#f0aa00", initials: "#ffffff" },
    { ink: "#856300", accent: "#f2bc0a", soft: "#fff9e0", border: "#f6eab9", from: "#ffdd55", to: "#f5bd0a", initials: "#6b4f00" },
    { ink: "#7d6400", accent: "#f2c81f", soft: "#fffbe3", border: "#f5edbf", from: "#ffe86b", to: "#f7cc1f", initials: "#6b5500" },
    { ink: "#766200", accent: "#efd045", soft: "#fffce8", border: "#f4efc8", from: "#fff3a3", to: "#f9da45", initials: "#6b5a00" },
  ],
};

/** Shades run in order within each country, so neighbours differ until the family is used up. */
export function recipientShade(direction: RecipientDirection, index: number): RecipientShade {
  const shades = recipientShades[direction];
  return shades[index % shades.length];
}

/** Position of each recipient among those of the same country, in display order. */
export function recipientShadeIndexes(recipients: readonly { direction: RecipientDirection }[]): number[] {
  const seen: Record<RecipientDirection, number> = { aud: 0, irt: 0 };
  return recipients.map(recipient => seen[recipient.direction]++);
}
