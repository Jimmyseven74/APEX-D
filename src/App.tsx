import { useState, type FormEvent, type ReactNode } from "react";
import { isPlausibleReg, lookup, type Status, type VehicleResult } from "./lookup";

// J1 — Add a family car (PRD V1.2): reg → confirm → sign up → reminders → vehicle page.
// Failed lookup → J4 manual setup.

type Car = {
  registration: string;
  make: string;
  model: string;
  year: number | null;
  colour?: string;
  mot?: VehicleResult["mot"];
  tax?: VehicleResult["tax"];
  retrievedAt?: string;
  source: "lookup" | "owner";
};

type Step =
  | { name: "entry"; error?: string }
  | { name: "loading" }
  | { name: "confirm"; car: Car }
  | { name: "manual"; reg: string }
  | { name: "signup"; car: Car }
  | { name: "reminders"; car: Car }
  | { name: "vehicle"; car: Car; reminders: boolean };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const STATUS: Record<Status, { icon: string; label: string }> = {
  valid: { icon: "✓", label: "Valid" },
  "due-soon": { icon: "!", label: "Due soon" },
  expired: { icon: "✕", label: "Expired" },
};

function StatusRow({ title, status, date }: { title: string; status: Status; date: string }) {
  const s = STATUS[status];
  const verb = status === "expired" ? "Expired" : title === "MOT" ? "Expires" : "Due";
  return (
    <div className="status-row">
      <div>
        <div className="status-title">{title}</div>
        <div className="status-date">
          {verb} {fmtDate(date)}
        </div>
      </div>
      <span className={`pill pill-${status}`}>
        <span aria-hidden="true">{s.icon}</span> {s.label}
      </span>
    </div>
  );
}

function CarHeader({ car }: { car: Car }) {
  return (
    <>
      <div className="car-head">
        <span className="plate-sm">{car.registration || "No UK reg"}</span>
        <span className="tag">{car.source === "lookup" ? "Demo data" : "Owner-added"}</span>
      </div>
      <h2>
        {car.year ? `${car.year} ` : ""}
        {car.make} {car.model}
      </h2>
      {car.colour && <p className="muted">{car.colour}</p>}
    </>
  );
}

function Dates({ car }: { car: Car }) {
  if (!car.mot || !car.tax) {
    return <p className="muted note">No MOT or tax data. Add the dates yourself once the car is saved.</p>;
  }
  return (
    <>
      <StatusRow title="MOT" status={car.mot.status} date={car.mot.date} />
      <StatusRow title="Tax" status={car.tax.status} date={car.tax.date} />
      <p className="source">
        Sample data for preview only, not from DVLA or DVSA.
        {car.retrievedAt ? ` Checked ${fmtDate(car.retrievedAt)}.` : ""}
      </p>
    </>
  );
}

function Screen({ onBack, children }: { onBack?: () => void; children: ReactNode }) {
  return (
    <div className="card">
      {onBack && (
        <button className="back" type="button" onClick={onBack}>
          ← Back
        </button>
      )}
      {children}
    </div>
  );
}

