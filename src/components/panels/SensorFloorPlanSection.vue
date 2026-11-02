<template>
    <div>
        <!-- Section title -->
        <div class="section-title mb-2">
            {{ name }}
            <span class="section-pill">{{ sensorCount }}</span>
        </div>

        <!-- Controls -->
        <div v-if="readonly" class="map-controls mb-2">
            <span class="edit-hint">{{ readonlyHint }}</span>
        </div>
        <div v-else class="map-controls mb-2">
            <v-btn
                small
                :color="isEditing ? 'success' : undefined"
                :class="{ 'save-pulse': isEditing }"
                @click="isEditing = !isEditing">
                {{ isEditing ? 'Done' : 'Edit' }}
            </v-btn>
            <v-btn small title="Add air sensor" @click="openAirSensorSettings">Add Sensor</v-btn>
            <v-btn
                v-if="isEditing && surveyedEntries.length"
                small
                outlined
                color="primary"
                :title="surveyedTitle"
                @click="applySurveyedPositions">
                Apply surveyed positions ({{ surveyedEntries.length }})
            </v-btn>
            <span class="edit-hint">{{ editHint }}</span>
        </div>

        <!-- Status: sensors on this floor and how many are reporting -->
        <div class="status-counters mb-3">
            <span class="status-counter" :title="legendTitle">
                <span class="status-dot air" :style="{ backgroundColor: legendColor }"></span>
                Sensor{{ sensorCount === 1 ? '' : 's' }} {{ sensorCount }}
                <span v-if="sensorCount" class="status-counter__muted">&middot; {{ onlineCount }} online</span>
            </span>
            <span v-if="unplacedEntries.length" class="status-counter status-counter--unplaced">
                {{ unplacedEntries.length }} unplaced
            </span>
        </div>

        <!-- Plan -->
        <div ref="frame" class="plan-frame">
            <div ref="stage" class="plan-stage" :style="{ height: stageH + 'px' }">
                <img class="plan-bg" :src="floor.background" :alt="name + ' floor plan'" draggable="false" />

                <!-- Air field in plan units, scaled to the display and clipped to the floor (luminance mask) -->
                <div class="plan-field" :style="fieldStyle">
                    <air-quality-overlay
                        :width="PLAN_WIDTH"
                        :height="PLAN_HEIGHT"
                        :fields="airFields"
                        :metric="metric"
                        :cell="fieldHalfWeight"
                        :blur-px="6" />
                </div>

                <!-- Sensors (display px; the markers keep their size at any zoom) -->
                <div
                    v-for="s in placedEntries"
                    :key="'air-' + s.hostname"
                    class="marker"
                    :class="{
                        'marker--editing': isEditing,
                        'marker--dragging': dragKey === s.key,
                        'marker--surveyed': isEditing && s.source === 'surveyed',
                    }"
                    :style="markerStyle(s)"
                    :data-air-sensor-id="s.hostname"
                    @pointerdown="startDrag($event, s)"
                    @mouseover="showTooltip(s)"
                    @mouseleave="hideTooltip">
                    <air-sensor-icon
                        :size="34"
                        :fill="sensorColor(s.hostname)"
                        :value="sensorValueText(s.hostname)"
                        :unit="metricUnitText"
                        :offline="!sensorOnline(s.hostname)"
                        :badge-color="sensorBadgeColor(s.hostname)" />
                    <span class="marker-label">{{ s.label }}</span>
                </div>

                <!-- Tooltip: label, host, online state, then one row per metric -->
                <div v-if="hovered" class="tooltip" :style="tooltipStyle">
                    <p>
                        <strong>{{ hovered.label }}</strong>
                        <span v-if="hovered.label !== hovered.shortHost" class="note">
                            &middot; {{ hovered.shortHost }}
                        </span>
                    </p>
                    <p :class="hoveredOnline ? 'air-online' : 'air-offline'">
                        {{ hoveredOnline ? 'online' : 'offline' }}
                        <span class="note">&middot; {{ hoveredAge }}</span>
                        <span v-if="hoveredError" class="note">&middot; {{ hoveredError }}</span>
                    </p>
                    <p v-if="hoveredVendor" class="note">{{ hoveredVendor }}</p>
                    <p v-for="(flag, i) in hoveredFlags" :key="'air-flag-' + i" class="note">&#9873; {{ flag }}</p>
                    <p v-if="!hoveredRows.length" class="note">No readings yet</p>
                    <div
                        v-for="r in hoveredRows"
                        :key="'air-row-' + r.key"
                        class="air-row"
                        :class="{ 'air-row--selected': r.key === metricKey }">
                        <span class="air-row-label">{{ r.label }}</span>
                        <span class="air-row-value" :title="r.title">{{ r.value }}</span>
                        <span class="air-row-band">
                            <span class="air-row-dot" :style="{ backgroundColor: r.color }"></span>
                            {{ r.band }}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Sensors on this floor without a position: listed, never guessed onto the plan -->
        <div v-if="unplacedEntries.length" class="unplaced mt-2">
            <span class="unplaced__label">Unplaced</span>
            <v-chip
                v-for="s in unplacedEntries"
                :key="'unplaced-' + s.hostname"
                small
                outlined
                :disabled="!isEditing"
                :title="isEditing ? 'Put this sensor in the middle of the plan, then drag it' : 'Click Edit to place'"
                @click="placeAtCentre(s)">
                {{ s.label }}
            </v-chip>
            <span v-if="!isEditing && !readonly" class="edit-hint">Click Edit to place.</span>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Mixins, Prop } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import { hostKey } from '@/plugins/hostKey'
