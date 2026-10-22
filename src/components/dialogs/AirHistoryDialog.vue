<template>
    <v-dialog :value="value" max-width="1500" scrollable @input="$emit('input', $event)">
        <v-card>
            <v-card-title class="d-flex align-center flex-wrap">
                <v-icon class="mr-2">{{ mdiHistory }}</v-icon>
                <span class="mr-4">{{ $t('AirQuality.HistoryTitle') }}</span>
                <v-chip-group v-model="rangeDays" mandatory active-class="primary--text" class="mr-4" @change="load">
                    <v-chip v-for="r in RANGES" :key="'range-' + r.days" :value="r.days" small outlined>{{ r.label }}</v-chip>
                </v-chip-group>
                <v-chip-group v-if="metrics.length" v-model="metricKey" mandatory active-class="primary--text" column>
                    <v-chip v-for="m in metrics" :key="'hm-' + m.key" :value="m.key" small outlined>{{ m.label }}</v-chip>
                </v-chip-group>
                <v-spacer />
                <span v-if="source" class="air-history__source mr-3" :title="sourceTitle">{{ sourceLabel }}</span>
                <v-btn icon @click="$emit('input', false)"><v-icon>{{ mdiClose }}</v-icon></v-btn>
            </v-card-title>

            <v-card-text class="air-history__body">
                <v-alert v-if="error" type="error" dense text class="mb-3">{{ $t('AirQuality.HistoryError') }} {{ error }}</v-alert>
                <v-alert v-else-if="!loading && !hours.length" type="info" dense text class="mb-3">{{ $t('AirQuality.HistoryEmpty') }}</v-alert>
                <v-progress-linear v-if="loading" indeterminate class="mb-3" />

                <v-tabs v-if="hours.length" v-model="view" class="mb-3" height="36">
                    <v-tab>{{ $t('AirQuality.HistoryMapView') }}</v-tab>
                    <v-tab>{{ $t('AirQuality.HistoryChartView') }}</v-tab>
                </v-tabs>

                <!-- Timeline: one slider step per archived hour; the strip under it is the fleet-wide worst band
                     of the selected metric for each hour (click to jump). -->
                <div v-if="hours.length" class="air-history__timeline mb-4">
                    <div class="air-history__time-row">
                        <v-btn icon small :disabled="index <= 0" :title="$t('AirQuality.HistoryPrev')" @click="step(-1)">
                            <v-icon>{{ mdiChevronLeft }}</v-icon>
                        </v-btn>
                        <div class="air-history__time">
                            <strong>{{ hourLabel }}</strong>
                            <span class="air-history__time-sub">{{ onlineSummary }}</span>
                        </div>
                        <v-btn icon small :disabled="index >= hours.length - 1" :title="$t('AirQuality.HistoryNext')" @click="step(1)">
                            <v-icon>{{ mdiChevronRight }}</v-icon>
                        </v-btn>
                        <v-btn small text class="ml-2" :disabled="index >= hours.length - 1" @click="index = hours.length - 1">
                            {{ $t('AirQuality.HistoryLatest') }}
                        </v-btn>
                    </div>
                    <v-slider
                        v-model="index"
                        :min="0"
                        :max="hours.length - 1"
                        :step="1"
                        hide-details
                        class="air-history__slider"
                        thumb-label
                        :thumb-size="56">
                        <template #thumb-label="{ value: v }">
                            <span class="air-history__thumb">{{ shortLabel(v) }}</span>
                        </template>
                    </v-slider>
                    <div class="air-history__strip" :title="$t('AirQuality.HistoryStripHint')">
                        <span
                            v-for="(h, i) in hours"
                            :key="'strip-' + h.epoch"
                            class="air-history__cell"
                            :class="{ 'air-history__cell--active': i === index }"
                            :style="{ backgroundColor: worstColor(h) }"
                            :title="shortLabel(i)"
                            @click="index = i"></span>
                    </div>
                    <div class="air-history__axis">
                        <span v-for="t in axisTicks" :key="'tick-' + t.index" :style="{ left: t.pct + '%' }">{{ t.label }}</span>
                    </div>
                </div>

                <!-- Charts: the selected metric over the whole range, one line per sensor (hourly means) -->
                <template v-if="hours.length && view === 1">
                    <p class="air-history__chart-hint mb-1">{{ $t('AirQuality.HistoryChartHint') }}</p>
                    <air-history-chart
                        v-if="metric"
                        :hours="hours"
                        :metric="metric"
                        :sensors="chartSensors"
                        :selected-epoch="current ? current.epoch : null"
                        @select="selectFromChart" />
                </template>

                <!-- The same two floors as the live page, fed the selected hour instead of the live socket -->
                <template v-if="hours.length && view === 0">
                    <farm-map-section
                        mode="air"
                        location="farm"
                        name="Print Farm"
                        readonly
                        :readonly-hint="$t('AirQuality.HistoryHint')"
                        :metric-key="metricKey"
                        :air-frames="framesAtHour"
                        :air-frames-label="hourLabel"
                        class="mb-8" />
                    <farm-map-section
                        mode="air"
                        location="ground"
                        name="Ground Floor"
                        readonly
                        :readonly-hint="$t('AirQuality.HistoryHint')"
                        :metric-key="metricKey"
                        :air-frames="framesAtHour"
                        :air-frames-label="hourLabel" />
                </template>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<script lang="ts">
