# Handoff: fleet_online — read-only cloud Fleet_Mainsail on Vercel

Implementation handoff. Written 2026-07-22 after planning with the owner (Azi). This repo (branch `Fleet_online`) is the Fleet_Mainsail fork; the goal is deploying it on Vercel as a **read-only, two-site** cloud app backed by the Neon aggregate that both sites' fleet_daemons already populate. Companion docs in the fleet_daemon repo: `MULTISITE_HANDOFF.md` (§6.5 scope, §6.8 dedup, §6.10–6.13) and `ARCHITECTURE.md`.

## 1. Context — what already exists and works

- Two fleet sites run `fleet_daemon` (Python, port 8090): site ids **`pantheonfleet`** (~33 printers) and **`sf`** (~16). Both sync outbound to one **Neon** Postgres (project endpoint `ep-sparkling-frost-awij5z4z`, us-east-1, PG 18): live status every 30s, print history every 60s, map metadata / spool / gcode-listing mirrors on change. Deployed and verified in production 2026-07-22/23. As of 2026-07-23 **fleet_daemon's Track 2 is also done**: each site's gcode library lives on its Synology NAS, a directory watcher mirrors the library listing to Neon's `cloud_gcode_files`, and the two NASes are being paired with ShareSync (two-way library replication).
- This frontend, running locally at each site, talks to its site's fleet_daemon over HTTP + WS (`src/plugins/fleetDaemonClient.ts`). The complete daemon⇄frontend contract was inventoried 2026-07-22 — the relevant read surface is reproduced in §4 below.
- Owner accounts: Vercel ready; Neon Launch plan. The Neon endpoint is kept awake 24/7 by the daemons (~$19/mo fixed) — **browser reads are marginal-zero cost**, so live polling is fine (see §6.5 cost note in MULTISITE_HANDOFF.md).

## 2. Decisions (owner-made, do not re-litigate)

| Decision | Choice |
|---|---|
| App | THIS repo/branch deployed on Vercel — not a rebuilt dashboard. UI works "exactly like Fleet_Mainsail". |
| Write access | **Strictly read-only.** No data insertion, no add-printer, no QC/QR edits, no gcode/spool mutations, no reconnect/refresh triggers. Hide or disable all write UI (§5.4). |
| Two sites | **Site tabs** (`pantheonfleet` / `sf`). Each tab shows that site's own maps + panels exactly like local Mainsail. History/parts search gets a `site` filter with an "all sites" option. |
| v1 panels | Farm map + printer status + history/jobs + **parts search** + **analytics (jobs + parts)** + **spool list (read-only)** + **gcode library browser (read-only listing)** — the owner approved the gcode browser "ships with Track 2", and Track 2 landed 2026-07-23 (`cloud_gcode_files` is live). No download-queue view, no file contents/downloads, no mutations. Archive panel hidden (file downloads impossible cross-site — bytes live on site NASes, no inbound path). |
| Live feed | 30s polling while the tab is **visible** (`document.visibilityState`), paused when hidden. No WebSocket (Vercel serverless). 30–60s staleness accepted. |
| Auth | Shared password → sha256(password + static salt) token in an httpOnly cookie; all `/api/*` except login require it. SPA static assets may stay public. |
| Future (do NOT build) | Job-start at either site via a Neon command queue the daemons poll outbound (fleet_daemon §6.13); archive file relay. |

## 3. Architecture

```
Browser (Vue SPA, this repo, static on Vercel CDN)
   │  30s poll + on-demand GETs, cookie-authed
   ▼
/api/* — Vercel serverless functions (TypeScript, @neondatabase/serverless)
   │  read-only parameterized SQL
   ▼
Neon (cloud_sites, cloud_fleet_status, cloud_print_history[+dedup view],
      cloud_remoteprinters, cloud_gcode_files, cloud_vendor/filament/spool)
```

The adapter serves the **same response shapes** the frontend already consumes from fleet_daemon, so frontend changes are confined to: transport (polling client), site tabs, read-only chrome, auth, and per-site floor geometry.

## 4. Neon schema (what the adapter reads)