import { AirSensorFrame } from '@/store/farm/types'
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
    metricQuality,
    metricUnit,
    rawSensorValue,
    sensorAgeSeconds,
    sensorValue,
    SEVERITY_ATTENTION,
    worstReading,
} from '@/components/panels/airQualityBands'
import { AIR_SENSOR_VENDOR_LABELS, airSensorVendor } from '@/store/gui/remoteprinters/types'
import { MapLocation } from '@/components/panels/farmMapGeometry'
import {
    clampToPlan,
    fitPlan,
    PLAN_HEIGHT,
    PLAN_UNITS_PER_METRE,
    PLAN_WIDTH,
    resolveSensorPlacement,
    roundPlan,
    SENSOR_FLOORS,
    SENSOR_LAYOUT_ID,
    SensorFloor,
    sensorSerialOf,
} from '@/components/panels/sensorFloorPlan'

interface SensorEntry {
    /** roster id (gui/remoteprinters key) */
    id: string
    key: string
    hostname: string
    shortHost: string
    label: string
    location: MapLocation
    x: number | null
    y: number | null
    source: 'saved' | 'surveyed' | null
}

/**
 * One floor of the air sensor floor plan (CAD-based SF office plan, sensorFloorPlan.ts).
 * Sensors only — printers stay on the printer grid map (FarmMapSection). Positions are
 * continuous plan coordinates (`mapPosition`), saved on drop; the air field is clipped to
 * the floor with the plan's luminance mask so the open void is never painted.
 */
@Component({ components: { AirSensorIcon, AirQualityOverlay } })
export default class SensorFloorPlanSection extends Mixins(BaseMixin) {
    readonly PLAN_WIDTH = PLAN_WIDTH
    readonly PLAN_HEIGHT = PLAN_HEIGHT

    @Prop({ type: String, required: true }) readonly location!: MapLocation
    @Prop({ type: String, required: true }) readonly name!: string
    /** key of the metric (fleet/air/getMetrics) the markers and field show */
    @Prop({ type: String, default: '' }) readonly metricKey!: string
    /** history view: archived frames (hostname -> frame) to render instead of the live socket */
    @Prop({ type: Object, default: null }) readonly airFrames!: Record<string, AirSensorFrame> | null
    @Prop({ type: String, default: '' }) readonly airFramesLabel!: string
    @Prop({ type: Boolean, default: false }) readonly readonly!: boolean
    @Prop({ type: String, default: 'Hover a sensor for its readings.' }) readonly readonlyHint!: string

