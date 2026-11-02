# Denwork — Farm Work Companion

A dark, cozy, mobile-first work companion for routines, crop labels, tasks, paychecks, and savings.

## Current browser-side features
- Task board with editable titles, sources, due dates, priorities, filters, and archive actions
- Weekly editable farm routines with per-day add, edit, reorder, and checklist progress
- Product label search, missing/full-sheet filters, and custom varieties
- Printer-friendly Wednesday harvest, Thursday delivery, and Friday harvest run-sheet
- Local reference-image drawer for routine notes and unclear source-photo items
- Paycheck log, $25 personal allowance, multiple individually funded savings goals, monthly/yearly summaries, and task/paycheck reconciliation
- Local note/message task drafting, crop reference guidance for all 20 varieties, and paycheck/receipt text extraction
- JSON backup and restore for the app's local data
- Browser local storage; no account or server connection is required for these local features

## AI and cloud integration boundary
The helper screens currently use local parsing rules and a built-in crop reference guide. They do not call a hosted AI model. Firebase, Firestore, cloud sync, database schemas/rules, and backend AI endpoints are intentionally not implemented here so they can be added separately in Google AI Studio.

## Run locally
```bash
npm install
npm run dev
``

## Build
```bash
npm run build
``

All extracted tasks and paycheck values are drafts until reviewed. Crop guidance is a starting reference only; follow the farm's written procedures and seed supplier directions for operational decisions.
