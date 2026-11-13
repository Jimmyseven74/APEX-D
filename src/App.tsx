import { useState, type FormEvent, type ReactNode } from "react";
import { isPlausibleReg, lookup, normalise, type Status, type VehicleResult } from "./lookup";

/*
  Navigation follows the design system (Notion change log v01):
  - Top bar types: Root (tab destinations), Back (drill-down), Close (task flows).
  - Tabs: Home, My Garage, Account. Tabs go to their root screen.
  - Before sign-up (J1) there is no tab bar; after sign-up the user lands in the app.
*/

type Car = {
  id: string;
  registration: string;
  make: string;
  model: string;
  year: number | null;
  colour?: string;
  mot?: VehicleResult["mot"];
  tax?: VehicleResult["tax"];
  retrievedAt?: string;
  source: "lookup" | "owner";
  reminders: boolean;
};

type Tab = "home" | "garage" | "account";

// Add-car flow steps (shared by onboarding and "Add a car").
type Flow =
  | { name: "entry"; error?: string }
  | { name: "loading" }
  | { name: "confirm"; car: Car }
  | { name: "manual"; reg: string }
  | { name: "signup"; car: Car }
  | { name: "reminders"; car: Car };

type View =
  | { kind: "onboarding"; flow: Flow }
  | { kind: "tab"; tab: Tab }
  | { kind: "vehicle"; id: string; from: Tab }
  | { kind: "add"; flow: Flow; from: Tab };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const STATUS: Record<Status, { icon: string; label: string }> = {
  valid: { icon: "✓", label: "Valid" },
  "due-soon": { icon: "!", label: "Due soon" },
  expired: { icon: "✕", label: "Expired" },
};

let idSeq = 0;
const newId = () => `car-${Date.now()}-${idSeq++}`;

const carName = (c: Car) => `${c.make} ${c.model}`;

/* ---------- Shared UI ---------- */

function TopBar({
  type,
  title,
  onLeft,
}: {
  type: "root" | "back" | "close" | "brand";
  title: string;
  onLeft?: () => void;
}) {
  return (
    <header className={`topbar topbar-${type}`}>
      <div className="topbar-side">
        {type === "back" && (
          <button className="icon-btn" type="button" onClick={onLeft} aria-label="Back">
            ←
          </button>
        )}
        {type === "close" && (
          <button className="icon-btn" type="button" onClick={onLeft} aria-label="Close">
            ✕
          </button>
        )}
      </div>
      <h1 className={`topbar-title ${type === "root" || type === "brand" ? "is-root" : ""}`}>{title}</h1>
      <div className="topbar-side right">
        {type === "root" && (
          <span className="icon-btn inert" aria-hidden="true" title="Notifications (not in V1 prototype)">
            🔔
          </span>
        )}
      </div>
    </header>
  );
}

function TabBar({ active, onSelect }: { active: Tab | null; onSelect: (t: Tab) => void }) {
  const tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: "home", label: "Home", icon: "⌂" },
    { id: "garage", label: "My Garage", icon: "🚗" },
    { id: "account", label: "Account", icon: "◯" },
  ];
  return (
    <nav className="tabbar" aria-label="Main">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`tab ${active === t.id ? "active" : ""}`}
          aria-current={active === t.id ? "page" : undefined}
          onClick={() => onSelect(t.id)}
        >
          <span className="tab-icon" aria-hidden="true">
            {t.icon}
          </span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

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
        {carName(car)}
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

/* ---------- Add-car flow (J1 / J4) ---------- */

