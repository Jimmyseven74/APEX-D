# APEX DREAMS — web front door

Public registration and MOT/tax check page for APEX DREAMS Digital Garage. It hands users off to the native app (see PRD V1.2, open decisions 12–14).

**Status:** preview. The lookup uses demo data (`src/lookup.ts`); there's no live DVLA/DVSA integration yet. Try `AB12 CDE` or `CD34 EFG`.

## Run locally

```bash
npm install
npm run dev
```

## Deploy

Vercel: import this repo; it detects Vite (build `npm run build`, output `dist`). Pushes to `main` deploy automatically.

## Notes

- Colour tokens in `src/styles.css` are placeholders; swap them for the exact values in Brand & Product Guidelines V0.1.
- Inter is a provisional typeface.