/**
 * Air Quality history (`GET /air/history`, hourly): the daemon averages each sensor's
 * per-minute readings per hour (valid readings only; hours before the per-minute recorder
 * existed come from the legacy hourly snapshots). Two views share the hour timeline:
 *  - Map: the live page's two maps rendered for the selected hour; hover a sensor for its
 *    readings at that hour. Sensor positions are the current roster positions.
 *  - Chart: the selected metric over the whole range, one line per sensor; click a point
 *    to select its hour (then switch back to the map).
 */
import { Component, Mixins, Prop, Watch } from 'vue-property-decorator'
import { mdiChevronLeft, mdiChevronRight, mdiClose, mdiHistory } from '@mdi/js'
import BaseMixin from '@/components/mixins/base'
import FarmMapSection from '@/components/panels/FarmMapSection.vue'
import AirHistoryChart, { AirChartSensor } from '@/components/charts/AirHistoryChart.vue'
import { AirHistoryHour, AirHistoryResponse, AirMetric } from '@/store/fleet/air/types'
import { AirSensorFrame } from '@/store/farm/types'
import { AIR_NEUTRAL_COLOR, bandFor, bandSeverity, sensorValue } from '@/components/panels/airQualityBands'

interface Range {
    days: number
    label: string
}

@Component({ components: { FarmMapSection, AirHistoryChart } })
export default class AirHistoryDialog extends Mixins(BaseMixin) {
    mdiChevronLeft = mdiChevronLeft
    mdiChevronRight = mdiChevronRight
    mdiClose = mdiClose
    mdiHistory = mdiHistory

    readonly RANGES: Range[] = [
        { days: 1, label: '24 h' },
        { days: 3, label: '3 d' },
        { days: 7, label: '7 d' },
        { days: 14, label: '14 d' },
        { days: 30, label: '30 d' },
    ]

    @Prop({ type: Boolean, default: false }) readonly value!: boolean
    /** Metric selected on the live page; the dialog starts on it. */
    @Prop({ type: String, default: '' }) readonly initialMetricKey!: string

    rangeDays = 7
    metricKey = ''
    /** 0 = map, 1 = chart */
    view = 0
    hours: AirHistoryHour[] = []
    index = 0
    loading = false
    error: string | null = null
    source: AirHistoryResponse['source'] = null
    truncated = false

    @Watch('value')
    onOpen(open: boolean) {
        if (!open) return
        this.metricKey = this.initialMetricKey || this.metricKey || this.metrics[0]?.key || ''
        this.load()
    }

    get metrics(): AirMetric[] {
        return this.$store.getters['fleet/air/getRosterMetrics'] || []
    }

    /** Chart lines: current roster sensors first (by label), then hosts that only appear in the archive. */
    get chartSensors(): AirChartSensor[] {
        const printers = this.$store.state.gui?.remoteprinters?.printers ?? {}
        const byHost = new Map<string, AirChartSensor>()
        const norm = (h: string) => h.toLowerCase().replace(/\.local$/, '')
        const archived = new Set<string>()
        for (const h of this.hours) for (const host of Object.keys(h.sensors)) archived.add(host)
        for (const entry of Object.values(printers) as any[]) {
            if (entry?.deviceType !== 'air_sensor' || !entry.hostname) continue
            const host = [...archived].find((a) => norm(a) === norm(entry.hostname))
            if (!host) continue
            byHost.set(host, { hostname: host, label: (entry.label ?? '').trim() || entry.hostname })
        }
        for (const host of archived) {
            if (byHost.has(host)) continue
            const latestLabel = [...this.hours].reverse().find((h) => h.sensors[host]?.label)?.sensors[host]?.label
            byHost.set(host, { hostname: host, label: latestLabel || host })
        }
        return [...byHost.values()].sort((a, b) => a.label.localeCompare(b.label))
    }

    selectFromChart(index: number) {
        this.index = index
    }

    get metric(): AirMetric | null {
        return this.metricKey ? this.$store.getters['fleet/air/getMetric'](this.metricKey) : null
    }

    async load() {
        this.loading = true
        this.error = null
        const until = new Date()
        const since = new Date(until.getTime() - this.rangeDays * 86400 * 1000)
        try {
            const res: AirHistoryResponse = await this.$store.dispatch('fleet/air/loadHistory', { since, until })
            this.hours = res.hours ?? []
            this.source = res.source ?? null
            this.truncated = !!res.truncated
            this.index = Math.max(0, this.hours.length - 1)
        } catch (e: any) {
            this.error = e?.message ?? String(e)
            this.hours = []
        } finally {
            this.loading = false
        }
    }

