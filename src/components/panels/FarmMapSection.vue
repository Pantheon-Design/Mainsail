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
            <v-btn v-if="mode === 'air'" small title="Add air sensor" @click="openAirSensorSettings">
                Add Sensor
            </v-btn>
            <v-btn small title="Add printer" @click="openPrinterSettings">
                Add Printer
            </v-btn>
            <v-btn v-if="isEditing && mode !== 'air'" small :color="isDrawing ? 'success' : undefined" :class="{ 'save-pulse': isDrawing }"
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
            <span
                v-if="workersVisible"
                class="status-counter status-counter--attention"
                :class="{ 'status-counter--attention-active': sectionAttentionHostnames.length > 0 }"
                :title="sectionAttentionTitle">
                <v-icon x-small :color="sectionAttentionHostnames.length ? 'white' : undefined">{{ mdiExclamationThick }}</v-icon>
                {{ sectionAttentionHostnames.length }} need{{ sectionAttentionHostnames.length === 1 ? 's' : '' }} attention
            </span>
            <span v-for="s in activeStatusList" :key="'active-' + s.key" class="status-counter">
                <span class="status-dot" :class="{ square: s.key === 'error' || s.key === 'printing' }"
                      :style="{ backgroundColor: s.color }"></span>
                {{ s.label }} {{ s.count }}
            </span>
            <!-- Air mode: sensors on this floor and how many are reporting -->
            <span v-if="mode === 'air'" class="status-counter status-counter--air" :title="airSensorLegendTitle">
                <span class="status-dot air" :style="{ backgroundColor: airLegendColor }"></span>
                Sensor{{ airSensorCount === 1 ? '' : 's' }} {{ airSensorCount }}
                <span v-if="airSensorCount" class="status-counter__muted">&middot; {{ airOnlineCount }} online</span>
            </span>
            <!-- Ovens are counted apart from printers (never part of the printer statuses) -->
            <span
                v-if="ovenCount && mode !== 'air'"
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

                <!-- Air quality field (air mode): under the grid lines and markers, over the room markings -->
                <air-quality-overlay
                    v-if="mode === 'air'"
                    class="air-layer"
                    :style="roomsWrapStyle"
                    :width="gridW"
                    :height="gridH"
                    :fields="airFields"
                    :metric="airMetric"
                    :cell="CELL" />

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
                    <div v-if="mode !== 'air' && markerStatus(printer) === 'printing'" class="marker-ring"
                         :style="markerRingStyle(printer, hostname)"></div>
                    <div class="marker-dot" :style="markerDotStyle(printer, hostname)">
                        <!-- Air mode: minimal marker, just the printer icon on the status colour -->
                        <v-icon v-if="mode === 'air'" size="20" color="#fff">{{ mdiPrinter3d }}</v-icon>
                        <template v-else>
                            <span class="marker-host" :style="{ fontSize: markerFilament(printer).length > 4 ? '7px' : '9px' }">
                                {{ markerFilament(printer) }}
                            </span>
                            <span v-if="markerGlyph(printer)" class="marker-glyph"
                                  :style="{ fontSize: markerStatus(printer) === 'printing' ? '9px' : '13px' }">
                                {{ markerGlyph(printer) }}
                            </span>
                        </template>
                    </div>
                    <!-- Worker stickers: flashing "!" when the worker needs attention, else the hammer -->
                    <span v-if="mode !== 'air' && workersVisible && needsAttention(hostname)" class="worker-sticker attention-sticker"
                          :title="attentionReason(hostname) || 'Worker needs attention'">
                        <v-icon size="13" color="#fff">{{ mdiExclamationThick }}</v-icon>
                    </span>
                    <span v-else-if="mode !== 'air' && workersVisible && isWorker(hostname)" class="worker-sticker" title="Fleet worker">
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
                    v-for="o in mode === 'air' ? [] : ovenEntries"
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

                <!-- Oven tooltip: name, oven temperature, then one block per material (same
                     ranking as the marker, so the first block is the material shown on the icon):
                       row 1  `NAME ×n` | grams left / grams when full | fullness bar
                       row 2  `r ready · d drying`                     | readiness bar (green = ready
                              share, amber track = still drying) -->
                <div v-if="hoveredOven" ref="tooltipEl" class="tooltip tooltip--oven" :style="tooltipStyle">
                    <p>
                        <strong>{{ hoveredOvenLabel }}</strong>
                        <span v-if="hoveredOvenStatusNote" class="oven-note"> · {{ hoveredOvenStatusNote }}</span>
                    </p>
                    <p>Temperature: {{ hoveredOvenTemperature }}</p>
                    <p v-if="hoveredOvenFrame && !hoveredOvenMaterials.length" class="oven-note">No spools loaded</p>
                    <div v-for="m in hoveredOvenMaterials" :key="'m-' + m.material" class="oven-mat">
                        <span class="oven-mat-name">{{ m.material }} ×{{ m.count }}</span>
                        <span class="oven-mat-weight">{{ m.weightText }}</span>
                        <span class="oven-mat-bar">
                            <span class="oven-mat-bar-fill" :style="{ width: m.fillPercent + '%' }"></span>
                        </span>
                        <span class="oven-mat-state">
                            <span class="oven-mat-ready">{{ m.ready }} ready</span> ·
                            <span class="oven-mat-drying">{{ m.drying }} drying</span>
                        </span>
                        <span class="oven-mat-bar oven-mat-bar--dry">
                            <span class="oven-mat-bar-fill" :style="{ width: m.readyPercent + '%' }"></span>
                        </span>
                    </div>
                    <p v-if="isEditing" class="oven-hint">Drag to place</p>
                </div>

                <!-- Air sensors (roster deviceType === 'air_sensor', air mode only), placed by
                     gridPosition like printers and ovens. Driven by the roster so a sensor that
                     has never reported still shows up (offline, grey) and can be dragged. The
                     body colour is the quality band of the selected metric and the text is its
                     exact reading. -->
                <div
                    v-for="s in airSensorEntries"
                    :key="'air-' + s.hostname"
                    class="marker marker--air"
                    :style="markerWrapStyle(s.hostname)"
                    :class="{ draggable: isEditing && !isDrawing, highlighted: isHighlighted(s.hostname), 'marker--air-editing': isEditing && !isDrawing }"
                    :data-air-sensor-id="s.hostname"
                    @mousedown="isEditing && !isDrawing ? startGridDrag($event, null, s.hostname) : null"
                    @mouseover="showAirTooltip(s.hostname)"
                    @mouseleave="hideTooltip">
                    <air-sensor-icon
                        :size="CELL - 10"
                        :fill="airSensorColor(s.hostname)"
                        :value="airSensorValueText(s.hostname)"
                        :unit="airMetricUnit"
                        :offline="!airSensorOnline(s.hostname)" />
                </div>

                <!-- Air sensor tooltip: label, host, online state, then one row per metric -->
                <div v-if="hoveredAirSensor" ref="tooltipEl" class="tooltip tooltip--air" :style="tooltipStyle">
                    <p>
                        <strong>{{ hoveredAirSensorLabel }}</strong>
                        <span v-if="hoveredAirSensorLabel !== hoveredAirSensor.hostname" class="oven-note">
                            &middot; {{ hoveredAirSensor.hostname }}
                        </span>
                    </p>
                    <p :class="hoveredAirSensorOnline ? 'air-online' : 'air-offline'">
                        {{ hoveredAirSensorOnline ? 'online' : 'offline' }}
                        <span class="oven-note">&middot; {{ hoveredAirSensorAge }}</span>
                        <span v-if="hoveredAirSensorError" class="oven-note">&middot; {{ hoveredAirSensorError }}</span>
                    </p>
                    <p v-if="!hoveredAirSensorRows.length" class="oven-note">No readings yet</p>
                    <div v-for="r in hoveredAirSensorRows" :key="'air-row-' + r.key" class="air-row" :class="{ 'air-row--selected': r.key === metricKey }">
                        <span class="air-row-label">{{ r.label }}</span>
                        <span class="air-row-value">{{ r.value }}</span>
                        <span class="air-row-band">
                            <span class="air-row-dot" :style="{ backgroundColor: r.color }"></span>
                            {{ r.band }}
                        </span>
                    </div>
                    <p v-if="isEditing" class="oven-hint">Drag to place</p>
                </div>

                <!-- Tooltip -->
                <farm-printer-tooltip
                    v-if="hoveredPrinter"
                    ref="tooltipEl"
                    :printer="hoveredPrinter"
                    :show-worker="workersVisible"
                    :is-worker="isWorker(hoveredPrinter.socket.hostname)"
                    :needs-attention="needsAttention(hoveredPrinter.socket.hostname)"
                    :attention-reason="attentionReason(hoveredPrinter.socket.hostname)"
                    :toggle-hint="mode === 'workers'"
                    :style="tooltipStyle" />
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Mixins, Prop, Watch } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import MapDrawingOverlay from '@/components/panels/MapDrawingOverlay.vue'
import MapDrawingToolbar from '@/components/panels/MapDrawingToolbar.vue'
import FarmPrinterTooltip from '@/components/panels/FarmPrinterTooltip.vue'
import Vue from 'vue'
import { hostKey } from '@/plugins/hostKey'
import { getPrinterStatus as getPrinterStatusUtil, PrinterStatus, STATUS_META, STATUS_ORDER } from '@/components/panels/farmPrinterStatus'
import { PrinterModel, SQUARE_PRINTER_MODELS, PRINTER_MODEL_HEIGHT_SCALE } from '@/store/gui/remoteprinters/types'
import { AirSensorFrame, OvenFrame } from '@/store/farm/types'
import { FleetSpool } from '@/store/fleet/spools/types'
import { AirMetric } from '@/store/fleet/air/types'
import AirSensorIcon from '@/components/panels/AirSensorIcon.vue'
import AirQualityOverlay, { AirField } from '@/components/panels/AirQualityOverlay.vue'
import {
    AIR_NEUTRAL_COLOR,
    bandColor,
    bandFor,
    formatAge,
    formatMetricReading,
    formatMetricValue,
    isSensorOnline,
    metricUnit,
    sensorAgeSeconds,
    sensorValue,
} from '@/components/panels/airQualityBands'
import { fleetDaemonEvents } from '@/plugins/fleetDaemonClient'
import {
    getOvenStatus,
    ovenCountText,
    ovenLabel,
    ovenMaxSpools,
    ovenOverCapacity,
    ovenSpoolCount,
    ovenTopMaterial,
    OvenStatus,
    OvenFire,
    ovenFire,
    ovenMaterialFill,
    ovenMaterialStats,
    ovenTemperatureText,
    formatWeight,
    OvenSpoolWeights,
    OvenWeightLookup,
    OVEN_LEGEND,
    OVEN_STATUS_META,
} from '@/components/panels/farmOvenStatus'
import { mdiExclamationThick, mdiHammer, mdiPrinter3d } from '@mdi/js'
import { attentionChipTitle } from '@/components/panels/fleetWorkerAttention'

