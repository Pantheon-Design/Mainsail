<template>
    <div class="dash-workers" :class="{ 'dash-workers--reduced': reducedMotion }">
        <!-- 1. attention: the one number an operator must see first -->
        <div
            class="dash-workers__attention"
            :class="{ 'dash-workers__attention--active': attentionHostnames.length > 0 }"
            :title="attentionTitle">
            <v-icon :size="56" :color="attentionHostnames.length ? 'white' : 'grey'">{{ mdiExclamationThick }}</v-icon>
            <span class="dash-workers__attention-num">{{ attentionHostnames.length }}</span>
            <span class="dash-workers__attention-text">
                {{
                    attentionHostnames.length === 1
                        ? $t('FleetDashboard.NeedsAttention')
                        : $t('FleetDashboard.NeedAttention')
                }}
                <span v-if="attentionHostnames.length" class="dash-workers__attention-hosts">
                    {{ attentionHostnames.map(shortName).join(', ') }}
                </span>
            </span>
        </div>

        <!-- 2. worker status summary -->
        <div class="dash-workers__row">
            <span class="dash-workers__row-title">
                <v-icon small color="orange">{{ mdiHammer }}</v-icon>
                {{ enabledCount }} {{ $t('FleetDashboard.Workers') }}
            </span>
            <span v-for="s in workerStatusList" :key="s.key" class="dash-workers__status" :title="s.label">
                <span
                    class="dash-workers__dot"
                    :class="{ square: s.key === 'error' || s.key === 'printing' }"
                    :style="{ backgroundColor: s.color }"></span>
                {{ s.label }}
                <strong>{{ s.count }}</strong>
            </span>
        </div>

        <!-- 3. finish forecast: totals only; the worker / other split is in the hover title -->
        <div class="dash-workers__row-title mt-2">
            {{ $t('FleetDashboard.Finishing') }}
            <span class="text--secondary font-weight-regular">
                · {{ buckets.total.workers + buckets.total.others }} {{ $t('FleetDashboard.PrintingNow') }}
            </span>
        </div>
        <div class="dash-workers__bands">
            <span v-for="b in buckets.bands" :key="'band-' + b.label" class="dash-workers__band" :title="splitTitle(b)">
                <span class="dash-workers__band-label">{{ b.label }}</span>
                <span class="dash-workers__band-num">{{ b.workers + b.others }}</span>
            </span>
            <span
                v-for="w in buckets.within"
                :key="'within-' + w.hours"
                class="dash-workers__band dash-workers__band--within"
                :title="splitTitle(w)">
                <span class="dash-workers__band-label">{{ $t('FleetDashboard.Within', { hours: w.hours }) }}</span>
                <span class="dash-workers__band-num">{{ w.workers + w.others }}</span>
            </span>
            <span
                v-if="buckets.unknown.workers + buckets.unknown.others"
                class="dash-workers__band dash-workers__band--unknown"
                :title="$t('FleetDashboard.UnknownHint') + '\n' + splitTitle(buckets.unknown)">
                <span class="dash-workers__band-label">{{ $t('FleetDashboard.Unknown') }}</span>
                <span class="dash-workers__band-num">{{ buckets.unknown.workers + buckets.unknown.others }}</span>
            </span>
        </div>

        <!-- 4. worker list: one metric at a time (progress / nozzle health / filament left) -->
        <div class="dash-workers__list-head mt-2">
            <span class="dash-workers__row-title">{{ $t('FleetDashboard.WorkerList') }}</span>
            <v-btn-toggle v-model="metric" dense mandatory class="dash-workers__toggle" @change="onMetricPicked">
                <v-btn x-small value="progress" :title="$t('FleetDashboard.MetricProgress')">
                    <v-icon small>{{ mdiProgressClock }}</v-icon>
                </v-btn>
                <v-btn x-small value="nozzle" :title="$t('FleetDashboard.MetricNozzle')">
                    <v-icon small>{{ mdiPrinter3dNozzle }}</v-icon>
                </v-btn>
                <v-btn x-small value="filament" :title="$t('FleetDashboard.MetricFilament')">
                    <v-icon small>{{ mdiSpool }}</v-icon>
                </v-btn>
            </v-btn-toggle>
            <v-btn
                x-small
                icon
                :color="autoCycle ? 'primary' : undefined"
                :title="$t('FleetDashboard.AutoCycle')"
                @click="toggleAutoCycle">
                <v-icon small :class="{ 'dash-workers__spin': autoCycle }">{{ mdiAutorenew }}</v-icon>
            </v-btn>
            <!-- big indicator of what the bars mean right now: nozzle / spool / progress icon + label -->
            <span :key="metric" class="dash-workers__metric" :class="'dash-workers__metric--' + metric">
                <v-icon :size="44" color="white">{{ metricIcon }}</v-icon>
                <span class="dash-workers__metric-label">{{ metricLabel }}</span>
            </span>
        </div>
        <div class="dash-workers__list">
            <table class="dash-workers__table dash-workers__table--list">
                <tbody>
                    <tr
                        v-for="r in sortedRows"
                        :key="r.hostname"
                        class="dash-workers__worker"
                        :class="{ 'dash-workers__worker--hover': hoverHostname === r.hostname }"
                        :title="rowTitle(r)"
                        @mouseenter="setHover(r.hostname)"
                        @mouseleave="setHover('')">
                        <td class="dash-workers__worker-name text-left">
                            <span class="dash-workers__dot" :style="{ backgroundColor: r.color }"></span>
                            {{ r.short }}
                            <v-icon v-if="r.attention" x-small color="error" class="ml-1">
                                {{ mdiExclamationThick }}
                            </v-icon>
                        </td>
                        <td class="dash-workers__worker-bar">
                            <!-- progress: solid rounded bar with the percentage inside -->
                            <div
                                v-if="metric === 'progress'"
                                class="bar-progress"
                                :class="{ 'bar-progress--idle': r.progress === null }">
                                <div class="bar-progress__fill" :style="{ width: (r.progress ?? 0) * 100 + '%' }"></div>
                                <span class="bar-progress__text">
                                    {{ r.progress === null ? r.statusLabel : Math.round(r.progress * 100) + '%' }}
                                </span>
                            </div>
                            <!-- nozzle health: ten segments, coloured by remaining life -->
                            <div
                                v-else-if="metric === 'nozzle'"
                                class="bar-segments"
                                :class="'bar-segments--' + healthTone(r.nozzlePct)">
                                <span
                                    v-for="i in 10"
                                    :key="i"
                                    class="bar-segments__seg"
                                    :class="{
                                        'bar-segments__seg--on': r.nozzlePct !== null && r.nozzlePct >= i * 10 - 5,
                                    }"></span>
                                <span class="bar-segments__text">
                                    {{ r.nozzlePct === null ? '?' : Math.round(r.nozzlePct) + '%' }}
                                </span>
                            </div>
                            <!-- filament left: thin gauge with a gradient track and the grams on the right -->
                            <div v-else class="bar-gauge">
                                <div class="bar-gauge__track">
                                    <div
                                        class="bar-gauge__mask"
                                        :style="{ width: 100 - (r.gramsPct ?? 0) + '%' }"></div>
                                    <div
                                        v-if="r.gramsPct !== null"
                                        class="bar-gauge__needle"
                                        :style="{ left: r.gramsPct + '%' }"></div>
                                </div>
                                <span class="bar-gauge__text">
                                    {{ r.gramsLeft === null ? '?' : Math.round(r.gramsLeft) + ' g' }}
                                </span>
                            </div>
                        </td>
                    </tr>
                    <tr v-if="!sortedRows.length">
                        <td colspan="2" class="text-left text--secondary">{{ $t('FleetDashboard.NoWorkers') }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Mixins, Prop } from 'vue-property-decorator'
