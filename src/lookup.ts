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

// "Format" a normalised reg for display: current-style (AB12CDE) gets a space.
function display(r: string): string {
  return /^[A-Z]{2}[0-9]{2}[A-Z]{3}$/.test(r) ? `${r.slice(0, 4)} ${r.slice(4)}` : r;
}

const POOL: Array<Pick<VehicleResult, "make" | "model" | "colour">> = [
  { make: "Ford", model: "Fiesta", colour: "Grey" },
  { make: "Vauxhall", model: "Corsa", colour: "Red" },
  { make: "Nissan", model: "Qashqai", colour: "Black" },
  { make: "BMW", model: "3 Series", colour: "Silver" },
  { make: "Kia", model: "Sportage", colour: "Blue" },
];

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function statusFor(days: number): Status {
  return days < 0 ? "expired" : days <= 30 ? "due-soon" : "valid";
}

// Any plausible reg returns a car: known demo cars, otherwise one generated from the reg.
// "ZZ" anywhere in the reg simulates a failed lookup, so the manual route can be tested.
export async function lookup(input: string): Promise<VehicleResult | null> {
  await new Promise((res) => setTimeout(res, 900));
  const r = normalise(input);
  const retrievedAt = new Date().toISOString();
  if (DEMO[r]) return { ...DEMO[r], retrievedAt };
  if (r.includes("ZZ")) return null;

  const seed = [...r].reduce((n, c) => n + c.charCodeAt(0), 0);
  const car = POOL[seed % POOL.length];
  const motDays = (seed * 7) % 300 - 20;
  const taxDays = (seed * 13) % 330 + 10;
  return {
    registration: display(r),
    ...car,
    year: 2010 + (seed % 14),
    mot: { status: statusFor(motDays), date: addDays(motDays) },
    tax: { status: statusFor(taxDays), date: addDays(taxDays) },
    retrievedAt,
  };
}