type MapLocation = 'farm' | 'ground'

interface OvenEntry {
    /** roster id (gui/remoteprinters key) */
    id: string
    hostname: string
}

interface AirSensorEntry {
    /** roster id (gui/remoteprinters key) */
    id: string
    hostname: string
    label: string
}

@Component({
    components: {
        MapDrawingOverlay,
        MapDrawingToolbar,
        FarmPrinterTooltip,
        AirSensorIcon,
        AirQualityOverlay,
    },
})
export default class FarmMapSection extends Mixins(BaseMixin) {
    @Prop({ type: String, required: true }) readonly location!: MapLocation
    @Prop({ type: String, required: true }) readonly name!: string
    /** 'map' (default): edit/drag, click opens the printer. 'workers': no editing,
     *  click emits `toggle-worker`(hostname), worker printers get a hammer sticker.
     *  'air': Air Quality page - minimal printer markers (icon + status colour), air sensor
     *  markers coloured by the selected metric's quality band, the colour field underneath,
     *  edit/drag for printers and sensors (no drawing). */
    @Prop({ type: String, default: 'map' }) readonly mode!: 'map' | 'workers' | 'air'
    /** Air mode: key of the metric (from fleet/air/getMetrics) the markers and overlay show. */
    @Prop({ type: String, default: '' }) readonly metricKey!: string
    /** Map mode only: also show the per-section worker count, stickers and tooltip lines
     *  (the Fleet Map page passes this so it mirrors the Workers map without toggling). */
    @Prop({ type: Boolean, default: false }) readonly showWorkers!: boolean
    /** Hostnames currently enabled as fleet workers (workers mode). */
    @Prop({ type: Array, default: () => [] }) readonly workerHostnames!: string[]
    /** Printer to highlight on the map (e.g. hovered in a side list). */
    @Prop({ type: String, default: '' }) readonly highlightHostname!: string
    /** Workers that could run a job but are blocked by low filament / not primed / worn-out or unset nozzle:
     *  they get a flashing red "!" sticker instead of the hammer. */
    @Prop({ type: Array, default: () => [] }) readonly attentionHostnames!: string[]
    /** Scheduler reason per attention hostname (e.g. "filament 350g < 400g needed …"),
     *  shown in the hover tooltip and the sticker title. */
    @Prop({ type: Object, default: () => ({}) }) readonly attentionReasons!: Record<string, string>