import { mdiAutorenew, mdiExclamationThick, mdiHammer, mdiPrinter3dNozzle, mdiProgressClock } from '@mdi/js'
import { mdiSpool } from '@/plugins/customIcons'
import BaseMixin from '@/components/mixins/base'
import { hostKey } from '@/plugins/hostKey'
import { FleetWorker } from '@/store/fleet/jobs/types'
import { ServiceTrackerPrinterSummary } from '@/store/fleet/maintenance/types'
import {
    computeNozzleHealthPct,
    computeRemainingWeightPct,
    countPrinterStatuses,
    getPrinterStatus,
    PrinterStatus,
    STATUS_META,
    STATUS_ORDER,
} from '@/components/panels/farmPrinterStatus'
import {
    attentionChipTitle,
    attentionWorkerHostnames,
    attentionWorkerReasons,
    enabledWorkerHostnames,
    workerNeedsAttention,
} from '@/components/panels/fleetWorkerAttention'
import { bucketFinishes, FinishBuckets, FinishCount, FinishEntry, remainingSecs } from '@/store/fleet/forecast'

type WorkerMetric = 'progress' | 'nozzle' | 'filament'
const METRICS: WorkerMetric[] = ['progress', 'nozzle', 'filament']
const METRIC_KEY = 'fleetDashboardWorkerMetric'
const AUTO_KEY = 'fleetDashboardWorkerAutoCycle'
const CYCLE_MS = 5000

