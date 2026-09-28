<template>
    <div class="dash-map" :class="{ 'dash-map--empty': !crop }">
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

                <!-- printers: coloured status icon + worker sticker only -->
                <g v-for="p in printers" :key="p.hostname" class="dash-map__marker" @click="openPrinter(p.printer)">
                    <title>{{ markerTitle(p) }}</title>
                    <ellipse
                        v-if="p.status === 'printing'"
                        class="dash-map__ring"
                        :cx="p.cx"
                        :cy="p.cy"
                        :rx="MARK / 2 + 2"
                        :ry="(MARK / 2 + 2) * p.hScale"
                        fill="none"
                        :stroke="STATUS_META.printing.color"
                        stroke-width="2.5" />
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
                    <text
                        v-if="p.glyph"
                        :x="p.cx"
                        :y="p.cy"
                        text-anchor="middle"
                        dominant-baseline="central"
                        fill="#fff"
                        font-weight="800"
                        font-size="16"
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
            </svg>
            <div v-else class="dash-map__empty">{{ $t('FleetDashboard.NoPrintersPlaced') }}</div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Mixins, Prop } from 'vue-property-decorator'
import { mdiExclamationThick, mdiHammer } from '@mdi/js'
import BaseMixin from '@/components/mixins/base'
import { hostKey } from '@/plugins/hostKey'
import {
    getPrinterStatus,
    getPrinterPrintPercent,
    PrinterStatus,
    STATUS_META,
    STATUS_ORDER,
    countPrinterStatuses,
} from '@/components/panels/farmPrinterStatus'
import {
    CELL,
    GRID_COLS,
    FARM_DIVIDER_COLS,
    GROUND_ROOMS,
    MapLocation,
    cropBox,
    gridRows,
    ovenHostnames,
    printerGridPosition,
    printerLocation,
    printerModel,
} from '@/components/panels/farmMapGeometry'
import { SQUARE_PRINTER_MODELS, PRINTER_MODEL_HEIGHT_SCALE } from '@/store/gui/remoteprinters/types'
import { attentionChipTitle } from '@/components/panels/fleetWorkerAttention'
import { getOvenStatus, OVEN_LEGEND, OVEN_STATUS_META } from '@/components/panels/farmOvenStatus'
import { OvenFrame } from '@/store/farm/types'

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

    isOvenHostname(hostname: string): boolean {
        return this.$store.getters['gui/remoteprinters/getDeviceType'](hostname) === 'oven'
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

    get printers(): MarkerVm[] {
        return Object.entries(this.frames)
            .filter(
                ([hostname]) =>
                    !this.isOvenHostname(hostname) && printerLocation(this.roster, hostname) === this.location
            )
            .map(([hostname, printer]) => {
                const pos = printerGridPosition(this.roster, hostname)
                const model = printerModel(this.roster, hostname)
                const status = getPrinterStatus(printer, this.connected)
                const attention = this.inList(this.attentionHostnames, hostname)
                let glyph = ''
                if (status === 'complete') glyph = '✓'
                else if (status === 'error') glyph = '!'
                else if (status === 'printing') glyph = ''
                return {
                    hostname,
                    printer,
                    cx: (pos.x - 0.5) * CELL,
                    cy: (pos.y - 0.5) * CELL,
                    status,
                    color: STATUS_META[status].color,
                    square: model !== null && SQUARE_PRINTER_MODELS.includes(model),
                    hScale: (model && PRINTER_MODEL_HEIGHT_SCALE[model]) || 1,
                    glyph,
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

    get crop() {
        const positions = [
            ...this.printers.map((p) => printerGridPosition(this.roster, p.hostname)),
            ...this.ovens.map((o) => printerGridPosition(this.roster, o.hostname)),
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

    get statusList() {
        const counts = countPrinterStatuses(
            this.printers.map((p) => p.printer),
            this.connected
        )
        return STATUS_ORDER.map((k) => ({ key: k, color: STATUS_META[k].color, count: counts[k] }))
    }

    get sectionAttention(): string[] {
        return this.printers.filter((p) => p.attention).map((p) => p.hostname)
    }

    get sectionAttentionTitle(): string {
        const reasons: Record<string, string> = {}
        this.sectionAttention.forEach((h) => {
            const r = this.reasonFor(h)
            if (r) reasons[h] = r
        })
        return attentionChipTitle(this.sectionAttention, reasons)
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