    mdiHammer = mdiHammer
    mdiExclamationThick = mdiExclamationThick
    mdiPrinter3d = mdiPrinter3d

    // Grid geometry
    readonly GRID_COLS = 25
    readonly CELL = 46
    /** Rows per location: the Print Farm has one extra row along the bottom. */
    get GRID_ROWS(): number {
        return this.location === 'farm' ? 13 : 12
    }

    // Status colour/label vocabulary shared with the other fleet views (farmPrinterStatus.ts)
    readonly STATUS_META = STATUS_META
    readonly STATUS_ORDER = STATUS_ORDER
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
    hoveredAirSensor: AirSensorEntry | null = null
    tooltipStyle: Record<string, string> = { top: '0px', left: '0px', position: 'absolute' }

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

    /** Roster entries by hostKey (cached getter). Every per-printer roster lookup in this
     *  component goes through it: activePrinterEntries runs one lookup per printer on every
     *  store commit, and scanning the roster inside that made it O(N^2). */
    get rosterByKey(): Record<string, any> {
        return this.$store.getters['gui/remoteprinters/byHostKey'] || {}
    }

    // Resolve a printer's location, defaulting legacy printers (no location key) to 'farm'
    getPrinterLocation(hostname: string): MapLocation {
        return (this.rosterByKey[hostKey(hostname)]?.location as MapLocation) ?? 'farm'
    }

