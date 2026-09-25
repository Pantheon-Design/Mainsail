<template>
    <div>
        <v-progress-linear v-if="loading || detailLoading" indeterminate color="primary" class="mb-4" />

        <!-- ======================== PRINTER LOOKUP ======================== -->
        <v-card flat class="mb-4">
            <v-card-title class="subtitle-2 d-flex align-center flex-wrap">
                <span>{{ $t('FleetMaintenance.PrinterLookup') }}</span>
                <v-spacer />
                <v-btn icon small :title="$t('FleetMaintenance.Refresh')" :loading="loading" @click="reloadAll">
                    <v-icon small>{{ mdiRefresh }}</v-icon>
                </v-btn>
            </v-card-title>
            <v-card-text>
                <v-row dense class="align-center">
                    <v-col cols="12" md="5">
                        <v-autocomplete
                            v-model="selectedPrinter"
                            :items="printerItems"
                            :loading="printersLoading"
                            :label="$t('FleetMaintenance.SelectPrinter')"
                            dense
                            outlined
                            hide-details
                            clearable />
                    </v-col>
                    <v-col v-if="latest" cols="12" md="7" class="d-flex align-center flex-wrap">
                        <v-chip small outlined class="mr-2 mb-1">
                            {{ $t('FleetMaintenance.SnapshotDay') }}: {{ latest.day }}
                        </v-chip>
                        <v-chip small :color="latest.source === 'printer' ? 'primary' : 'warning'" outlined class="mb-1">
                            {{ latest.source === 'printer' ? $t('FleetMaintenance.SourcePrinter') : $t('FleetMaintenance.SourceDaemon') }}
                        </v-chip>
                    </v-col>
                </v-row>

                <v-alert v-if="!selectedPrinter" type="info" text dense class="mt-3 mb-0">
                    {{ $t('FleetMaintenance.SelectPrinterHint') }}
                </v-alert>
                <v-alert v-else-if="!detailLoading && !latest" type="info" text dense class="mt-3 mb-0">
                    {{ $t('FleetMaintenance.NoSnapshots') }}
                </v-alert>

                <template v-if="latest">
                    <!-- Current service tracker tiles -->
                    <div class="caption text--secondary mt-4 mb-1">{{ $t('FleetMaintenance.Odometer') }}</div>
                    <v-row dense>
                        <v-col v-for="tile in odometerTiles" :key="tile.label" cols="6" sm="3">
                            <v-card outlined>
                                <v-card-text class="pa-3 text-center">
                                    <div class="caption text--secondary">{{ tile.label }}</div>
                                    <div class="headline font-weight-bold">{{ tile.value }}</div>
                                </v-card-text>
                            </v-card>
                        </v-col>
                    </v-row>

                    <div class="caption text--secondary mt-4 mb-1">{{ $t('FleetMaintenance.Tripmeter') }}</div>
                    <v-row dense>
                        <v-col v-for="tile in tripmeterTiles" :key="tile.label" cols="6" sm="3">
                            <v-card outlined>
                                <v-card-text class="pa-3 text-center">
                                    <div class="caption text--secondary">{{ tile.label }}</div>
                                    <div class="headline font-weight-bold">{{ tile.value }}</div>
                                </v-card-text>
                            </v-card>
                        </v-col>
                    </v-row>

                    <v-row dense class="mt-4">
                        <v-col cols="12" md="6">
                            <v-card outlined class="fill-height">
                                <v-card-title class="subtitle-2">{{ $t('FleetMaintenance.Nozzle') }}</v-card-title>
                                <v-card-text>
                                    <div class="mb-2">
                                        <span class="text--secondary">{{ $t('FleetMaintenance.NozzleSizeType') }}:</span>
                                        {{ latest.nozzle_size != null ? `${latest.nozzle_size} mm` : '—' }}
                                        <span v-if="latest.nozzle_type"> · {{ latest.nozzle_type }}</span>
                                    </div>
                                    <div class="mb-1">
                                        <span class="text--secondary">{{ $t('FleetMaintenance.NozzleLife') }}:</span>
                                        {{ formatKg(latest.remaining_nozzle_life) }} / {{ formatKg(latest.nozzle_life) }}
                                        <span v-if="nozzlePct !== null"> ({{ nozzlePct.toFixed(0) }}%)</span>
                                    </div>
                                    <v-progress-linear
                                        :value="nozzlePct ?? 0"
                                        :color="nozzleColor(nozzlePct)"
                                        height="10"
                                        rounded />
                                </v-card-text>
                            </v-card>
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-card outlined class="fill-height">
                                <v-card-title class="subtitle-2">{{ $t('FleetMaintenance.Filament') }}</v-card-title>
                                <v-card-text>
                                    <div>
                                        <span class="text--secondary">{{ $t('FleetMaintenance.FilamentType') }}:</span>
                                        {{ latest.filament_type || '—' }}
                                    </div>
                                    <div>
                                        <span class="text--secondary">{{ $t('FleetMaintenance.RemainingWeight') }}:</span>
                                        {{ formatG(latest.remaining_weight) }}
                                        <span class="text--secondary"> / {{ formatG(latest.initial_weight) }}</span>
                                    </div>
                                    <div>
                                        <span class="text--secondary">{{ $t('FleetMaintenance.UsedWeightLength') }}:</span>
                                        {{ formatG(latest.used_weight) }} · {{ formatM(latest.used_length) }}
                                    </div>
                                    <div>
                                        <span class="text--secondary">{{ $t('FleetMaintenance.SpoolQr') }}:</span>
                                        {{ latest.spool_qr_code || '—' }}
                                    </div>
                                </v-card-text>
                            </v-card>
                        </v-col>
                    </v-row>

                    <!-- Per-printer charts -->
                    <v-row dense class="mt-4">
                        <v-col cols="12" md="6">
                            <v-card flat>
                                <v-card-title class="subtitle-2">{{ $t('FleetMaintenance.DailyTravel') }}</v-card-title>
                                <v-card-text>
                                    <e-chart
                                        v-if="deltas.length"
                                        :option="printerTravelChartOptions"
                                        :autoresize="true"
                                        :init-options="{ renderer: 'svg' }"
                                        style="height: 260px; width: 100%" />
                                    <div v-else class="caption text--secondary">{{ $t('FleetMaintenance.NotEnoughDays') }}</div>
                                </v-card-text>
                            </v-card>
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-card flat>
                                <v-card-title class="subtitle-2">{{ $t('FleetMaintenance.DailyWearFilament') }}</v-card-title>
                                <v-card-text>
                                    <e-chart
                                        v-if="deltas.length"
                                        :option="printerWearChartOptions"
                                        :autoresize="true"
                                        :init-options="{ renderer: 'svg' }"
                                        style="height: 260px; width: 100%" />
                                    <div v-else class="caption text--secondary">{{ $t('FleetMaintenance.NotEnoughDays') }}</div>
                                </v-card-text>
                            </v-card>
                        </v-col>
                    </v-row>
                </template>
            </v-card-text>
        </v-card>

        <!-- ======================== FLEET INSIGHTS ======================== -->
        <template v-if="analytics">
            <v-row dense class="mb-4">
                <v-col v-for="kpi in kpiCards" :key="kpi.label" cols="6" sm="4" md="3">
                    <v-card outlined>
                        <v-card-text class="pa-3 text-center">
                            <div class="caption text--secondary">{{ kpi.label }}</div>
                            <div class="headline font-weight-bold">{{ kpi.value }}</div>
                        </v-card-text>
                    </v-card>
                </v-col>
            </v-row>

            <v-row dense class="mb-2 align-center">
                <v-col cols="auto" class="subtitle-2">{{ $t('FleetMaintenance.Metric') }}</v-col>
                <v-col cols="auto">
                    <v-btn-toggle v-model="metric" dense mandatory>
                        <v-btn v-for="m in metricOptions" :key="m.value" small :value="m.value">{{ m.label }}</v-btn>
                    </v-btn-toggle>
                </v-col>
            </v-row>

            <v-row dense class="mb-4">
                <v-col cols="12" md="6">
                    <v-card flat>
                        <v-card-title class="subtitle-2">{{ $t('FleetMaintenance.TopChanging') }} · {{ metricLabel }}</v-card-title>
                        <v-card-text>
                            <e-chart
                                v-if="topEntries.length"
                                :option="topChartOptions"
                                :autoresize="true"
                                :init-options="{ renderer: 'svg' }"
                                :style="{ height: `${Math.max(200, 28 * topEntries.length + 60)}px`, width: '100%' }" />
                            <div v-else class="caption text--secondary">{{ $t('FleetMaintenance.NoData') }}</div>
                        </v-card-text>
                    </v-card>
                </v-col>
                <v-col cols="12" md="6">
                    <v-card flat>
                        <v-card-title class="subtitle-2">{{ $t('FleetMaintenance.FleetDaily') }} · {{ metricLabel }}</v-card-title>
                        <v-card-text>
                            <e-chart
                                v-if="analytics.daily_fleet && analytics.daily_fleet.length"
                                :option="fleetDailyChartOptions"
                                :autoresize="true"
                                :init-options="{ renderer: 'svg' }"
                                style="height: 260px; width: 100%" />
                            <div v-else class="caption text--secondary">{{ $t('FleetMaintenance.NoData') }}</div>
                        </v-card-text>
                    </v-card>
                </v-col>
            </v-row>

            <v-card flat class="mb-4">
                <v-card-title class="subtitle-2">{{ $t('FleetMaintenance.PerPrinter') }} · {{ metricLabel }}</v-card-title>
                <v-data-table
                    :headers="perPrinterHeaders"
                    :items="perPrinterRows"
                    :items-per-page="10"
                    sort-by="avg"
                    sort-desc
                    dense
                    class="elevation-0">
                    <template #item.avg="{ item }">{{ formatMetric(item.avg) }}</template>
                    <template #item.total="{ item }">{{ formatMetric(item.total) }}</template>
                    <template #item.last_day="{ item }">{{ item.last_day || '—' }}</template>
                </v-data-table>
            </v-card>

            <v-card flat class="mb-4">
                <v-card-title class="subtitle-2">{{ $t('FleetMaintenance.NozzleLifeRanking') }}</v-card-title>
                <v-data-table
                    :headers="nozzleHeaders"
                    :items="nozzleRows"
                    :items-per-page="10"
                    sort-by="pct"
                    dense
                    class="elevation-0">
                    <template #item.life="{ item }">
                        {{ formatKg(item.remaining_nozzle_life) }} / {{ formatKg(item.nozzle_life) }}
                    </template>
                    <template #item.pct="{ item }">
                        <div class="d-flex align-center" style="min-width: 160px">
                            <v-progress-linear
                                :value="item.pct ?? 0"
                                :color="nozzleColor(item.pct)"
                                height="8"
                                rounded
                                class="mr-2" />
                            <span class="caption">{{ item.pct !== null ? `${item.pct.toFixed(0)}%` : '—' }}</span>
                        </div>
                    </template>
                </v-data-table>
            </v-card>
        </template>

        <v-alert v-else-if="!loading" type="info" text>
            {{ $t('FleetMaintenance.NoAnalytics') }}
        </v-alert>
    </div>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins, Prop, Watch } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import ThemeMixin from '@/components/mixins/theme'