    isEditing = false
    displayW = 0
    dragKey = ''
    dragPos: { x: number; y: number } | null = null
    hovered: SensorEntry | null = null
    tooltipStyle: Record<string, string> = {}
    private resizeObserver: ResizeObserver | null = null

    mounted() {
        // Measure the stage itself (inside the frame's border) so plan px and display px agree.
        const stage = this.$refs.stage as HTMLElement
        this.displayW = stage.clientWidth
        this.resizeObserver = new ResizeObserver(() => {
            this.displayW = stage.clientWidth
        })
        this.resizeObserver.observe(stage)
    }

    beforeDestroy() {
        this.resizeObserver?.disconnect()
        this.endDragListeners()
    }

    // ---------- geometry ----------
    get floor(): SensorFloor {
        return SENSOR_FLOORS.find((f) => f.location === this.location) ?? SENSOR_FLOORS[0]
    }

    /** The stage is exactly the plan's aspect ratio, so the fit has no letterbox offset. */
    get scale(): number {
        return fitPlan(Math.max(1, this.displayW), Number.MAX_SAFE_INTEGER).scale
    }

    get stageH(): number {
        return Math.round(PLAN_HEIGHT * this.scale)
    }

    get fieldStyle(): Record<string, string> {
        const mask = `url('${this.floor.mask}')`
        return {
            width: PLAN_WIDTH + 'px',
            height: PLAN_HEIGHT + 'px',
            transform: `scale(${this.scale})`,
            maskImage: mask,
            webkitMaskImage: mask,
        }
    }

    /** distance at which a sensor's weight halves in the value blend (~1.5 m) */
    get fieldHalfWeight(): number {
        return PLAN_UNITS_PER_METRE * 1.5
    }

    markerStyle(s: SensorEntry): Record<string, string> {
        const p = this.positionOf(s)
        return {
            left: (p ? p.x * this.scale : 0) + 'px',
            top: (p ? p.y * this.scale : 0) + 'px',
        }
    }

    positionOf(s: SensorEntry): { x: number; y: number } | null {
        if (this.dragKey === s.key && this.dragPos) return this.dragPos
        return s.x === null || s.y === null ? null : { x: s.x, y: s.y }
    }

    // ---------- roster ----------
    get roster(): Record<string, any> {
        return this.$store.state.gui?.remoteprinters?.printers ?? {}
    }

    /** Every roster air sensor (deduplicated by hostname) with its resolved placement. */
    get allEntries(): SensorEntry[] {
        const seen = new Set<string>()
        const out: SensorEntry[] = []
        for (const [id, e] of Object.entries(this.roster)) {
            if (e?.deviceType !== 'air_sensor' || !e.hostname) continue
            const key = hostKey(e.hostname)
            if (seen.has(key)) continue
            seen.add(key)
            const placement = resolveSensorPlacement(e)
            const shortHost = String(e.hostname).replace(/\.local$/i, '')
            out.push({
                id,
                key,
                hostname: e.hostname,
                shortHost,
                label: String(e.label ?? '').trim() || shortHost,
                location: placement?.location ?? ((e.location as MapLocation) || 'farm'),
                x: placement?.x ?? null,
                y: placement?.y ?? null,
                source: placement?.source ?? null,
            })
        }
        return out.sort((a, b) => a.label.localeCompare(b.label))
    }

    get floorEntries(): SensorEntry[] {
        return this.allEntries.filter((s) => s.location === this.location)
    }

    get placedEntries(): SensorEntry[] {
        return this.floorEntries.filter((s) => s.source !== null || this.dragKey === s.key)
    }

    get unplacedEntries(): SensorEntry[] {
        return this.floorEntries.filter((s) => s.source === null && this.dragKey !== s.key)
    }