function AddCarFlow({
  flow,
  setFlow,
  signedIn,
  existing,
  onOpenExisting,
  onDone,
}: {
  flow: Flow;
  setFlow: (f: Flow) => void;
  signedIn: boolean;
  existing: Car[];
  onOpenExisting: (id: string) => void;
  onDone: (car: Car) => void;
}) {
  const [reg, setReg] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isPlausibleReg(reg)) {
      setFlow({ name: "entry", error: "That doesn't look like a UK registration. Check it and try again." });
      return;
    }
    const dupe = existing.find((c) => normalise(c.registration) === normalise(reg));
    if (dupe) {
      onOpenExisting(dupe.id);
      return;
    }
    setFlow({ name: "loading" });
    const v = await lookup(reg);
    if (v) {
      setFlow({ name: "confirm", car: { ...v, id: newId(), source: "lookup", reminders: false } });
    } else {
      setFlow({ name: "manual", reg: reg.toUpperCase().trim() });
    }
  }

  function onManual(e: FormEvent<HTMLFormElement>, regValue: string) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const make = String(f.get("make") || "").trim();
    const model = String(f.get("model") || "").trim();
    const yearRaw = Number(f.get("year"));
    if (!make || !model) return;
    const car: Car = {
      id: newId(),
      registration: regValue,
      make,
      model,
      year: Number.isFinite(yearRaw) && yearRaw > 1885 ? yearRaw : null,
      source: "owner",
      reminders: false,
    };
    setFlow(signedIn ? { name: "reminders", car } : { name: "signup", car });
  }

  const afterConfirm = (car: Car) => setFlow(signedIn ? { name: "reminders", car } : { name: "signup", car });

  if (flow.name === "entry" || flow.name === "loading") {
    return (
      <>
        <section className="hero">
          {!signedIn && <h2 className="hero-title">Everything about your cars. All in one place.</h2>}
          <p className="lede">
            {signedIn
              ? "Enter the registration of the car you want to add."
              : "Enter your registration to check MOT and tax dates. Save your car to get reminders before anything is due."}
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
                aria-invalid={flow.name === "entry" && !!flow.error}
                aria-describedby={flow.name === "entry" && flow.error ? "reg-error" : undefined}
              />
            </div>
            <button className="btn-primary" type="submit" disabled={flow.name === "loading" || !reg.trim()}>
              {flow.name === "loading" ? "Checking…" : signedIn ? "Find car" : "Check my car"}
            </button>
          </form>
          {flow.name === "entry" && flow.error && (
            <p id="reg-error" className="error" role="alert">
              {flow.error}
            </p>
          )}
          <button className="link" type="button" onClick={() => setFlow({ name: "manual", reg: "" })}>
            No UK registration yet? Add the car manually
          </button>
        </section>
        {flow.name === "loading" && (
          <div className="card skeleton" aria-label="Looking up the car" aria-live="polite">
            <div className="sk-line w60" />
            <div className="sk-line w40" />
            <div className="sk-line w80" />
          </div>
        )}
      </>
    );
  }

  if (flow.name === "confirm") {
    return (
      <div className="card">
        <p className="eyebrow">Is this your car?</p>
        <CarHeader car={flow.car} />
        <Dates car={flow.car} />
        <div className="actions">
          <button className="btn-primary" type="button" onClick={() => afterConfirm(flow.car)}>
            Yes, save this car
          </button>
          <button className="btn-secondary" type="button" onClick={() => setFlow({ name: "entry" })}>
            No, try another registration
          </button>
        </div>
      </div>
    );
  }

  if (flow.name === "manual") {
    return (
      <div className="card">
        <h2>{flow.reg ? `We couldn't find ${flow.reg}` : "Add your car"}</h2>
        <p className="muted">
          Classic, import or not yet registered in the UK? Add what you know. Everything else is optional.
        </p>
        <form className="manual" onSubmit={(e) => onManual(e, flow.reg)}>
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
      </div>
    );
  }

  if (flow.name === "signup") {
    return (
      <div className="card">
        <h2>Save your car</h2>
        <p className="muted">Create a free account to keep your car and get reminders.</p>
        <div className="actions">
          {["Continue with Apple", "Continue with Google", "Continue with email"].map((label) => (
            <button
              key={label}
              className={label.includes("Apple") ? "btn-primary" : "btn-secondary"}
              type="button"
              onClick={() => setFlow({ name: "reminders", car: flow.car })}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="source">Prototype: no account is created.</p>
      </div>
    );
  }

  // reminders
  const car = flow.car;
  return (
    <div className="card">
      <h2>Get a reminder before it's due?</h2>
      <p className="muted">
        {car.mot
          ? `The MOT on ${car.registration} ${car.mot.status === "expired" ? "expired" : "is due"} ${fmtDate(car.mot.date)}. We'll remind you 2 weeks before.`
          : "Add MOT, tax, insurance and service dates and we'll remind you 2 weeks before each one."}
      </p>
      <div className="actions">
        <button className="btn-primary" type="button" onClick={() => onDone({ ...car, reminders: true })}>
          Turn on reminders
        </button>
        <button className="btn-secondary" type="button" onClick={() => onDone({ ...car, reminders: false })}>
          Not now
        </button>
      </div>
    </div>
  );
}

/* ---------- Signed-in screens ---------- */

type DueItem = { car: Car; label: "MOT" | "Tax"; status: Status; date: string };

function dueItems(cars: Car[]): DueItem[] {
  const items: DueItem[] = [];
  for (const car of cars) {
    if (car.mot) items.push({ car, label: "MOT", ...car.mot });
    if (car.tax) items.push({ car, label: "Tax", ...car.tax });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

function HomeScreen({ cars, onOpen, onAdd }: { cars: Car[]; onOpen: (id: string) => void; onAdd: () => void }) {
  const items = dueItems(cars);
  const attention = items.filter((i) => i.status !== "valid");
  const upcoming = items.filter((i) => i.status === "valid");
  return (
    <>
      <section>
        <h2 className="section-title">Needs attention</h2>
        {attention.length === 0 ? (
          <div className="card all-clear">
            <span aria-hidden="true">✓</span> All clear. Nothing is due in the next 30 days.
          </div>
        ) : (
          <div className="list">
            {attention.map((i) => (
              <button key={i.car.id + i.label} type="button" className="row" onClick={() => onOpen(i.car.id)}>
                <span>
                  <span className="row-title">
                    {i.label} · {i.car.registration || carName(i.car)}
                  </span>
                  <span className="row-sub">
                    {carName(i.car)} · {i.status === "expired" ? "Expired" : "Due"} {fmtDate(i.date)}
                  </span>
                </span>
                <span className={`pill pill-${i.status}`}>
                  <span aria-hidden="true">{STATUS[i.status].icon}</span> {STATUS[i.status].label}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section>
          <h2 className="section-title">Coming up</h2>
          <div className="list">
            {upcoming.map((i) => (
              <button key={i.car.id + i.label} type="button" className="row" onClick={() => onOpen(i.car.id)}>
                <span>
                  <span className="row-title">
                    {i.label} · {i.car.registration || carName(i.car)}
                  </span>
                  <span className="row-sub">
                    {carName(i.car)} · Due {fmtDate(i.date)}
                  </span>
                </span>
                <span className="chev" aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <button className="btn-secondary block" type="button" onClick={onAdd}>
        ＋ Add a car
      </button>
    </>
  );
}

function GarageScreen({ cars, onOpen, onAdd }: { cars: Car[]; onOpen: (id: string) => void; onAdd: () => void }) {
  return (
    <>
      <p className="muted">
        {cars.length} {cars.length === 1 ? "car" : "cars"}
      </p>
      <div className="list">
        {cars.map((c) => {
          const next = dueItems([c])[0];
          return (
            <button key={c.id} type="button" className="row car-row" onClick={() => onOpen(c.id)}>
              <span>
                <span className="plate-sm">{c.registration || "No UK reg"}</span>
                <span className="row-title spaced">
                  {c.year ? `${c.year} ` : ""}
                  {carName(c)}
                </span>
                <span className="row-sub">
                  {next ? `Next: ${next.label} ${fmtDate(next.date)}` : "No dates set yet"}
                </span>
              </span>
              <span className="chev" aria-hidden="true">
                ›
              </span>
            </button>
          );
        })}
      </div>
      <button className="btn-secondary block" type="button" onClick={onAdd}>
        ＋ Add a car
      </button>
    </>
  );
}

function AccountScreen({ onSignOut }: { onSignOut: () => void }) {
  return (
    <>
      <div className="list">
        <div className="row static">
          <span>
            <span className="row-title">Signed in</span>
            <span className="row-sub">Prototype account</span>
          </span>
        </div>
        <div className="row static">
          <span>
            <span className="row-title">Reminder lead time</span>
            <span className="row-sub">2 weeks before (placeholder)</span>
          </span>
        </div>
      </div>
      <button className="btn-secondary block" type="button" onClick={onSignOut}>
        Sign out and restart prototype
      </button>
    </>
  );
}

function VehicleScreen({
  car,
  onToggleReminders,
  onFlash,
  onRemove,
}: {
  car: Car;
  onToggleReminders: () => void;
  onFlash: (m: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="card">
      <CarHeader car={car} />
      <Dates car={car} />
      <div className="status-row">
        <div>
          <div className="status-title">Reminders</div>
          <div className="status-date">{car.reminders ? "On · 2 weeks before" : "Off"}</div>
        </div>
        <button className="btn-small" type="button" onClick={onToggleReminders}>
          {car.reminders ? "Turn off" : "Turn on"}
        </button>
      </div>
      <div className="tiles">
        {["Set insurance date", "Set service date", "Add a document"].map((t) => (
          <button key={t} className="tile" type="button" onClick={() => onFlash(`${t}: coming in the app`)}>
            <span aria-hidden="true">＋</span> {t}
          </button>
        ))}
      </div>
      <button className="link danger" type="button" onClick={onRemove}>
        Remove this car
      </button>
    </div>
  );
}

/* ---------- App ---------- */

const TITLES: Record<Tab, string> = { home: "Home", garage: "My Garage", account: "Account" };

export default function App() {
  const [cars, setCars] = useState<Car[]>([]);
  const [view, setView] = useState<View>({ kind: "onboarding", flow: { name: "entry" } });
  const [toast, setToast] = useState("");

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2500);
  };

  const signedIn = view.kind !== "onboarding";
  const activeTab: Tab | null =
    view.kind === "tab" ? view.tab : view.kind === "vehicle" || view.kind === "add" ? view.from : null;

  const openVehicle = (id: string, from: Tab) => setView({ kind: "vehicle", id, from });
  const startAdd = (from: Tab) => setView({ kind: "add", flow: { name: "entry" }, from });

  const saveCar = (car: Car) => {
    setCars((cs) => [...cs, car]);
    setView({ kind: "vehicle", id: car.id, from: "garage" });
    flash(`${car.registration || carName(car)} saved to your garage`);
  };

  const restart = () => {
    setCars([]);
    setView({ kind: "onboarding", flow: { name: "entry" } });
  };

  // Back within the add-car flow steps one step back; at the first step it leaves the flow.
  const flowBack = (flow: Flow): Flow | null => {
    switch (flow.name) {
      case "confirm":
      case "manual":
        return { name: "entry" };
      case "signup":
        return flow.car.source === "lookup" ? { name: "confirm", car: flow.car } : { name: "manual", reg: flow.car.registration };
      case "reminders":
        return signedIn
          ? flow.car.source === "lookup"
            ? { name: "confirm", car: flow.car }
            : { name: "manual", reg: flow.car.registration }
          : null; // after sign-up there's no going back to sign-up
      default:
        return null;
    }
  };

  let top: ReactNode;
  let body: ReactNode;

  if (view.kind === "onboarding") {
    const back = flowBack(view.flow);
    top = back ? (
      <TopBar type="back" title="" onLeft={() => setView({ kind: "onboarding", flow: back })} />
    ) : (
      <TopBar type="brand" title="APEX DREAMS" />
    );
    body = (
      <AddCarFlow
        flow={view.flow}
        setFlow={(flow) => setView({ kind: "onboarding", flow })}
        signedIn={false}
        existing={cars}
        onOpenExisting={() => undefined}
        onDone={saveCar}
      />
    );
  } else if (view.kind === "add") {
    const back = flowBack(view.flow);
    const from = view.from;
    top = (
      <TopBar
        type={back ? "back" : "close"}
        title="Add a car"
        onLeft={() => (back ? setView({ kind: "add", flow: back, from }) : setView({ kind: "tab", tab: from }))}
      />
    );
    body = (
      <AddCarFlow
        flow={view.flow}
        setFlow={(flow) => setView({ kind: "add", flow, from })}
        signedIn
        existing={cars}
        onOpenExisting={(id) => {
          openVehicle(id, from);
          flash("That car is already in your garage");
        }}
        onDone={saveCar}
      />
    );
  } else if (view.kind === "vehicle") {
    const car = cars.find((c) => c.id === view.id);
    const from = view.from;
    top = <TopBar type="back" title={car ? car.registration || carName(car) : ""} onLeft={() => setView({ kind: "tab", tab: from })} />;
    body = car ? (
      <VehicleScreen
        car={car}
        onFlash={flash}
        onToggleReminders={() =>
          setCars((cs) => cs.map((c) => (c.id === car.id ? { ...c, reminders: !c.reminders } : c)))
        }
        onRemove={() => {
          setCars((cs) => cs.filter((c) => c.id !== car.id));
          setView({ kind: "tab", tab: "garage" });
          flash("Car removed");
        }}
      />
    ) : null;
  } else {
    top = <TopBar type="root" title={TITLES[view.tab]} />;
    const tab = view.tab;
    body =
      tab === "home" ? (
        <HomeScreen cars={cars} onOpen={(id) => openVehicle(id, "home")} onAdd={() => startAdd("home")} />
      ) : tab === "garage" ? (
        <GarageScreen cars={cars} onOpen={(id) => openVehicle(id, "garage")} onAdd={() => startAdd("garage")} />
      ) : (
        <AccountScreen onSignOut={restart} />
      );
  }

  // Tab bar shows on tab roots and drill-downs, not inside task flows (Close top bar) or before sign-up.
  const showTabs = signedIn && view.kind !== "add";

  return (
    <div className="app">
      {top}
      <main className={`main ${showTabs ? "with-tabs" : ""}`} key={JSON.stringify([view.kind, "tab" in view ? view.tab : "", "id" in view ? view.id : ""])}>
        {body}
        {view.kind === "onboarding" && (view.flow.name === "entry" || view.flow.name === "loading") && (
          <section className="get-app">
            <h2>Coming soon to iPhone and Android</h2>
            <ul className="features">
              <li>Reminders before MOT, tax, insurance and servicing are due</li>
              <li>Every invoice and document stored against the right car</li>
              <li>Running costs and a full ownership history</li>
            </ul>
            <p className="source">Prototype · any valid reg works · include "ZZ" to test a failed lookup</p>
          </section>
        )}
      </main>
      {showTabs && <TabBar active={activeTab} onSelect={(t) => setView({ kind: "tab", tab: t })} />}
      {toast && (
        <div className={`toast ${showTabs ? "above-tabs" : ""}`} role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