import { mdiRefresh } from '@mdi/js'
import {
    MaintenanceMetric,
    ServiceTrackerAnalytics,
    ServiceTrackerDelta,
    ServiceTrackerNozzleRank,
    ServiceTrackerPrinterDetail,
    ServiceTrackerPrinterSummary,
    ServiceTrackerRow,
    ServiceTrackerTopEntry,
} from '@/store/fleet/maintenance/types'

const TRAVEL_METRICS: MaintenanceMetric[] = ['odometer_x', 'odometer_y', 'odometer_z', 'odometer_e']

@Component
export default class FleetMaintenanceAnalytics extends Mixins(BaseMixin, ThemeMixin) {
    @Prop({ type: Number, default: 0 }) readonly days!: number

    mdiRefresh = mdiRefresh
    selectedPrinter: string | null = null
    metric: MaintenanceMetric = 'odometer_x'

    readonly nozzleHeaders = [
        { text: 'Printer', value: 'printer_hostname', sortable: true },
        { text: 'Remaining / Total', value: 'life', sortable: false },
        { text: 'Life left', value: 'pct', sortable: true },
    ]

    mounted() {
        this.reloadAll()
    }

    reloadAll() {
        this.$store.dispatch('fleet/maintenance/loadPrinters')
        this.$store.dispatch('fleet/maintenance/loadAnalytics', this.days)
        this.reloadPrinter()
    }