interface WorkerRow {
    hostname: string
    short: string
    status: PrinterStatus
    statusLabel: string
    color: string
    attention: boolean
    reason: string | null
    /** 0..1 while printing, else null */
    progress: number | null
    nozzlePct: number | null
    gramsLeft: number | null
    gramsPct: number | null
}

/**
 * Workers section of the fleet dashboard: attention count first, the enabled
 * workers by status, how many printing printers finish within the configured
 * hour marks (totals; worker / other split on hover), then the worker list
 * showing one metric at a time — print progress (closest to done first),
 * nozzle health or filament left (lowest first) — optionally cycling every 5 s.
 * Hovering a row emits `hover` so the page can highlight the printer on the map.
 */
@Component
export default class DashboardWorkersPanel extends Mixins(BaseMixin) {
    @Prop({ type: Array, default: () => [] }) readonly workers!: FleetWorker[]
    @Prop({ type: Array, default: () => [1, 2] }) readonly intervalsHours!: number[]
    /** Reduced motion (slow screens): the attention banner stays solid red instead of flashing. */
    @Prop({ type: Boolean, default: false }) readonly reducedMotion!: boolean

    mdiExclamationThick = mdiExclamationThick
    mdiHammer = mdiHammer
    mdiAutorenew = mdiAutorenew
    mdiPrinter3dNozzle = mdiPrinter3dNozzle
    mdiProgressClock = mdiProgressClock
    mdiSpool = mdiSpool

    metric: WorkerMetric = 'progress'
    autoCycle = false
    hoverHostname = ''
    private cycleTimer: ReturnType<typeof setInterval> | null = null

    created() {
        try {
            const m = localStorage.getItem(METRIC_KEY) as WorkerMetric | null
            if (m && METRICS.includes(m)) this.metric = m
            this.autoCycle = localStorage.getItem(AUTO_KEY) === '1'
        } catch (e) {
            // storage unavailable — keep defaults
        }
    }

    mounted() {
        this.applyCycle()
    }

    beforeDestroy() {
        this.stopCycle()
        this.setHover('')
    }

    // ---- metric switch / auto cycle ----
    get metricIcon(): string {
        if (this.metric === 'nozzle') return mdiPrinter3dNozzle
        if (this.metric === 'filament') return mdiSpool
        return mdiProgressClock
    }

    get metricLabel(): string {
        if (this.metric === 'nozzle') return this.$t('FleetDashboard.MetricNozzle') as string
        if (this.metric === 'filament') return this.$t('FleetDashboard.MetricFilament') as string
        return this.$t('FleetDashboard.MetricProgress') as string
    }

    /** A manual pick pauses the cycle so the chosen metric stays until it is turned back on. */
    onMetricPicked() {
        if (this.autoCycle) {
            this.autoCycle = false
            this.applyCycle()
        }
        this.persist()
    }

    toggleAutoCycle() {
        this.autoCycle = !this.autoCycle
        this.applyCycle()
        this.persist()
    }

    applyCycle() {
        this.stopCycle()
        if (!this.autoCycle) return
        this.cycleTimer = setInterval(() => {
            const i = METRICS.indexOf(this.metric)
            this.metric = METRICS[(i + 1) % METRICS.length]
        }, CYCLE_MS)
    }

    stopCycle() {
        if (this.cycleTimer) clearInterval(this.cycleTimer)
        this.cycleTimer = null
    }

    persist() {
        try {
            localStorage.setItem(METRIC_KEY, this.metric)
            localStorage.setItem(AUTO_KEY, this.autoCycle ? '1' : '0')
        } catch (e) {
            // ignore
        }
    }

    setHover(hostname: string) {
        if (this.hoverHostname === hostname) return
        this.hoverHostname = hostname
        this.$emit('hover', hostname)
    }

    // ---- data ----
    get connected(): boolean {
        return !!this.$store.state.farm.fleetDaemonConnected
    }