    /** Surveyed defaults not yet saved, whose serial matches exactly one roster entry. */
    get surveyedEntries(): SensorEntry[] {
        const serialCount = new Map<string, number>()
        Object.values(this.roster).forEach((e: any) => {
            if (e?.deviceType !== 'air_sensor') return
            const serial = sensorSerialOf(e)
            if (serial) serialCount.set(serial, (serialCount.get(serial) ?? 0) + 1)
        })
        return this.floorEntries.filter((s) => {
            if (s.source !== 'surveyed') return false
            const serial = sensorSerialOf(this.roster[s.id])
            return !!serial && serialCount.get(serial) === 1
        })
    }

    get surveyedTitle(): string {
        return (
            'Save the surveyed CAD position and floor for: ' +
            this.surveyedEntries.map((s) => s.label).join(', ') +
            '. Sensors already placed by hand are not changed.'
        )
    }

    get sensorCount(): number {
        return this.floorEntries.length
    }

    get onlineCount(): number {
        return this.floorEntries.filter((s) => this.sensorOnline(s.hostname)).length
    }

    get legendTitle(): string {
        if (!this.sensorCount) return 'No air sensors on this floor'
        return `${this.onlineCount} of ${this.sensorCount} sensors reporting`
    }

    get legendColor(): string {
        return this.metric?.bands?.[0]?.color ?? AIR_NEUTRAL_COLOR
    }

    get editHint(): string {
        if (!this.isEditing) return ''
        return 'Drag a sensor to move it; it is saved when you drop it.'
    }

    // ---------- persistence ----------
    savePosition(s: SensorEntry, x: number, y: number) {
        const p = clampToPlan(x, y)
        this.$store.dispatch('gui/remoteprinters/updateOnDrag', {
            id: s.id,
            values: {
                location: this.location,
                mapPosition: { layoutId: SENSOR_LAYOUT_ID, x: roundPlan(p.x), y: roundPlan(p.y) },
            },
        })
    }

    applySurveyedPositions() {
        // Snapshot first: each save changes the roster and therefore this list.
        const todo = this.surveyedEntries.map((s) => ({ s, x: s.x as number, y: s.y as number }))
        todo.forEach(({ s, x, y }) => this.savePosition(s, x, y))
    }

    placeAtCentre(s: SensorEntry) {
        if (!this.isEditing) return
        this.savePosition(s, PLAN_WIDTH / 2, PLAN_HEIGHT / 2)
    }

    // ---------- drag ----------
    startDrag(event: PointerEvent, s: SensorEntry) {
        if (!this.isEditing || this.readonly) return
        event.preventDefault()
        this.hovered = null
        this.dragKey = s.key
        this.dragPos = this.positionOf(s)
        document.addEventListener('pointermove', this.onDrag)
        document.addEventListener('pointerup', this.stopDrag)
        document.addEventListener('pointercancel', this.cancelDrag)
    }

    onDrag(event: PointerEvent) {
        const stage = this.$refs.stage as HTMLElement | undefined
        if (!stage || !this.dragKey) return
        const rect = stage.getBoundingClientRect()
        this.dragPos = clampToPlan((event.clientX - rect.left) / this.scale, (event.clientY - rect.top) / this.scale)
    }

    stopDrag() {
        const s = this.allEntries.find((e) => e.key === this.dragKey)
        const p = this.dragPos
        const moved = !!s && !!p && (s.x === null || Math.abs(p.x - s.x) > 0.05 || Math.abs(p.y - (s.y ?? 0)) > 0.05)
        if (s && p && moved) this.savePosition(s, p.x, p.y)
        this.cancelDrag()
    }

    cancelDrag() {
        this.endDragListeners()
        this.dragKey = ''
        this.dragPos = null
    }

    endDragListeners() {
        document.removeEventListener('pointermove', this.onDrag)
        document.removeEventListener('pointerup', this.stopDrag)
        document.removeEventListener('pointercancel', this.cancelDrag)
    }

    openAirSensorSettings() {
        this.$root.$emit('open-settings', 'air-sensors')
    }

    // ---------- readings ----------
    get historical(): boolean {
        return this.airFrames !== null
    }

