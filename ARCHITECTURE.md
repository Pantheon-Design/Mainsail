---
# Machine-readable project metadata. Keep in sync when architecture changes.
project: mainsail-pantheon-fleet
upstream: mainsail (Klipper/Moonraker web UI), forked by Pantheon Design
version_source: package.json
branch_of_record: Fleet3.0
language: TypeScript
framework: Vue 2.7 (class components via vue-class-component / vue-property-decorator)
ui_library: Vuetify 2
state_management: Vuex 3
router: vue-router 3 (history mode)
i18n: vue-i18n 8 (locales in src/locales/*.json)
build_tool: Vite 4
package_manager: npm
node: "^18 || ^20"
test_framework: Cypress 13 (e2e)
lint: ESLint 8 + Prettier 3
entry_point: src/main.ts
path_alias: "@/* -> src/*"
backends:
  - name: moonraker
    protocol: JSON-RPC 2.0 over WebSocket
    client: src/plugins/webSocketClient.ts
    scope: single active printer (Klipper host)
  - name: fleet_daemon
    protocol: WebSocket (live push) + HTTP REST (CRUD)
    client: src/plugins/fleetDaemonClient.ts
    default_url: http://pantheonfleet.local:8090
    scope: whole-fleet aggregation (fork-specific)
    repo: https://github.com/Azio-Pantheon/fleet_daemon.git
    repo_branch: fleet3.0
    local_path: /Users/azio/Documents/GitHub/fleet_daemon
    architecture_doc: fleet_daemon/ARCHITECTURE.md
nas:
  host_mount: /mnt/nas/fleet_archive (NFS mount from Synology NAS, on the hub)
  gcode_archive: /mnt/nas/fleet_archive/gcode_archive/ (content-addressed, SHA-256)
  telemetry_archive: /mnt/nas/fleet_archive/telemetry_archive/
  access_from_frontend: proxied via fleet_daemon HTTP (/archive/file/{hash}, /archive/telemetry/file/{job_id}) — the browser never touches the NAS
printer_models: [HS-3, HS-Pro]
---

# Architecture

Pantheon's **Fleet** fork of [Mainsail](https://github.com/mainsail-crew/mainsail), the Klipper/Moonraker 3D-printer web UI. On top of upstream Mainsail's single-printer UI, this fork adds a fleet-management layer: a separate backend service (`fleet_daemon`) that aggregates a farm of Pantheon printers (models HS-3 / HS-Pro) and provides centralized G-code storage, print history with quality control (QC), spool management, analytics, and archiving.

## 1. Tech Stack

| Concern | Choice | Config |
|---|---|---|
| Framework | Vue 2.7 + TypeScript, class-based components | `tsconfig.json` (strict, es2020, decorators) |
| UI | Vuetify 2, MDI icons (`@mdi/js`) | `src/plugins/vuetify.ts` |
| State | Vuex 3, namespaced modules | `src/store/index.ts` |
| Routing | vue-router 3, history mode | `src/plugins/router.ts`, `src/routes/index.ts` |
| Build | Vite 4 + `vite-plugin-vue2`, PWA via `vite-plugin-pwa` (Workbox), type-check via `vite-plugin-checker` | `vite.config.ts` |
| i18n | vue-i18n 8, JSON locales | `src/plugins/i18n.ts`, `src/locales/` |
| Testing | Cypress e2e | `cypress.config.ts`, `cypress/` |
| Lint/format | ESLint + Prettier | `.eslintrc.json`, `.prettierrc` |

Key domain dependencies: `axios` (Fleet REST calls), `echarts`/`echarts-gl` (charts/analytics), CodeMirror 6 (config/G-code editor, custom stream parsers in `src/plugins/StreamParser*.ts`), `@sindarius/gcodeviewer` (3D G-code viewer), `hls.js`/`jmuxer`/`typed_janus_js` (webcam streaming), `zxing-wasm` (QR/barcode scanning for Fleet QC/parts), `vuedraggable`, `overlayscrollbars`.

## 2. Directory Layout

```
src/
├── main.ts                  # App bootstrap (see §3)
├── App.vue                  # Root layout: TheSidebar, TheTopbar, router-view, global overlays, TheFleetToast
├── pages/                   # Route-level views (Dashboard, Farm, Files, Console, History,
│                            #   FleetHistory*, SpoolManagement, Machine, Heightmap, Viewer, Webcam, Timelapse)
├── routes/index.ts          # Typed route table (AppRoute: icon, showInNavi, position, klipper/moonraker gating)
├── components/
│   ├── The*.vue             # App chrome (sidebar, topbar, dialogs, TheFleetToast*, TheFullscreenUpload*)
│   ├── panels/              # Dashboard/feature panels, incl. Farm* and Fleet* panels
│   ├── dialogs/  inputs/  settings/  charts/  console/  webcams/  gcodeviewer/  ui/  notifications/
│   └── mixins/              # Shared component mixins (navigation, theme, ...)
├── store/                   # Vuex modules (see §4)
├── plugins/                 # webSocketClient.ts, fleetDaemonClient.ts*, router, vuetify, i18n, helpers,
│                            #   StreamParserGcode.ts, StreamParserKlipperConfig.ts, build-version plugins
├── locales/                 # 19 translation JSON files
├── directives/              # longpress, responsive-class
└── types/                   # Ambient .d.ts (websocket, vue shims)
```
`*` = fork-specific (not in upstream Mainsail).

## 3. Bootstrap Flow

Entry: `index.html` → `src/main.ts`.

1. Register global plugins/components: Vuetify, i18n, VueMeta, VueToast, OverlayScrollbars, ECharts (selective module registration), custom directives.
2. `initLoad()`: fetch `/config.json` → dispatch `importConfigJson` → set locale/theme. `config.json` determines `instancesDB` (`moonraker` | `browser`) and instance config.
3. Install `WebSocketPlugin` (`src/plugins/webSocketClient.ts`) as `Vue.$socket` using `socket/getWebsocketUrl`; auto-connect when `instancesDB === 'moonraker'`.
4. **Fork:** `fleetDaemonClient.start()` opens the persistent fleet-daemon WebSocket.
5. Mount root `Vue` (`#app`) with vuetify, router, store, i18n.

Default route `/` redirects to `/allPrinters` (Farm view). Fork route: `/fleet-history` → `src/pages/FleetHistory.vue`.

## 4. State Management (Vuex)

Root store `src/store/index.ts`; each module follows the `index.ts / actions.ts / mutations.ts / getters.ts / types.ts` pattern.

| Module | Path | Domain |
|---|---|---|
| `socket` | `src/store/socket/` | Moonraker WS connection state; central notification router (`onMessage`) |
| `printer` | `src/store/printer/` | Live Klipper objects (toolhead, heaters, print_stats, ...); sub-module `tempHistory` |
| `server` | `src/store/server/` | Moonraker server domain; sub-modules: `power`, `spoolman`, `timelapse`, `announcements`, `history`, `jobQueue`, `updateManager` |
| `files` | `src/store/files/` | File browser state and G-code metadata |
| `gui` | `src/store/gui/` | Persisted UI/user settings (Moonraker DB namespace `mainsail`, or localStorage); sub-modules: `webcams`, `navigation`, `miscellaneous`, `macros`, **`remoteprinters`**, `gcodehistory`, `heightmap`, `presets`, `notifications`, `console` |
| `editor` | `src/store/editor/` | Config-file editor state |
| `gcodeviewer` | `src/store/gcodeviewer/` | 3D G-code viewer state |
| `farm` | `src/store/farm/` | Multi-printer live state (see §6) |
| `fleet` * | `src/store/fleet/` | Fleet-daemon aggregate data; sub-modules: `gcodes`, `history`, `spools`, `archive` (see §7) |

Core domain types: `src/store/types.ts` (`RootState`), `src/store/printer/types.ts` (`PrinterState` + typed heater/fan/sensor interfaces), `src/store/farm/printer/types.ts` (`FarmPrinterState`), `src/store/gui/remoteprinters/types.ts` (`GuiRemoteprintersStatePrinter` — persisted printer descriptor incl. fork-specific `printerModel: 'HS-3' | 'HS-Pro'` and map `position`/`gridPosition`).

## 5. Moonraker Data Flow (single active printer)

- **Client:** `src/plugins/webSocketClient.ts` — `WebSocketClient` class, JSON-RPC 2.0 over `ws(s)://host/websocket`. Request/response correlation via incrementing `messageId` + `waits[]`; replies dispatch their registered Vuex action. Auto-reconnect (default 5 attempts, 1 s interval).
- **Init:** socket open → `socket/onOpen` → `server/init`; on `notify_klippy_ready` → `printer/init` → `printer.objects.list` → `initSubscripts` → `printer.objects.subscribe`. Init progress tracked via `socket/addInitModule` / `removeInitModule`.
- **Live updates:** Moonraker pushes `notify_status_update` → `socket/onMessage` (`src/store/socket/actions.ts`, a large switch mapping every `notify_*` to its module) → `printer/getData` commits object diffs. Other notifications route to `server/*`, `files`, `gui/webcams`, etc.

## 6. Multi-Printer / Farm

Three cooperating mechanisms:

1. **Printer registry — `gui/remoteprinters`** (`src/store/gui/remoteprinters/`): persisted list of configured printers (hostname, port, uuid, map position, grid position, `printerModel`). Persisted to Moonraker DB (`remoteprinters.printers.<id>`) or localStorage. CRUD actions mirror into the `farm` module.
2. **Legacy per-printer connections — `farm/<id>`** (`src/store/farm/printer/`): a Vuex sub-module is dynamically registered per printer (`registerModule(['farm', id])`); each maintains its **own raw WebSocket** with independent reconnect logic and handles its own `notify_status_update`.
3. **Fleet-daemon push — `farm.fleetDaemonPrinters`** *(fork)*: live per-printer status pushed by the fleet daemon, committed directly from `fleetDaemonClient.ts` via `SET_FLEET_DAEMON_PRINTER` / `REMOVE_FLEET_DAEMON_PRINTER` / `SET_FLEET_DAEMON_CONNECTED`, enriched with position/model from `gui/remoteprinters`. Consumed by `src/pages/Farm.vue` and the grid/map panels (`FarmPrinterGridPanel.vue`, `FarmPrinterMapPanel.vue`, `SimplifiedPrinterMapPanel.vue`).

Paths 2 and 3 coexist: 2 is upstream Mainsail's mechanism; 3 is the fork's centralized replacement.

## 7. Fleet Layer (fork-specific)

Backend: **`fleet_daemon`** service. URL configurable via `gui/fleetDaemonUrl` getter (`src/store/gui/getters.ts`; edited in `src/components/settings/SettingsRemotePrintersTab.vue`), default `http://pantheonfleet.local:8090`.

**Transport split:** live state arrives over the daemon WebSocket; CRUD/queries go over HTTP REST from the `fleet/*` store actions.

- **Daemon client:** `src/plugins/fleetDaemonClient.ts` — singleton persistent WebSocket to `<daemonUrl>/ws`, 5 s auto-reconnect. Commits printer status into `farm`; re-broadcasts daemon events (`history_updated`, `spool_updated`, `gcodes_updated`, `download_queue_updated`, `toast`) on the `fleetDaemonEvents` Vue event bus.
- **`fleet/gcodes`** — centralized G-code library: list/upload/delete/move/mkdir, `push`/`push-all` to devices, download queue (`/gcodes/...`). `TheFullscreenUpload.vue` reroutes drag-drop uploads here instead of Moonraker.
- **`fleet/history`** — cross-fleet print job history + QC: filtering, analytics (`/history/analytics`, `/history/analytics/parts`), QC verdicts (`PATCH /history/{id}/qc`), inspectors, QR-code linking of physical parts (`/history/qr-link`).
- **`fleet/spools`** — centralized spool management: vendors, filaments, spools, QR lookup (`/spool/...`).
- **`fleet/archive`** — archived/old file management (`/archive/list|status|search|sweep`).

**Fleet UI:** page `src/pages/FleetHistory.vue` (tabs: Jobs / Parts / Analytics / Archive + printer-status overview); panels `FleetHistoryListPanel`, `FleetPrinterStatusPanel`, `FleetArchivePanel`, `FleetAnalyticsPanel`, `FleetPartsPanel` (all in `src/components/panels/`); global toast `src/components/TheFleetToast.vue` (mounted in `App.vue`); QC-mode / add-part-mode entry points in `src/components/TheTopbar.vue`.

## 8. UI Composition

- **Layout:** `App.vue` renders `<v-app>` with `TheSidebar`, `TheTopbar`, `<router-view/>`, plus global overlays (editor, update dialog, service worker, upload/timelapse snackbars, fleet toast). Printer selection shell: `TheSelectPrinterDialog` (multi-instance) vs `TheConnectingDialog` (single moonraker).
- **Dashboard panels are data-driven:** `src/pages/Dashboard.vue` iterates responsive layout arrays from the `gui` store (`mobileLayout`, `tabletLayout1/2`, `desktopLayout1/2`, `widescreenLayout1/2`) and renders panels via dynamic `<component :is>`. Panel order/visibility is user-configurable state, not hardcoded.

## 9. Build, Test, CI

Scripts (`package.json`): `serve` (Vite dev, `0.0.0.0:8080`) · `build` (Vite build + zip `dist/mainsail.zip`) · `preview` · `lint`/`lint:fix` · `format`/`format:check` · `i18n-extract` · `test` (Cypress against preview server) · `changelog` (git-cliff).

CI (`.github/workflows/`, gated on `develop` — upstream convention, not `Fleet3.0`): `build.yml`, `test.yml` (Cypress), `code_style.yml`, `check_locale.yml`, `release.yml` (version bump, changelog, FTP deploy of `dist/` + `remote/`), plus bundle-size, Docker publish, and housekeeping workflows. Container: `Dockerfile` + `.docker/nginx.conf`. No Fleet-specific tests exist yet; Cypress specs in `cypress/` cover upstream behavior.

## 10. Cross-Reference: `fleet_daemon` Backend

The Fleet backend lives in a **separate repository**: [`Azio-Pantheon/fleet_daemon`](https://github.com/Azio-Pantheon/fleet_daemon.git), **branch `fleet3.0`** (locally `/Users/azio/Documents/GitHub/fleet_daemon`; the `main` branch is an older generation — do not reference it). Its `ARCHITECTURE.md` on that branch is the authoritative server-side reference; this section only maps the seam between the two projects.

**Backend summary** (from `fleet_daemon/ARCHITECTURE.md`, branch `fleet3.0`): a FastAPI + uvicorn daemon (`main.py`, port `8090`) on the central hub (`pantheonfleet.local`) composed of supervised subsystems: `fleet_manager.py` (persistent WebSocket per printer's Moonraker `:7125`, status cache, broadcast coalescing), `fleet_history_collector.py` (polls each printer's `/server/history/list` every 5 min + event-driven on print-state transitions; upserts into PostgreSQL `fleetdb`), `fleet_gcode_manager.py` (central G-code storage with on-demand download queue to printers), `fleet_gcode_archiver.py` + `fleet_telemetry_archiver.py` (NAS archiving, see below), and `fleet_backup.sh` (DB backups). History data originates from the daemon's Moonraker polling/subscriptions, not from this frontend.

**Integration points (this repo ⇄ fleet_daemon):**

| Seam | This repo (frontend) | fleet_daemon (backend) |
|---|---|---|
| Daemon URL | `gui/fleetDaemonUrl` getter; default `http://pantheonfleet.local:8090` (`src/store/gui/index.ts`) | Binds `0.0.0.0:8090` (`main.py`); hub Moonraker at `http://pantheonfleet.local` (`fleet_manager.py` `CENTRAL_MOONRAKER`) |
| Live push | `src/plugins/fleetDaemonClient.ts` connects `<daemonUrl>/ws` | `WS /ws` broadcasts printer status + change events from the in-memory `printer_data_cache` |
| REST CRUD | `src/store/fleet/{gcodes,history,spools,archive}/actions.ts` via axios | FastAPI endpoints in `main.py` (no auth, CORS `*` — trusted-LAN assumption) |
| **Printer registry (shared source of truth)** | Settings → Remote Printers (`SettingsRemotePrintersTab.vue`) writes `gui/remoteprinters` to the **hub's** Moonraker DB, namespace `mainsail`, key `remoteprinters.printers.<id>` | Daemon polls `GET <hub-moonraker>/server/database/item?namespace=mainsail` every 30 s and derives its whole fleet connection list from it. Adding a printer in this UI is how the daemon discovers it — no backend change needed |
| G-code delivery | Uploads go to Fleet central storage (`fleet/gcodes/uploadFile`, `TheFullscreenUpload.vue`); download queue UI in `GcodefilesPanel.vue` | `FleetGcodeManager`: files stored in `/home/hs3/Fleetdaemon/gcodes/`, pushed on-demand to printers' `fleet_gcodes/` via Moonraker upload API through a prioritized download queue (`fleet_download_queue` table); a Moonraker `fleet_integration` component on each printer mirrors folders and handles Download & Print |
| QC / parts QR linking | Scanner or camera capture (`zxing-wasm`) → `POST /history/qr-link`, `PATCH /history/{id}/qc` | Daemon persists QR↔job links and QC state in `fleetdb` (base-row vs part-row pattern in `fleet_print_history`; QR-linked endpoints use a dedicated priority DB pool) |
| G-code archive (NAS) | Download button in history detail (`FleetHistoryListPanel.vue:729`) opens `GET /archive/file/{gcode_archive_hash}`; Archive tab (`FleetArchivePanel.vue`) lists/searches/sweeps | `FleetGcodeArchiver`: after each job, downloads the printed G-code (from central storage or the printer's Moonraker), SHA-256 hashes it, and stores it content-addressed on the NAS at `/mnt/nas/fleet_archive/gcode_archive/{h[:2]}/{hash}.gcode`; falls back to local staging (`gcode_staging/`, max 50 files) when the NAS is down and flushes on restart; 15-min background sweep retries misses; `deleted:{hash}` tombstones for files gone from printers |
| Telemetry archive (NAS) | Telemetry download in history detail → `GET /archive/telemetry/file/{job_id}`; UI states from `telemetry_archive_status` (`archived`/`unavailable`/`corrupt`) | `FleetTelemetryArchiver` pulls per-print gzipped-JSONL motion/temperature logs recorded on each printer's Pi by the sibling `fleet_telemetry_recorder` project, validates them, and stores them at `/mnt/nas/fleet_archive/telemetry_archive/{printer}/{YYYY-MM}/`; three-state retry model with a 24 h grace period |
| NAS health toasts | `TheFleetToast.vue` shows a sticky keyed "NAS down" warning replaced in place by "NAS restored" | Archivers probe the NFS mount (30 s cached write-probe); `notify_nas_status` in `fleet_manager.py` broadcasts `{"event":"toast", key:"nas_status"}` over `/ws` on state changes |

**Deployment coupling:** the hub also runs its own Moonraker + Mainsail instance — that is the instance whose database stores this frontend's `remoteprinters` registry, making it the fleet's de-facto machine list. The backend's `unified_update.sh` keeps a separate hand-maintained `CLIENTS` array that does **not** read the registry and must be updated separately when printers are added.

**Data durability (backend-side, for context):** print history, QC, spools, and archive metadata live in PostgreSQL `fleetdb` on the hub; `fleet_backup.sh` (cron, daily 02:00) takes tiered `pg_dump` backups (7 daily / 3 weekly / permanent monthly) to `/home/hs3/Fleetdaemon/backups/` and mirrors them to Google Drive via rclone (`gdrive-fleet:fleet-backups`). Archived G-code and telemetry files live only on the Synology NAS (plus transient local staging) — they are not covered by the DB backup.

**Branch caveat:** the daemon's `main` branch is a previous-generation codebase (per-printer queue balancing, rsync fan-out, no archive/NAS/spool subsystems) whose ARCHITECTURE.md describes a different API. Everything above reflects branch `fleet3.0`, which is what runs in production against this frontend.

## 11. Invariants & Conventions

- Every Vuex module keeps the `index/actions/mutations/getters/types` file quintet; new domain state should follow it.
- All fleet-daemon HTTP calls resolve their base URL from `rootGetters['gui/fleetDaemonUrl']` — never hardcode the daemon address.
- The fleet-daemon WebSocket is a singleton that survives route navigation; per-printer Moonraker sockets (`farm/<id>`) and the primary `$socket` are separate connections with independent reconnect logic.
- Persisted settings go through the `gui` store, which abstracts Moonraker DB vs localStorage (`instancesDB`).
- Imports use the `@/` alias for `src/`.