    reloadPrinter() {
        if (!this.selectedPrinter) {
            this.$store.commit('fleet/maintenance/setPrinterDetail', null)
            return
        }
        this.$store.dispatch('fleet/maintenance/loadPrinter', { hostname: this.selectedPrinter, days: this.detailDays })
    }

    @Watch('days')
    onDaysChange() {
        this.$store.dispatch('fleet/maintenance/loadAnalytics', this.days)
        this.reloadPrinter()
    }

    @Watch('selectedPrinter')
    onPrinterChange() {
        this.reloadPrinter()
    }

    get detailDays(): number {
        return this.days > 0 ? this.days : 90
    }

    // ===================== STORE =====================

    get printers(): ServiceTrackerPrinterSummary[] {
        return this.$store.getters['fleet/maintenance/getPrinters']
    }

    get printerItems() {
        return this.printers.map((p) => ({
            text: p.last_day ? `${p.printer_hostname} (${p.last_day})` : p.printer_hostname,
            value: p.printer_hostname,
        }))
    }

    get detail(): ServiceTrackerPrinterDetail | null {
        return this.$store.getters['fleet/maintenance/getPrinterDetail']
    }

    get latest(): ServiceTrackerRow | null {
        if (!this.detail || this.detail.hostname !== this.selectedPrinter) return null
        return this.detail.latest
    }

