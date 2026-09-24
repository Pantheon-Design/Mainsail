<template>
    <div>
        <!-- Section title -->
        <div class="section-title mb-2">
            {{ name }}
            <span class="section-pill">{{ printerCount }}</span>
        </div>

        <!-- Controls (hidden in workers mode: the map is a toggle surface there) -->
        <div v-if="mode === 'workers'" class="map-controls mb-2">
            <span class="edit-hint">Click a printer to toggle it as a fleet worker.</span>
        </div>
        <div v-else class="map-controls mb-2">
            <v-btn small :color="isEditing ? 'success' : undefined" :class="{ 'save-pulse': isEditing }"
                   @click="toggleEditMode">
                {{ isEditing ? 'Save' : 'Edit' }}
            </v-btn>
            <v-btn small title="Add printer" @click="openPrinterSettings">
                Add Printer
            </v-btn>
            <v-btn v-if="isEditing" small :color="isDrawing ? 'success' : undefined" :class="{ 'save-pulse': isDrawing }"
                   @click="toggleDrawMode">
                {{ isDrawing ? 'Save Drawing' : 'Draw' }}
            </v-btn>
            <map-drawing-toolbar v-if="isEditing && isDrawing"
                                 :color.sync="drawColor"
                                 :stroke-width.sync="drawStrokeWidth"
                                 :storage-key="drawStorageKey" />
            <span class="edit-hint">{{ editHint }}</span>
        </div>

        <!-- Per-section status legend (leads with the worker total when workers are shown) -->
        <div class="status-counters mb-3">
            <span v-if="workersVisible" class="status-counter status-counter--total"
                  :title="`${workerCount} of ${printerCount} printers in this section are enabled as fleet workers`">
                <v-icon x-small color="orange">{{ mdiHammer }}</v-icon>
                Workers {{ workerCount }}
            </span>
            <span v-for="s in activeStatusList" :key="'active-' + s.key" class="status-counter">
                <span class="status-dot" :class="{ square: s.key === 'error' || s.key === 'printing' }"
                      :style="{ backgroundColor: s.color }"></span>
                {{ s.label }} {{ s.count }}
            </span>
            <!-- Ovens are counted apart from printers (never part of the printer statuses) -->
            <span
                v-if="ovenCount"
                class="status-counter status-counter--oven"
                :title="ovenLegendTitle">
                <span class="status-dot oven" :style="{ borderColor: OVEN_LEGEND.color }"></span>
                {{ OVEN_LEGEND.label }}{{ ovenCount === 1 ? '' : 's' }} {{ ovenCount }}<span v-if="ovenSpoolTotals"> · {{ ovenSpoolTotals }}</span>
            </span>
        </div>

        <!-- Grid canvas -->
        <div class="grid-scroll">
            <div ref="canvas" class="grid-canvas" :style="canvasStyle">
                <!-- Background markings (outside the grid, in the margin) -->
                <template v-if="location === 'farm'">
                    <div v-for="(d, i) in farmDividers" :key="'fd-' + i" class="area-divider" :style="d"></div>
                    <span v-for="(l, i) in farmLabels" :key="'fl-' + i" class="area-label" :style="l.style">{{ l.text }}</span>
                </template>
                <template v-else>
                    <div class="rooms-wrap" :style="roomsWrapStyle">
                        <div v-for="(r, i) in groundRooms" :key="'gr-' + i" class="area-room" :style="r"></div>
                    </div>
                    <span v-for="(l, i) in groundLabels" :key="'gl-' + i" class="area-label" :style="l.style">{{ l.text }}</span>
                </template>

                <!-- Bay door: thickened right-border segment (rows 5-9), both locations -->
                <div class="bay-door" :style="bayDoorStyle"></div>
                <span class="area-label" :style="bayDoorLabelStyle">Bay Door</span>

                <!-- Grid lines -->
                <div class="grid-lines" :style="gridLinesStyle"></div>

                <!-- Drawing overlay (over the grid area) -->
                <map-drawing-overlay class="draw-layer" :style="drawLayerStyle"
                                     :editable="isEditing && isDrawing"
                                     :width="gridW"
                                     :height="gridH"
                                     :color="drawColor"
                                     :stroke-width="drawStrokeWidth"
                                     :storage-key="drawStorageKey" />

                <!-- Printers -->
                <div v-for="[hostname, printer] in activePrinterEntries" :key="hostname"
                     class="marker" :style="markerWrapStyle(hostname)"
                     :class="{ draggable: isEditing && !isDrawing, highlighted: isHighlighted(hostname) }"
                     :data-printer-id="hostname"
                     @mousedown="isEditing && !isDrawing ? startGridDrag($event, printer, hostname) : null"
                     @click="onMarkerClick(printer, hostname)"
                     @mouseover="showTooltip(printer, hostname, $event)"
                     @mouseleave="hideTooltip">
                    <div v-if="markerStatus(printer) === 'printing'" class="marker-ring"
                         :style="markerRingStyle(printer, hostname)"></div>
                    <div class="marker-dot" :style="markerDotStyle(printer, hostname)">
                        <span class="marker-host" :style="{ fontSize: markerFilament(printer).length > 4 ? '7px' : '9px' }">
                            {{ markerFilament(printer) }}
                        </span>
                        <span v-if="markerGlyph(printer)" class="marker-glyph"
                              :style="{ fontSize: markerStatus(printer) === 'printing' ? '9px' : '13px' }">
                            {{ markerGlyph(printer) }}
                        </span>
                    </div>
                    <!-- Worker stickers: flashing "!" when the worker needs attention, else the hammer -->
                    <span v-if="workersVisible && needsAttention(hostname)" class="worker-sticker attention-sticker"
                          :title="attentionReason(hostname) || 'Worker needs attention'">
                        <v-icon size="13" color="#fff">{{ mdiExclamationThick }}</v-icon>
                    </span>
                    <span v-else-if="workersVisible && isWorker(hostname)" class="worker-sticker" title="Fleet worker">
                        <v-icon size="12" color="#fff" class="worker-hammer">{{ mdiHammer }}</v-icon>
                    </span>
                </div>

                <!-- Ovens (roster deviceType === 'oven'), placed by gridPosition like printers.
                     Pixel-art furnace (public/img/oven): the body PNG is the marker background, the
                     top material over `count/max` (red when over capacity) is stacked in the furnace
                     window like the printer marker's two rows, a bar on the right wall shows how full
                     that material is by weight (grams left / grams when full, hidden when unknown),
                     and an animated fire sprite burns in the hearth: red = none of that material
                     ready, blue = some, green = all.
                     No fire when offline / Klipper error / empty (see ovenFire()).
                     One markup for both modes ('map' and 'workers' render this same loop). -->
                <div
                    v-for="o in ovenEntries"
                    :key="'oven-' + o.hostname"
                    class="marker marker--oven"
                    :style="markerWrapStyle(o.hostname)"
                    :class="{ draggable: isEditing && !isDrawing, highlighted: isHighlighted(o.hostname) }"
                    :data-oven-id="o.hostname"
                    @mousedown="isEditing && !isDrawing ? startGridDrag($event, null, o.hostname) : null"
                    @click="onOvenClick(o.hostname)"
                    @mouseover="showOvenTooltip(o.hostname)"
                    @mouseleave="hideTooltip">
                    <div class="oven-dot" :class="ovenDotClass(o.hostname)" :style="ovenDotStyle(o.hostname)">
                        <span
                            v-if="ovenFireFor(o.hostname) !== 'off'"
                            class="oven-fire"
                            :class="'oven-fire--' + ovenFireFor(o.hostname)"></span>
                        <div class="oven-text">
                            <span
                                class="oven-material"
                                :title="ovenTopMaterialText(o.hostname)"
                                :style="{ fontSize: ovenTopMaterialText(o.hostname).length > 4 ? '7px' : '9px' }">
                                {{ ovenTopMaterialText(o.hostname) }}
                            </span>
                            <span
                                class="oven-count"
                                :class="{ 'oven-count--over': ovenIsOverCapacity(o.hostname) }"
                                :style="{ fontSize: ovenCountLabel(o.hostname).length > 5 ? '7px' : '9px' }">
                                {{ ovenCountLabel(o.hostname) }}
                            </span>
                        </div>
                        <span v-if="ovenMaterialFillFor(o.hostname) !== null" class="oven-bar">
                            <span class="oven-bar-fill" :style="{ height: ovenBarHeight(o.hostname) }"></span>
                        </span>
                    </div>
                </div>

                <!-- Oven tooltip -->
                <div v-if="hoveredOven" class="tooltip tooltip--oven" :style="tooltipStyle">
                    <p><strong>{{ hoveredOvenLabel }}</strong> ({{ hoveredOven.hostname }}): {{ hoveredOvenStatusLabel }}</p>
                    <p v-if="hoveredOvenFrame && hoveredOvenFrame.webhooks && hoveredOvenFrame.webhooks.state">
                        Klipper: {{ hoveredOvenFrame.webhooks.state }}
                    </p>
                    <p v-if="!hoveredOvenFrame">No status from fleet_daemon yet</p>
                    <p v-else-if="hoveredOvenFrame.fleet_to_printer_ws === false">Daemon → oven websocket: down</p>
                    <p v-for="t in hoveredOvenTemps" :key="'t-' + t">{{ t }}</p>
                    <p v-if="hoveredOvenFrame && hoveredOvenLayout">Layout: {{ hoveredOvenLayout }}</p>
                    <p v-if="hoveredOvenFrame">
                        Spools: {{ hoveredOvenReady }}/{{ hoveredOvenTotal }} ready · capacity {{ hoveredOvenCapacityText }}
                        <span v-if="hoveredOven && ovenIsOverCapacity(hoveredOven.hostname)" class="oven-over">(over capacity)</span>
                    </p>
                    <p v-if="hoveredOvenFrame && hoveredOvenTotal">Top material: {{ hoveredOvenTopMaterialDetail }}</p>
                    <p v-for="line in hoveredOvenSpoolLines" :key="'s-' + line" class="oven-spool-line">{{ line }}</p>
                    <p
                        v-if="hoveredOvenFrame && hoveredOvenFrame.webhooks && hoveredOvenFrame.webhooks.state_message"
                        style="white-space: pre-wrap; max-width: 300px;">
                        <strong>Webhook:</strong><br>{{ hoveredOvenFrame.webhooks.state_message }}
                    </p>
                    <p v-if="isEditing" class="oven-hint">Drag to place</p>
                </div>

                <!-- Tooltip -->
                <div v-if="hoveredPrinter" class="tooltip" :style="tooltipStyle">
                    <p>{{ hoveredPrinter.socket.hostname }}: {{ hoveredPrinter.print_stats?.state || 'Unknown' }}</p>
                    <p v-if="workersVisible">
                        Fleet worker: {{ isWorker(hoveredPrinter.socket.hostname) ? 'yes' : 'no' }}<span v-if="mode === 'workers'"> (click to toggle)</span>
                    </p>
                    <p v-if="workersVisible && needsAttention(hoveredPrinter.socket.hostname)" class="attention-reason">
                        <strong>Needs attention:</strong> {{ attentionReason(hoveredPrinter.socket.hostname) || 'see the Workers list' }}
                    </p>
                    <p>IsConnected: {{ hoveredPrinter.socket.isConnected }}</p>
                    <p>Filament: {{ hoveredPrinter.toolhead?.filament_type || 'N/A' }}</p>
                    <p>Nozzle: {{ hoveredPrinter.toolhead?.nozzle_size || 'N/A' }}</p>
                    <p>Remaining: {{ hoveredRemainingG !== null ? Math.round(hoveredRemainingG) + 'g' : 'N/A' }}</p>
                    <p>CurrentFile: {{ hoveredPrinter.current_file?.filename || 'None' }}</p>
                    <p>Progress: {{ getPrinterPrintPercent(hoveredPrinter) }}%</p>
                    <p v-if="hoveredPrinter.webhooks?.state_message" style="white-space: pre-wrap; max-width: 300px;">
                        <strong>Webhook:</strong><br>{{ hoveredPrinter.webhooks.state_message }}
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Mixins, Prop, Watch } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import MapDrawingOverlay from '@/components/panels/MapDrawingOverlay.vue'
import MapDrawingToolbar from '@/components/panels/MapDrawingToolbar.vue'
import Vue from 'vue'
import {
    getPrinterStatus as getPrinterStatusUtil,
    computeRemainingFilamentG,
    PrinterStatus,
} from '@/components/panels/farmPrinterStatus'
import { PrinterModel, SQUARE_PRINTER_MODELS, PRINTER_MODEL_HEIGHT_SCALE } from '@/store/gui/remoteprinters/types'
import { OvenFrame } from '@/store/farm/types'
import { FleetSpool } from '@/store/fleet/spools/types'
import { fleetDaemonEvents } from '@/plugins/fleetDaemonClient'
import {
    getOvenStatus,
    ovenCountText,
    ovenLabel,
    ovenMaxSpools,
    ovenOverCapacity,
    ovenReadyCount,
    ovenSpoolCount,
    ovenSpoolLine,
    ovenTemperatureLines,
    ovenTopMaterial,
    OvenStatus,
    OvenFire,
    ovenFire,
    ovenMaterialFill,
    ovenTopMaterialDetail,
    OvenSpoolWeights,
    OvenWeightLookup,
    OVEN_LEGEND,
    OVEN_STATUS_META,
} from '@/components/panels/farmOvenStatus'
import { mdiExclamationThick, mdiHammer } from '@mdi/js'

