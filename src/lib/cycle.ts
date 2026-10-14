export const CYCLE_PHASES = ["menstrual", "follicular", "ovulatory", "luteal"] as const;

export type CyclePhase = (typeof CYCLE_PHASES)[number];

export const PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual: "Menstrual",
  follicular: "Follicular",
  ovulatory: "Ovulatory",
  luteal: "Luteal",
};
