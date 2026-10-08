<template>
    <div
        class="dash-map"
        :class="{
            'dash-map--empty': !crop,
            'dash-map--rainbow': allPrinting && !reducedMotion,
            'dash-map--reduced': reducedMotion,
        }">
        <div class="dash-map__head">
            <span class="dash-map__title">{{ name }}</span>
            <span class="dash-map__pill">{{ printers.length }}</span>
            <span
                v-if="workerHostnames.length && printers.length"
                class="dash-map__attn"
                :class="{ 'dash-map__attn--active': sectionAttention.length > 0 }"
                :title="sectionAttentionTitle">
                <v-icon x-small :color="sectionAttention.length ? 'white' : undefined">
                    {{ mdiExclamationThick }}
                </v-icon>
                {{ sectionAttention.length }}
            </span>
            <span class="dash-map__legend">
                <span v-for="s in statusList" v-show="s.count" :key="s.key" class="dash-map__legend-item">
                    <span class="dash-map__dot" :style="{ backgroundColor: s.color }"></span>
                    {{ s.count }}
                </span>
            </span>
        </div>
        <div class="dash-map__body">
            <svg
                v-if="crop"
                class="dash-map__svg"
                :viewBox="viewBox"
                preserveAspectRatio="xMidYMid meet"
                xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern :id="patternId" :width="CELL" :height="CELL" patternUnits="userSpaceOnUse">
                        <path
                            :d="`M ${CELL} 0 L 0 0 0 ${CELL}`"
                            fill="none"
                            stroke="rgba(40,36,30,0.22)"
                            stroke-width="1" />
                    </pattern>
                </defs>
                <!-- floor -->
                <rect x="0" y="0" :width="gridW" :height="gridH" fill="#f5f3ef" />
                <rect x="0" y="0" :width="gridW" :height="gridH" :fill="`url(#${patternId})`" />
                <template v-if="location === 'farm'">
                    <line
                        v-for="c in FARM_DIVIDER_COLS"
                        :key="'div-' + c"
                        :x1="c * CELL"
                        :x2="c * CELL"
                        y1="0"
                        :y2="gridH"
                        stroke="rgba(60,55,48,0.5)"
                        stroke-width="2.5" />
                </template>
                <template v-else>
                    <rect
                        v-for="r in GROUND_ROOMS"
                        :key="'room-' + r.name"
                        :x="(r.gx - 1) * CELL"
                        :y="(r.gy - 1) * CELL"
                        :width="r.wc * CELL"
                        :height="r.hc * CELL"
                        fill="none"
                        stroke="rgba(60,55,48,0.5)"
                        stroke-width="2.5" />
                </template>
                <rect
                    x="0.5"
                    y="0.5"
                    :width="gridW - 1"
                    :height="gridH - 1"
                    fill="none"
                    stroke="rgba(40,36,30,0.35)"
                    stroke-width="1" />

                <!-- air quality overlay: only sensors with a metric at Marginal or worse paint their
                     range in the worst band's colour, fading out over another half range -->
                <defs>
                    <radialGradient
                        v-for="a in alertSensors"
                        :id="sensorGradId(a)"
                        :key="'air-grad-' + a.hostname"
                        gradientUnits="userSpaceOnUse"
                        :cx="a.cx"
                        :cy="a.cy"
                        :r="a.radius * 1.5">
                        <stop offset="0%" :stop-color="a.color" stop-opacity="0.45" />
                        <stop offset="66%" :stop-color="a.color" stop-opacity="0.4" />
                        <stop offset="100%" :stop-color="a.color" stop-opacity="0" />
                    </radialGradient>
                </defs>
                <!-- clipped to the floor: the SVG keeps painting outside its viewBox into the
                     letterbox, so a field near an edge must not spill past the grid -->
                <clipPath :id="patternId + '-floor'">
                    <rect x="0" y="0" :width="gridW" :height="gridH" />
                </clipPath>
                <g :clip-path="`url(#${patternId}-floor)`" pointer-events="none">
                    <circle
                        v-for="a in alertSensors"
                        :key="'air-field-' + a.hostname"
                        :cx="a.cx"
                        :cy="a.cy"
                        :r="a.radius * 1.5"
                        :fill="`url(#${sensorGradId(a)})`" />
                </g>

                <!-- ovens: hollow rounded square in the oven legend colour -->
                <g v-for="o in ovens" :key="'oven-' + o.hostname" class="dash-map__oven">
                    <title>{{ o.hostname }} · oven · {{ o.label }}</title>
                    <rect
                        :x="o.cx - MARK / 2"
                        :y="o.cy - MARK / 2"
                        :width="MARK"
                        :height="MARK"
                        rx="6"
                        fill="rgba(30,27,22,0.85)"
                        :stroke="o.color"
                        stroke-width="3"
                        :stroke-dasharray="o.offline ? '4 3' : undefined"
                        :opacity="o.offline ? 0.55 : 1" />
                </g>

                <!-- air quality sensors: square body with two antennas in the worst band's colour
                     (green = every metric Good), no reading text; "!" when Marginal or worse -->
                <g
                    v-for="a in sensors"
                    :key="'air-' + a.hostname"
                    class="dash-map__air"
                    :opacity="a.offline ? 0.55 : 1">
                    <title>{{ a.title }}</title>
                    <line
                        :x1="a.cx - 10"
                        :y1="a.cy - 12"
                        :x2="a.cx - 14"
                        :y2="a.cy - 20"
                        :stroke="a.offline ? '#9e9e9e' : '#2b2824'"
                        stroke-width="2.2"
                        stroke-linecap="round" />
                    <line
                        :x1="a.cx + 10"
                        :y1="a.cy - 12"
                        :x2="a.cx + 14"
                        :y2="a.cy - 20"
                        :stroke="a.offline ? '#9e9e9e' : '#2b2824'"
                        stroke-width="2.2"
                        stroke-linecap="round" />
                    <circle :cx="a.cx - 14" :cy="a.cy - 20" r="2.2" :fill="a.offline ? '#9e9e9e' : '#2b2824'" />
                    <circle :cx="a.cx + 14" :cy="a.cy - 20" r="2.2" :fill="a.offline ? '#9e9e9e' : '#2b2824'" />
                    <rect
                        :x="a.cx - 16"
                        :y="a.cy - 12"
                        width="32"
                        height="26"
                        rx="5"
                        :fill="a.color"
                        :stroke="a.offline ? '#c4c4c4' : 'rgba(255,255,255,0.9)'"
                        stroke-width="2"
                        :stroke-dasharray="a.offline ? '4 3' : undefined" />
                    <g v-if="a.alert" class="dash-map__sticker">
                        <circle
                            :cx="a.cx + STICKER_OFF"
                            :cy="a.cy + 12"
                            :r="STICKER_R"
                            :fill="a.color"
                            stroke="rgba(255,255,255,0.9)"
                            stroke-width="1.5" />
                        <path
                            :d="mdiExclamationThick"
                            fill="#fff"
                            :transform="`translate(${a.cx + STICKER_OFF - 7}, ${a.cy + 12 - 7}) scale(${14 / 24})`" />
                    </g>
                </g>

                <!-- printers: coloured status icon + worker sticker only -->
                <g v-for="p in printers" :key="p.hostname" class="dash-map__marker" @click="openPrinter(p.printer)">
                    <title>{{ markerTitle(p) }}</title>
                    <!-- pulse ring: pure decoration, dropped under reduced motion -->
                    <ellipse
                        v-if="p.status === 'printing' && !reducedMotion"
                        class="dash-map__ring"
                        :cx="p.cx"
                        :cy="p.cy"
                        :rx="MARK / 2 + 2"
                        :ry="(MARK / 2 + 2) * p.hScale"
                        fill="none"
                        :stroke="STATUS_META.printing.color"
                        stroke-width="2.5" />
                    <!-- printing: the shape doubles as a clip so the wavy blue level fills it bottom-up -->
                    <clipPath v-if="p.progress !== null" :id="clipId(p)">
                        <rect
                            v-if="p.square"
                            :x="p.cx - MARK / 2"
                            :y="p.cy - (MARK * p.hScale) / 2"
                            :width="MARK"
                            :height="MARK * p.hScale"
                            :rx="MARK * 0.22" />
                        <ellipse v-else :cx="p.cx" :cy="p.cy" :rx="MARK / 2" :ry="(MARK / 2) * p.hScale" />
                    </clipPath>
                    <rect
                        v-if="p.square"
                        :x="p.cx - MARK / 2"
                        :y="p.cy - (MARK * p.hScale) / 2"
                        :width="MARK"
                        :height="MARK * p.hScale"
                        :rx="MARK * 0.22"
                        :fill="p.color"
                        :stroke="p.status === 'disconnected' ? '#c4c4c4' : 'rgba(255,255,255,0.9)'"
                        stroke-width="2"
                        :stroke-dasharray="p.status === 'disconnected' ? '4 3' : undefined"
                        :opacity="p.status === 'disconnected' ? 0.55 : 1" />
                    <ellipse
                        v-else
                        :cx="p.cx"
                        :cy="p.cy"
                        :rx="MARK / 2"
                        :ry="(MARK / 2) * p.hScale"
                        :fill="p.color"
                        :stroke="p.status === 'disconnected' ? '#c4c4c4' : 'rgba(255,255,255,0.9)'"
                        stroke-width="2"
                        :stroke-dasharray="p.status === 'disconnected' ? '4 3' : undefined"
                        :opacity="p.status === 'disconnected' ? 0.55 : 1" />
                    <g v-if="p.progress !== null" :clip-path="`url(#${clipId(p)})`" pointer-events="none">
                        <path class="dash-map__wave" :d="waveD(p)" :fill="STATUS_META.printing.color" />
                        <path
                            class="dash-map__wave dash-map__wave--back"
                            :d="waveD(p, 3)"
                            :fill="STATUS_META.printing.color"
                            opacity="0.45" />
                    </g>
                    <text
                        v-if="p.glyph"
                        :x="p.cx"
                        :y="p.cy"
                        text-anchor="middle"
                        dominant-baseline="central"
                        fill="#fff"
                        font-weight="800"
                        :font-size="p.progress !== null ? 12 : 16"
                        stroke="rgba(0,0,0,0.55)"
                        stroke-width="2"
                        paint-order="stroke"
                        pointer-events="none">
                        {{ p.glyph }}
                    </text>
                    <!-- sticker: flashing "!" when the worker needs attention, else the hammer -->
                    <g v-if="p.attention" class="dash-map__sticker dash-map__sticker--attention">
                        <circle
                            :cx="p.cx + STICKER_OFF"
                            :cy="p.cy + STICKER_OFF * p.hScale"
                            :r="STICKER_R"
                            fill="#d32f2f"
                            stroke="rgba(255,255,255,0.9)"
                            stroke-width="1.5" />
                        <path
                            :d="mdiExclamationThick"
                            fill="#fff"
                            :transform="`translate(${p.cx + STICKER_OFF - 7}, ${
                                p.cy + STICKER_OFF * p.hScale - 7
                            }) scale(${14 / 24})`" />
                    </g>
                    <g v-else-if="p.worker" class="dash-map__sticker">
                        <circle
                            :cx="p.cx + STICKER_OFF"
                            :cy="p.cy + STICKER_OFF * p.hScale"
                            :r="STICKER_R"
                            fill="#f57c00"
                            stroke="rgba(255,255,255,0.9)"
                            stroke-width="1.5" />
                        <path
                            :d="mdiHammer"
                            fill="#fff"
                            :transform="`translate(${p.cx + STICKER_OFF - 6}, ${
                                p.cy + STICKER_OFF * p.hScale - 6
                            }) scale(${12 / 24})`" />
                    </g>
                </g>

                <!-- highlight halo for the sensor hovered in the Air Sensors card -->
                <rect
                    v-if="highlightedSensor"
                    class="dash-map__halo"
                    :x="highlightedSensor.cx - 20"
                    :y="highlightedSensor.cy - 24"
                    width="40"
                    height="42"
                    rx="9"
                    fill="none"
                    stroke="#ffeb3b"
                    stroke-width="4"
                    pointer-events="none" />

                <!-- highlight halo for the worker hovered in the list (drawn last, above everything) -->
                <ellipse
                    v-if="highlighted"
                    class="dash-map__halo"
                    :cx="highlighted.cx"
                    :cy="highlighted.cy"
                    :rx="MARK / 2 + 4"
                    :ry="(MARK / 2 + 4) * highlighted.hScale"
                    fill="none"
                    stroke="#ffeb3b"
                    stroke-width="4"
                    pointer-events="none" />
            </svg>
            <div v-else class="dash-map__empty">{{ $t('FleetDashboard.NoPrintersPlaced') }}</div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Mixins, Prop, Watch } from 'vue-property-decorator'
import { mdiExclamationThick, mdiHammer } from '@mdi/js'
import BaseMixin from '@/components/mixins/base'
import { hostKey } from '@/plugins/hostKey'
import {
    getPrinterStatus,
    getPrinterPrintPercent,
    PrinterStatus,
    STATUS_META,
    STATUS_ORDER,
    emptyStatusCounts,
} from '@/components/panels/farmPrinterStatus'
import {
    CELL,
    GRID_COLS,
    FARM_DIVIDER_COLS,
    GROUND_ROOMS,
    MapLocation,
    cropBox,
    gridRows,
    airSensorHostnames,
    ovenHostnames,
    printerHostnames,
    printerGridPosition,
    printerLocation,
    printerModel,
} from '@/components/panels/farmMapGeometry'
import { SQUARE_PRINTER_MODELS, PRINTER_MODEL_HEIGHT_SCALE } from '@/store/gui/remoteprinters/types'
import { attentionChipTitle } from '@/components/panels/fleetWorkerAttention'
import { getOvenStatus, OVEN_LEGEND, OVEN_STATUS_META } from '@/components/panels/farmOvenStatus'
import { AirSensorFrame, OvenFrame } from '@/store/farm/types'
import { AirMetric } from '@/store/fleet/air/types'
import {
    AIR_NEUTRAL_COLOR,
    formatMetricReading,
    isSensorOnline,
    worstReading,
    SEVERITY_ATTENTION,
} from '@/components/panels/airQualityBands'

interface MarkerVm {
    hostname: string
    printer: any
    cx: number
    cy: number
    status: PrinterStatus
    color: string
    square: boolean
    hScale: number
    glyph: string
    /** 0..1 while printing (drives the wavy fill), else null */
    progress: number | null
    worker: boolean
    attention: boolean
    reason: string | null
}

interface OvenVm {
    hostname: string
    cx: number
    cy: number
    color: string
    label: string
    offline: boolean
}

interface SensorVm {
    hostname: string
    cx: number
    cy: number
    /** worst band colour across all metrics (green when everything is Good), grey when offline */
    color: string
    /** any metric at Marginal or worse: paint the range overlay + the "!" badge */
    alert: boolean
    /** overlay radius in grid px (sensorRange × CELL) */
    radius: number
    offline: boolean
    title: string
}

let svgSeq = 0

/**
 * Condensed, read-only fleet map for the dashboard: an SVG whose viewBox is
 * cropped to the occupied cells (+1 cell margin) and scaled to its container.
 * Markers carry only the status colour and the worker sticker; hover shows
 * the details, click opens the printer like the full map.
 */
@Component
export default class DashboardFleetMap extends Mixins(BaseMixin) {
    @Prop({ type: String, required: true }) readonly location!: MapLocation
    @Prop({ type: String, required: true }) readonly name!: string
    @Prop({ type: Array, default: () => [] }) readonly workerHostnames!: string[]
    @Prop({ type: Array, default: () => [] }) readonly attentionHostnames!: string[]
    @Prop({ type: Object, default: () => ({}) }) readonly attentionReasons!: Record<string, string>
    /** Printer hovered in the workers list: its marker gets a pulsing yellow halo. */
    @Prop({ type: String, default: '' }) readonly highlightHostname!: string
    /** Reduced motion (slow screens): no pulse rings, the wave fill and other decorations stand still. */
    @Prop({ type: Boolean, default: false }) readonly reducedMotion!: boolean

    mdiExclamationThick = mdiExclamationThick
    mdiHammer = mdiHammer
    readonly CELL = CELL
    /** marker diameter (same 36px as the full map at base scale) */
    readonly MARK = CELL - 10
    readonly STICKER_R = 9
    readonly STICKER_OFF = 14
    readonly FARM_DIVIDER_COLS = FARM_DIVIDER_COLS
    readonly GROUND_ROOMS = GROUND_ROOMS
    readonly STATUS_META = STATUS_META
    readonly patternId = 'dash-map-grid-' + ++svgSeq

    get roster(): Record<string, any> {
        return this.$store.state.gui?.remoteprinters?.printers || {}
    }

    get frames(): Record<string, any> {
        return this.$store.state.farm.fleetDaemonPrinters || {}
    }

    get connected(): boolean {
        return !!this.$store.state.farm.fleetDaemonConnected
    }

    get gridW(): number {
        return GRID_COLS * CELL
    }

    get gridH(): number {
        return gridRows(this.location) * CELL
    }

    isNonPrinterHostname(hostname: string): boolean {
        return this.$store.getters['gui/remoteprinters/getDeviceType'](hostname) !== 'printer'
    }

    private inList(list: string[], hostname: string): boolean {
        const h = hostKey(hostname)
        return list.some((w) => hostKey(w) === h)
    }

    reasonFor(hostname: string): string | null {
        const h = hostKey(hostname)
        const key = Object.keys(this.attentionReasons).find((k) => hostKey(k) === h)
        return key ? this.attentionReasons[key] || null : null
    }

    /** Markers on screen. Replaced by onMarkerSig only when markerState.sig changes. */
    printers: MarkerVm[] = []

    /**
     * Markers built from the daemon frames, plus a signature of everything the template and
     * the marker-derived getters read from them. The daemon re-sends a printer's frame whenever
     * any field changes (filament used, progress by a tenth of a percent, …); re-patching 600+
     * SVG nodes for that is what makes a slow device lag. So the render reads `printers`, which
     * the watcher below only replaces when the signature differs.
     */
    get markerState(): { sig: string; markers: MarkerVm[] } {
        const markers = this.buildMarkers()
        const sig = markers
            .map((m) =>
                [
                    m.hostname,
                    m.status,
                    m.glyph,
                    m.cx,
                    m.cy,
                    m.square ? 1 : 0,
                    m.hScale,
                    m.progress === null ? '' : Math.round(m.progress * 100),
                    m.worker ? 1 : 0,
                    m.attention ? 1 : 0,
                    m.reason ?? '',
                    m.printer?.toolhead?.filament_type ?? '',
                    m.printer?.socket?.webPort ?? '',
                ].join(',')
            )
            .join('|')
        return { sig, markers }
    }

    @Watch('markerState.sig', { immediate: true })
    onMarkerSig() {
        this.printers = this.markerState.markers
    }

    buildMarkers(): MarkerVm[] {
        return Object.entries(this.frames)
            .filter(
                ([hostname]) =>
                    !this.isNonPrinterHostname(hostname) && printerLocation(this.roster, hostname) === this.location
            )
            .map(([hostname, printer]) => {
                const pos = printerGridPosition(this.roster, hostname)
                const model = printerModel(this.roster, hostname)
                const status = getPrinterStatus(printer, this.connected)
                const attention = this.inList(this.attentionHostnames, hostname)
                const pct = getPrinterPrintPercent(printer)
                const progress = status === 'printing' ? Math.min(1, Math.max(0, pct / 100)) : null
                let glyph = ''
                if (status === 'complete') glyph = '✓'
                else if (status === 'error') glyph = '!'
                else if (status === 'printing') glyph = `${pct}%`
                return {
                    hostname,
                    printer,
                    cx: (pos.x - 0.5) * CELL,
                    cy: (pos.y - 0.5) * CELL,
                    status,
                    // printing: green body, the blue level (progress) fills it — see waveD()
                    color: status === 'printing' ? STATUS_META.ready.color : STATUS_META[status].color,
                    square: model !== null && SQUARE_PRINTER_MODELS.includes(model),
                    hScale: (model && PRINTER_MODEL_HEIGHT_SCALE[model]) || 1,
                    glyph,
                    progress,
                    worker: this.inList(this.workerHostnames, hostname),
                    attention,
                    reason: attention ? this.reasonFor(hostname) : null,
                }
            })
    }

    ovenFrame(hostname: string): OvenFrame | null {
        const ovens: Record<string, OvenFrame> = this.$store.state.farm.fleetDaemonOvens || {}
        const key = hostKey(hostname)
        for (const [h, frame] of Object.entries(ovens)) {
            if (hostKey(h) === key) return frame
        }
        return null
    }

    get ovens(): OvenVm[] {
        return ovenHostnames(this.roster, this.location).map((hostname) => {
            const pos = printerGridPosition(this.roster, hostname)
            const status = getOvenStatus(this.ovenFrame(hostname), this.connected)
            return {
                hostname,
                cx: (pos.x - 0.5) * CELL,
                cy: (pos.y - 0.5) * CELL,
                color: status === 'disconnected' ? '#8a8a8a' : OVEN_LEGEND.color,
                label: OVEN_STATUS_META[status].label,
                offline: status === 'disconnected',
            }
        })
    }

    airSensorFrame(hostname: string): AirSensorFrame | null {
        const frames: Record<string, AirSensorFrame> = this.$store.state.farm.fleetDaemonAirSensors || {}
        const key = hostKey(hostname)
        for (const [h, frame] of Object.entries(frames)) {
            if (hostKey(h) === key) return frame
        }
        return null
    }

    get airMetrics(): AirMetric[] {
        return this.$store.getters['fleet/air/getMetrics'] ?? []
    }

    /** Air sensors placed on this floor (roster-driven like ovens, so an unreported sensor still shows). */
    get sensors(): SensorVm[] {
        return airSensorHostnames(this.roster, this.location).map((hostname) => {
            const pos = printerGridPosition(this.roster, hostname)
            const frame = this.airSensorFrame(hostname)
            const online = isSensorOnline(frame, this.connected)
            const worst = online ? worstReading(this.airMetrics, frame) : null
            const alert = !!worst && worst.severity >= SEVERITY_ATTENTION + 1
            const range = this.$store.getters['gui/remoteprinters/getSensorRange'](hostname) as number
            const entry =
                this.roster[
                    Object.keys(this.roster).find((k) => hostKey(this.roster[k]?.hostname) === hostKey(hostname)) ?? ''
                ]
            const label: string = entry?.label || hostname.replace(/\.local$/i, '')
            const lines = [`${label} · ${hostname}`]
            if (!online) lines.push('offline')
            else if (!worst) lines.push('no readings yet')
            else if (worst.severity === 0) lines.push('All metrics Good')
            else
                lines.push(
                    `${worst.metric.label} ${formatMetricReading(worst.metric, worst.value)} · ${worst.band.name}`
                )
            return {
                hostname,
                cx: (pos.x - 0.5) * CELL,
                cy: (pos.y - 0.5) * CELL,
                color: !online ? AIR_NEUTRAL_COLOR : worst ? worst.band.color : AIR_NEUTRAL_COLOR,
                alert,
                radius: range * CELL,
                offline: !online,
                title: lines.join('\n'),
            }
        })
    }

    /** Sensors that paint an overlay + badge (any metric Marginal or worse). */
    get alertSensors(): SensorVm[] {
        return this.sensors.filter((a) => a.alert)
    }

    sensorGradId(a: SensorVm): string {
        return `${this.patternId}-air-${hostKey(a.hostname).replace(/[^a-z0-9]/g, '-')}`
    }

    mounted() {
        // Band colours come from the daemon's metric catalog; the Air Quality page loads it on
        // demand, the dashboard has to as well (once per app, the store keeps it).
        const air = this.$store.state.fleet?.air
        if (air && !air.metrics?.length && !air.loading) {
            this.$store.dispatch('fleet/air/loadMetrics').catch(() => undefined)
        }
    }

    get crop() {
        const positions = [
            ...this.printers.map((p) => printerGridPosition(this.roster, p.hostname)),
            ...this.ovens.map((o) => printerGridPosition(this.roster, o.hostname)),
            ...this.sensors.map((a) => printerGridPosition(this.roster, a.hostname)),
        ]
        return cropBox(positions, this.location, 1)
    }

    get viewBox(): string {
        const c = this.crop
        if (!c) return `0 0 ${this.gridW} ${this.gridH}`
        return `${(c.minX - 1) * CELL} ${(c.minY - 1) * CELL} ${(c.maxX - c.minX + 1) * CELL} ${
            (c.maxY - c.minY + 1) * CELL
        }`
    }

    get highlightedSensor(): SensorVm | null {
        if (!this.highlightHostname) return null
        const key = hostKey(this.highlightHostname)
        return this.sensors.find((a) => hostKey(a.hostname) === key) ?? null
    }

    get highlighted(): MarkerVm | null {
        if (!this.highlightHostname) return null
        const key = hostKey(this.highlightHostname)
        return this.printers.find((p) => hostKey(p.hostname) === key) ?? null
    }

    get statusList() {
        const counts = emptyStatusCounts()
        this.printers.forEach((p) => counts[p.status]++)
        return STATUS_ORDER.map((k) => ({ key: k, color: STATUS_META[k].color, count: counts[k] }))
    }

    get sectionAttention(): string[] {
        return this.printers.filter((p) => p.attention).map((p) => p.hostname)
    }

    /**
     * Easter egg: every printer placed on this floor is printing at once → the card shines rainbow.
     * Judged against the roster (all placed printers), not only the printers the daemon currently
     * sends frames for: a placed printer without a frame, or with any status but printing, vetoes it.
     */
    get allPrinting(): boolean {
        const placed = printerHostnames(this.roster, this.location)
        if (!placed.length) return false
        const byKey = new Map(this.printers.map((p) => [hostKey(p.hostname), p.status]))
        return placed.every((h) => byKey.get(hostKey(h)) === 'printing')
    }

    get sectionAttentionTitle(): string {
        const reasons: Record<string, string> = {}
        this.sectionAttention.forEach((h) => {
            const r = this.reasonFor(h)
            if (r) reasons[h] = r
        })
        return attentionChipTitle(this.sectionAttention, reasons)
    }

    clipId(p: MarkerVm): string {
        return `${this.patternId}-clip-${hostKey(p.hostname).replace(/[^a-z0-9]/g, '-')}`
    }

    /**
     * Wavy "liquid" surface for a printing marker: a path three wavelengths wide
     * (one marker width each) whose flat top sits at the progress level and which
     * extends past the marker on both sides so the CSS scroll of one wavelength
     * loops seamlessly. `phase` shifts the crests for the second, fainter layer.
     */
    waveD(p: MarkerVm, phase = 0): string {
        const h = this.MARK * p.hScale
        const top = p.cy - h / 2
        const bottom = p.cy + h / 2
        const level = bottom - h * (p.progress ?? 0)
        const L = this.MARK
        const A = 2.2
        const x0 = p.cx - L * 1.5 - phase
        let d = `M ${x0} ${level}`
        for (let i = 0; i < 4; i++) {
            const x = x0 + i * L
            d += ` Q ${x + L / 4} ${level - A * 2} ${x + L / 2} ${level}`
            d += ` Q ${x + (3 * L) / 4} ${level + A * 2} ${x + L} ${level}`
        }
        d += ` L ${x0 + 4 * L} ${bottom + 2} L ${x0} ${bottom + 2} Z`
        void top
        return d
    }

    markerTitle(p: MarkerVm): string {
        const lines = [`${p.hostname} · ${STATUS_META[p.status].label}`]
        if (p.status === 'printing') lines[0] += ` ${getPrinterPrintPercent(p.printer)}%`
        const filament = p.printer?.toolhead?.filament_type
        if (filament) lines.push(`Filament: ${filament}`)
        if (p.worker) lines.push('Fleet worker')
        if (p.attention) lines.push(`Needs attention: ${p.reason || 'see the Workers list'}`)
        return lines.join('\n')
    }

    openPrinter(printer: any) {
        const socket = printer?.socket
        const hostname = socket?.hostname ?? ''
        if (!hostname) return
        const webPort = socket?.webPort ?? 80
        let url = window.location.protocol + '//' + hostname
        if (webPort !== 80) url += ':' + webPort
        window.open(url)
    }
}
</script>

<style scoped>
.dash-map {
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(128, 128, 128, 0.25);
    border-radius: 6px;
    padding: 6px 8px 8px;
}
/* Easter egg: every printer on the floor is printing (see allPrinting) → rainbow beams shoot
   out from the card's centre and slowly rotate. The beams are a conic gradient on an oversized
   square pseudo-element spinning behind the content while its opacity pulses; a soft white
   glow marks the centre. The content sits above the beams so the map and text stay readable. */
.dash-map--rainbow {
    position: relative;
    overflow: hidden;
    border-color: rgba(255, 255, 255, 0.35);
    box-shadow: 0 0 16px rgba(255, 255, 255, 0.25);
}
.dash-map--rainbow > * {
    position: relative;
    z-index: 1;
}
.dash-map--rainbow::before {
    content: '';
    position: absolute;
    z-index: 0;
    top: 50%;
    left: 50%;
    /* a square three card-widths wide (padding-% is relative to the width): wider than the
       card's diagonal so no corner shows while it spins, without a screen-sized texture */
    width: 300%;
    height: 0;
    padding-bottom: 300%;
    will-change: transform, opacity;
    background: conic-gradient(
        from 0deg,
        rgba(255, 20, 90, 0.85) 0deg 12deg,
        transparent 12deg 30deg,
        rgba(255, 120, 0, 0.85) 30deg 42deg,
        transparent 42deg 60deg,
        rgba(255, 230, 0, 0.85) 60deg 72deg,
        transparent 72deg 90deg,
        rgba(0, 235, 90, 0.85) 90deg 102deg,
        transparent 102deg 120deg,
        rgba(0, 160, 255, 0.85) 120deg 132deg,
        transparent 132deg 150deg,
        rgba(170, 50, 255, 0.85) 150deg 162deg,
        transparent 162deg 180deg,
        rgba(255, 20, 90, 0.85) 180deg 192deg,
        transparent 192deg 210deg,
        rgba(255, 120, 0, 0.85) 210deg 222deg,
        transparent 222deg 240deg,
        rgba(255, 230, 0, 0.85) 240deg 252deg,
        transparent 252deg 270deg,
        rgba(0, 235, 90, 0.85) 270deg 282deg,
        transparent 282deg 300deg,
        rgba(0, 160, 255, 0.85) 300deg 312deg,
        transparent 312deg 330deg,
        rgba(170, 50, 255, 0.85) 330deg 342deg,
        transparent 342deg 360deg
    );
    animation:
        dash-map-beams 12s linear infinite,
        dash-map-beams-pulse 3s ease-in-out infinite;
    pointer-events: none;
}
/* centre glow the beams appear to shoot out of */
.dash-map--rainbow::after {
    content: '';
    position: absolute;
    z-index: 0;
    inset: 0;
    background: radial-gradient(circle at center, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0) 45%);
    pointer-events: none;
}
@keyframes dash-map-beams {
    from {
        transform: translate(-50%, -50%) rotate(0deg);
    }
    to {
        transform: translate(-50%, -50%) rotate(360deg);
    }
}
/* beams breathe between dim and full while they spin (the two periods are not multiples,
   so the bright phase drifts around the circle) */
@keyframes dash-map-beams-pulse {
    0%,
    100% {
        opacity: 0.35;
    }
    50% {
        opacity: 1;
    }
}
.dash-map__head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 4px;
    flex: 0 0 auto;
}
.dash-map__pill {
    font-size: 11px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 9px;
    background: var(--v-primary-base, #f0d3b0);
    color: #1a1712;
}
.dash-map__attn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    padding: 1px 7px;
    border-radius: 10px;
    border: 1px solid rgba(128, 128, 128, 0.5);
    line-height: 16px;
}
.dash-map__attn--active {
    background: #d32f2f;
    border-color: #d32f2f;
    color: #fff;
}
.dash-map__legend {
    margin-left: auto;
    display: inline-flex;
    gap: 8px;
    font-size: 11px;
    font-weight: 500;
    opacity: 0.85;
}
.dash-map__legend-item {
    display: inline-flex;
    align-items: center;
    gap: 3px;
}
.dash-map__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
}
.dash-map__body {
    flex: 1 1 0;
    min-height: 120px;
    position: relative;
}
.dash-map__svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    border-radius: 4px;
}
.dash-map--empty .dash-map__body {
    flex: 0 0 auto;
    min-height: 0;
}
.dash-map__empty {
    font-size: 12px;
    opacity: 0.6;
    padding: 2px 0;
}
.dash-map__marker {
    cursor: pointer;
}
.dash-map__ring {
    transform-box: fill-box;
    transform-origin: center;
    animation: dash-pulsering 1.6s ease-out infinite;
    pointer-events: none;
}
@keyframes dash-pulsering {
    0% {
        transform: scale(1);
        opacity: 0.75;
    }
    100% {
        transform: scale(1.7);
        opacity: 0;
    }
}
.dash-map__sticker {
    pointer-events: none;
}
/* wavy progress level: slides one wavelength (= marker width, 36 user units) per cycle */
@keyframes dash-wave {
    from {
        transform: translateX(0);
    }
    to {
        transform: translateX(-36px);
    }
}
.dash-map__wave {
    animation: dash-wave 2.4s linear infinite;
}
.dash-map__wave--back {
    animation-duration: 3.6s;
    animation-direction: reverse;
}
/* reduced motion: every animated SVG element repaints the whole map each frame, so the
   wave fill, halo and attention sticker stand still (the ring is not rendered and the
   rainbow easter egg is off, see the root class binding) */
.dash-map--reduced .dash-map__wave,
.dash-map--reduced .dash-map__halo,
.dash-map--reduced .dash-map__sticker--attention circle {
    animation: none;
}
@keyframes dash-halo {
    0%,
    100% {
        stroke-opacity: 1;
        stroke-width: 4;
    }
    50% {
        stroke-opacity: 0.45;
        stroke-width: 8;
    }
}
.dash-map__halo {
    animation: dash-halo 0.9s ease-in-out infinite;
    filter: drop-shadow(0 0 6px rgba(255, 235, 59, 0.9));
}
.dash-map__sticker--attention circle {
    animation: dash-attention-flash 0.8s ease-in-out infinite;
}
@keyframes dash-attention-flash {
    0%,
    100% {
        fill: #d32f2f;
    }
    50% {
        fill: #ff5252;
    }
}
</style>