type MapLocation = 'farm' | 'ground'

interface OvenEntry {
    /** roster id (gui/remoteprinters key) */
    id: string
    hostname: string
}

@Component({
    components: {
        MapDrawingOverlay,
        MapDrawingToolbar,
    },
})
export default class FarmMapSection extends Mixins(BaseMixin) {
    @Prop({ type: String, required: true }) readonly location!: MapLocation
    @Prop({ type: String, required: true }) readonly name!: string
    /** 'map' (default): edit/drag, click opens the printer. 'workers': no editing,
     *  click emits `toggle-worker`(hostname), worker printers get a hammer sticker. */
    @Prop({ type: String, default: 'map' }) readonly mode!: 'map' | 'workers'
    /** Map mode only: also show the per-section worker count, stickers and tooltip lines
     *  (the Fleet Map page passes this so it mirrors the Workers map without toggling). */
    @Prop({ type: Boolean, default: false }) readonly showWorkers!: boolean
    /** Hostnames currently enabled as fleet workers (workers mode). */
    @Prop({ type: Array, default: () => [] }) readonly workerHostnames!: string[]
    /** Printer to highlight on the map (e.g. hovered in a side list). */
    @Prop({ type: String, default: '' }) readonly highlightHostname!: string
    /** Workers that could run a job but are blocked by low filament / not primed:
     *  they get a flashing red "!" sticker instead of the hammer. */
    @Prop({ type: Array, default: () => [] }) readonly attentionHostnames!: string[]
    /** Scheduler reason per attention hostname (e.g. "filament 350g < 400g needed …"),
     *  shown in the hover tooltip and the sticker title. */
    @Prop({ type: Object, default: () => ({}) }) readonly attentionReasons!: Record<string, string>