    step(delta: number) {
        this.index = Math.min(this.hours.length - 1, Math.max(0, this.index + delta))
    }

    get current(): AirHistoryHour | null {
        return this.hours[this.index] ?? null
    }

    /** Frames the maps render: the archived hour, keyed by hostname like the live socket. */
    get framesAtHour(): Record<string, AirSensorFrame> {
        const out: Record<string, AirSensorFrame> = {}
        const sensors = this.current?.sensors ?? {}
        for (const [host, f] of Object.entries(sensors)) {
            out[host] = {
                hostname: f.hostname,
                device_type: 'air_sensor',
                online: !!f.online,
                last_update: f.last_update ?? null,
                values: (f.values ?? {}) as any,
                error: f.error ?? null,
            }
        }
        return out
    }

    formatHour(epoch: number, withDate = true): string {
        const d = new Date(epoch * 1000)
        return d.toLocaleString(undefined, {
            ...(withDate ? { weekday: 'short', month: 'short', day: 'numeric' } : {}),
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    get hourLabel(): string {
        return this.current ? this.formatHour(this.current.epoch) : ''
    }

    shortLabel(i: number): string {
        const h = this.hours[i]
        return h ? this.formatHour(h.epoch) : ''
    }

    get onlineSummary(): string {
        const sensors = Object.values(this.current?.sensors ?? {})
        if (!sensors.length) return ''
        const online = sensors.filter((s) => s.online).length
        return `${online} of ${sensors.length} sensors online`
    }

    /** Fleet-wide worst band colour of the selected metric at that hour (strip cell). */
    worstColor(h: AirHistoryHour): string {
        const metric = this.metric
        if (!metric) return AIR_NEUTRAL_COLOR
        let worst: { sev: number; color: string } | null = null
        for (const f of Object.values(h.sensors)) {
            if (!f.online) continue
            const band = bandFor(metric, sensorValue(f as any, metric.key))
            if (!band) continue
            const sev = bandSeverity(band)
            if (!worst || sev > worst.sev) worst = { sev, color: band.color }
        }
        return worst?.color ?? AIR_NEUTRAL_COLOR
    }

    /** Day boundaries along the strip (local midnight), at most ~12 labels. */
    get axisTicks(): { index: number; pct: number; label: string }[] {
        const n = this.hours.length
        if (n < 2) return []
        const out: { index: number; pct: number; label: string }[] = []
        let lastDay = ''
        this.hours.forEach((h, i) => {
            const d = new Date(h.epoch * 1000)
            const day = d.toDateString()
            if (day !== lastDay) {
                lastDay = day
                out.push({ index: i, pct: (i / (n - 1)) * 100, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) })
            }
        })
        const every = Math.max(1, Math.ceil(out.length / 12))
        return out.filter((_, i) => i % every === 0)
    }

    get sourceLabel(): string {
        const base = this.source === 'postgres' ? 'Postgres' : this.source === 'files' ? 'NAS day-files' : ''
        return this.truncated ? `${base} · truncated` : base
    }

    get sourceTitle(): string {
        const legacy = this.hours.some((h) => h.source === 'snapshot')
            ? ' Hours before the per-minute recorder started are the legacy hourly snapshots.'
            : ''
        return (
            (this.source === 'files'
                ? 'The database was not reachable; hourly means come from the archive day-files.'
                : 'Hourly means of the per-minute readings (fleet_air_reading).') + legacy
        )
    }
}
</script>

<style scoped>
.air-history__body {
    padding-top: 12px;
}
.air-history__chart-hint {
    font-size: 11px;
    opacity: 0.65;
}
.air-history__source {
    font-size: 11px;
    opacity: 0.6;
}
.air-history__time-row {
    display: flex;
    align-items: center;
    gap: 8px;
}
.air-history__time {
    display: flex;
    flex-direction: column;
    min-width: 220px;
    line-height: 1.2;
}
.air-history__time strong {
    font-size: 15px;
    font-variant-numeric: tabular-nums;
}
.air-history__time-sub {
    font-size: 11px;
    opacity: 0.65;
}
.air-history__slider {
    margin-top: 4px;
}
.air-history__thumb {
    font-size: 10px;
    white-space: nowrap;
}
.air-history__strip {
    display: flex;
    height: 10px;
    border-radius: 3px;
    overflow: hidden;
    margin: 0 8px;
    cursor: pointer;
}
.air-history__cell {
    flex: 1 1 0;
    min-width: 1px;
    opacity: 0.85;
}
.air-history__cell:hover,
.air-history__cell--active {
    opacity: 1;
    outline: 2px solid #fff;
    outline-offset: -2px;
    z-index: 1;
}
.air-history__axis {
    position: relative;
    height: 16px;
    margin: 2px 8px 0;
    font-size: 10px;
    opacity: 0.6;
}
.air-history__axis span {
    position: absolute;
    transform: translateX(-50%);
    white-space: nowrap;
}
</style>