    getPrinterModel(hostname: string): PrinterModel | null {
        return this.rosterByKey[hostKey(hostname)]?.printerModel ?? null
    }

    // Ovens and air sensors are roster entries (deviceType 'oven' / 'air_sensor') but not
    // printers: they never send printer WS frames, so without this filter they would render
    // as offline printers.
    isPrinterHostname(hostname: string): boolean {
        return this.$store.getters['gui/remoteprinters/getDeviceType'](hostname) === 'printer'
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
            ([hostname]) => this.isPrinterHostname(hostname) && this.getPrinterLocation(hostname) === this.location
        ) as [string, any][]
    }

    // ---------- air sensors (air mode) ----------
    get fleetDaemonAirSensors(): Record<string, AirSensorFrame> {
        return this.$store.state.farm.fleetDaemonAirSensors || {}
    }

    get airMetric(): AirMetric | null {
        return this.metricKey ? this.$store.getters['fleet/air/getMetric'](this.metricKey) : null
    }

    get airMetrics(): AirMetric[] {
        return this.$store.getters['fleet/air/getMetrics'] || []
    }

    get airMetricUnit(): string {
        return metricUnit(this.airMetric)
    }

    /** Roster sensors on this map tab (roster-driven like ovens, so unplaced/offline ones still show). */
    get airSensorEntries(): AirSensorEntry[] {
        if (this.mode !== 'air') return []
        const seen = new Set<string>()
        const entries: AirSensorEntry[] = []
        for (const [id, entry] of Object.entries(this.remotePrinters)) {
            const e = entry as any
            if (e?.deviceType !== 'air_sensor' || !e.hostname) continue
            if (((e.location as MapLocation) ?? 'farm') !== this.location) continue
            const key = hostKey(e.hostname)
            if (seen.has(key)) continue
            seen.add(key)
            entries.push({ id, hostname: e.hostname, label: (e.label ?? '').trim() })
        }
        return entries.sort((a, b) => a.hostname.localeCompare(b.hostname))
    }

    get airSensorCount(): number {
        return this.airSensorEntries.length
    }

    get airOnlineCount(): number {
        return this.airSensorEntries.filter((s) => this.airSensorOnline(s.hostname)).length
    }

    get airSensorLegendTitle(): string {
        if (!this.airSensorCount) return 'No air sensors placed on this floor'
        return `${this.airOnlineCount} of ${this.airSensorCount} sensors reporting`
    }

    /** Legend swatch: the first (best) band colour of the selected metric. */
    get airLegendColor(): string {
        return this.airMetric?.bands?.[0]?.color ?? AIR_NEUTRAL_COLOR
    }

    airSensorFrame(hostname: string): AirSensorFrame | null {
        const key = hostKey(hostname)
        for (const [h, frame] of Object.entries(this.fleetDaemonAirSensors)) {
            if (hostKey(h) === key) return frame
        }
        return null
    }

    airSensorOnline(hostname: string): boolean {
        return isSensorOnline(this.airSensorFrame(hostname), this.$store.state.farm.fleetDaemonConnected)
    }

    airSensorValue(hostname: string): number | null {
        return sensorValue(this.airSensorFrame(hostname), this.metricKey)
    }

    /** Body colour: the band of the selected metric; neutral grey when offline or no reading. */
    airSensorColor(hostname: string): string {
        if (!this.airSensorOnline(hostname)) return AIR_NEUTRAL_COLOR
        return bandColor(this.airMetric, this.airSensorValue(hostname))
    }

    airSensorValueText(hostname: string): string {
        return formatMetricValue(this.airMetric, this.airSensorValue(hostname))
    }

    airSensorLabel(hostname: string): string {
        const entry = this.airSensorEntries.find((s) => hostKey(s.hostname) === hostKey(hostname))
        return entry?.label || hostname.replace(/\.local$/i, '')
    }

    /** Overlay inputs: every online sensor with a reading, at its (possibly mid-drag) cell centre. */
    get airFields(): AirField[] {
        if (this.mode !== 'air' || !this.airMetric) return []
        const fields: AirField[] = []
        for (const s of this.airSensorEntries) {
            if (!this.airSensorOnline(s.hostname)) continue
            const value = this.airSensorValue(s.hostname)
            if (value === null) continue
            const pos = this.getPrinterGridPosition(s.hostname)
            const range = this.$store.getters['gui/remoteprinters/getSensorRange'](s.hostname) as number
            fields.push({
                cx: (pos.x - 0.5) * this.CELL,
                cy: (pos.y - 0.5) * this.CELL,
                radius: range * this.CELL,
                value,
            })
        }
        return fields
    }

    openAirSensorSettings() {
        this.$root.$emit('open-settings', 'air-sensors')
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
            const key = hostKey(e.hostname)
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
        const key = hostKey(hostname)
        for (const [h, frame] of Object.entries(this.fleetDaemonOvens)) {
            if (hostKey(h) === key) return frame
        }
        return null
    }

    ovenStatus(hostname: string): OvenStatus {
        return getOvenStatus(this.ovenFrame(hostname), this.$store.state.farm.fleetDaemonConnected)
    }

    /** Soft capacity (display only): roster `maxSpools` → daemon `max_spools` → null. Never derived from the shelf layout. */
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
        // Open by the hostname fleet_daemon resolved (`oven1.local`), since a roster entry may be
        // saved without the `.local` suffix that mDNS needs in the browser.
        const resolved = this.ovenFrame(hostname)?.hostname || hostname
        this.openPrinter({ socket: { hostname: resolved, webPort: 80 } })
    }

    /** Worker count, stickers and tooltip lines are shown in workers mode or on request. */
    get workersVisible(): boolean {
        return this.mode === 'workers' || this.showWorkers
    }

    /** Printers in this section currently enabled as fleet workers. */
    get workerCount(): number {
        return this.activePrinterEntries.filter(([hostname]) => this.isWorker(hostname)).length
    }

    /** Blocked workers placed in this section (the page header counts the whole fleet). */
    get sectionAttentionHostnames(): string[] {
        return this.activePrinterEntries.map(([hostname]) => hostname).filter((h) => this.needsAttention(h))
    }

    get sectionAttentionTitle(): string {
        const reasons: Record<string, string> = {}
        this.sectionAttentionHostnames.forEach((h) => {
            const r = this.attentionReason(h)
            if (r) reasons[h] = r
        })
        return attentionChipTitle(this.sectionAttentionHostnames, reasons)
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
        if (this.isEditing && this.mode === 'air') return 'Drag any printer or sensor to a new cell.'
        if (this.isEditing) return this.ovenCount ? 'Drag any printer or oven to a new cell.' : 'Drag any printer to a new cell.'
        return ''
    }

    get drawStorageKey(): string {
        return 'mapdrawing.' + this.location + 'Strokes'
    }

    // ---------- marker rendering ----------
    getPrinterGridPosition(hostname: string): { x: number; y: number } {
        const key = hostKey(hostname)
        if (this.gridPositions[key]) return this.gridPositions[key]
        const gridPosition = this.rosterByKey[key]?.gridPosition
        if (gridPosition) {
            Vue.set(this.gridPositions, key, gridPosition)
            return gridPosition
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
                Vue.set(this.gridPositions, hostKey(printer.hostname), printer.gridPosition)
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
        return !!this.highlightHostname && hostKey(this.highlightHostname) === hostKey(hostname)
    }

    /** hostKey sets of the worker / attention props, so the per-marker checks are O(1). */
    get workerHostKeys(): Set<string> {
        return new Set(this.workerHostnames.map((w) => hostKey(w)))
    }

    get attentionHostKeys(): Set<string> {
        return new Set(this.attentionHostnames.map((w) => hostKey(w)))
    }

    needsAttention(hostname: string): boolean {
        return this.attentionHostKeys.has(hostKey(hostname))
    }

    attentionReason(hostname: string): string | null {
        const h = hostKey(hostname)
        const key = Object.keys(this.attentionReasons).find((k) => hostKey(k) === h)
        return key ? this.attentionReasons[key] || null : null
    }

    isWorker(hostname: string): boolean {
        return this.workerHostKeys.has(hostKey(hostname))
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
        Vue.set(this.gridPositions, hostKey(this.draggingGridHostname), { x: gx, y: gy })
    }

    stopGridDrag() {
        document.removeEventListener('mousemove', this.onGridDrag)
        document.removeEventListener('mouseup', this.stopGridDrag)
        if (this.draggingGridHostname) {
            const pos = this.gridPositions[hostKey(this.draggingGridHostname)]
            if (pos) this.updatePrinterGridPosition(this.draggingGridHostname, pos.x, pos.y)
        }
        this.draggingPrinter = null
        this.draggingGridHostname = ''
    }

    updatePrinterGridPosition(hostname: string, gx: number, gy: number) {
        const key = hostKey(hostname)
        let printerId: string | null = null
        for (const [id, printer] of Object.entries(this.remotePrinters)) {
            if (hostKey((printer as any).hostname) === key) {
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
    showTooltip(printer: any, hostname: string, _event: MouseEvent) {
        if (this.isEditing) return
        this.hoveredOven = null
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
        // The canvas clips overflow, so once the tooltip has rendered (and its height is known)
        // push it up as far as needed to keep it inside the bottom edge.
        this.$nextTick(this.clampTooltipToCanvas)
    }

    clampTooltipToCanvas() {
        // The printer tooltip is a component (use its root element); the oven tooltip is a plain div.
        const ref = this.$refs.tooltipEl as Vue | HTMLElement | undefined
        const el = ref && '$el' in ref ? (ref.$el as HTMLElement) : ref
        if (!el) return
        const margin = 4
        const canvasH = this.gridH + this.CELL
        const top = parseFloat(this.tooltipStyle.top)
        if (isNaN(top)) return
        const maxTop = Math.max(margin, canvasH - el.offsetHeight - margin)
        if (top > maxTop) this.tooltipStyle = { ...this.tooltipStyle, top: maxTop + 'px' }
    }

    hideTooltip() {
        this.hoveredPrinter = null
        this.hoveredOven = null
        this.hoveredAirSensor = null
    }

    // ---------- air sensor tooltip ----------
    showAirTooltip(hostname: string) {
        if (this.isEditing) return
        this.hoveredPrinter = null
        this.hoveredOven = null
        const entry = this.airSensorEntries.find((s) => s.hostname === hostname)
        this.hoveredAirSensor = entry ?? { id: '', hostname, label: '' }
        this.placeTooltip(hostname)
    }

    get hoveredAirSensorFrame(): AirSensorFrame | null {
        return this.hoveredAirSensor ? this.airSensorFrame(this.hoveredAirSensor.hostname) : null
    }

    get hoveredAirSensorLabel(): string {
        return this.hoveredAirSensor ? this.airSensorLabel(this.hoveredAirSensor.hostname) : ''
    }

    get hoveredAirSensorOnline(): boolean {
        return this.hoveredAirSensor ? this.airSensorOnline(this.hoveredAirSensor.hostname) : false
    }

    get hoveredAirSensorAge(): string {
        if (!this.$store.state.farm.fleetDaemonConnected) return 'fleet_daemon disconnected'
        const frame = this.hoveredAirSensorFrame
        if (!frame) return 'no status from fleet_daemon yet'
        return 'last reading ' + formatAge(sensorAgeSeconds(frame))
    }

    get hoveredAirSensorError(): string {
        return (this.hoveredAirSensorFrame?.error ?? '').toString().trim()
    }

    /** One row per catalog metric: label, formatted reading and its band. */
    get hoveredAirSensorRows(): { key: string; label: string; value: string; band: string; color: string }[] {
        const frame = this.hoveredAirSensorFrame
        if (!frame) return []
        return this.airMetrics
            .map((m) => {
                const v = sensorValue(frame, m.key)
                const band = bandFor(m, v)
                return {
                    key: m.key,
                    label: m.label,
                    value: formatMetricReading(m, v),
                    band: band?.name ?? 'â€”',
                    color: band?.color ?? AIR_NEUTRAL_COLOR,
                }
            })
            .filter((r) => r.value !== 'â€”')
    }

    // ---------- oven tooltip ----------
    showOvenTooltip(hostname: string) {
        if (this.isEditing) return
        this.hoveredPrinter = null
        const entry = this.ovenEntries.find((o) => o.hostname === hostname)
        this.hoveredOven = entry ?? { id: '', hostname }
        this.placeTooltip(hostname)
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

    /** Only shown when something is wrong; a healthy oven needs no status line. */
    get hoveredOvenStatusNote(): string {
        if (!this.hoveredOven) return ''
        const frame = this.hoveredOvenFrame
        if (!frame) return 'no status from fleet_daemon yet'
        if (!this.$store.state.farm.fleetDaemonConnected) return 'fleet_daemon disconnected'
        if (frame.fleet_to_printer_ws === false) return 'daemon → oven websocket down'
        if (this.ovenStatus(this.hoveredOven.hostname) === 'error') return `Klipper ${frame.webhooks?.state ?? 'error'}`
        return ''
    }

    get hoveredOvenTemperature(): string {
        return ovenTemperatureText(this.hoveredOvenFrame)
    }

    /** One block per material, best first (the marker's shown material comes first). */
    get hoveredOvenMaterials(): {
        material: string
        count: number
        ready: number
        drying: number
        readyPercent: number
        weightText: string
        fillPercent: number
    }[] {
        return ovenMaterialStats(this.hoveredOvenFrame, this.spoolWeightLookup).map((m) => ({
            material: m.material,
            count: m.count,
            ready: m.ready,
            drying: m.count - m.ready,
            readyPercent: m.count > 0 ? Math.round((m.ready / m.count) * 100) : 0,
            weightText: m.capacity > 0 ? `${formatWeight(m.remaining)} / ${formatWeight(m.capacity)}` : '—',
            fillPercent: m.capacity > 0 ? Math.round(Math.min(1, m.remaining / m.capacity) * 100) : 0,
        }))
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
/* "N need attention" chip: mirrors the chip in the Jobs -> Workers card title */
.status-counter--attention {
    padding: 1px 8px;
    border-radius: 11px;
    border: 1px solid rgba(128, 128, 128, 0.5);
    line-height: 18px;
}
.status-counter--attention-active {
    background: #d32f2f;
    border-color: #d32f2f;
    color: #fff;
    font-weight: 700;
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
/* Air quality field: above the room markings (z0), below grid lines / markers */
.air-layer {
    position: absolute;
    z-index: 1;
    pointer-events: none;
}
.status-dot.air {
    width: 10px;
    height: 10px;
    border-radius: 2px;
}
.status-counter--air {
    padding-left: 12px;
    border-left: 1px solid rgba(128, 128, 128, 0.4);
}
.status-counter__muted {
    opacity: 0.7;
    font-weight: 400;
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
    /* heaviest Roboto face + a 1px black outline (8-direction hard shadow; a blurred glow
       makes 7-9px strokes look thin) */
    font-weight: 900;
    text-shadow:
        1px 0 0 #000,
        -1px 0 0 #000,
        0 1px 0 #000,
        0 -1px 0 #000,
        1px 1px 0 #000,
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000;
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

/* Air sensor markers: the SVG icon carries fill/outline; editing gets a halo like printers */
.marker--air-editing >>> .air-sensor-icon {
    filter: drop-shadow(0 0 2px rgba(240, 211, 176, 0.8));
}
.marker.highlighted >>> .air-sensor-icon {
    animation: highlight-pulse 0.9s ease-in-out infinite;
    transform: scale(1.12);
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
.tooltip .oven-note {
    opacity: 0.75;
}
.tooltip .oven-hint {
    opacity: 0.6;
    font-style: italic;
}
.tooltip .air-online {
    color: #00e676;
}
.tooltip .air-offline {
    color: #ff8a80;
}
/* Per-metric row: label | reading | band dot + name */
.tooltip .air-row {
    display: grid;
    grid-template-columns: 92px auto auto;
    gap: 1px 10px;
    align-items: center;
}
.tooltip .air-row--selected .air-row-label {
    font-weight: 700;
}
.tooltip .air-row-label {
    opacity: 0.85;
}
.tooltip .air-row-value {
    text-align: right;
    font-variant-numeric: tabular-nums;
}
.tooltip .air-row-band {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    opacity: 0.9;
}
.tooltip .air-row-dot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    display: inline-block;
}
/* Per-material block: `NAME ×n` | grams left / full | fullness bar
                        `r ready · d drying`        | readiness bar */
.tooltip .oven-mat {
    display: grid;
    grid-template-columns: auto auto 72px;
    gap: 1px 10px;
    align-items: center;
}
.tooltip .oven-mat + .oven-mat {
    margin-top: 5px;
}
.tooltip .oven-mat-state {
    grid-column: 1 / 3;
    opacity: 0.85;
    font-variant-numeric: tabular-nums;
}
.tooltip .oven-mat-ready {
    color: #00e676;
}
.tooltip .oven-mat-drying {
    color: #ffa000;
}
/* readiness bar: green fill = ready share, amber track = still drying */
.tooltip .oven-mat-bar--dry {
    background: rgba(255, 160, 0, 0.55);
}
.tooltip .oven-mat-name {
    font-weight: 700;
}
.tooltip .oven-mat-weight {
    opacity: 0.85;
    text-align: right;
    font-variant-numeric: tabular-nums;
}
.tooltip .oven-mat-bar {
    display: block;
    height: 6px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.2);
    overflow: hidden;
}
.tooltip .oven-mat-bar-fill {
    display: block;
    height: 100%;
    background: #00e676;
}
</style>