    mdiHammer = mdiHammer
    mdiExclamationThick = mdiExclamationThick

    // Grid geometry
    readonly GRID_COLS = 25
    readonly GRID_ROWS = 12
    readonly CELL = 46

    // Status color/label vocabulary (matches farmPrinterStatus + FarmPrinterGridPanel)
    readonly STATUS_META: Record<PrinterStatus, { color: string; label: string }> = {
        printing: { color: '#2196f3', label: 'Printing' },
        ready: { color: 'hsl(90, 100%, 32%)', label: 'Ready' },
        complete: { color: '#1976d2', label: 'Complete' },
        error: { color: '#d32f2f', label: 'Error' },
        disconnected: { color: '#8a8a8a', label: 'Offline' },
    }
    readonly STATUS_ORDER: PrinterStatus[] = ['printing', 'ready', 'complete', 'error', 'disconnected']
    // Oven legend entry (shared with Farm.vue through farmOvenStatus.ts)
    readonly OVEN_LEGEND = OVEN_LEGEND

    isEditing = false
    isDrawing = false

    // grid drag
    gridPositions: { [id: string]: { x: number; y: number } } = {}
    draggingGridHostname = ''
    draggingPrinter: any = null

    // drawing
    drawColor = '#d32f2f'
    drawStrokeWidth = 3

    // tooltip
    hoveredPrinter: any = null
    hoveredOven: OvenEntry | null = null
    tooltipStyle: Record<string, string> = { top: '0px', left: '0px', position: 'absolute' }
    // Countdown clock for the oven tooltip: ticks only while an oven tooltip is open
    tooltipNow = Date.now()
    private tooltipTimer: ReturnType<typeof setInterval> | null = null

    // ---------- geometry helpers ----------
    get pad(): number {
        return this.CELL / 2
    }
    get gridW(): number {
        return this.GRID_COLS * this.CELL
    }
    get gridH(): number {
        return this.GRID_ROWS * this.CELL
    }
    get canvasStyle() {
        return { width: this.gridW + this.CELL + 'px', height: this.gridH + this.CELL + 'px' }
    }
    get gridLinesStyle() {
        return {
            left: this.pad + 'px',
            top: this.pad + 'px',
            width: this.gridW + 'px',
            height: this.gridH + 'px',
            backgroundSize: this.CELL + 'px ' + this.CELL + 'px',
        }
    }
    get roomsWrapStyle() {
        return { left: this.pad + 'px', top: this.pad + 'px', width: this.gridW + 'px', height: this.gridH + 'px' }
    }
    get drawLayerStyle() {
        return { left: this.pad + 'px', top: this.pad + 'px', pointerEvents: this.isEditing && this.isDrawing ? 'auto' : 'none' }
    }

    // ---------- store data ----------
    get fleetDaemonPrinters() {
        return this.$store.state.farm.fleetDaemonPrinters || {}
    }

    get remotePrinters() {
        return this.$store.state.gui?.remoteprinters?.printers || {}
    }

    // Resolve a printer's location, defaulting legacy printers (no location key) to 'farm'
    getPrinterLocation(hostname: string): MapLocation {
        const key = hostname.toLowerCase()
        for (const printer of Object.values(this.remotePrinters)) {
            if ((printer as any).hostname?.toLowerCase() === key) {
                return ((printer as any).location as MapLocation) ?? 'farm'
            }
        }
        return 'farm'
    }

    getPrinterModel(hostname: string): PrinterModel | null {
        const key = hostname.toLowerCase()
        for (const printer of Object.values(this.remotePrinters)) {
            if ((printer as any).hostname?.toLowerCase() === key) return (printer as any).printerModel ?? null
        }
        return null
    }

    // Ovens are roster entries (deviceType === 'oven') but not printers: they never send
    // printer WS frames, so without this they would render as offline printers.
    isOvenHostname(hostname: string): boolean {
        return this.$store.getters['gui/remoteprinters/getDeviceType'](hostname) === 'oven'
    }