    get deltas(): ServiceTrackerDelta[] {
        if (!this.detail || this.detail.hostname !== this.selectedPrinter) return []
        return this.detail.deltas ?? []
    }

    get analytics(): ServiceTrackerAnalytics | null {
        return this.$store.getters['fleet/maintenance/getAnalytics']
    }

    get loading(): boolean {
        return this.$store.getters['fleet/maintenance/isLoading']
    }

    get detailLoading(): boolean {
        return this.$store.getters['fleet/maintenance/isDetailLoading']
    }

    get printersLoading(): boolean {
        return this.$store.getters['fleet/maintenance/isPrintersLoading']
    }

    // ===================== FORMATTERS =====================

    formatMm(value: number | null | undefined): string {
        if (value === null || value === undefined || isNaN(value)) return '—'
        const m = value / 1000
        if (m >= 10000) return `${(m / 1000).toFixed(2)} km`
        return `${m.toFixed(1)} m`
    }

    formatM(value: number | null | undefined): string {
        if (value === null || value === undefined || isNaN(value)) return '—'
        if (value >= 10000) return `${(value / 1000).toFixed(2)} km`
        return `${value.toFixed(1)} m`
    }

    formatKg(value: number | null | undefined): string {
        if (value === null || value === undefined || isNaN(value)) return '—'
        return `${value.toFixed(2)} kg`
    }

    formatG(value: number | null | undefined): string {
        if (value === null || value === undefined || isNaN(value)) return '—'
        return `${value.toFixed(0)} g`
    }

    formatMetric(value: number | null | undefined, metric: MaintenanceMetric = this.metric): string {
        if (value === null || value === undefined || isNaN(value)) return '—'
        if (TRAVEL_METRICS.includes(metric)) return this.formatMm(value)
        if (metric === 'nozzle_wear') return `${value.toFixed(3)} kg`
        return this.formatG(value)
    }

    metricUnitLabel(metric: MaintenanceMetric = this.metric): string {
        if (TRAVEL_METRICS.includes(metric)) return 'm'
        if (metric === 'nozzle_wear') return 'kg'
        return 'g'
    }

    metricToDisplay(value: number | null | undefined, metric: MaintenanceMetric = this.metric): number | null {
        if (value === null || value === undefined || isNaN(value)) return null
        if (TRAVEL_METRICS.includes(metric)) return Math.round(value / 100) / 10
        if (metric === 'nozzle_wear') return Math.round(value * 1000) / 1000
        return Math.round(value * 10) / 10
    }

    nozzleColor(pct: number | null | undefined): string {
        if (pct === null || pct === undefined) return 'grey'
        if (pct < 20) return 'error'
        if (pct < 50) return 'warning'
        return 'success'
    }

    get nozzlePct(): number | null {
        const l = this.latest
        if (!l || !l.nozzle_life || l.remaining_nozzle_life === null) return null
        return Math.max(0, Math.min(100, (l.remaining_nozzle_life / l.nozzle_life) * 100))
    }

    // ===================== CURRENT TILES =====================

    get odometerTiles() {
        const l = this.latest
        if (!l) return []
        return [
            { label: 'X', value: this.formatMm(l.odometer_x) },
            { label: 'Y', value: this.formatMm(l.odometer_y) },
            { label: 'Z', value: this.formatMm(l.odometer_z) },
            { label: 'E', value: this.formatMm(l.odometer_e) },
        ]
    }

