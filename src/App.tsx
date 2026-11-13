import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { isPlausibleReg, lookup, normalise, type Status, type VehicleResult } from "./lookup";
import { BottomSheet, SheetHeader, SheetRow, SHEET_CLOSE_MS } from "./Sheet";
import {
  IconBellOff,
  IconCalendar,
  IconCamera,
  IconCheck,
  IconDone,
  IconPdf,
  IconPhotos,
  IconScan,
  IconSnooze,
  IconTurnOff,
} from "./icons";

/*
  Figma (APEX DREAMS — Design System v01) is the source of truth for copy, layout and tokens.
  Navigation follows the design system:
  - Top bar types: Root (tab destinations), Back (drill-down), Close (task flows).
  - Tabs: Home, My Garage, Account. Tabs go to their root screen.
  - Before sign-up (J1) there is no tab bar; after sign-up the user lands in the app.
  - Bottom sheets: J1 reminder offer and notifications off, J2/J3 add invoice,
    J5 reminder actions and snooze.
*/

type Cat = "mot" | "tax";

type DateInfo = { status: Status; date: string; source: "official" | "owner"; official?: string };

type Doc = { id: string; name: string };

type Car = {
  id: string;
  registration: string;
  make: string;
  model: string;
  year: number | null;
  colour?: string;
  mot?: DateInfo;
  tax?: DateInfo;
  retrievedAt?: string;
  source: "lookup" | "owner";
  reminders: boolean;
  channel?: "push" | "email";
  off: Partial<Record<Cat, boolean>>;
  snoozed: Partial<Record<Cat, string>>;
  documents: Doc[];
};

type Tab = "home" | "garage" | "account";

// Add-car flow steps (shared by onboarding and "Add a car").
type Flow =
  | { name: "entry"; error?: string }
  | { name: "loading" }
  | { name: "confirm"; car: Car }
  | { name: "manual"; reg: string }
  | { name: "signup"; car: Car };

// Full-screen task flows opened from the reminder actions sheet (J5 06–08, 11; J2 06).
type TaskStep = "update" | "compare" | "done" | "next" | "uptodate";

type View =
  | { kind: "onboarding"; flow: Flow }
  | { kind: "tab"; tab: Tab }
  | { kind: "vehicle"; id: string; from: Tab }
  | { kind: "add"; flow: Flow; from: Tab }
  | { kind: "task"; id: string; cat: Cat; step: TaskStep; draft: string; choice?: "official" | "owner"; from: Tab };

type Snooze = "tomorrow" | "week" | "pick";

type Sheet =
  | { kind: "offer"; carId: string; step: "offer" | "blocked" }
  | { kind: "actions"; carId: string; cat: Cat; step: "menu" | "snooze"; snooze: Snooze; pick: string }
  | { kind: "docs"; carId: string };

type Toast = { msg: string; action?: { label: string; run: () => void } };

/* ---------- Dates ---------- */

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const todayIso = () => isoDay(new Date());
const addDays = (iso: string, n: number) => isoDay(new Date(new Date(iso).getTime() + n * DAY));
const addYears = (iso: string, n: number) => {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() + n);
  return isoDay(d);
};
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const fmtShort = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function statusFor(iso: string): Status {
  const days = (new Date(iso).getTime() - new Date(todayIso()).getTime()) / DAY;
  if (days < 0) return "expired";
  if (days <= 30) return "due-soon";
  return "valid";
}

const STATUS: Record<Status, { icon: string; label: string }> = {
  valid: { icon: "✓", label: "Up to date" },
  "due-soon": { icon: "!", label: "Due soon" },
  expired: { icon: "✕", label: "Expired" },
};

const CAT_LABEL: Record<Cat, string> = { mot: "MOT", tax: "Tax" };

let idSeq = 0;
const newId = (p = "car") => `${p}-${Date.now()}-${idSeq++}`;

const carName = (c: Car) => `${c.make} ${c.model}`;

const fromLookup = (v: VehicleResult): Car => ({
  ...v,
  mot: { ...v.mot, source: "official", official: v.mot.date },
  tax: { ...v.tax, source: "official", official: v.tax.date },
  id: newId(),
  source: "lookup",
  reminders: false,
  off: {},
  snoozed: {},
  documents: [],
});