    /** fleet_daemon frames keyed by hostKey so worker rows match regardless of `.local` / case. */
    get framesByKey(): Map<string, any> {
        const out = new Map<string, any>()
        Object.entries(this.$store.state.farm.fleetDaemonPrinters || {}).forEach(([h, frame]) =>
            out.set(hostKey(h), frame)
        )
        return out
    }

    /** Daily service-tracker snapshot per printer: nozzle life fallback for older daemons. */
    get snapshotByKey(): Map<string, ServiceTrackerPrinterSummary> {
        const out = new Map<string, ServiceTrackerPrinterSummary>()
        const rows: ServiceTrackerPrinterSummary[] = this.$store.getters['fleet/maintenance/getPrinters'] || []
        rows.forEach((r) => out.set(hostKey(r.printer_hostname), r))
        return out
    }

    get enabledHostnames(): string[] {
        return enabledWorkerHostnames(this.workers)
    }

    get enabledCount(): number {
        const keys = new Set(this.enabledHostnames.map(hostKey))
        let n = 0
        this.framesByKey.forEach((_frame, key) => {
            if (keys.has(key)) n++
        })
        return n
    }

    get attentionHostnames(): string[] {
        return attentionWorkerHostnames(this.workers)
    }

    get attentionTitle(): string {
        return attentionChipTitle(this.attentionHostnames, attentionWorkerReasons(this.workers))
    }

    shortName(hostname: string): string {
        return hostname.replace(/\.local$/i, '')
    }

    get workerStatusList() {
        const keys = new Set(this.enabledHostnames.map(hostKey))
        const frames: any[] = []
        this.framesByKey.forEach((frame, key) => {
            if (keys.has(key)) frames.push(frame)
        })
        const counts = countPrinterStatuses(frames, this.connected)
        return STATUS_ORDER.map((k) => ({
            key: k,
            label: STATUS_META[k].label,
            color: STATUS_META[k].color,
            count: counts[k],
        }))
    }

    /** Every printer that is printing right now (worker or not), with its remaining time. */
    get printingEntries(): FinishEntry[] {
        return this.workers
            .filter((w) => {
                const frame = this.framesByKey.get(hostKey(w.printer_hostname))
                if (frame) return getPrinterStatus(frame, this.connected) === 'printing'
                return w.connected && w.print_state === 'printing'
            })
            .map((w) => ({
                remaining: remainingSecs({
                    estimated_time: w.estimated_time,
                    print_duration: w.print_duration,
                    progress: w.progress,
                    filename: w.filename,
                }),
                isWorker: w.enabled,
            }))
    }

    get buckets(): FinishBuckets {
        return bucketFinishes(this.printingEntries, this.intervalsHours)
    }

    splitTitle(c: FinishCount): string {
        return this.$t('FleetDashboard.HoverSplit', { workers: c.workers, others: c.others }) as string
    }

    // ---- worker list ----
    get rows(): WorkerRow[] {
        return this.workers
            .filter((w) => w.enabled)
            .map((w) => {
                const key = hostKey(w.printer_hostname)
                const frame = this.framesByKey.get(key)
                const th = frame?.toolhead || {}
                const snap = this.snapshotByKey.get(key)?.latest || null
                const status: PrinterStatus = frame
                    ? getPrinterStatus(frame, this.connected)
                    : w.connected
                    ? w.print_state === 'printing'
                        ? 'printing'
                        : 'ready'
                    : 'disconnected'
                const rawProgress = frame?.virtual_sdcard?.progress ?? w.progress
                const progress =
                    status === 'printing' && typeof rawProgress === 'number'
                        ? Math.min(1, Math.max(0, rawProgress))
                        : null
                const nozzlePct =
                    computeNozzleHealthPct(th.nozzle_life, th.remaining_nozzle_life) ??
                    computeNozzleHealthPct(w.nozzle_life, w.remaining_nozzle_life) ??
                    computeNozzleHealthPct(snap?.nozzle_life, snap?.remaining_nozzle_life)
                const grams = typeof th.remaining_weight === 'number' ? th.remaining_weight : w.remaining_weight
                const gramsLeft = typeof grams === 'number' && !isNaN(grams) ? Math.max(0, grams) : null
                let gramsPct = frame ? computeRemainingWeightPct(frame) : null
                if (gramsPct === null && gramsLeft !== null && snap?.initial_weight) {
                    gramsPct = Math.max(0, Math.min(100, (gramsLeft / snap.initial_weight) * 100))
                }
                return {
                    hostname: w.printer_hostname,
                    short: this.shortName(w.printer_hostname),
                    status,
                    statusLabel: STATUS_META[status].label,
                    color: STATUS_META[status].color,
                    attention: workerNeedsAttention(w),
                    reason: w.reason,
                    progress,
                    nozzlePct,
                    gramsLeft,
                    gramsPct,
                }
            })
    }

