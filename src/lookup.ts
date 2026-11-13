// Demo lookup. No live DVLA/DVSA integration yet (PRD DG-001, DG-011).
// Replace with an authorised API call once a provider is confirmed (PRD open decision 2).

export type Status = "valid" | "due-soon" | "expired";

export interface VehicleResult {
  registration: string;
  make: string;
  model: string;
  year: number;
  colour: string;
  mot: { status: Status; date: string };
  tax: { status: Status; date: string };
  retrievedAt: string;
}

const DEMO: Record<string, Omit<VehicleResult, "retrievedAt">> = {
  AB12CDE: {
    registration: "AB12 CDE",
    make: "Volkswagen",
    model: "Golf",
    year: 2012,
    colour: "Blue",
    mot: { status: "due-soon", date: "2026-12-04" },
    tax: { status: "valid", date: "2027-03-01" },
  },
  CD34EFG: {
    registration: "CD34 EFG",
    make: "Toyota",
    model: "Yaris",
    year: 2018,
    colour: "White",
    mot: { status: "valid", date: "2027-06-19" },
    tax: { status: "expired", date: "2026-10-31" },
  },
};

export function normalise(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Accepts current, prefix, suffix and dateless UK formats, loosely.
export function isPlausibleReg(input: string): boolean {
  const r = normalise(input);
  return r.length >= 2 && r.length <= 7 && /[A-Z]/.test(r) && /[0-9]/.test(r);
}

export async function lookup(input: string): Promise<VehicleResult | null> {
  await new Promise((res) => setTimeout(res, 900));
  const hit = DEMO[normalise(input)];
  return hit ? { ...hit, retrievedAt: new Date().toISOString() } : null;
}