    isSquareModel(hostname: string): boolean {
        const model = this.getPrinterModel(hostname)
        return model !== null && SQUARE_PRINTER_MODELS.includes(model)
    }

    modelHeightScale(hostname: string): number {
        const model = this.getPrinterModel(hostname)
        return (model && PRINTER_MODEL_HEIGHT_SCALE[model]) || 1
    }

    get activePrinterEntries(): [string, any][] {
        return Object.entries(this.fleetDaemonPrinters).filter(
            ([hostname]) => !this.isOvenHostname(hostname) && this.getPrinterLocation(hostname) === this.location
        ) as [string, any][]
    }

    get printerCount(): number {
        return this.activePrinterEntries.length
    }

    // ---------- ovens ----------
    get fleetDaemonOvens(): Record<string, OvenFrame> {
        return this.$store.state.farm.fleetDaemonOvens || {}
    }

    /** Roster ovens on this map tab. Driven by the roster (not by WS frames) so an oven
     *  that has never reported still shows up — as offline — and can be dragged into place. */
    get ovenEntries(): OvenEntry[] {
        const seen = new Set<string>()
        const entries: OvenEntry[] = []
        for (const [id, entry] of Object.entries(this.remotePrinters)) {
            const e = entry as any
            if (e?.deviceType !== 'oven' || !e.hostname) continue
            if (((e.location as MapLocation) ?? 'farm') !== this.location) continue
            const key = e.hostname.toLowerCase()
            if (seen.has(key)) continue
            seen.add(key)
            entries.push({ id, hostname: e.hostname })
        }
        return entries.sort((a, b) => a.hostname.localeCompare(b.hostname))
    }

    get ovenCount(): number {
        return this.ovenEntries.length
    }

    get ovenLegendTitle(): string {
        const c: Record<OvenStatus, number> = { drying: 0, ready: 0, empty: 0, error: 0, disconnected: 0 }
        this.ovenEntries.forEach((o) => {
            c[this.ovenStatus(o.hostname)]++
        })
        return (Object.keys(c) as OvenStatus[])
            .filter((k) => c[k] > 0)
            .map((k) => `${OVEN_STATUS_META[k].label} ${c[k]}`)
            .join(' · ')
    }

    /** Legend suffix `5/24 spools` (sum over ovens with a frame; max only when every one is known). */
    get ovenSpoolTotals(): string {
        let spools = 0
        let max = 0
        let allMaxKnown = true
        let anyFrame = false
        this.ovenEntries.forEach((o) => {
            const frame = this.ovenFrame(o.hostname)
            if (frame) {
                anyFrame = true
                spools += ovenSpoolCount(frame)
            }
            const m = this.ovenMax(o.hostname)
            if (m === null) allMaxKnown = false
            else max += m
        })
        if (!anyFrame) return ''
        return allMaxKnown ? `${spools}/${max} spools` : `${spools} spools`
    }

    ovenFrame(hostname: string): OvenFrame | null {
        const key = hostname.toLowerCase()
        for (const [h, frame] of Object.entries(this.fleetDaemonOvens)) {
            if (h.toLowerCase() === key) return frame
        }
        return null
    }

    ovenStatus(hostname: string): OvenStatus {
        return getOvenStatus(this.ovenFrame(hostname), this.$store.state.farm.fleetDaemonConnected)
    }

    /** Soft capacity: roster `maxSpools` → daemon `max_spools` → rows × slots → null. */
    ovenMax(hostname: string): number | null {
        const rosterMax = this.$store.getters['gui/remoteprinters/getMaxSpools'](hostname) as number | null
        return ovenMaxSpools(this.ovenFrame(hostname), rosterMax)
    }

    /** Weights by QR code from the fleet spool list: fallback for oven frames without weight fields. */
    get spoolWeightLookup(): OvenWeightLookup {
        const byQr = new Map<string, OvenSpoolWeights>()
        const spools: FleetSpool[] = this.$store.getters['fleet/spools/getSpools'] || []
        spools.forEach((s) => {
            if (!s.qr_code) return
            byQr.set(s.qr_code, { remaining: s.remaining_weight, capacity: s.initial_weight ?? s.filament_weight })
        })
        return (qr) => byQr.get(qr) ?? null
    }

    /** The fleet spool list only feeds the fill bar, so a failed load just hides the bar. */
    loadSpoolWeights() {
        this.$store.dispatch('fleet/spools/loadSpools').catch(() => {})
    }

    /** Marker top row: most common material, ties broken by weight (`EMPTY` when the oven holds nothing). */
    ovenTopMaterialText(hostname: string): string {
        return ovenTopMaterial(this.ovenFrame(hostname), this.spoolWeightLookup)
    }

    /** 0..1 fullness of the shown material by weight; null when no spool of it has known weights. */
    ovenMaterialFillFor(hostname: string): number | null {
        return ovenMaterialFill(this.ovenFrame(hostname), this.spoolWeightLookup)
    }

    ovenBarHeight(hostname: string): string {
        return Math.round((this.ovenMaterialFillFor(hostname) ?? 0) * 100) + '%'
    }

    /** Marker bottom row: `5/12` (`5/?` when no capacity is known, `?/12` without a frame). */
    ovenCountLabel(hostname: string): string {
        return ovenCountText(this.ovenFrame(hostname), this.ovenMax(hostname))
    }

    ovenIsOverCapacity(hostname: string): boolean {
        return ovenOverCapacity(this.ovenFrame(hostname), this.ovenMax(hostname))
    }

    /** Fire colour in the hearth (see ovenFire in farmOvenStatus.ts). */
    ovenFireFor(hostname: string): OvenFire {
        return ovenFire(this.ovenFrame(hostname), this.ovenStatus(hostname), this.spoolWeightLookup)
    }

    ovenDotClass(hostname: string) {
        const status = this.ovenStatus(hostname)
        return {
            'oven-dot--off': status === 'disconnected',
            'oven-dot--error': status === 'error',
            'oven-dot--editing': this.isEditing && !this.isDrawing,
        }
    }

    ovenDotStyle(hostname: string) {
        // 36px = the furnace sprite's native size, so its pixels render 1:1 (no resampling)
        void hostname
        const size = this.CELL - 10
        return { width: size + 'px', height: size + 'px' }
    }

