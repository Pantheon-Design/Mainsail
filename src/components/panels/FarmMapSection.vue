<template>
    <div>
        <!-- Section title -->
        <div class="section-title mb-2">
            {{ name }}
            <span class="section-pill">{{ printerCount }}</span>
        </div>

        <!-- Controls -->
        <div class="map-controls mb-2">
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

        <!-- Per-section status legend -->
        <div class="status-counters mb-3">
            <span v-for="s in activeStatusList" :key="'active-' + s.key" class="status-counter">
                <span class="status-dot" :class="{ square: s.key === 'error' || s.key === 'printing' }"
                      :style="{ backgroundColor: s.color }"></span>
                {{ s.label }} {{ s.count }}
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
                     :class="{ draggable: isEditing && !isDrawing }"
                     :data-printer-id="hostname"
                     @mousedown="isEditing && !isDrawing ? startGridDrag($event, printer, hostname) : null"
                     @click="isEditing ? null : openPrinter(printer)"
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
                </div>

                <!-- Tooltip -->
                <div v-if="hoveredPrinter" class="tooltip" :style="tooltipStyle">
                    <p>{{ hoveredPrinter.socket.hostname }}: {{ hoveredPrinter.print_stats?.state || 'Unknown' }}</p>
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

type MapLocation = 'farm' | 'ground'

@Component({
    components: {
        MapDrawingOverlay,
        MapDrawingToolbar,
    },
})
export default class FarmMapSection extends Mixins(BaseMixin) {
    @Prop({ type: String, required: true }) readonly location!: MapLocation
    @Prop({ type: String, required: true }) readonly name!: string

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
            ([hostname]) => this.getPrinterLocation(hostname) === this.location
        ) as [string, any][]
    }

    get printerCount(): number {
        return this.activePrinterEntries.length
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
        if (this.isEditing) return 'Drag any printer to a new cell.'
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
        this.hoveredPrinter = printer
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
.status-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    display: inline-block;
}
.status-dot.square {
    border-radius: 2px;
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
</style>