export default function App() {
  const [reg, setReg] = useState("");
  const [step, setStep] = useState<Step>({ name: "entry" });
  const [toast, setToast] = useState("");

  const restart = () => {
    setReg("");
    setStep({ name: "entry" });
  };

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2500);
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isPlausibleReg(reg)) {
      setStep({ name: "entry", error: "That doesn't look like a UK registration. Check it and try again." });
      return;
    }
    setStep({ name: "loading" });
    const v = await lookup(reg);
    if (v) {
      setStep({ name: "confirm", car: { ...v, source: "lookup" } });
    } else {
      setStep({ name: "manual", reg: reg.toUpperCase().trim() });
    }
  }

  function onManual(e: FormEvent<HTMLFormElement>, regValue: string) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const make = String(f.get("make") || "").trim();
    const model = String(f.get("model") || "").trim();
    const yearRaw = Number(f.get("year"));
    if (!make || !model) return;
    setStep({
      name: "signup",
      car: {
        registration: regValue,
        make,
        model,
        year: Number.isFinite(yearRaw) && yearRaw > 1885 ? yearRaw : null,
        source: "owner",
      },
    });
  }

  const showHero = step.name === "entry" || step.name === "loading";

  return (
    <div className="page">
      <header className="top">
        <button className="wordmark" type="button" onClick={restart}>
          APEX DREAMS
        </button>
      </header>

      <main className="main">
        {showHero && (
          <section className="hero">
            <h1>Everything about your cars. All in one place.</h1>
            <p className="lede">
              Enter your registration to check MOT and tax dates. Save your car to get reminders before anything is
              due.
            </p>

            <form className="reg-form" onSubmit={onSubmit} noValidate>
              <label htmlFor="reg" className="sr-only">
                Registration number
              </label>
              <div className="plate">
                <span className="plate-band" aria-hidden="true">
                  UK
                </span>
                <input
                  id="reg"
                  value={reg}
                  onChange={(e) => setReg(e.target.value)}
                  placeholder="AB12 CDE"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={8}
                  enterKeyHint="go"
                  aria-invalid={step.name === "entry" && !!step.error}
                  aria-describedby={step.name === "entry" && step.error ? "reg-error" : undefined}
                />
              </div>
              <button className="btn-primary" type="submit" disabled={step.name === "loading" || !reg.trim()}>
                {step.name === "loading" ? "Checking…" : "Check my car"}
              </button>
            </form>

            {step.name === "entry" && step.error && (
              <p id="reg-error" className="error" role="alert">
                {step.error}
              </p>
            )}
            <button className="link" type="button" onClick={() => setStep({ name: "manual", reg: "" })}>
              No UK registration yet? Add your car manually
            </button>
          </section>
        )}

        <div aria-live="polite">
          {step.name === "loading" && (
            <div className="card skeleton" aria-label="Looking up your car">
              <div className="sk-line w60" />
              <div className="sk-line w40" />
              <div className="sk-line w80" />
            </div>
          )}

          {step.name === "confirm" && (
            <Screen onBack={() => setStep({ name: "entry" })}>
              <p className="eyebrow">Is this your car?</p>
              <CarHeader car={step.car} />
              <Dates car={step.car} />
              <div className="actions">
                <button className="btn-primary" type="button" onClick={() => setStep({ name: "signup", car: step.car })}>
                  Yes, save this car
                </button>
                <button className="btn-secondary" type="button" onClick={() => setStep({ name: "entry" })}>
                  No, try another registration
                </button>
              </div>
            </Screen>
          )}

          {step.name === "manual" && (
            <Screen onBack={() => setStep({ name: "entry" })}>
              <h2>{step.reg ? `We couldn't find ${step.reg}` : "Add your car"}</h2>
              <p className="muted">
                Classic, import or not yet registered in the UK? Add what you know. Everything else is optional.
              </p>
              <form className="manual" onSubmit={(e) => onManual(e, step.reg)}>
                <label>
                  Make
                  <input name="make" required placeholder="e.g. Mazda" autoComplete="off" />
                </label>
                <label>
                  Model
                  <input name="model" required placeholder="e.g. MX-5" autoComplete="off" />
                </label>
                <label>
                  Year <span className="optional">(optional)</span>
                  <input name="year" inputMode="numeric" placeholder="e.g. 1991" autoComplete="off" />
                </label>
                <button className="btn-primary" type="submit">
                  Continue
                </button>
              </form>
            </Screen>
          )}

          {step.name === "signup" && (
            <Screen
              onBack={() =>
                setStep(step.car.source === "lookup" ? { name: "confirm", car: step.car } : { name: "manual", reg: step.car.registration })
              }
            >
              <h2>Save your car</h2>
              <p className="muted">Create a free account to keep your car and get reminders.</p>
              <div className="actions">
                {["Continue with Apple", "Continue with Google", "Continue with email"].map((label) => (
                  <button
                    key={label}
                    className={label.includes("Apple") ? "btn-primary" : "btn-secondary"}
                    type="button"
                    onClick={() => setStep({ name: "reminders", car: step.car })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="source">Prototype: no account is created.</p>
            </Screen>
          )}

          {step.name === "reminders" && (
            <Screen>
              <h2>Get a reminder before it's due?</h2>
              <p className="muted">
                {step.car.mot
                  ? `Your MOT ${step.car.mot.status === "expired" ? "expired" : "is due"} ${fmtDate(step.car.mot.date)}. We'll remind you 2 weeks before.`
                  : "Add your MOT, tax, insurance and service dates and we'll remind you 2 weeks before each one."}
              </p>
              <div className="actions">
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => setStep({ name: "vehicle", car: step.car, reminders: true })}
                >
                  Turn on reminders
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setStep({ name: "vehicle", car: step.car, reminders: false })}
                >
                  Not now
                </button>
              </div>
            </Screen>
          )}

          {step.name === "vehicle" && (
            <Screen>
              <p className="eyebrow">Saved to your garage</p>
              <CarHeader car={step.car} />
              <Dates car={step.car} />
              <div className="status-row">
                <div>
                  <div className="status-title">Reminders</div>
                  <div className="status-date">{step.reminders ? "On · 2 weeks before" : "Off"}</div>
                </div>
                <button
                  className="btn-small"
                  type="button"
                  onClick={() => setStep({ ...step, reminders: !step.reminders })}
                >
                  {step.reminders ? "Turn off" : "Turn on"}
                </button>
              </div>
              <div className="tiles">
                {["Set insurance date", "Set service date", "Add a document"].map((t) => (
                  <button key={t} className="tile" type="button" onClick={() => flash(`${t}: coming in the app`)}>
                    <span aria-hidden="true">＋</span> {t}
                  </button>
                ))}
              </div>
              <button className="btn-secondary block" type="button" onClick={restart}>
                Add another car
              </button>
            </Screen>
          )}
        </div>

        {showHero && (
          <section className="get-app">
            <h2>Coming soon to iPhone and Android</h2>
            <p className="muted">
              MOT, tax, insurance and service reminders, your documents and your car's full history, in one app.
            </p>
            <ul className="features">
              <li>Reminders before MOT, tax, insurance and servicing are due</li>
              <li>Every invoice and document stored against the right car</li>
              <li>Running costs and a full ownership history</li>
            </ul>
          </section>
        )}
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      <footer className="foot">
        <span>© {new Date().getFullYear()} APEX DREAMS · Prototype</span>
        <span>Any valid reg works · include "ZZ" to test a failed lookup</span>
      </footer>
    </div>
  );
}
