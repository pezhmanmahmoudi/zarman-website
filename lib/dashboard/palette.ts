/** Shared light surfaces: colour identifies a stage; words and icons carry its meaning. */
export const dashboardPalette = {
  violet: { ink: "#49318b", accent: "#7651d4", soft: "#f3edff", border: "#d8c9f2", glow: "#c7aeff" },
  amber: { ink: "#81500c", accent: "#b87013", soft: "#fff3dc", border: "#ecd3a4", glow: "#ffda8a" },
  sky: { ink: "#185a82", accent: "#207fad", soft: "#eaf6ff", border: "#bfddec", glow: "#9bdbff" },
  teal: { ink: "#17635e", accent: "#168477", soft: "#e6f7f3", border: "#b5ddd4", glow: "#8fe2cc" },
  emerald: { ink: "#24653f", accent: "#2b8051", soft: "#eaf7e9", border: "#bdddb8", glow: "#b0e8a3" },
  rose: { ink: "#95344f", accent: "#be4a68", soft: "#fff0f3", border: "#efc4d0", glow: "#ffc2d5" },
  slate: { ink: "#48566b", accent: "#68788d", soft: "#f0f3f7", border: "#d0d8e2", glow: "#c8d4e2" },
} as const;
export type DashboardTone = keyof typeof dashboardPalette;
export const dashboardStageTones = ["violet", "amber", "sky", "teal", "emerald"] as const;
