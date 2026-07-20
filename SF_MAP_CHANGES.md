# Two-floor Fleet Map — repo changes

Drop these files into your Mainsail checkout at the matching paths under `src/`.
Four files change; no new dependencies.

## Files

1. **src/store/gui/remoteprinters/types.ts**
   - Adds optional `location?: 'farm' | 'ground'` to `GuiRemoteprintersStatePrinter`.
   - Optional = backward compatible; printers saved before this field have no value.

2. **src/store/gui/remoteprinters/actions.ts**
   - `upload()` now persists `location` (both `browser` localStorage and `moonraker` DB paths),
     defaulting to `'farm'` when absent — legacy printers land on the Print Farm tab.
   - Stored exactly like `gridPosition` (same `server.database.post_item` payload).

3. **src/components/settings/SettingsRemotePrintersTab.vue**
   - New **Location** select (Print Farm / Ground Floor) in both the Add and Edit forms.
   - `storePrinter()` / `updatePrinter()` include `location`.
   - `editPrinter()` reads `printer.location ?? 'farm'`; list rows show the location as a subtitle.

4. **src/pages/Farm.vue** — reworked map page:
   - Removed the Simple/Detailed map switch.
   - Two tabs — **Print Farm** and **Ground Floor** — filtered by each printer's `location`
     (`getPrinterLocation()` defaults missing values to `'farm'`).
   - One **25 × 12** cell grid per tab, half-cell margin around the perimeter, closed border on all sides.
   - Background markings drawn OUTSIDE the grid:
       - Print Farm: `Post Processing` (col 1, left), `Isle 1..6` along the top (each 4 columns),
         `Farm Room` along the bottom, thick dividers at the aisle boundaries.
       - Ground Floor: `Production` (3×12, left), `R&D` (21×9, top), `Fulfilment` (21×3, bottom).
   - Status is the marker FILL color (HS-3 circle / HS-Pro square), with print %, ✓ (complete),
     ! (error) glyphs and a pulsing ring while printing. Material name shown on the marker.
   - **Edit** = drag printers to grid cells (saved via `updateOnDrag` → `gridPosition`, unchanged path).
   - **Draw** = reuses `MapDrawingOverlay` + `MapDrawingToolbar`, stored per tab
     (`mapdrawing.farmStrokes` / `mapdrawing.groundStrokes`).
   - Total fleet status shown next to the "Fleet Map" title; per-tab status below the tabs.
   - Hover tooltip unchanged (hostname, connection, filament, nozzle, remaining, file, progress, webhook).

## Notes / things to confirm in your build

- `farmPrinterStatus.ts` is used as-is (imports `getPrinterStatus`, `computeRemainingFilamentG`, `PrinterStatus`).
- `Farm.vue` no longer imports `FarmPrinterMapPanel` / `FarmPrinterGridPanel`. If nothing else
  references them you can leave them in place; they're just unused by this page now.
- Marker size is driven by `CELL = 46`. The grid is 1196 px wide; it sits in a horizontal
  scroll container (`.grid-scroll`). Adjust `CELL` if you want it to fit a fixed width.
- The Ground Floor rooms are a schematic (cell-based rectangles), not the scanned drawing —
  swap `.area-room` for a background image layer if you want the real plan behind the grid.
- If your fleet daemon sync overwrites the local store, make sure the daemon round-trips the new
  `location` key the same way it does `gridPosition`.