    get tripmeterTiles() {
        const l = this.latest
        if (!l) return []
        const since = this.$t('FleetMaintenance.SinceReset')
        return [
            { label: `X · ${since}`, value: this.formatMm(l.tripmeter_x) },
            { label: `Y · ${since}`, value: this.formatMm(l.tripmeter_y) },
            { label: `Z · ${since}`, value: this.formatMm(l.tripmeter_z) },
            { label: `E · ${since}`, value: this.formatMm(l.tripmeter_e) },
        ]
    }

    // ===================== PER-PRINTER CHARTS =====================

    get printerTravelChartOptions() {
        const rows = this.deltas
        const days = rows.map((r) => r.day)
        const series = TRAVEL_METRICS.map((m) => ({
            name: this.metricShortLabel(m),
            type: 'line',
            smooth: true,
            connectNulls: false,
            data: rows.map((r) => this.metricToDisplay(r[m], m)),
        }))
        return {
            animation: false,
            tooltip: { trigger: 'axis', valueFormatter: (v: any) => (v === null || v === undefined ? '—' : `${v} m`) },
            legend: { data: series.map((s) => s.name), textStyle: { color: this.fgColor() } },
            grid: { left: 50, right: 20, top: 40, bottom: 50 },
            xAxis: { type: 'category', data: days, axisLabel: { color: this.fgColor(), rotate: 45, fontSize: 10 } },
            yAxis: { type: 'value', axisLabel: { color: this.fgColor(), formatter: '{value} m' } },
            series,
        }
    }

    get printerWearChartOptions() {
        const rows = this.deltas
        const days = rows.map((r) => r.day)
        return {
            animation: false,
            tooltip: { trigger: 'axis' },
            legend: { data: ['Nozzle wear', 'Filament used'], textStyle: { color: this.fgColor() } },
            grid: { left: 60, right: 60, top: 40, bottom: 50 },
            xAxis: { type: 'category', data: days, axisLabel: { color: this.fgColor(), rotate: 45, fontSize: 10 } },
            yAxis: [
                { type: 'value', name: 'kg', axisLabel: { color: this.fgColor(), formatter: '{value} kg' } },
                { type: 'value', name: 'g', axisLabel: { color: this.fgColor(), formatter: '{value} g' } },
            ],
            series: [
                {
                    name: 'Nozzle wear',
                    type: 'bar',
                    yAxisIndex: 0,
                    itemStyle: { color: '#ff9800' },
                    data: rows.map((r) => this.metricToDisplay(r.nozzle_wear, 'nozzle_wear')),
                },
                {
                    name: 'Filament used',
                    type: 'line',
                    yAxisIndex: 1,
                    smooth: true,
                    itemStyle: { color: '#2196f3' },
                    data: rows.map((r) => this.metricToDisplay(r.filament_used_g, 'filament_used_g')),
                },
            ],
        }
    }

    // ===================== FLEET INSIGHTS =====================

    get metricOptions(): { label: string; value: MaintenanceMetric }[] {
        return [
            { label: this.$t('FleetMaintenance.Metrics.TravelX') as string, value: 'odometer_x' },
            { label: this.$t('FleetMaintenance.Metrics.TravelY') as string, value: 'odometer_y' },
            { label: this.$t('FleetMaintenance.Metrics.TravelZ') as string, value: 'odometer_z' },
            { label: this.$t('FleetMaintenance.Metrics.ExtrusionE') as string, value: 'odometer_e' },
            { label: this.$t('FleetMaintenance.Metrics.NozzleWear') as string, value: 'nozzle_wear' },
            { label: this.$t('FleetMaintenance.Metrics.FilamentUsed') as string, value: 'filament_used_g' },
        ]
    }

    metricShortLabel(m: MaintenanceMetric): string {
        return this.metricOptions.find((o) => o.value === m)?.label ?? m
    }

    get metricLabel(): string {
        return this.metricShortLabel(this.metric)
    }