    onOvenClick(hostname: string) {
        if (this.isEditing) return
        // Ovens cannot be fleet workers, so the workers map ignores the click
        if (this.mode === 'workers') return
        this.openPrinter({ socket: { hostname, webPort: 80 } })
    }

    /** Worker count, stickers and tooltip lines are shown in workers mode or on request. */
    get workersVisible(): boolean {
        return this.mode === 'workers' || this.showWorkers
    }

    /** Printers in this section currently enabled as fleet workers. */
    get workerCount(): number {
        return this.activePrinterEntries.filter(([hostname]) => this.isWorker(hostname)).length
    }

    getPrinterStatus(printer: any): PrinterStatus {
        return getPrinterStatusUtil(printer, this.$store.state.farm.fleetDaemonConnected)
    }

    countStatuses(entries: [string, any][]): Record<PrinterStatus, number> {
        const counts: Record<PrinterStatus, number> = { printing: 0, ready: 0, complete: 0, error: 0, disconnected: 0 }
        entries.forEach(([, printer]) => {
            counts[this.getPrinterStatus(printer)]++
        })
        return counts
    }

    get activeStatusList() {
        const c = this.countStatuses(this.activePrinterEntries)
        return this.STATUS_ORDER.map((k) => ({ key: k, label: this.STATUS_META[k].label, color: this.STATUS_META[k].color, count: c[k] }))
    }

    get editHint(): string {
        if (this.isDrawing) return 'Draw on the plan — strokes save per map.'
        if (this.isEditing) return this.ovenCount ? 'Drag any printer or oven to a new cell.' : 'Drag any printer to a new cell.'
        return ''
    }

    get drawStorageKey(): string {
        return 'mapdrawing.' + this.location + 'Strokes'
    }

    // ---------- marker rendering ----------
    getPrinterGridPosition(hostname: string): { x: number; y: number } {
        const key = hostname.toLowerCase()
        if (this.gridPositions[key]) return this.gridPositions[key]
        for (const printer of Object.values(this.remotePrinters)) {
            if ((printer as any).hostname?.toLowerCase() === key && (printer as any).gridPosition) {
                Vue.set(this.gridPositions, key, (printer as any).gridPosition)
                return (printer as any).gridPosition
            }
        }
        return { x: 1, y: 1 }
    }

    markerStatus(printer: any): PrinterStatus {
        return this.getPrinterStatus(printer)
    }

    markerFilament(printer: any): string {
        return printer?.toolhead?.filament_type || '—'
    }

    markerGlyph(printer: any): string {
        const status = this.getPrinterStatus(printer)
        if (status === 'printing') return this.getPrinterPrintPercent(printer) + '%'
        if (status === 'complete') return '✓'
        if (status === 'error') return '!'
        return ''
    }

    markerWrapStyle(hostname: string) {
        const pos = this.getPrinterGridPosition(hostname)
        return {
            position: 'absolute',
            left: (pos.x - 1) * this.CELL + this.pad + 'px',
            top: (pos.y - 1) * this.CELL + this.pad + 'px',
            width: this.CELL + 'px',
            height: this.CELL + 'px',
        }
    }

    markerDotStyle(printer: any, hostname: string) {
        const status = this.getPrinterStatus(printer)
        const square = this.isSquareModel(hostname)
        const off = status === 'disconnected'
        return {
            width: this.CELL - 10 + 'px',
            height: (this.CELL - 10) * this.modelHeightScale(hostname) + 'px',
            borderRadius: square ? '22%' : '50%',
            backgroundColor: this.STATUS_META[status].color,
            border: off ? '2px dashed #c4c4c4' : '2px solid rgba(255,255,255,.9)',
            boxShadow: this.isEditing && !this.isDrawing
                ? '0 0 0 2px rgba(240,211,176,.5), 0 2px 6px rgba(0,0,0,.4)'
                : off ? 'none' : '0 2px 6px rgba(0,0,0,.4)',
            opacity: off ? 0.55 : 1,
        }
    }

    markerRingStyle(printer: any, hostname: string) {
        const square = this.isSquareModel(hostname)
        return {
            width: this.CELL - 8 + 'px',
            height: (this.CELL - 8) * this.modelHeightScale(hostname) + 'px',
            borderRadius: square ? '26%' : '50%',
            border: '2.5px solid ' + this.STATUS_META.printing.color,
        }
    }

    // ---------- background markings ----------
    get farmDividers() {
        // thick separators: after Post Processing (col 1) + each aisle boundary
        return [1, 5, 9, 13, 17, 21].map((c) => ({
            left: this.pad + c * this.CELL + 'px',
            top: this.pad + 'px',
            height: this.gridH + 'px',
        }))
    }

    get farmLabels() {
        const labels: { text: string; style: Record<string, string> }[] = []
        labels.push({
            text: 'Post Processing',
            style: { left: '5px', top: this.pad + this.gridH / 2 + 'px', transform: 'translateY(-50%) rotate(180deg)', writingMode: 'vertical-rl', fontSize: '11px' },
        })
        for (let i = 0; i < 6; i++) {
            const startCol = 2 + i * 4
            labels.push({
                text: 'Isle ' + (i + 1),
                style: { left: this.pad + (startCol + 1) * this.CELL + 'px', top: '5px', transform: 'translateX(-50%)', fontSize: '11px' },
            })
        }
        labels.push({
            text: 'Farm Room',
            style: { left: this.pad + 13 * this.CELL + 'px', bottom: '4px', transform: 'translateX(-50%)', fontSize: '13px', letterSpacing: '.24em' },
        })
        return labels
    }

    // Bay door: on the right border of the grid, spanning these rows (inclusive)
    readonly BAY_DOOR_START_ROW = 5
    readonly BAY_DOOR_END_ROW = 9

    get bayDoorStyle() {
        return {
            left: this.pad + this.gridW + 'px',
            top: this.pad + (this.BAY_DOOR_START_ROW - 1) * this.CELL + 'px',
            height: (this.BAY_DOOR_END_ROW - this.BAY_DOOR_START_ROW + 1) * this.CELL + 'px',
        }
    }

    get bayDoorLabelStyle() {
        const centerY = this.pad + ((this.BAY_DOOR_START_ROW - 1 + this.BAY_DOOR_END_ROW) / 2) * this.CELL
        return {
            right: '2px',
            top: centerY + 'px',
            transform: 'translateY(-50%)',
            writingMode: 'vertical-rl',
            fontSize: '11px',
        }
    }