- **`cloud_sites`** `(site PK, last_heartbeat, printer_count, daemon_started_at)`. Site offline = `now() - last_heartbeat > 90s` (derive in SQL; daemons never write "offline").
- **`cloud_fleet_status`** `(site, printer_hostname, printer_model, payload JSONB, updated_at)` PK `(site, printer_hostname)`. `payload` is exactly the slim WS shape the UI already consumes: `{print_stats:{state,filename}, virtual_sdcard:{progress}, toolhead:{filament_type,nozzle_size,remaining_weight,used_weight}, webhooks:{state,state_message}, fleet_to_printer_ws}`.
- **`cloud_print_history`** `(site, id UUID, <every fleet_print_history column>, synced_at)` PK `(site,id)`. Base rows have `qr_code IS NULL`; part rows have unique non-null `qr_code`. Indexed: `(site, start_time DESC)`, `(qr_code)`, `(status)`, `(qc_status)`.
- **`cloud_remoteprinters`** `(site, printer_id, meta JSONB, updated_at)` PK `(site, printer_id)`. `meta` = the verbatim GUI record: `{hostname, port, position:{x,y}, gridPosition:{x,y}, printerModel, location:'farm'|'ground', settings}` — this is what `src/store/gui/remoteprinters` holds locally.
- **`cloud_gcode_files`** `(site PK, listing JSONB, updated_at)`. `listing` = array of `{filename (relative path), is_directory, size, modified_epoch}` covering the whole library tree, refreshed by each daemon's directory watcher within ~60s of any change (including files arriving via ShareSync from the other site).
- **`cloud_vendor` / `cloud_filament` / `cloud_spool`** `(site, id INT, data JSONB, synced_at)` PK `(site,id)`. `data` = `row_to_json` of the local row. Spool fields the UI reads: `id, qr_code, initial_weight, used_weight, remaining_weight, loaded_on_printer, location, lot_nr, archived, filament_id`; filament: `id, vendor_id, name, material, color_hex, ...`; vendor: `id, name`.

**Dedup view (create once in Neon — DDL below, from fleet_daemon §6.8):** a printer that moved sites carries duplicate history. Keep the earliest-collected copy of each base row, attribute to the printer's *current* site for display:

```sql
CREATE OR REPLACE VIEW cloud_print_history_deduped AS
WITH base AS (
    SELECT DISTINCT ON (printer_hostname, moonraker_job_id) *
    FROM cloud_print_history
    WHERE qr_code IS NULL
    ORDER BY printer_hostname, moonraker_job_id, collected_at ASC
),
parts AS (
    SELECT * FROM cloud_print_history WHERE qr_code IS NOT NULL
),
merged AS (
    SELECT * FROM base UNION ALL SELECT * FROM parts
)
SELECT m.*,
       COALESCE(cfs.site, m.site) AS display_site
FROM merged m
LEFT JOIN cloud_fleet_status cfs
       ON cfs.printer_hostname = m.printer_hostname;
```
(Implementing agent: verify this DDL before creating it — the intent is authoritative, the exact SQL is a sketch. `cloud_fleet_status` holds each printer under exactly one site, since each site's daemon prunes printers it no longer manages. All history/parts/analytics queries go through this view; site filtering uses `display_site`.)

## 5. Implementation

### 5.1 Vercel project + repo mechanics

- Vue 2.7 + **Vite 4** + Vuex 3 + Vuetify 2. Vercel build command: `vite build` (NOT the npm `build` script — it appends a 7z `build.zip` step that will fail/waste time on Vercel), output dir `dist`.
- Serverless functions live in `/api/*.ts` at repo root (Vercel convention; auto-detected next to the static build). Use `@neondatabase/serverless` (`neon()` HTTP driver — correct for short-lived functions; the daemon-side "direct non-pooler" rule does NOT apply here).
- Env vars: `DATABASE_URL` (Neon), `DASHBOARD_PASSWORD`, `AUTH_SALT` (any fixed random string).
- SPA routing: add a `vercel.json` rewrite of non-`/api` paths to `index.html`.

### 5.2 Auth

- `POST /api/login {password}` → compare against `DASHBOARD_PASSWORD`; on match set httpOnly cookie `fleet_online = sha256(password + AUTH_SALT)`, 30d expiry, `Secure`, `SameSite=Lax`.
- Every other `/api/*` handler: shared guard that recomputes the expected token and 401s on mismatch. Frontend: on any 401, route to a new `/login` page (simple Vuetify password form).

### 5.3 The adapter API (serve fleet_daemon's read shapes from Neon)

| Route | Backs | Notes |
|---|---|---|
| `GET /api/sites` | (new) | `cloud_sites` + derived `online` bool; drives the site tabs + offline badge. |
| `GET /api/status?site=` | WS `{hostname, update}` stream | Returns `{site, online, printers: [{hostname, printer_model, payload}], remoteprinters: {printer_id: meta}}` from `cloud_fleet_status` + `cloud_remoteprinters`. One query pair; the polling client (§5.5) diffs for removals. |
| `GET /api/history?...` | `GET /history` | Same params the UI sends: `printer, status, qr_code, has_qr_code, filename, printer_model, qc_status, moonraker_job_id, spool_qr_code, gcode_archive_hash, limit, offset` **plus `site`** (omit/`all` = both). Same response `{records, total}`. Query the dedup view; `has_qr_code` maps to `qr_code IS [NOT] NULL`; `filename` is ILIKE. Include `parts_count` per base row (subquery count of part rows with same `(printer_hostname, moonraker_job_id)`) — the UI reads it. |
| `GET /api/history/analytics?days=&site=` | `GET /history/analytics` | Response shape: `src/store/fleet/history/types.ts:107-117` (`kpis, monthly_summary, filament_summary, monthly_filament, printer_health, status_summary, weekly_success_rate, daily_utilization, model_summary`). Port the aggregation SQL from fleet_daemon `main.py` `get_history_analytics` (line ~914) against the dedup view + site filter. |
| `GET /api/history/analytics/parts?days=&site=` | `GET /history/analytics/parts` | Shape: `types.ts:199-211`; port from `main.py` `get_part_analytics` (~1140). Part rows only (`qr_code IS NOT NULL`). |
| `GET /api/history/inspectors` | same | `SELECT DISTINCT qc_inspector ... WHERE qc_inspector IS NOT NULL`. |
| `GET /api/spool/vendors?site=`, `/api/spool/filaments?site=`, `/api/spool/spools?site=` | `GET /spool/*` lists | Unpack `data` JSONB from the mirrors; reproduce the joined shapes the panels render (spool rows joined with filament name/material/color + vendor name — join in SQL on `(site, filament_id)` / `(site, vendor_id)`). |
| `GET /api/spool/lookup/:qr?site=` | `GET /spool/lookup/{qr}` | Return `{spool}` with nested `filament.vendor` like the local endpoint; used by part-detail. QR codes are globally unique so `site` is optional. |
| `GET /api/gcodes?site=&path=` | `GET /gcodes` | Serve from `cloud_gcode_files.listing`: filter the flat tree to one directory level for `path`; return the local endpoint's shape (`{files, storage_available: true}`, mapping `modified_epoch` → the `modified`/`age_days` fields the panel renders; `cached_on` always `[]`, `disk_usage` null). Read-only browsing only — all GcodefilesPanel actions are hidden by the read-only flag (§5.4). |

Read-only: implement **no** POST/PATCH/DELETE besides `/api/login`.

### 5.4 Frontend: read-only mode

Build-time flag `VUE_APP_FLEET_READONLY=1` (set in Vercel env). When set, hide/disable every write surface (inventoried 2026-07-22): QC editing + QC mode + add-part/QR-link + delete-part (FleetPartsPanel, FleetHistoryListPanel), history collect trigger, archive sweep + the whole Archive panel (v1), all gcode mutations + upload + push + download-queue actions and the queue display (GcodefilesPanel stays visible as a read-only library browser fed by `/api/gcodes`), all spool/filament/vendor create/edit/archive/destroy (SpoolListPanel becomes display-only), `reconnect_all` button (FleetPrinterStatusPanel), Settings → Remote Printers add/edit/remove, and map **drag-to-place** (FarmMapSection `updateOnDrag` — render positions, never write).

### 5.5 Frontend: transport + site tabs

- New `src/plugins/fleetCloudClient.ts` replacing `fleetDaemonClient.ts` when a `VUE_APP_FLEET_CLOUD=1` flag is set (keep the local client working on this branch for side-by-side dev): polls `/api/status?site=<active>` every 30s **only while `document.visibilityState === 'visible'`** (poll immediately on `visibilitychange` back to visible). For each printer, commit the same `farm/SET_FLEET_DAEMON_PRINTER` payload the WS handler builds today (`fleetDaemonClient.ts:78-100`) — spread `payload`, synthesize `socket:{hostname, isConnected:true, webPort:80, position, printerModel}` + `current_file` + `_namespace`. Diff against the previous poll for `REMOVE_FLEET_DAEMON_PRINTER`. Site offline (from `/api/sites` or the status response) ⇒ `farm/SET_FLEET_DAEMON_CONNECTED false` so tiles show the existing disconnected treatment.
- **Site tabs**: top-level switcher (route param, e.g. `/site/:siteId/...`). On switch: clear `farm/fleetDaemonPrinters` and re-poll — the store holds ONE site at a time, which also sidesteps cross-site hostname collisions (both sites can have a `cm4-01.local`; never merge the two stores). History/parts/analytics/spool panels pass `site=<active>`; history + parts get an "All sites" toggle that omits the param and shows a site column (use `display_site`).
- **remoteprinters store**: hydrate `gui/remoteprinters` from the `/api/status` `remoteprinters` meta (read-only) instead of Moonraker DB — positions/gridPosition/printerModel/location then flow into the existing map/tooltip lookups unchanged.
- **Per-site floor geometry**: `FarmMapSection.vue` hardcodes ONE floor plan (GRID 25×12, aisles/rooms/labels at :337-415) — **owner clarification 2026-07-22: the geometry currently on this branch is the SF building.** Refactor the constants into a per-site config map keyed by site id; assign the current geometry to `sf`, and **recover the old building's (`pantheonfleet`) plan from this repo's git history** (it was replaced on this branch — check earlier commits of FarmMapSection.vue; ask the owner if it can't be found). Free-hand `mapdrawing.*` localStorage strokes stay browser-local (fine).
- Kill the site-URL coupling: `fleetDaemonUrl` getter/settings are irrelevant in cloud mode (adapter is same-origin `/api`); also note the dead hardcoded `http://localhost:8090/` fetch at `src/store/farm/printer/actions.ts:280` — do not wire it up.

## 6. Verification plan

1. Local dev: `vercel dev` (or `vite serve` + `vercel dev` for functions) with `DATABASE_URL` pointed at the real Neon — the data is already live. Wrong password → 401/redirect; correct → cookie set, subsequent reloads authed.
2. Both site tabs show the correct printer roster with live states matching each site's local Mainsail (allow ≤60s lag). Map tiles sit at the same grid positions as the local map; drag a printer on a LOCAL site's Mainsail → cloud map follows within ~90s (daemon 30s fetch + sync + poll).
3. Hostname-collision guard: verify switching tabs never shows site A's printer under site B (store cleared on switch).
4. Parts search: QR lookup returns the same record as the local UI; "all sites" search shows `display_site`; a moved printer's job appears ONCE (dedup view), attributed to its current site.
5. Analytics numbers spot-checked against the local `/history/analytics` for one site (same `days` window; small drift acceptable only from sync lag).
6. Spool list renders read-only with filament/vendor joins; part detail resolves its spool.
7. Read-only audit: grep the built bundle/UI for every write action in §5.4 — none reachable; adapter has no mutating routes.
8. Poll pause: background the tab ≥2 min → no `/api/status` requests in that window (network tab); foreground → immediate poll.
9. Offline badge: stop one site's daemon briefly → its tab shows offline within ~2 min; printers render as disconnected; other site unaffected.

## 7. Out of scope (v1)

- Job start / any command channel (fleet_daemon §6.13 sketch exists — future; when built, the gcode browser becomes its file picker).
- Archive panel + archive/telemetry file downloads (no cross-site byte path yet).
- Gcode file *contents*/downloads and the download-queue view (the library *listing* browser IS in v1 via `cloud_gcode_files`).
- Spool/QC/QR/gcode mutations of any kind, add-printer, map editing.
- Webcams, direct printer Moonraker access (never part of fleet mode anyway).