    get kpiCards() {
        if (!this.analytics) return []
        const k = this.analytics.kpis
        const a = k.avg_daily ?? ({} as any)
        return [
            { label: this.$t('FleetMaintenance.Kpi.Printers'), value: String(k.printers ?? 0) },
            { label: this.$t('FleetMaintenance.Kpi.DaysCovered'), value: String(k.days_covered ?? 0) },
            { label: this.$t('FleetMaintenance.Kpi.AvgTravelX'), value: this.formatMetric(a.odometer_x, 'odometer_x') },
            { label: this.$t('FleetMaintenance.Kpi.AvgTravelY'), value: this.formatMetric(a.odometer_y, 'odometer_y') },
            { label: this.$t('FleetMaintenance.Kpi.AvgTravelZ'), value: this.formatMetric(a.odometer_z, 'odometer_z') },
            { label: this.$t('FleetMaintenance.Kpi.AvgExtrusion'), value: this.formatMetric(a.odometer_e, 'odometer_e') },
            { label: this.$t('FleetMaintenance.Kpi.AvgNozzleWear'), value: this.formatMetric(a.nozzle_wear, 'nozzle_wear') },
            { label: this.$t('FleetMaintenance.Kpi.AvgFilament'), value: this.formatMetric(a.filament_used_g, 'filament_used_g') },
        ]
    }

    get topEntries(): ServiceTrackerTopEntry[] {
        if (!this.analytics || !this.analytics.top) return []
        return (this.analytics.top[this.metric] ?? []).filter((e) => e.value !== null && e.value !== undefined)
    }

    get topChartOptions() {
        const rows = [...this.topEntries].sort((a, b) => a.value - b.value)
        const unit = this.metricUnitLabel()
        return {
            animation: false,
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: (params: any[]) => {
                    const r = rows[params[0].dataIndex]
                    return r ? `<b>${r.printer_hostname}</b><br/>${this.formatMetric(r.value)}` : ''
                },
            },
            grid: { left: 140, right: 60, top: 20, bottom: 30 },
            xAxis: { type: 'value', axisLabel: { color: this.fgColor(), formatter: `{value} ${unit}` } },
            yAxis: {
                type: 'category',
                data: rows.map((r) => r.printer_hostname),
                axisLabel: { color: this.fgColor(), fontSize: 10 },
            },
            series: [
                {
                    name: this.metricLabel,
                    type: 'bar',
                    itemStyle: { color: '#4caf50' },
                    data: rows.map((r) => this.metricToDisplay(r.value)),
                    label: {
                        show: true,
                        position: 'right',
                        color: this.fgColor(),
                        formatter: (p: any) => this.formatMetric(rows[p.dataIndex]?.value),
                    },
                },
            ],
        }
    }

    get fleetDailyChartOptions() {
        const rows = this.analytics?.daily_fleet ?? []
        const unit = this.metricUnitLabel()
        return {
            animation: false,
            tooltip: { trigger: 'axis', valueFormatter: (v: any) => (v === null || v === undefined ? '—' : `${v} ${unit}`) },
            grid: { left: 60, right: 20, top: 20, bottom: 50 },
            xAxis: { type: 'category', data: rows.map((r) => r.day), axisLabel: { color: this.fgColor(), rotate: 45, fontSize: 10 } },
            yAxis: { type: 'value', axisLabel: { color: this.fgColor(), formatter: `{value} ${unit}` } },
            series: [
                {
                    name: this.metricLabel,
                    type: 'line',
                    smooth: true,
                    areaStyle: { opacity: 0.2 },
                    data: rows.map((r) => this.metricToDisplay(r[this.metric])),
                },
            ],
        }
    }

    get perPrinterHeaders() {
        return [
            { text: 'Printer', value: 'printer_hostname', sortable: true },
            { text: 'Days', value: 'days', sortable: true, align: 'end' },
            { text: `Avg / day`, value: 'avg', sortable: true, align: 'end' },
            { text: 'Total', value: 'total', sortable: true, align: 'end' },
            { text: 'Last day', value: 'last_day', sortable: true },
        ]
    }

    get perPrinterRows() {
        if (!this.analytics) return []
        return (this.analytics.per_printer ?? []).map((p) => ({
            printer_hostname: p.printer_hostname,
            days: p.days,
            avg: p.avg_daily?.[this.metric] ?? null,
            total: p.total?.[this.metric] ?? null,
            last_day: p.last_day,
        }))
    }

    get nozzleRows(): ServiceTrackerNozzleRank[] {
        if (!this.analytics) return []
        return [...(this.analytics.nozzle_life_ranking ?? [])].sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101))
    }
}
</script>