    get sortedRows(): WorkerRow[] {
        const rows = [...this.rows]
        const last = (v: number | null) => (v === null ? Number.POSITIVE_INFINITY : v)
        if (this.metric === 'progress') {
            // closest to complete first; idle / offline workers after the printing ones, by status
            return rows.sort((a, b) => {
                if (a.progress !== null && b.progress !== null) return b.progress - a.progress
                if (a.progress !== null) return -1
                if (b.progress !== null) return 1
                return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.short.localeCompare(b.short)
            })
        }
        if (this.metric === 'nozzle')
            return rows.sort((a, b) => last(a.nozzlePct) - last(b.nozzlePct) || a.short.localeCompare(b.short))
        return rows.sort((a, b) => last(a.gramsLeft) - last(b.gramsLeft) || a.short.localeCompare(b.short))
    }

    healthTone(pct: number | null): string {
        if (pct === null) return 'unknown'
        if (pct <= 20) return 'low'
        if (pct <= 50) return 'mid'
        return 'ok'
    }

    rowTitle(r: WorkerRow): string {
        const lines = [
            `${r.hostname} · ${r.statusLabel}${r.progress !== null ? ` ${Math.round(r.progress * 100)}%` : ''}`,
        ]
        lines.push(
            `${this.$t('FleetDashboard.MetricNozzle')}: ${r.nozzlePct === null ? '?' : Math.round(r.nozzlePct) + '%'}`
        )
        lines.push(
            `${this.$t('FleetDashboard.MetricFilament')}: ${
                r.gramsLeft === null ? '?' : Math.round(r.gramsLeft) + ' g'
            }`
        )
        if (r.attention) lines.push(`Needs attention: ${r.reason || ''}`)
        return lines.join('\n')
    }
}
</script>

<style scoped>
.dash-workers {
    display: flex;
    flex-direction: column;
    min-height: 0;
    /* when the fixed parts alone exceed the column (small screens) the whole panel scrolls */
    overflow-y: auto;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(128, 128, 128, 0.25);
    border-radius: 6px;
    padding: 8px 12px 10px;
}
.dash-workers__attention {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid rgba(128, 128, 128, 0.4);
    margin-bottom: 8px;
    flex: 0 0 auto;
}
/* Flashes in the second half of the 2.4s cycle; the page background (Dashboard.vue,
   html.fleet-attention #content) flashes in the first half, so they take turns. */
.dash-workers__attention--active {
    background: #b71c1c;
    border-color: #b71c1c;
    color: #fff;
    animation: dash-attention-banner 2.4s ease-in-out infinite;
}
@keyframes dash-attention-banner {
    0%,
    50%,
    100% {
        background-color: #b71c1c;
        border-color: #b71c1c;
        box-shadow: 0 0 0 0 rgba(255, 82, 82, 0);
    }
    75% {
        background-color: #ff5252;
        border-color: #ff5252;
        box-shadow: 0 0 18px 4px rgba(255, 82, 82, 0.75);
    }
}
.dash-workers--reduced .dash-workers__attention--active {
    animation: none;
}
.dash-workers__attention-num {
    font-size: 68px;
    font-weight: 900;
    line-height: 1;
    font-variant-numeric: tabular-nums;
}
.dash-workers__attention-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    font-size: 26px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.dash-workers__attention-hosts {
    font-size: 22px;
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
    opacity: 0.9;
    /* one line; the full list is in the banner's hover title */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
}
.dash-workers__row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 12px;
    font-size: 24px;
    flex: 0 0 auto;
}
.dash-workers__row-title {
    font-size: 24px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.dash-workers__status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.dash-workers__dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    display: inline-block;
    flex: 0 0 auto;
}
.dash-workers__dot.square {
    border-radius: 2px;
}

/* finish forecast: compact tiles, totals only (split in the hover title) */
.dash-workers__bands {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
    flex: 0 0 auto;
}
.dash-workers__band {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    min-width: 96px;
    padding: 4px 12px;
    border-radius: 6px;
    background: rgba(128, 128, 128, 0.12);
    cursor: default;
}
.dash-workers__band--within {
    background: transparent;
    border: 1px dashed rgba(128, 128, 128, 0.4);
}
.dash-workers__band--unknown {
    opacity: 0.6;
}
.dash-workers__band-label {
    font-size: 20px;
    opacity: 0.75;
    white-space: nowrap;
}
.dash-workers__band-num {
    font-size: 36px;
    font-weight: 800;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
}