const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

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

function StatusRow({
  title,
  info,
  onClick,
  note,
}: {
  title: string;
  info: DateInfo;
  onClick?: () => void;
  note?: ReactNode;
}) {
  const s = STATUS[info.status];
  const verb = info.status === "expired" ? "Expired" : title === "MOT" ? "Expires" : "Due";
  const inner = (
    <>
      <div>
        <div className="status-title">{title}</div>
        <div className="status-date">
          {verb} {fmtDate(info.date)}
        </div>
        <span className="tag tag-inline">{info.source === "owner" ? "Owner-added" : "Sample data"}</span>
        {note}
      </div>
      <span className={`pill pill-${info.status}`}>
        <span aria-hidden="true">{s.icon}</span> {s.label}
      </span>
    </>
  );
  return onClick ? (
    <button type="button" className="status-row as-button" onClick={onClick} aria-label={`${title}: manage reminder`}>
      {inner}
    </button>
  ) : (
    <div className="status-row">{inner}</div>
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

function Dates({ car, onManage }: { car: Car; onManage?: (cat: Cat) => void }) {
  if (!car.mot || !car.tax) {
    return <p className="muted note">No MOT or tax data. Add the dates yourself once the car is saved.</p>;
  }
  const offNote = (cat: Cat) =>
    car.off[cat] ? (
      <p className="inline-note">
        {CAT_LABEL[cat]} reminders are off for {carName(car)}. You’ll still see the due date here and on Home.
      </p>
    ) : car.snoozed[cat] ? (
      <p className="inline-note">Snoozed until {fmtDate(car.snoozed[cat]!)}</p>
    ) : null;
  return (
    <>
      <StatusRow title="MOT" info={car.mot} onClick={onManage && (() => onManage("mot"))} note={offNote("mot")} />
      <StatusRow title="Tax" info={car.tax} onClick={onManage && (() => onManage("tax"))} note={offNote("tax")} />
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
      setFlow({ name: "confirm", car: fromLookup(v) });
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
      off: {},
      snoozed: {},
      documents: [],
    };
    if (signedIn) onDone(car);
    else setFlow({ name: "signup", car });
  }

  const afterConfirm = (car: Car) => (signedIn ? onDone(car) : setFlow({ name: "signup", car }));

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

  // signup
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
            onClick={() => onDone(flow.car)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="source">Prototype: no account is created.</p>
    </div>
  );
}

/* ---------- Signed-in screens ---------- */

type DueItem = { car: Car; label: "MOT" | "Tax"; status: Status; date: string };

function dueItems(cars: Car[]): DueItem[] {
  const items: DueItem[] = [];
  for (const car of cars) {
    if (car.mot) items.push({ car, label: "MOT", status: car.mot.status, date: car.mot.date });
    if (car.tax) items.push({ car, label: "Tax", status: car.tax.status, date: car.tax.date });
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
  onManage,
  onAddDocument,
}: {
  car: Car;
  onToggleReminders: () => void;
  onFlash: (m: string) => void;
  onRemove: () => void;
  onManage: (cat: Cat) => void;
  onAddDocument: () => void;
}) {
  return (
    <div className="card">
      <CarHeader car={car} />
      <Dates car={car} onManage={onManage} />
      <div className="status-row">
        <div>
          <div className="status-title">Reminders</div>
          <div className="status-date">
            {car.reminders ? `On · ${car.channel === "email" ? "email · " : ""}2 weeks before` : "Off"}
          </div>
        </div>
        <button className="btn-small" type="button" onClick={onToggleReminders}>
          {car.reminders ? "Turn off" : "Turn on"}
        </button>
      </div>
      {car.documents.length > 0 && (
        <div className="docs">
          <div className="status-title">Documents</div>
          <ul>
            {car.documents.map((d) => (
              <li key={d.id}>
                <IconPdf /> <span>{d.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="tiles">
        {["Set insurance date", "Set service date"].map((t) => (
          <button key={t} className="tile" type="button" onClick={() => onFlash(`${t}: coming in the app`)}>
            <span aria-hidden="true">＋</span> {t}
          </button>
        ))}
        <button className="tile" type="button" onClick={onAddDocument}>
          <span aria-hidden="true">＋</span> Add a document
        </button>
      </div>
      <button className="link danger" type="button" onClick={onRemove}>
        Remove this car
      </button>
    </div>
  );
}

/* ---------- Task screens opened from reminder actions (Figma J5 06–08, 11; J2 06) ---------- */

function DateField({ id, label, hint, value, onChange }: { id: string; label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <p id={`${id}-hint`} className="field-hint">
        {hint}
      </p>
      <input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={`${id}-hint`} />
    </div>
  );
}

function TaskScreen({
  car,
  view,
  setView,
  onSave,
  onCheckOfficial,
  onAddCertificate,
}: {
  car: Car;
  view: Extract<View, { kind: "task" }>;
  setView: (v: View) => void;
  onSave: (date: string, source: "official" | "owner", after: TaskStep | "vehicle") => void;
  onCheckOfficial: () => void;
  onAddCertificate: () => void;
}) {
  const label = CAT_LABEL[view.cat];
  const info = car[view.cat]!;
  const set = (patch: Partial<Extract<View, { kind: "task" }>>) => setView({ ...view, ...patch });

  if (view.step === "update") {
    const save = () => {
      if (!view.draft) return;
      if (info.official && view.draft !== info.official) set({ step: "compare", choice: "official" });
      else onSave(view.draft, info.official && view.draft === info.official ? "official" : "owner", "vehicle");
    };
    return (
      <div className="task">
        <DateField
          id="due"
          label={`${label} due date`}
          hint={view.cat === "mot" ? "Use the date on your latest MOT certificate" : "Use the date on your latest tax reminder"}
          value={view.draft}
          onChange={(v) => set({ draft: v })}
        />
        {info.official && (
          <>
            <button className="link" type="button" onClick={onCheckOfficial}>
              Check with {view.cat === "mot" ? "DVSA" : "DVLA"} instead
            </button>
            <p className="muted small">
              If your date is different from {view.cat === "mot" ? "DVSA" : "DVLA"}’s, we’ll show both and you choose.
            </p>
          </>
        )}
        <div className="task-foot">
          <button className="btn-primary" type="button" onClick={save} disabled={!view.draft}>
            Save date
          </button>
        </div>
      </div>
    );
  }

  if (view.step === "compare" && info.official) {
    const opts: Array<{ k: "official" | "owner"; date: string; tag: string; sub: string }> = [
      { k: "official", date: info.official, tag: "Sample data", sub: `From ${view.cat === "mot" ? "DVSA" : "DVLA"} (sample), retrieved ${car.retrievedAt ? fmtDate(car.retrievedAt) : "today"}` },
      { k: "owner", date: view.draft, tag: "Owner-added", sub: "You entered this today" },
    ];
    return (
      <div className="task">
        <h2 className="task-title">Which {label} date should we use?</h2>
        <div className="choices" role="radiogroup" aria-label={`${label} date`}>
          {opts.map((o) => (
            <button
              key={o.k}
              type="button"
              role="radio"
              aria-checked={view.choice === o.k}
              className={`choice ${view.choice === o.k ? "selected" : ""}`}
              onClick={() => set({ choice: o.k })}
            >
              <span className="radio" aria-hidden="true" />
              <span>
                <span className="choice-date">{fmtDate(o.date)}</span>
                <span className="tag tag-inline">{o.tag}</span>
                <span className="choice-sub">{o.sub}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="muted small">Until you choose, reminders follow the earlier date.</p>
        <div className="task-foot">
          <button
            className="btn-primary"
            type="button"
            onClick={() => onSave(view.choice === "owner" ? view.draft : info.official!, view.choice === "owner" ? "owner" : "official", "vehicle")}
          >
            Use this date
          </button>
        </div>
      </div>
    );
  }

  if (view.step === "done") {
    return (
      <div className="task">
        <div className="all-clear-block">
          <span className="all-clear-icon">
            <IconDone />
          </span>
          <h2 className="task-title">{label} marked as done</h2>
          <p className="muted">Nice one. Want to keep the certificate or invoice with {carName(car)}?</p>
        </div>
        <div className="task-foot">
          <button className="btn-primary" type="button" onClick={onAddCertificate}>
            Add certificate or invoice
          </button>
          <button className="btn-secondary" type="button" onClick={() => set({ step: "next", draft: addYears(info.date, 1) })}>
            Not now
          </button>
        </div>
      </div>
    );
  }

  if (view.step === "next") {
    return (
      <div className="task">
        <h2 className="task-title">When is the next {label} due?</h2>
        <DateField
          id="next"
          label={`Next ${label} due`}
          hint={view.cat === "mot" ? "Usually a year after this one. It’s on your new certificate." : "Usually a year after this one."}
          value={view.draft}
          onChange={(v) => set({ draft: v })}
        />
        <div className="task-foot">
          <button className="btn-primary" type="button" disabled={!view.draft} onClick={() => onSave(view.draft, "owner", "uptodate")}>
            Save and set reminder
          </button>
        </div>
      </div>
    );
  }

  // uptodate
  return (
    <div className="card">
      <div className="all-clear-block">
        <span className="all-clear-icon">
          <IconDone />
        </span>
        <h2 className="task-title">You’re up to date</h2>
        <p className="muted">
          We'll remind you 2 weeks before your next {label} on {fmtDate(info.date)}.
        </p>
      </div>
      <StatusRow title={label} info={info} />
    </div>
  );
}

/* ---------- App ---------- */

const TITLES: Record<Tab, string> = { home: "Home", garage: "My Garage", account: "Account" };

export default function App() {
  const [cars, setCars] = useState<Car[]>([]);
  const [view, setView] = useState<View>({ kind: "onboarding", flow: { name: "entry" } });
  const [toast, setToast] = useState<Toast | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [sheetClosing, setSheetClosing] = useState(false);
  const toastTimer = useRef<number>(0);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const flash = (msg: string, action?: Toast["action"]) => {
    window.clearTimeout(toastTimer.current);
    setToast({ msg, action });
    toastTimer.current = window.setTimeout(() => setToast(null), action ? 5000 : 2500);
  };

  const updateCar = (id: string, fn: (c: Car) => Car) => setCars((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));

  const openSheet = (s: Sheet) => {
    setSheetClosing(false);
    setSheet(s);
  };
  const closeSheet = (after?: () => void) => {
    setSheetClosing(true);
    window.setTimeout(() => {
      setSheet(null);
      setSheetClosing(false);
      after?.();
    }, reduceMotion() ? 0 : SHEET_CLOSE_MS);
  };

  const signedIn = view.kind !== "onboarding";
  const activeTab: Tab | null = view.kind === "tab" ? view.tab : view.kind === "onboarding" ? null : view.from;

  const openVehicle = (id: string, from: Tab) => setView({ kind: "vehicle", id, from });
  const startAdd = (from: Tab) => setView({ kind: "add", flow: { name: "entry" }, from });
  const viewOnHome = { label: "View on Home", run: () => setView({ kind: "tab", tab: "home" }) };

  const savedMsg = (car: Car) => `${car.registration || carName(car)} saved to your garage`;

  // J1: after saving, the vehicle page appears and the reminder offer slides up 0.6s later —
  // only when there is a real MOT or tax date to remind about.
  const saveCar = (car: Car) => {
    setCars((cs) => [...cs, car]);
    setView({ kind: "vehicle", id: car.id, from: "garage" });
    if (car.mot || car.tax) window.setTimeout(() => openSheet({ kind: "offer", carId: car.id, step: "offer" }), 600);
    else flash(savedMsg(car));
  };

  const restart = () => {
    setCars([]);
    setSheet(null);
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
      default:
        return null;
    }
  };

  /* ----- Sheet content ----- */

  const sheetCar = sheet ? cars.find((c) => c.id === sheet.carId) : undefined;

  function renderSheet(): ReactNode {
    if (!sheet || !sheetCar) return null;
    const car = sheetCar;

    if (sheet.kind === "offer") {
      const notNow = () => closeSheet(() => flash(savedMsg(car)));
      if (sheet.step === "offer") {
        const first = [car.mot && { cat: "mot" as Cat, ...car.mot }, car.tax && { cat: "tax" as Cat, ...car.tax }]
          .filter(Boolean)
          .sort((a, b) => (a as DateInfo).date.localeCompare((b as DateInfo).date))[0] as (DateInfo & { cat: Cat });
        const what = first.cat === "mot" ? "MOT" : "tax";
        return (
          <div className="sheet-body">
            <button
              type="button"
              className="notif-preview"
              onClick={() => openSheet({ ...sheet, step: "blocked" })}
              aria-label="Notification preview. Prototype: tap to see what happens if notifications are blocked."
            >
              <span className="notif-icon" aria-hidden="true">
                AD
              </span>
              <span className="notif-text">
                <span className="notif-app">APEX DREAMS</span>
                <span className="notif-msg">
                  {carName(car)} {car.registration}: {first.cat === "mot" ? "MOT" : "Tax"} due {fmtShort(first.date)}. Source:{" "}
                  {first.cat === "mot" ? "DVSA" : "DVLA"} (sample data).
                </span>
              </span>
            </button>
            <h2 id="sheet-title" className="sheet-title">
              Remind you 2 weeks before your {what} on {fmtShort(first.date)}?
            </h2>
            <p className="sheet-text">
              We’ll remind you about MOT and tax for this car. You can change this anytime in reminder settings.
            </p>
            <div className="sheet-actions">
              <button
                className="btn-primary"
                type="button"
                onClick={() => {
                  updateCar(car.id, (c) => ({ ...c, reminders: true, channel: "push" }));
                  closeSheet(() => flash("Reminders on for MOT and tax"));
                }}
              >
                Remind me
              </button>
              <button className="btn-secondary" type="button" onClick={notNow}>
                Not now
              </button>
            </div>
            <p className="source">Prototype: tap the notification to see what happens if notifications are blocked.</p>
          </div>
        );
      }
      return (
        <div className="sheet-body">
          <span className="icon-tile" aria-hidden="true">
            <IconBellOff />
          </span>
          <h2 id="sheet-title" className="sheet-title">
            Notifications are off for APEX DREAMS
          </h2>
          <p className="sheet-text">
            To get reminders, open your phone's Settings, tap Notifications, then APEX DREAMS, and turn on Allow
            Notifications. Or we can email you instead.
          </p>
          <div className="sheet-actions">
            <button className="btn-primary" type="button" onClick={notNow}>
              Open Settings
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => {
                updateCar(car.id, (c) => ({ ...c, reminders: true, channel: "email" }));
                closeSheet(() => flash("Reminders on for MOT and tax"));
              }}
            >
              Email me instead
            </button>
          </div>
        </div>
      );
    }

    if (sheet.kind === "docs") {
      const pick = (key: string) => fileInputs.current[key]?.click();
      return (
        <>
          <SheetHeader id="sheet-title" title={`Add invoice to ${carName(car)}`} onClose={() => closeSheet()} />
          <div className="sheet-rows">
            <SheetRow icon={<IconScan />} label="Scan document" onClick={() => pick("scan")} />
            <SheetRow icon={<IconCamera />} label="Take photo" onClick={() => pick("camera")} />
            <SheetRow icon={<IconPhotos />} label="Choose from photos" onClick={() => pick("photos")} />
            <SheetRow icon={<IconPdf />} label="Choose a PDF" onClick={() => pick("pdf")} />
          </div>
        </>
      );
    }

    // Reminder actions (J5)
    const info = car[sheet.cat];
    if (!info) return null;
    const label = CAT_LABEL[sheet.cat];
    if (sheet.step === "menu") {
      const active = car.reminders && !car.off[sheet.cat];
      const toTask = (step: TaskStep, draft: string) =>
        closeSheet(() => {
          setToast(null);
          setView({ kind: "task", id: car.id, cat: sheet.cat, step, draft, from: activeTab ?? "garage" });
        });
      return (
        <>
          <SheetHeader id="sheet-title" title={`${carName(car)} · ${label} due ${fmtShort(info.date)}`} onClose={() => closeSheet()} />
          <div className="sheet-rows">
            <SheetRow icon={<IconCalendar />} label="Update date" onClick={() => toTask("update", info.date)} />
            <SheetRow icon={<IconDone />} label="Mark as done" onClick={() => toTask("done", info.date)} />
            {active && (
              <SheetRow
                icon={<IconSnooze />}
                label="Snooze"
                onClick={() => openSheet({ ...sheet, step: "snooze", snooze: "tomorrow", pick: addDays(todayIso(), 3) })}
              />
            )}
            {active ? (
              <SheetRow
                icon={<IconTurnOff />}
                label="Turn off this reminder"
                destructive
                onClick={() => {
                  const cat = sheet.cat;
                  updateCar(car.id, (c) => ({ ...c, off: { ...c.off, [cat]: true } }));
                  closeSheet(() =>
                    flash(`Reminder off for ${carName(car)} ${label}`, {
                      label: "Undo",
                      run: () => {
                        updateCar(car.id, (c) => ({ ...c, off: { ...c.off, [cat]: false } }));
                        setToast(null);
                      },
                    }),
                  );
                }}
              />
            ) : (
              <SheetRow
                icon={<IconSnooze />}
                label="Turn on this reminder"
                onClick={() => {
                  const cat = sheet.cat;
                  updateCar(car.id, (c) => ({ ...c, reminders: true, channel: c.channel ?? "push", off: { ...c.off, [cat]: false } }));
                  closeSheet(() => flash(`${label} reminder on for ${carName(car)}`));
                }}
              />
            )}
          </div>
        </>
      );
    }

    // Snooze (sheet-to-sheet)
    const until = sheet.snooze === "tomorrow" ? addDays(todayIso(), 1) : sheet.snooze === "week" ? addDays(todayIso(), 7) : sheet.pick;
    const btn = sheet.snooze === "tomorrow" ? "Snooze until tomorrow" : sheet.snooze === "week" ? "Snooze until next week" : `Snooze until ${fmtShort(sheet.pick)}`;
    const chips: Array<{ k: Snooze; t: string }> = [
      { k: "tomorrow", t: "Tomorrow" },
      { k: "week", t: "Next week" },
      { k: "pick", t: "Pick a date" },
    ];
    return (
      <div className="sheet-body">
        <h2 id="sheet-title" className="sheet-title">
          Remind me again
        </h2>
        <div className="chips" role="radiogroup" aria-label="Snooze until">
          {chips.map((c) => (
            <button
              key={c.k}
              type="button"
              role="radio"
              aria-checked={sheet.snooze === c.k}
              className={`chip ${sheet.snooze === c.k ? "selected" : ""}`}
              onClick={() => openSheet({ ...sheet, snooze: c.k })}
            >
              {sheet.snooze === c.k && <IconCheck />}
              {c.t}
            </button>
          ))}
        </div>
        {sheet.snooze === "pick" && (
          <DateField
            id="snooze-date"
            label="Remind me on"
            hint="We'll send it at 9am."
            value={sheet.pick}
            onChange={(v) => openSheet({ ...sheet, pick: v })}
          />
        )}
        <div className="sheet-actions">
          <button
            className="btn-primary"
            type="button"
            disabled={!until}
            onClick={() => {
              const cat = sheet.cat;
              const prev = car.snoozed[cat];
              updateCar(car.id, (c) => ({ ...c, snoozed: { ...c.snoozed, [cat]: until } }));
              closeSheet(() =>
                flash(
                  sheet.snooze === "tomorrow" ? "We'll remind you again tomorrow at 9am" : `We'll remind you again on ${fmtDate(until)} at 9am`,
                  {
                    label: "Undo",
                    run: () => {
                      updateCar(car.id, (c) => ({ ...c, snoozed: { ...c.snoozed, [cat]: prev } }));
                      setToast(null);
                    },
                  },
                ),
              );
            }}
          >
            {btn}
          </button>
        </div>
      </div>
    );
  }

  function onFile(key: string, files: FileList | null) {
    const file = files?.[0];
    const s = sheet;
    if (fileInputs.current[key]) fileInputs.current[key]!.value = "";
    if (!file || !s || s.kind !== "docs" || !sheetCar) return;
    const car = sheetCar;
    updateCar(car.id, (c) => ({ ...c, documents: [...c.documents, { id: newId("doc"), name: file.name }] }));
    closeSheet(() => flash(`Saved to ${carName(car)}`, viewOnHome));
  }

  /* ----- Screens ----- */

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
        onToggleReminders={() => updateCar(car.id, (c) => ({ ...c, reminders: !c.reminders, channel: c.channel ?? "push" }))}
        onRemove={() => {
          setCars((cs) => cs.filter((c) => c.id !== car.id));
          setView({ kind: "tab", tab: "garage" });
          flash("Car removed");
        }}
        onManage={(cat) => openSheet({ kind: "actions", carId: car.id, cat, step: "menu", snooze: "tomorrow", pick: "" })}
        onAddDocument={() => openSheet({ kind: "docs", carId: car.id })}
      />
    ) : null;
  } else if (view.kind === "task") {
    const car = cars.find((c) => c.id === view.id);
    const label = CAT_LABEL[view.cat];
    const toVehicle = () => setView({ kind: "vehicle", id: view.id, from: view.from });
    const titles: Record<TaskStep, string> = {
      update: `Update ${label} date`,
      compare: `${label} date`,
      done: `${label} done`,
      next: `Next ${label}`,
      uptodate: car ? carName(car) : "",
    };
    const isBack = view.step === "compare" || view.step === "uptodate";
    top = (
      <TopBar
        type={isBack ? "back" : "close"}
        title={titles[view.step]}
        onLeft={() => (view.step === "compare" ? setView({ ...view, step: "update" }) : toVehicle())}
      />
    );
    body = car ? (
      <TaskScreen
        car={car}
        view={view}
        setView={setView}
        onSave={(date, source, after) => {
          const cat = view.cat;
          updateCar(car.id, (c) => ({
            ...c,
            [cat]: { ...c[cat]!, date, source, status: statusFor(date) },
            snoozed: { ...c.snoozed, [cat]: undefined },
          }));
          if (after === "uptodate") {
            setToast(null);
            setView({ ...view, step: "uptodate", draft: date });
          }
          else {
            toVehicle();
            flash(`Saved to ${carName(car)}`, viewOnHome);
          }
        }}
        onCheckOfficial={() => {
          const cat = view.cat;
          updateCar(car.id, (c) => ({
            ...c,
            [cat]: { ...c[cat]!, date: c[cat]!.official!, source: "official", status: statusFor(c[cat]!.official!) },
          }));
          setView({ ...view, step: "uptodate" });
        }}
        onAddCertificate={() => {
          toVehicle();
          window.setTimeout(() => openSheet({ kind: "docs", carId: car.id }), 0);
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
  const inTaskFlow = view.kind === "add" || (view.kind === "task" && view.step !== "uptodate");
  const showTabs = signedIn && !inTaskFlow;

  const sheetKey = sheet ? `${sheet.kind}-${"step" in sheet ? sheet.step : ""}` : "";

  return (
    <div className="app">
      {top}
      <main
        className={`main ${showTabs ? "with-tabs" : ""}`}
        key={JSON.stringify([view.kind, "tab" in view ? view.tab : "", "id" in view ? view.id : "", "step" in view ? view.step : ""])}
      >
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
      {toast && !sheet && (
        <div className={`toast ${showTabs ? "above-tabs" : ""}`} role="status">
          <span className="toast-icon" aria-hidden="true">
            <IconDone />
          </span>
          <span className="toast-msg">{toast.msg}</span>
          {toast.action && (
            <button type="button" className="toast-action" onClick={toast.action.run}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}
      {sheet && sheetCar && (
        <BottomSheet closing={sheetClosing} onDismiss={() => {
          if (sheet.kind === "offer") closeSheet(() => flash(savedMsg(sheetCar)));
          else closeSheet();
        }} labelledBy="sheet-title" contentKey={sheetKey}>
          {renderSheet()}
        </BottomSheet>
      )}
      {/* File pickers for the add-invoice sheet (Figma J2/J3 08). Nothing is uploaded; the file name is kept in this tab. */}
      <div hidden>
        <input ref={(el) => { fileInputs.current.scan = el; }} type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => onFile("scan", e.target.files)} />
        <input ref={(el) => { fileInputs.current.camera = el; }} type="file" accept="image/*" capture="environment" onChange={(e) => onFile("camera", e.target.files)} />
        <input ref={(el) => { fileInputs.current.photos = el; }} type="file" accept="image/*" onChange={(e) => onFile("photos", e.target.files)} />
        <input ref={(el) => { fileInputs.current.pdf = el; }} type="file" accept="application/pdf" onChange={(e) => onFile("pdf", e.target.files)} />
      </div>
    </div>
  );
}