    // Ground floor: 3 areas in grid-cell units
    readonly GROUND_ROOMS = [
        { name: 'Production', gx: 1, gy: 1, wc: 3, hc: 12, side: 'left' },
        { name: 'R&D', gx: 4, gy: 1, wc: 22, hc: 9, side: 'top' },
        { name: 'Fulfilment', gx: 4, gy: 10, wc: 22, hc: 3, side: 'bottom' },
    ]

    get groundRooms() {
        return this.GROUND_ROOMS.map((r) => ({
            left: (r.gx - 1) * this.CELL + 'px',
            top: (r.gy - 1) * this.CELL + 'px',
            width: r.wc * this.CELL + 'px',
            height: r.hc * this.CELL + 'px',
        }))
    }

    get groundLabels() {
        return this.GROUND_ROOMS.map((r) => {
            const cx = this.pad + (r.gx - 1 + r.wc / 2) * this.CELL
            const cy = this.pad + (r.gy - 1 + r.hc / 2) * this.CELL
            let style: Record<string, string>
            if (r.side === 'left') style = { left: '5px', top: cy + 'px', transform: 'translateY(-50%) rotate(180deg)', writingMode: 'vertical-rl', fontSize: '12px' }
            else if (r.side === 'top') style = { left: cx + 'px', top: '5px', transform: 'translateX(-50%)', fontSize: '12px' }
            else style = { left: cx + 'px', bottom: '5px', transform: 'translateX(-50%)', fontSize: '12px' }
            return { text: r.name, style }
        })
    }

    // ---------- lifecycle ----------
    mounted() {
        this.loadGridPositions()
        this.loadSpoolWeights()
        fleetDaemonEvents.$on('spool_updated', this.loadSpoolWeights)
        fleetDaemonEvents.$on('ovens_updated', this.loadSpoolWeights)
    }

    beforeDestroy() {
        this.stopTooltipClock()
        fleetDaemonEvents.$off('spool_updated', this.loadSpoolWeights)
        fleetDaemonEvents.$off('ovens_updated', this.loadSpoolWeights)
    }

    @Watch('$store.state.gui.remoteprinters.printers', { deep: true })
    onRemotePrintersChanged() {
        this.loadGridPositions()
    }

    loadGridPositions() {
        Object.values(this.remotePrinters).forEach((printer: any) => {
            if (printer.hostname && printer.gridPosition) {
                Vue.set(this.gridPositions, printer.hostname.toLowerCase(), printer.gridPosition)
            }
        })
    }

    toggleEditMode() {
        this.isEditing = !this.isEditing
        if (!this.isEditing) this.isDrawing = false
    }

    toggleDrawMode() {
        this.isDrawing = !this.isDrawing
    }

    openPrinterSettings() {
        this.$root.$emit('open-settings', 'remote-printers')
    }

    isHighlighted(hostname: string): boolean {
        return !!this.highlightHostname && this.highlightHostname.toLowerCase() === (hostname || '').toLowerCase()
    }

    needsAttention(hostname: string): boolean {
        const h = (hostname || '').toLowerCase()
        return this.attentionHostnames.some((w) => w.toLowerCase() === h)
    }

    attentionReason(hostname: string): string | null {
        const h = (hostname || '').toLowerCase()
        const key = Object.keys(this.attentionReasons).find((k) => k.toLowerCase() === h)
        return key ? this.attentionReasons[key] || null : null
    }

    isWorker(hostname: string): boolean {
        const h = (hostname || '').toLowerCase()
        return this.workerHostnames.some((w) => w.toLowerCase() === h)
    }

    onMarkerClick(printer: any, hostname: string) {
        if (this.isEditing) return
        if (this.mode === 'workers') {
            this.$emit('toggle-worker', hostname)
            return
        }
        this.openPrinter(printer)
    }

    openPrinter(printer: any) {
        const socket = printer?.socket
        const hostname = socket?.hostname ?? ''
        if (!hostname) return
        const protocol = window.location.protocol
        const webPort = socket?.webPort ?? 80
        let url = protocol + '//' + hostname
        if (webPort !== 80) url += ':' + webPort
        window.open(url)
    }

    // ---------- drag to place ----------
    startGridDrag(event: MouseEvent, printer: any, hostname: string) {
        event.preventDefault()
        this.draggingPrinter = printer
        this.draggingGridHostname = hostname
        document.addEventListener('mousemove', this.onGridDrag)
        document.addEventListener('mouseup', this.stopGridDrag)
    }

    onGridDrag(event: MouseEvent) {
        if (!this.draggingGridHostname) return
        const canvas = this.$refs.canvas as HTMLElement | null
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const gx = Math.min(this.GRID_COLS, Math.max(1, Math.floor((event.clientX - rect.left - this.pad) / this.CELL) + 1))
        const gy = Math.min(this.GRID_ROWS, Math.max(1, Math.floor((event.clientY - rect.top - this.pad) / this.CELL) + 1))
        Vue.set(this.gridPositions, this.draggingGridHostname.toLowerCase(), { x: gx, y: gy })
    }

    stopGridDrag() {
        document.removeEventListener('mousemove', this.onGridDrag)
        document.removeEventListener('mouseup', this.stopGridDrag)
        if (this.draggingGridHostname) {
            const pos = this.gridPositions[this.draggingGridHostname.toLowerCase()]
            if (pos) this.updatePrinterGridPosition(this.draggingGridHostname, pos.x, pos.y)
        }
        this.draggingPrinter = null
        this.draggingGridHostname = ''
    }

    updatePrinterGridPosition(hostname: string, gx: number, gy: number) {
        const key = hostname.toLowerCase()
        let printerId: string | null = null
        for (const [id, printer] of Object.entries(this.remotePrinters)) {
            if ((printer as any).hostname?.toLowerCase() === key) {
                printerId = id
                break
            }
        }
        if (printerId) {
            this.$store.dispatch('gui/remoteprinters/updateOnDrag', {
                id: printerId,
                values: { gridPosition: { x: gx, y: gy } },
            })
        }
    }

    // ---------- tooltip ----------
    get hoveredRemainingG(): number | null {
        if (!this.hoveredPrinter) return null
        return computeRemainingFilamentG(this.hoveredPrinter)
    }

    showTooltip(printer: any, hostname: string, _event: MouseEvent) {
        if (this.isEditing) return
        this.hoveredOven = null
        this.stopTooltipClock()
        this.hoveredPrinter = printer
        this.placeTooltip(hostname)
    }