/* worker list */
.dash-workers__list-head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto;
}
.dash-workers__toggle {
    height: 34px;
}
.dash-workers__toggle .v-btn {
    height: 34px !important;
    min-width: 44px !important;
}
/* big "what am I looking at" indicator: coloured pill per metric, pops in on change */
.dash-workers__metric {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 3px 12px 3px 8px;
    border-radius: 16px;
    color: #fff;
    font-size: 20px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    animation: dash-metric-pop 0.35s ease-out;
}
.dash-workers__metric--progress {
    background: #1976d2;
}
.dash-workers__metric--nozzle {
    background: #ef6c00;
}
.dash-workers__metric--filament {
    background: #2e7d32;
}
@keyframes dash-metric-pop {
    0% {
        transform: scale(0.85);
        opacity: 0.4;
    }
    100% {
        transform: scale(1);
        opacity: 1;
    }
}
@keyframes dash-spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}
.dash-workers__spin {
    animation: dash-spin 2s linear infinite;
}
.dash-workers__list {
    flex: 1 1 auto;
    min-height: 160px;
    overflow-y: auto;
    margin-top: 4px;
}
.dash-workers__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 24px;
    font-variant-numeric: tabular-nums;
}
.dash-workers__table td {
    padding: 2px 6px;
}
.dash-workers__worker {
    cursor: pointer;
}
.dash-workers__worker:hover,
.dash-workers__worker--hover {
    background: rgba(255, 235, 59, 0.14);
}
.dash-workers__worker-name {
    white-space: nowrap;
    width: 1%;
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
}
.dash-workers__worker-bar {
    width: 99%;
}

/* progress: solid rounded bar, percentage inside */
.bar-progress {
    position: relative;
    height: 30px;
    border-radius: 15px;
    background: rgba(128, 128, 128, 0.25);
    overflow: hidden;
}
.bar-progress__fill {
    height: 100%;
    background: linear-gradient(90deg, #1976d2, #2196f3);
    border-radius: 15px;
    transition: width 0.4s ease;
}
.bar-progress--idle .bar-progress__fill {
    background: transparent;
}
.bar-progress__text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: 700;
    color: #fff;
    text-shadow: 0 0 3px rgba(0, 0, 0, 0.7);
}
.bar-progress--idle .bar-progress__text {
    color: rgba(255, 255, 255, 0.6);
    text-shadow: none;
}

/* nozzle health: ten segments lit from the left, colour by remaining life */
.bar-segments {
    display: flex;
    align-items: center;
    gap: 3px;
    height: 30px;
}
.bar-segments__seg {
    flex: 1 1 0;
    height: 20px;
    border-radius: 3px;
    background: rgba(128, 128, 128, 0.22);
}
.bar-segments--ok .bar-segments__seg--on {
    background: #43a047;
}
.bar-segments--mid .bar-segments__seg--on {
    background: #fb8c00;
}
.bar-segments--low .bar-segments__seg--on {
    background: #e53935;
    box-shadow: 0 0 4px rgba(229, 57, 53, 0.8);
}
.bar-segments__text {
    flex: 0 0 76px;
    text-align: right;
    font-size: 22px;
    font-weight: 700;
    padding-left: 4px;
}

/* filament left: gradient gauge revealed from the left with a needle, grams on the right */
.bar-gauge {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 30px;
}
.bar-gauge__track {
    position: relative;
    flex: 1 1 0;
    height: 12px;
    border-radius: 6px;
    background: linear-gradient(90deg, #e53935 0%, #fb8c00 35%, #43a047 100%);
    overflow: visible;
}
.bar-gauge__mask {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    background: rgba(40, 40, 40, 0.85);
    border-radius: 0 3px 3px 0;
    transition: width 0.4s ease;
}
.bar-gauge__needle {
    position: absolute;
    top: -6px;
    width: 4px;
    height: 24px;
    margin-left: -2px;
    border-radius: 2px;
    background: #fff;
    box-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
    transition: left 0.4s ease;
}
.bar-gauge__text {
    flex: 0 0 104px;
    text-align: right;
    font-size: 22px;
    font-weight: 700;
}
</style>