    get frames(): Record<string, AirSensorFrame> {
        if (this.airFrames !== null) return this.airFrames
        return this.$store.state.farm.fleetDaemonAirSensors || {}
    }

    get metric(): AirMetric | null {
        return this.metricKey ? this.$store.getters['fleet/air/getMetric'](this.metricKey) : null
    }

    get metrics(): AirMetric[] {
        return this.$store.getters['fleet/air/getMetrics'] || []
    }

    get metricUnitText(): string {
        return metricUnit(this.metric)
    }

    sensorFrame(hostname: string): AirSensorFrame | null {
        const key = hostKey(hostname)
        for (const [h, frame] of Object.entries(this.frames)) {
            if (hostKey(h) === key) return frame
        }
        return null
    }

    sensorOnline(hostname: string): boolean {
        if (this.historical) return !!this.sensorFrame(hostname)?.online
        return isSensorOnline(this.sensorFrame(hostname), this.$store.state.farm.fleetDaemonConnected)
    }

    sensorReading(hostname: string): number | null {
        return sensorValue(this.sensorFrame(hostname), this.metricKey)
    }

    sensorColor(hostname: string): string {
        if (!this.sensorOnline(hostname)) return AIR_NEUTRAL_COLOR
        return bandColor(this.metric, this.sensorReading(hostname))
    }

    sensorValueText(hostname: string): string {
        return formatMetricValue(this.metric, this.sensorReading(hostname))
    }

    /** "!" badge: worst band across all metrics when worse than Good (independent of the selected metric). */
    sensorBadgeColor(hostname: string): string | null {
        if (!this.sensorOnline(hostname)) return null
        const worst = worstReading(this.metrics, this.sensorFrame(hostname))
        return worst && worst.severity >= SEVERITY_ATTENTION ? worst.band.color : null
    }

    /** Field inputs in plan units: every online placed sensor with a reading; range is metres. */
    get airFields(): AirField[] {
        if (!this.metric) return []
        const fields: AirField[] = []
        for (const s of this.placedEntries) {
            if (!this.sensorOnline(s.hostname)) continue
            const value = this.sensorReading(s.hostname)
            const p = this.positionOf(s)
            if (value === null || !p) continue
            const range = this.$store.getters['gui/remoteprinters/getSensorRange'](s.hostname) as number
            fields.push({ cx: p.x, cy: p.y, radius: range * PLAN_UNITS_PER_METRE, value })
        }
        return fields
    }

    // ---------- tooltip ----------
    showTooltip(s: SensorEntry) {
        if (this.isEditing) return
        this.hovered = s
        const p = this.positionOf(s)
        if (!p) return
        const x = p.x * this.scale
        const y = p.y * this.scale
        const flip = x > this.displayW * 0.6
        this.tooltipStyle = {
            top: Math.max(4, Math.min(y - 12, this.stageH - 140)) + 'px',
            ...(flip ? { right: Math.max(4, this.displayW - x + 26) + 'px' } : { left: Math.max(4, x + 26) + 'px' }),
        }
    }

    hideTooltip() {
        this.hovered = null
    }

    get hoveredFrame(): AirSensorFrame | null {
        return this.hovered ? this.sensorFrame(this.hovered.hostname) : null
    }

    get hoveredOnline(): boolean {
        return this.hovered ? this.sensorOnline(this.hovered.hostname) : false
    }

    get hoveredAge(): string {
        if (this.historical) {
            const frame = this.hoveredFrame as (AirSensorFrame & { samples?: number; expected?: number }) | null
            if (!frame) return `no data${this.airFramesLabel ? ' at ' + this.airFramesLabel : ' for this hour'}`
            const at = this.airFramesLabel ? ` at ${this.airFramesLabel}` : ''
            if (typeof frame.samples === 'number' && typeof frame.expected === 'number')
                return `hourly mean${at} · ${frame.samples}/${frame.expected} readings`
            return at ? `snapshot${at}` : 'archived snapshot'
        }
        if (!this.$store.state.farm.fleetDaemonConnected) return 'fleet_daemon disconnected'
        const frame = this.hoveredFrame
        if (!frame) return 'no status from fleet_daemon yet'
        return 'last reading ' + formatAge(sensorAgeSeconds(frame))
    }