    placeTooltip(hostname: string) {
        const pos = this.getPrinterGridPosition(hostname)
        const cellLeft = (pos.x - 1) * this.CELL + this.pad
        const cellTop = (pos.y - 1) * this.CELL + this.pad
        const flipLeft = pos.x > this.GRID_COLS - 7
        this.tooltipStyle = {
            position: 'absolute',
            top: cellTop + 'px',
            left: flipLeft ? 'auto' : cellLeft + this.CELL + 8 + 'px',
            right: flipLeft ? this.gridW + this.CELL - cellLeft + 8 + 'px' : 'auto',
        }
    }

    hideTooltip() {
        this.hoveredPrinter = null
        this.hoveredOven = null
        this.stopTooltipClock()
    }

    // ---------- oven tooltip ----------
    showOvenTooltip(hostname: string) {
        if (this.isEditing) return
        this.hoveredPrinter = null
        const entry = this.ovenEntries.find((o) => o.hostname === hostname)
        this.hoveredOven = entry ?? { id: '', hostname }
        this.placeTooltip(hostname)
        this.tooltipNow = Date.now()
        // Countdowns ("3h 12m left") are recomputed from ready_at on every render; the clock
        // only runs while the oven tooltip is open.
        if (!this.tooltipTimer) this.tooltipTimer = setInterval(() => (this.tooltipNow = Date.now()), 1000)
    }

    stopTooltipClock() {
        if (this.tooltipTimer) {
            clearInterval(this.tooltipTimer)
            this.tooltipTimer = null
        }
    }

    get hoveredOvenFrame(): OvenFrame | null {
        return this.hoveredOven ? this.ovenFrame(this.hoveredOven.hostname) : null
    }

    get hoveredOvenLabel(): string {
        return this.hoveredOven ? ovenLabel(this.hoveredOvenFrame, this.hoveredOven.hostname) : ''
    }

    get hoveredOvenStatusLabel(): string {
        return this.hoveredOven ? OVEN_STATUS_META[this.ovenStatus(this.hoveredOven.hostname)].label : ''
    }

    get hoveredOvenTemps(): string[] {
        return ovenTemperatureLines(this.hoveredOvenFrame)
    }

    get hoveredOvenLayout(): string {
        const cfg = this.hoveredOvenFrame?.oven?.config
        if (!cfg || cfg.shelf_rows == null || cfg.slots_per_row == null) return ''
        return `${cfg.shelf_rows} rows × ${cfg.slots_per_row} slots`
    }

    get hoveredOvenTotal(): number {
        return ovenSpoolCount(this.hoveredOvenFrame)
    }

    get hoveredOvenReady(): number {
        return ovenReadyCount(this.hoveredOvenFrame)
    }

    get hoveredOvenCapacityText(): string {
        const max = this.hoveredOven ? this.ovenMax(this.hoveredOven.hostname) : null
        return max === null ? 'unknown' : String(max)
    }

    get hoveredOvenTopMaterialDetail(): string {
        return ovenTopMaterialDetail(this.hoveredOvenFrame, this.spoolWeightLookup)
    }

    get hoveredOvenSpoolLines(): string[] {
        const spools = [...(this.hoveredOvenFrame?.oven?.spools ?? [])]
        spools.sort((a, b) => a.row - b.row || a.slot - b.slot)
        return spools.map((s) => ovenSpoolLine(s, this.tooltipNow))
    }

    getPrinterPrintPercent(printer: any): number {
        const progress = printer?.virtual_sdcard?.progress || 0
        return Math.floor(progress * 100)
    }
}
</script>

<style scoped>
@keyframes pulsering {
    0% { transform: scale(1); opacity: 0.75; }
    100% { transform: scale(1.7); opacity: 0; }
}
@keyframes save-pulse-anim {
    0%, 100% { box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.45), 0 0 12px 2px rgba(76, 175, 80, 0.55); }
    50% { box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.7), 0 0 20px 4px rgba(76, 175, 80, 0.8); }
}

.save-pulse {
    font-weight: 700 !important;
    animation: save-pulse-anim 1.4s ease-in-out infinite;
}

/* Section title */
.section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 700;
    color: #fff;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
.section-pill {
    font-size: 11px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 9px;
    background: var(--v-primary-base, #f0d3b0);
    color: #1a1712;
}

/* Status counters */
.status-counters {
    display: flex;
    gap: 15px;
    flex-wrap: wrap;
    align-items: center;
}
.status-counter {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 500;
}
.status-counter--total {
    font-weight: 700;
    padding-right: 12px;
    border-right: 1px solid rgba(128, 128, 128, 0.4);
}
.status-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    display: inline-block;
}
.status-dot.square {
    border-radius: 2px;
}
/* Oven legend dot: hollow rounded square with a thick border, like the marker */
.status-dot.oven {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    background: rgba(30, 27, 22, 0.9);
    border: 2px solid;
    box-sizing: border-box;
}
.status-counter--oven {
    padding-left: 12px;
    border-left: 1px solid rgba(128, 128, 128, 0.4);
}

/* Controls */
.map-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}
.edit-hint {
    font-size: 11px;
    opacity: 0.55;
}

/* Grid canvas */
.grid-scroll {
    width: 100%;
    overflow: auto;
}
.grid-canvas {
    position: relative;
    background: #f5f3ef;
    border: 1px solid #33322f;
    border-radius: 6px;
    overflow: hidden;
}
.grid-lines {
    position: absolute;
    box-sizing: border-box;
    border: 1px solid rgba(40, 36, 30, 0.28);
    pointer-events: none;
    z-index: 1;
    background-repeat: repeat;
    background-image:
        linear-gradient(to right, rgba(40, 36, 30, 0.25) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(40, 36, 30, 0.25) 1px, transparent 1px);
}
.rooms-wrap {
    position: absolute;
    pointer-events: none;
    z-index: 0;
}
.area-room {
    position: absolute;
    box-sizing: border-box;
    border: 2.5px solid rgba(60, 55, 48, 0.5);
}
.area-divider {
    position: absolute;
    width: 2.5px;
    background: rgba(60, 55, 48, 0.5);
    transform: translateX(-50%);
    pointer-events: none;
    z-index: 0;
}
.bay-door {
    position: absolute;
    width: 7px;
    background: rgba(60, 55, 48, 0.65);
    transform: translateX(-50%);
    pointer-events: none;
    z-index: 0;
}
.area-label {
    position: absolute;
    font-family: 'Roboto Mono', monospace;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: rgba(60, 55, 48, 0.6);
    text-transform: uppercase;
    white-space: nowrap;
    pointer-events: none;
    z-index: 0;
}

