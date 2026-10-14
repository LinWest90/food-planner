// Unit conversions. Goals are stored and calculated in metric; the UI
// accepts US units (lb, ft/in) and shows the metric value alongside.

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const kgToLb = (kg: number) => kg / KG_PER_LB;

export const feetInchesToCm = (feet: number, inches: number) => (feet * 12 + inches) * CM_PER_IN;

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round((cm / CM_PER_IN) * 10) / 10;
  const feet = Math.floor(totalInches / 12);
  return { feet, inches: Math.round((totalInches - feet * 12) * 10) / 10 };
}

/** Rounds to one decimal place. */
export const round1 = (n: number) => Math.round(n * 10) / 10;