    get hoveredError(): string {
        return (this.hoveredFrame?.error ?? '').toString().trim()
    }

    get hoveredVendor(): string {
        if (!this.hovered) return ''
        const entry = this.roster[this.hovered.id]
        return AIR_SENSOR_VENDOR_LABELS[airSensorVendor(entry ?? { sensorVendor: this.hoveredFrame?.vendor })]
    }

    get hoveredFlags(): string[] {
        return this.historical ? [] : this.hoveredFrame?.flags ?? []
    }

    /** One row per catalog metric the sensor reports; flagged values (⚑) never get a band. */
    get hoveredRows(): { key: string; label: string; value: string; band: string; color: string; title: string }[] {
        const frame = this.hoveredFrame
        if (!frame) return []
        const rows = []
        for (const m of this.metrics) {
            const raw = rawSensorValue(frame, m.key)
            if (raw === null) continue
            const v = sensorValue(frame, m.key)
            const quality = metricQuality(frame, m.key)
            const band = bandFor(m, v)
            rows.push({
                key: m.key,
                label: m.label,
                value: formatMetricReading(m, raw) + (v === null ? ' ⚑' : ''),
                band: v === null ? (quality ?? 'flagged').replace(/_/g, ' ') : band?.name ?? '—',
                color: band?.color ?? AIR_NEUTRAL_COLOR,
                title: v === null ? `${quality}: excluded from bands, alerts and averages` : '',
            })
        }
        return rows
    }
}
</script>

<style scoped>
@keyframes save-pulse-anim {
    0%,
    100% {
        box-shadow:
            0 0 0 2px rgba(76, 175, 80, 0.45),
            0 0 12px 2px rgba(76, 175, 80, 0.55);
    }
    50% {
        box-shadow:
            0 0 0 4px rgba(76, 175, 80, 0.7),
            0 0 20px 4px rgba(76, 175, 80, 0.8);
    }
}
.save-pulse {
    font-weight: 700 !important;
    animation: save-pulse-anim 1.4s ease-in-out infinite;
}

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
.status-counter__muted {
    opacity: 0.7;
    font-weight: 400;
}
.status-counter--unplaced {
    opacity: 0.75;
    padding-left: 12px;
    border-left: 1px solid rgba(128, 128, 128, 0.4);
}
.status-dot.air {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    display: inline-block;
}

/* Plan */
.plan-frame {
    width: 100%;
    max-width: 1200px;
    background: #f5f3ef;
    border: 1px solid #33322f;
    border-radius: 6px;
    overflow: hidden;
}
.plan-stage {
    position: relative;
    width: 100%;
    user-select: none;
    touch-action: none;
}
.plan-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}
.plan-field {
    position: absolute;
    left: 0;
    top: 0;
    transform-origin: 0 0;
    pointer-events: none;
    mask-mode: luminance;
    mask-size: 100% 100%;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    -webkit-mask-repeat: no-repeat;
}

.marker {
    position: absolute;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 2;
    cursor: pointer;
}
.marker--editing {
    cursor: move;
}
.marker--dragging {
    z-index: 6;
    opacity: 0.85;
}
.marker--surveyed {
    outline: 2px dashed rgba(33, 150, 243, 0.8);
    outline-offset: 2px;
    border-radius: 6px;
}
.marker-label {
    position: absolute;
    top: 100%;
    margin-top: 1px;
    font-size: 10px;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    color: #33322f;
    background: rgba(245, 243, 239, 0.85);
    padding: 0 3px;
    border-radius: 3px;
    pointer-events: none;
}

.unplaced {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}
.unplaced__label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.6;
}

.tooltip {
    position: absolute;
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
.tooltip .note {
    opacity: 0.75;
}
.tooltip .air-online {
    color: #00e676;
}
.tooltip .air-offline {
    color: #ff8a80;
}
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
</style>
