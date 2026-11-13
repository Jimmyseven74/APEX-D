import { useState, type FormEvent } from "react";
import { isPlausibleReg, lookup, type Status, type VehicleResult } from "./lookup";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "not-found"; reg: string }
  | { kind: "result"; vehicle: VehicleResult };

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

export default function App() {
  const [reg, setReg] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isPlausibleReg(reg)) {
      setState({ kind: "invalid" });
      return;
    }
    setState({ kind: "loading" });
    const vehicle = await lookup(reg);
    setState(vehicle ? { kind: "result", vehicle } : { kind: "not-found", reg: reg.toUpperCase() });
  }

  return (
    <div className="page">
      <header className="top">
        <span className="wordmark">APEX DREAMS</span>
      </header>

      <main className="main">
        <section className="hero">
          <h1>Everything about your cars. All in one place.</h1>
          <p className="lede">
            Enter your registration to check MOT and tax dates. Save your car to get reminders before anything is due.
          </p>

          <form className="reg-form" onSubmit={onSubmit} noValidate>
            <label htmlFor="reg" className="sr-only">
              Registration number
            </label>
            <div className="plate">
              <span className="plate-band" aria-hidden="true">UK</span>
              <input
                id="reg"
                value={reg}
                onChange={(e) => setReg(e.target.value)}
                placeholder="AB12 CDE"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={8}
                aria-invalid={state.kind === "invalid"}
                aria-describedby={state.kind === "invalid" ? "reg-error" : undefined}
              />
            </div>
            <button className="btn-primary" type="submit" disabled={state.kind === "loading" || !reg.trim()}>
              {state.kind === "loading" ? "Checking…" : "Check my car"}
            </button>
          </form>

          {state.kind === "invalid" && (
            <p id="reg-error" className="error" role="alert">
              That doesn't look like a UK registration. Check it and try again.
            </p>
          )}
        </section>

        <div aria-live="polite">
          {state.kind === "loading" && (
            <div className="card skeleton" aria-label="Looking up your car">
              <div className="sk-line w60" />
              <div className="sk-line w40" />
              <div className="sk-line w80" />
            </div>
          )}

          {state.kind === "not-found" && (
            <div className="card">
              <h2>We couldn't find {state.reg}</h2>
              <p className="muted">
                Classic, import or not yet registered in the UK? You can still add your car manually in the app.
              </p>
              <a className="btn-secondary" href="#get-app">
                Add it manually
              </a>
            </div>
          )}

          {state.kind === "result" && (
            <div className="card">
              <div className="car-head">
                <span className="plate-sm">{state.vehicle.registration}</span>
                <span className="tag">Demo data</span>
              </div>
              <h2>
                {state.vehicle.year} {state.vehicle.make} {state.vehicle.model}
              </h2>
              <p className="muted">{state.vehicle.colour}. Is this your car?</p>

              <StatusRow title="MOT" status={state.vehicle.mot.status} date={state.vehicle.mot.date} />
              <StatusRow title="Tax" status={state.vehicle.tax.status} date={state.vehicle.tax.date} />

              <p className="source">
                Sample data for preview only, not from DVLA or DVSA. Checked {fmtDate(state.vehicle.retrievedAt)}.
              </p>

              <a className="btn-primary block" href="#get-app">
                Save this car and get reminders
              </a>
            </div>
          )}
        </div>

        <section id="get-app" className="get-app">
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
      </main>

      <footer className="foot">
        <span>© {new Date().getFullYear()} APEX DREAMS</span>
        <span>Try AB12 CDE or CD34 EFG</span>
      </footer>
    </div>
  );
}