.draw-layer {
    position: absolute;
    z-index: 3;
}

/* Markers */
.marker {
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    cursor: pointer;
}
.marker.draggable {
    cursor: move;
}
@keyframes highlight-pulse {
    0%, 100% { box-shadow: 0 0 0 4px rgba(255, 235, 59, 0.95), 0 0 18px 6px rgba(255, 235, 59, 0.55); }
    50% { box-shadow: 0 0 0 7px rgba(255, 235, 59, 0.6), 0 0 26px 10px rgba(255, 235, 59, 0.35); }
}
.marker.highlighted {
    z-index: 5;
}
.marker.highlighted >>> .marker-dot {
    animation: highlight-pulse 0.9s ease-in-out infinite;
    transform: scale(1.12);
}
.worker-sticker {
    position: absolute;
    bottom: -5px;
    right: -5px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #f57c00;
    border: 1.5px solid rgba(255, 255, 255, 0.9);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: visible;
    pointer-events: none;
    z-index: 3;
}
@keyframes attention-flash {
    0%, 100% { background: #d32f2f; box-shadow: 0 0 0 0 rgba(211, 47, 47, 0.7), 0 1px 3px rgba(0, 0, 0, 0.5); }
    50% { background: #ff5252; box-shadow: 0 0 0 6px rgba(211, 47, 47, 0), 0 1px 3px rgba(0, 0, 0, 0.5); }
}
.attention-sticker {
    animation: attention-flash 0.8s ease-in-out infinite;
}
/* Hammer swing: starts from the icon as drawn (head upper-right, handle to the
   lower-left), strikes by turning 45° clockwise about a point halfway down the handle,
   rebounds a touch, then rises slowly back to the drawn position. */
@keyframes hammer-swing {
    0% { transform: rotate(0deg); }
    20% { transform: rotate(45deg); }
    28% { transform: rotate(38deg); }
    100% { transform: rotate(0deg); }
}
.worker-sticker >>> .worker-hammer {
    transform-origin: 31% 69%;
    animation: hammer-swing 1s ease-in-out infinite;
}
.marker-ring {
    position: absolute;
    animation: pulsering 1.6s ease-out infinite;
    pointer-events: none;
}
.marker-dot {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    box-sizing: border-box;
    color: #fff;
}
.marker-host {
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.02em;
}
.marker-glyph {
    font-weight: 800;
    line-height: 1;
}

/* Oven markers: pixel-art furnace body with material over count/max stacked in the window
   (same two-row layout as the printer marker) and an animated fire sprite in the hearth */
.marker.highlighted >>> .oven-dot {
    animation: highlight-pulse 0.9s ease-in-out infinite;
    transform: scale(1.12);
}
.oven-dot {
    position: relative;
    box-sizing: border-box;
    background: url('/img/oven/oven-body.png') center / 100% 100% no-repeat;
    image-rendering: pixelated;
    /* slightly see-through so the map grid shows behind the furnace */
    opacity: 0.85;
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.45));
}
.oven-dot--off {
    opacity: 0.5;
    filter: grayscale(1);
}
.oven-dot--error {
    filter: drop-shadow(0 0 3px #d32f2f) drop-shadow(0 0 1px #d32f2f);
}
.oven-dot--editing {
    outline: 2px solid rgba(240, 211, 176, 0.5);
    outline-offset: 2px;
    border-radius: 18%;
}
.oven-fire {
    position: absolute;
    inset: 0;
    background-repeat: no-repeat;
    background-size: 300% 100%;
    background-position-x: 0;
    image-rendering: pixelated;
    pointer-events: none;
    animation: oven-flicker 0.45s steps(3, end) infinite;
}
.oven-fire--red {
    background-image: url('/img/oven/oven-fire-red.png');
}
.oven-fire--blue {
    background-image: url('/img/oven/oven-fire-blue.png');
}
.oven-fire--green {
    background-image: url('/img/oven/oven-fire-green.png');
}
/* 3-frame sprite sheet: the steps land on 0% / 50% / 100% = frame 1 / 2 / 3 */
@keyframes oven-flicker {
    from {
        background-position-x: 0;
    }
    to {
        background-position-x: 150%;
    }
}
/* Two text rows stacked over the furnace window + band (rows 9-23 of the 36px sprite) */
.oven-text {
    position: absolute;
    left: 1px;
    right: 5px; /* leaves the right wall to the material fill bar */
    top: 22%;
    height: 44%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    padding: 0 2px;
    box-sizing: border-box;
    color: #fff;
    /* heaviest Roboto face + a hard offset shadow (a blurred glow makes 7-9px strokes look thin) */
    font-weight: 900;
    text-shadow: 0 1px 0 #000, 1px 0 0 rgba(0, 0, 0, 0.7);
}
.oven-material {
    display: block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1;
}
.oven-count {
    line-height: 1;
    white-space: nowrap;
}
.oven-count--over {
    color: #ff5252;
}
/* Material fill bar on the right wall: grams left / grams when full of the shown material */
.oven-bar {
    position: absolute;
    right: 1px;
    top: 22%;
    height: 44%;
    width: 3px;
    border-radius: 1px;
    background: rgba(0, 0, 0, 0.6);
    overflow: hidden;
    pointer-events: none;
}
.oven-bar-fill {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    background: #00e676;
    transition: height 0.3s ease;
}

/* Tooltip */
.tooltip {
    background-color: rgba(0, 0, 0, 0.78);
    color: #fff;
    padding: 6px 10px;
    border-radius: 4px;
    white-space: nowrap;
    z-index: 10;
    font-size: 12px;
    line-height: 1.45;
    pointer-events: none;
}
.tooltip p {
    margin: 0;
}
.tooltip .attention-reason {
    color: #ff8a80;
    white-space: normal;
    max-width: 300px;
}
.tooltip .oven-spool-line {
    font-family: 'Roboto Mono', monospace;
    font-size: 11px;
    white-space: pre;
}
.tooltip .oven-hint {
    opacity: 0.6;
    font-style: italic;
}
.tooltip .oven-over {
    color: #ff8a80;
}
</style>
