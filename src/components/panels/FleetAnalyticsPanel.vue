<template>
    <div>
        <!-- View Toggle + Date Range -->
        <v-row dense class="mb-4 align-center">
            <v-col cols="auto">
                <v-btn-toggle v-model="analyticsView" dense mandatory>
                    <v-btn small value="jobs">Job Analytics</v-btn>
                    <v-btn small value="parts">Part Analytics</v-btn>
                </v-btn-toggle>
            </v-col>
            <v-spacer></v-spacer>
            <v-col cols="auto">
                <v-btn-toggle v-model="analyticsDays" dense mandatory @change="onDateRangeChange">
                    <v-btn small :value="0">All Time</v-btn>
                    <v-btn small :value="365">Past Year</v-btn>
                    <v-btn small :value="30">Past Month</v-btn>
                    <v-btn small :value="7">Past Week</v-btn>
                </v-btn-toggle>
            </v-col>
        </v-row>

        <!-- ======================== JOB ANALYTICS ======================== -->
        <template v-if="analyticsView === 'jobs'">
            <v-progress-linear v-if="analyticsLoading" indeterminate color="primary" class="mb-4" />

            <!-- 1. KPI Cards -->
            <v-row dense class="mb-4" v-if="analytics">
                <v-col cols="6" sm="4" md="3" v-for="kpi in kpiCards" :key="kpi.label">
                    <v-card outlined>
                        <v-card-text class="pa-3 text-center">
                            <div class="caption text--secondary">{{ kpi.label }}</div>
                            <div class="headline font-weight-bold">{{ kpi.value }}</div>
                        </v-card-text>
                    </v-card>
                </v-col>
            </v-row>

            <template v-if="analytics">
                <!-- Model Breakdown -->
                <v-row dense class="mb-4" v-if="analytics.model_summary && analytics.model_summary.length">
                    <v-col cols="12" md="5">
                        <v-card flat>
                            <v-card-title class="subtitle-2">Jobs by Printer Model</v-card-title>
                            <v-card-text>
                                <e-chart
                                    :option="modelDonutOptions"
                                    :autoresize="true"
                                    :init-options="{ renderer: 'svg' }"
                                    style="height: 260px; width: 100%"
                                />
                            </v-card-text>
                        </v-card>
                    </v-col>
                    <v-col cols="12" md="7">
                        <v-card flat>
                            <v-card-title class="subtitle-2">Printer Model Comparison</v-card-title>
                            <v-card-text>
                                <e-chart
                                    :option="modelComparisonOptions"
                                    :autoresize="true"
                                    :init-options="{ renderer: 'svg' }"
                                    style="height: 260px; width: 100%"
                                />
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>

                <!-- 2. TTM Utilization -->
                <v-card flat class="mb-4">
                    <v-card-title class="subtitle-2">TTM Fleet Utilization %</v-card-title>
                    <v-card-text>
                        <e-chart
                            :option="utilizationChartOptions"
                            :autoresize="true"
                            :init-options="{ renderer: 'svg' }"
                            style="height: 240px; width: 100%"
                        />
                    </v-card-text>
                </v-card>

                <!-- 3. TTM Filament by Type -->
                <v-card flat class="mb-4">
                    <v-card-title class="subtitle-2">Filament Usage by Type (kg / month)</v-card-title>
                    <v-card-text>
                        <e-chart
                            :option="filamentByTypeChartOptions"
                            :autoresize="true"
                            :init-options="{ renderer: 'svg' }"
                            style="height: 240px; width: 100%"
                        />
                    </v-card-text>
                </v-card>

                <!-- 4. 8-Week Utilization Heatmap -->
                <v-card flat class="mb-4">
                    <v-card-title class="subtitle-2 d-flex align-center">
                        <span>8-Week Printer Utilization Heatmap</span>
                        <v-spacer />
                        <v-btn-toggle v-model="heatmapModelFilter" dense mandatory class="ml-4">
                            <v-btn small value="all">All</v-btn>
                            <v-btn v-for="m in availableModels" :key="m" small :value="m">{{ m }}</v-btn>
                        </v-btn-toggle>
                    </v-card-title>
                    <v-card-text>
                        <e-chart
                            :option="heatmapChartOptions"
                            :autoresize="true"
                            :init-options="{ renderer: 'svg' }"
                            :style="heatmapHeight"
                        />
                    </v-card-text>
                </v-card>

                <!-- 5. Printer Health Score -->
                <v-card flat class="mb-4">
                    <v-card-title class="subtitle-2">Printer Health Score</v-card-title>
                    <v-card-text>
                        <e-chart
                            :option="healthChartOptions"
                            :autoresize="true"
                            :init-options="{ renderer: 'svg' }"
                            :style="healthChartHeight"
                        />
                    </v-card-text>
                </v-card>

                <!-- Row: Donut + Weekly trend -->
                <v-row dense>
                    <!-- 6. Status Donut -->
                    <v-col cols="12" md="5">
                        <v-card flat class="mb-4">
                            <v-card-title class="subtitle-2">Job Status Breakdown</v-card-title>
                            <v-card-text>
                                <e-chart
                                    :option="statusDonutOptions"
                                    :autoresize="true"
                                    :init-options="{ renderer: 'svg' }"
                                    style="height: 280px; width: 100%"
                                />
                            </v-card-text>
                        </v-card>
                    </v-col>

                    <!-- 7. Weekly Success Rate -->
                    <v-col cols="12" md="7">
                        <v-card flat class="mb-4">
                            <v-card-title class="subtitle-2">Weekly Success Rate Trend</v-card-title>
                            <v-card-text>
                                <e-chart
                                    :option="weeklySuccessOptions"
                                    :autoresize="true"
                                    :init-options="{ renderer: 'svg' }"
                                    style="height: 280px; width: 100%"
                                />
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>
            </template>

            <v-alert v-else-if="!analyticsLoading" type="info" text>
                No analytics data available. Run a collection cycle first.
            </v-alert>
        </template>

        <!-- ======================== PART ANALYTICS ======================== -->
        <template v-else>
            <v-progress-linear v-if="partAnalyticsLoading" indeterminate color="primary" class="mb-4" />

            <template v-if="partAnalytics">
                <!-- 1. QC KPI Cards -->
                <v-row dense class="mb-4">
                    <v-col cols="6" sm="4" md="3" v-for="kpi in partKpiCards" :key="kpi.label">
                        <v-card outlined>
                            <v-card-text class="pa-3 text-center">
                                <div class="caption text--secondary">{{ kpi.label }}</div>
                                <div class="headline font-weight-bold">{{ kpi.value }}</div>
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>

                <!-- Row: QC Status Donut + Weekly QC Trend -->
                <v-row dense class="mb-4">
                    <!-- 3. QC Status Breakdown -->
                    <v-col cols="12" md="5">
                        <v-card flat>
                            <v-card-title class="subtitle-2">QC Status Breakdown</v-card-title>
                            <v-card-text>
                                <e-chart
                                    :option="qcStatusDonutOptions"
                                    :autoresize="true"
                                    :init-options="{ renderer: 'svg' }"
                                    style="height: 280px; width: 100%"
                                />
                            </v-card-text>
                        </v-card>
                    </v-col>

                    <!-- 2. QC Pass/Fail Trend -->
                    <v-col cols="12" md="7">
                        <v-card flat>
                            <v-card-title class="subtitle-2">Weekly QC Pass Rate Trend</v-card-title>
                            <v-card-text>
                                <e-chart
                                    :option="weeklyQcTrendOptions"
                                    :autoresize="true"
                                    :init-options="{ renderer: 'svg' }"
                                    style="height: 280px; width: 100%"
                                />
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>

                <!-- 4. Fail Rate by Printer -->
                <v-card flat class="mb-4" v-if="partAnalytics.fail_rate_by_printer.length">
                    <v-card-title class="subtitle-2">Fail Rate by Printer</v-card-title>
                    <v-card-text>
                        <e-chart
                            :option="failRateByPrinterOptions"
                            :autoresize="true"
                            :init-options="{ renderer: 'svg' }"
                            :style="failByPrinterHeight"
                        />
                    </v-card-text>
                </v-card>

                <!-- Row: Fail by Filament + Fail by Nozzle -->
                <v-row dense class="mb-4">
                    <!-- 5. Fail Rate by Filament -->
                    <v-col cols="12" md="6" v-if="partAnalytics.fail_rate_by_filament.length">
                        <v-card flat>
                            <v-card-title class="subtitle-2">Fail Rate by Filament</v-card-title>
                            <v-card-text>
                                <e-chart
                                    :option="failRateByFilamentOptions"
                                    :autoresize="true"
                                    :init-options="{ renderer: 'svg' }"
                                    style="height: 260px; width: 100%"
                                />
                            </v-card-text>
                        </v-card>
                    </v-col>

                    <!-- 9. Fail Rate by Nozzle -->
                    <v-col cols="12" md="6" v-if="partAnalytics.fail_rate_by_nozzle.length">
                        <v-card flat>
                            <v-card-title class="subtitle-2">Fail Rate by Nozzle Size</v-card-title>
                            <v-card-text>
                                <e-chart
                                    :option="failRateByNozzleOptions"
                                    :autoresize="true"
                                    :init-options="{ renderer: 'svg' }"
                                    style="height: 260px; width: 100%"
                                />
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>

                <!-- 6. Fail Rate by Spool -->
                <v-card flat class="mb-4" v-if="partAnalytics.fail_rate_by_spool.length">
                    <v-card-title class="subtitle-2">Fail Rate by Spool (Top 20 Worst)</v-card-title>
                    <v-card-text>
                        <e-chart
                            :option="failRateBySpoolOptions"
                            :autoresize="true"
                            :init-options="{ renderer: 'svg' }"
                            style="height: 340px; width: 100%"
                        />
                    </v-card-text>
                </v-card>

                <!-- 7. Inspector Activity -->
                <v-card flat class="mb-4" v-if="partAnalytics.inspector_activity.length">
                    <v-card-title class="subtitle-2">Inspector Activity</v-card-title>
                    <v-card-text>
                        <e-chart
                            :option="inspectorActivityOptions"
                            :autoresize="true"
                            :init-options="{ renderer: 'svg' }"
                            style="height: 300px; width: 100%"
                        />
                    </v-card-text>
                </v-card>

                <!-- 8. QC Turnaround Time -->
                <v-card flat class="mb-4" v-if="partAnalytics.qc_turnaround.length">
                    <v-card-title class="subtitle-2">QC Turnaround Time (Weekly Avg Hours)</v-card-title>
                    <v-card-text>
                        <e-chart
                            :option="qcTurnaroundOptions"
                            :autoresize="true"
                            :init-options="{ renderer: 'svg' }"
                            style="height: 240px; width: 100%"
                        />
                    </v-card-text>
                </v-card>

                <!-- 10. Top Failing Files -->
                <v-card flat class="mb-4" v-if="partAnalytics.top_failing_files.length">
                    <v-card-title class="subtitle-2">Top Failing Files</v-card-title>
                    <v-card-text>
                        <e-chart
                            :option="topFailingFilesOptions"
                            :autoresize="true"
                            :init-options="{ renderer: 'svg' }"
                            :style="topFailingFilesHeight"
                        />
                    </v-card-text>
                </v-card>

                <!-- 11. Monthly QC Summary -->
                <v-card flat class="mb-4" v-if="partAnalytics.monthly_qc_summary.length">
                    <v-card-title class="subtitle-2">Monthly QC Pass Rate Trend</v-card-title>
                    <v-card-text>
                        <e-chart
                            :option="monthlyQcSummaryOptions"
                            :autoresize="true"
                            :init-options="{ renderer: 'svg' }"
                            style="height: 240px; width: 100%"
                        />
                    </v-card-text>
                </v-card>
            </template>

            <v-alert v-else-if="!partAnalyticsLoading" type="info" text>
                No part analytics data available. QC data will appear here once parts have been inspected.
            </v-alert>
        </template>
    </div>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins, Watch } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import ThemeMixin from '@/components/mixins/theme'
import {
    FleetAnalytics, FleetDailyUtilization, FleetPrinterHealth, FleetModelSummary,
    FleetPartAnalytics,
} from '@/store/fleet/history/types'
import { fleetDaemonEvents } from '@/plugins/fleetDaemonClient'

@Component
export default class FleetAnalyticsPanel extends Mixins(BaseMixin, ThemeMixin) {
    heatmapModelFilter = 'all'
    analyticsView = 'jobs'
    analyticsDays = 0

    mounted() {
        fleetDaemonEvents.$on('history_updated', this.onHistoryUpdated)
    }

    beforeDestroy() {
        fleetDaemonEvents.$off('history_updated', this.onHistoryUpdated)
    }

    onHistoryUpdated() {
        if (this.analyticsView === 'parts') {
            this.$store.dispatch('fleet/history/loadPartAnalytics', this.analyticsDays)
        } else {
            this.$store.dispatch('fleet/history/loadAnalytics', this.analyticsDays)
        }
    }

    onDateRangeChange() {
        if (this.analyticsView === 'parts') {
            this.$store.dispatch('fleet/history/loadPartAnalytics', this.analyticsDays)
        } else {
            this.$store.dispatch('fleet/history/loadAnalytics', this.analyticsDays)
        }
    }

    @Watch('analyticsView')
    onAnalyticsViewChange(val: string) {
        if (val === 'parts') {
            this.$store.dispatch('fleet/history/loadPartAnalytics', this.analyticsDays)
        } else {
            this.$store.dispatch('fleet/history/loadAnalytics', this.analyticsDays)
        }
    }

    get availableModels(): string[] {
        if (!this.analytics) return []
        const models = new Set(this.analytics.daily_utilization.map((r) => r.printer_model))
        return [...models].sort()
    }

    get filteredDailyUtilization(): FleetDailyUtilization[] {
        if (!this.analytics) return []
        if (this.heatmapModelFilter === 'all') return this.analytics.daily_utilization
        return this.analytics.daily_utilization.filter((r) => r.printer_model === this.heatmapModelFilter)
    }

    get analytics(): FleetAnalytics | null {
        return this.$store.getters['fleet/history/getAnalytics']
    }

    get analyticsLoading(): boolean {
        return this.$store.getters['fleet/history/isAnalyticsLoading']
    }

    get partAnalytics(): FleetPartAnalytics | null {
        return this.$store.getters['fleet/history/getPartAnalytics']
    }

    get partAnalyticsLoading(): boolean {
        return this.$store.getters['fleet/history/isPartAnalyticsLoading']
    }

    // ===================== JOB ANALYTICS CHARTS =====================

    get kpiCards() {
        if (!this.analytics) return []
        const k = this.analytics.kpis
        return [
            { label: 'Total Jobs', value: k.total_jobs.toLocaleString() },
            { label: 'Total Print Hours', value: `${k.total_print_hours.toFixed(1)} h` },
            { label: 'Total Filament', value: `${k.total_filament_kg.toFixed(2)} kg` },
            { label: 'Active Printers (30d)', value: k.active_printers_30d },
            { label: 'Jobs (30d)', value: k.jobs_30d },
            { label: 'Completion Rate (30d)', value: `${k.completion_rate_30d}%` },
            { label: 'Print Hours (30d)', value: `${k.print_hours_30d.toFixed(1)} h` },
            { label: 'Filament (30d)', value: `${k.filament_kg_30d.toFixed(2)} kg` },
        ]
    }

    get modelDonutOptions() {
        if (!this.analytics?.model_summary) return {}
        const modelColors: Record<string, string> = {
            'HS-3': '#2196f3',
            'HS-Pro': '#ff9800',
        }
        const data = this.analytics.model_summary.map((r: FleetModelSummary) => ({
            name: r.printer_model,
            value: r.total_jobs,
            itemStyle: { color: modelColors[r.printer_model] ?? '#607d8b' },
        }))
        return {
            animation: false,
            tooltip: {
                trigger: 'item',
                formatter: (params: any) => {
                    const m = this.analytics!.model_summary.find((r: FleetModelSummary) => r.printer_model === params.name)
                    if (!m) return params.name
                    return `<b>${m.printer_model}</b><br/>Jobs: ${m.total_jobs}<br/>Completed: ${m.completed_jobs}<br/>Failed: ${m.failed_jobs}<br/>Completion: ${m.completion_rate}%<br/>Print Hours: ${m.print_hours.toFixed(1)}h<br/>Filament: ${m.filament_kg.toFixed(2)} kg`
                },
            },
            legend: { orient: 'vertical', right: 10, textStyle: { color: this.fgColor() } },
            series: [{
                type: 'pie',
                radius: ['45%', '70%'],
                data,
                label: { color: this.fgColor(), formatter: '{b}\n{d}%' },
            }],
        }
    }

    get modelComparisonOptions() {
        if (!this.analytics?.model_summary) return {}
        const models = this.analytics.model_summary.map((r: FleetModelSummary) => r.printer_model)
        return {
            animation: false,
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: { data: ['Completion Rate %', 'Print Hours'], textStyle: { color: this.fgColor() } },
            xAxis: { type: 'category', data: models, axisLabel: { color: this.fgColor() } },
            yAxis: [
                { type: 'value', name: 'Rate %', max: 100, axisLabel: { color: this.fgColor(), formatter: '{value}%' } },
                { type: 'value', name: 'Hours', axisLabel: { color: this.fgColor() } },
            ],
            series: [
                {
                    name: 'Completion Rate %',
                    type: 'bar',
                    itemStyle: { color: '#4caf50' },
                    data: this.analytics.model_summary.map((r: FleetModelSummary) => r.completion_rate),
                },
                {
                    name: 'Print Hours',
                    type: 'bar',
                    yAxisIndex: 1,
                    itemStyle: { color: '#2196f3' },
                    data: this.analytics.model_summary.map((r: FleetModelSummary) => Math.round(r.print_hours * 10) / 10),
                },
            ],
        }
    }

    get utilizationChartOptions() {
        const series = this.$store.getters['fleet/history/getMonthlyUtilizationSeries']
        return {
            animation: false,
            tooltip: { trigger: 'axis' },
            legend: { data: ['Utilization %', '3-Month Avg'], textStyle: { color: this.fgColor() } },
            xAxis: { type: 'category', data: series.labels, axisLabel: { color: this.fgColor() } },
            yAxis: { type: 'value', axisLabel: { color: this.fgColor(), formatter: '{value}%' }, max: 100 },
            series: [
                { name: 'Utilization %', type: 'line', data: series.actual, smooth: true, areaStyle: { opacity: 0.2 } },
                { name: '3-Month Avg', type: 'line', data: series.rolling, smooth: true, lineStyle: { type: 'dashed' } },
            ],
        }
    }

    get filamentByTypeChartOptions() {
        if (!this.analytics) return {}
        const mf = this.analytics.monthly_filament
        const allTypes = [...new Set(mf.map((r) => r.filament_type))]
        const totals: Record<string, number> = {}
        mf.forEach((r) => { totals[r.filament_type] = (totals[r.filament_type] ?? 0) + r.mass_kg })
        const top5 = allTypes.sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0)).slice(0, 5)

        const months = [...new Set(mf.map((r) => r.year_month))].sort()
        const series = top5.map((t) => ({
            name: t,
            type: 'line',
            smooth: true,
            data: months.map((m) => {
                const row = mf.find((r) => r.year_month === m && r.filament_type === t)
                return row ? row.mass_kg : 0
            }),
        }))
        return {
            animation: false,
            tooltip: { trigger: 'axis' },
            legend: { data: top5, textStyle: { color: this.fgColor() } },
            xAxis: { type: 'category', data: months, axisLabel: { color: this.fgColor() } },
            yAxis: { type: 'value', axisLabel: { color: this.fgColor(), formatter: '{value} kg' } },
            series,
        }
    }

    get heatmapPrinters(): string[] {
        return [...new Set(this.filteredDailyUtilization.map((r) => r.printer_hostname))].sort()
    }

    get heatmapDays(): string[] {
        return [...new Set(this.filteredDailyUtilization.map((r) => r.day))].sort()
    }

    get heatmapHeight(): string {
        const rows = this.heatmapPrinters.length
        return `height: ${Math.max(200, rows * 28 + 60)}px; width: 100%`
    }

    get healthChartHeight(): string {
        const rows = this.analytics?.printer_health.length ?? 0
        return `height: ${Math.max(200, rows * 28 + 60)}px; width: 100%`
    }

    get heatmapChartOptions() {
        if (!this.analytics) return {}
        const printers = this.heatmapPrinters
        const days = this.heatmapDays
        const map: Record<string, Record<string, number>> = {}
        this.filteredDailyUtilization.forEach((r: FleetDailyUtilization) => {
            if (!map[r.printer_hostname]) map[r.printer_hostname] = {}
            map[r.printer_hostname][r.day] = Math.min(100, r.utilization_pct)
        })
        const data: [number, number, number][] = []
        printers.forEach((p, pi) => {
            days.forEach((d, di) => {
                data.push([di, pi, map[p]?.[d] ?? 0])
            })
        })
        return {
            animation: false,
            tooltip: {
                formatter: (params: any) => `${printers[params.data[1]]} / ${days[params.data[0]]}<br/>Utilization: ${params.data[2]}%`,
            },
            grid: { top: 10, bottom: 60, left: 140, right: 60 },
            xAxis: { type: 'category', data: days, axisLabel: { color: this.fgColor(), rotate: 45, fontSize: 10 } },
            yAxis: { type: 'category', data: printers, axisLabel: { color: this.fgColor(), fontSize: 10 } },
            visualMap: { min: 0, max: 100, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560'] } },
            series: [{ type: 'heatmap', data, emphasis: { itemStyle: { shadowBlur: 10 } } }],
        }
    }

    get healthChartOptions() {
        if (!this.analytics) return {}
        const sorted = [...this.analytics.printer_health].sort((a, b) => a.health_pct - b.health_pct)
        return {
            animation: false,
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: 140, right: 20, top: 10, bottom: 20 },
            xAxis: { type: 'value', max: 100, axisLabel: { color: this.fgColor(), formatter: '{value}%' } },
            yAxis: { type: 'category', data: sorted.map((r: FleetPrinterHealth) => r.printer_hostname), axisLabel: { color: this.fgColor(), fontSize: 10 } },
            series: [{
                type: 'bar',
                data: sorted.map((r: FleetPrinterHealth) => ({
                    value: r.health_pct,
                    itemStyle: { color: r.health_pct >= 90 ? '#4caf50' : r.health_pct >= 70 ? '#ff9800' : '#f44336' },
                })),
                label: { show: true, position: 'right', formatter: '{c}%', color: this.fgColor() },
            }],
        }
    }

    get statusDonutOptions() {
        if (!this.analytics) return {}
        const colorMap: Record<string, string> = {
            completed: '#4caf50', cancelled: '#9e9e9e', error: '#f44336',
            klippy_shutdown: '#e91e63', klippy_disconnect: '#ff5722',
            in_progress: '#2196f3', interrupted: '#ff9800',
        }
        const data = this.analytics.status_summary.map((r) => ({
            name: r.status,
            value: r.jobs,
            itemStyle: { color: colorMap[r.status] ?? '#607d8b' },
        }))
        return {
            animation: false,
            tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
            legend: { orient: 'vertical', right: 10, textStyle: { color: this.fgColor() } },
            series: [{
                type: 'pie',
                radius: ['45%', '70%'],
                data,
                label: { color: this.fgColor() },
            }],
        }
    }

    get weeklySuccessOptions() {
        const series = this.$store.getters['fleet/history/getWeeklySuccessRateSeries']
        return {
            animation: false,
            tooltip: { trigger: 'axis' },
            legend: { data: ['Success Rate %', '4-Week Avg'], textStyle: { color: this.fgColor() } },
            xAxis: { type: 'category', data: series.labels, axisLabel: { color: this.fgColor(), rotate: 45, fontSize: 10 } },
            yAxis: { type: 'value', max: 100, axisLabel: { color: this.fgColor(), formatter: '{value}%' } },
            series: [
                { name: 'Success Rate %', type: 'line', data: series.actual, smooth: true, areaStyle: { opacity: 0.15 }, itemStyle: { color: '#4caf50' } },
                { name: '4-Week Avg', type: 'line', data: series.rolling, smooth: true, lineStyle: { type: 'dashed' }, itemStyle: { color: '#ff9800' } },
            ],
        }
    }

    // ===================== PART ANALYTICS CHARTS =====================

    get partKpiCards() {
        if (!this.partAnalytics) return []
        const k = this.partAnalytics.kpis
        return [
            { label: 'Total Inspected', value: k.total_inspected.toLocaleString() },
            { label: 'Passed', value: k.passed.toLocaleString() },
            { label: 'Failed', value: k.failed.toLocaleString() },
            { label: 'Pending', value: k.pending.toLocaleString() },
            { label: 'Pass Rate', value: `${k.pass_rate}%` },
            { label: 'QC Coverage', value: `${k.coverage_pct}%` },
            { label: 'Avg Turnaround', value: `${k.avg_turnaround_hours} h` },
        ]
    }

    // 2. Weekly QC Pass/Fail Trend with 4-week rolling avg
    get weeklyQcTrendOptions() {
        if (!this.partAnalytics) return {}
        const data = this.partAnalytics.weekly_qc_trend
        const actual = data.map((d) => d.pass_rate)
        const rolling: (number | null)[] = data.map((_, i) => {
            if (i < 3) return null
            const slice = actual.slice(i - 3, i + 1)
            return Math.round((slice.reduce((a, b) => a + b, 0) / 4) * 10) / 10
        })
        return {
            animation: false,
            tooltip: { trigger: 'axis' },
            legend: { data: ['Pass Rate %', '4-Week Avg'], textStyle: { color: this.fgColor() } },
            xAxis: { type: 'category', data: data.map((d) => d.week), axisLabel: { color: this.fgColor(), rotate: 45, fontSize: 10 } },
            yAxis: { type: 'value', max: 100, axisLabel: { color: this.fgColor(), formatter: '{value}%' } },
            series: [
                { name: 'Pass Rate %', type: 'line', data: actual, smooth: true, areaStyle: { opacity: 0.15 }, itemStyle: { color: '#4caf50' } },
                { name: '4-Week Avg', type: 'line', data: rolling, smooth: true, lineStyle: { type: 'dashed' }, itemStyle: { color: '#ff9800' } },
            ],
        }
    }

    // 3. QC Status Donut
    get qcStatusDonutOptions() {
        if (!this.partAnalytics) return {}
        const colorMap: Record<string, string> = {
            pass: '#4caf50', fail: '#f44336', pending: '#ff9800', unreviewed: '#9e9e9e',
        }
        const data = this.partAnalytics.qc_status_summary.map((r) => ({
            name: r.status,
            value: r.count,
            itemStyle: { color: colorMap[r.status] ?? '#607d8b' },
        }))
        return {
            animation: false,
            tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
            legend: { orient: 'vertical', right: 10, textStyle: { color: this.fgColor() } },
            series: [{
                type: 'pie',
                radius: ['45%', '70%'],
                data,
                label: { color: this.fgColor() },
            }],
        }
    }

    // 4. Fail Rate by Printer (horizontal bar)
    get failByPrinterHeight(): string {
        const rows = this.partAnalytics?.fail_rate_by_printer.length ?? 0
        return `height: ${Math.max(200, rows * 28 + 60)}px; width: 100%`
    }

    get failRateByPrinterOptions() {
        if (!this.partAnalytics) return {}
        const sorted = [...this.partAnalytics.fail_rate_by_printer].sort((a, b) => a.fail_rate - b.fail_rate)
        return {
            animation: false,
            tooltip: {
                trigger: 'axis', axisPointer: { type: 'shadow' },
                formatter: (params: any) => {
                    const d = sorted[params[0].dataIndex]
                    return `<b>${d.printer_hostname}</b><br/>Fail Rate: ${d.fail_rate}%<br/>Failed: ${d.failed} / ${d.total}`
                },
            },
            grid: { left: 140, right: 20, top: 10, bottom: 20 },
            xAxis: { type: 'value', max: 100, axisLabel: { color: this.fgColor(), formatter: '{value}%' } },
            yAxis: { type: 'category', data: sorted.map((r) => r.printer_hostname), axisLabel: { color: this.fgColor(), fontSize: 10 } },
            series: [{
                type: 'bar',
                data: sorted.map((r) => ({
                    value: r.fail_rate,
                    itemStyle: { color: r.fail_rate >= 20 ? '#f44336' : r.fail_rate >= 10 ? '#ff9800' : '#4caf50' },
                })),
                label: { show: true, position: 'right', formatter: '{c}%', color: this.fgColor() },
            }],
        }
    }

    // 5. Fail Rate by Filament
    get failRateByFilamentOptions() {
        if (!this.partAnalytics) return {}
        const data = this.partAnalytics.fail_rate_by_filament
        return {
            animation: false,
            tooltip: {
                trigger: 'axis', axisPointer: { type: 'shadow' },
                formatter: (params: any) => {
                    const d = data[params[0].dataIndex]
                    return `<b>${d.filament_type}</b><br/>Fail Rate: ${d.fail_rate}%<br/>Failed: ${d.failed} / ${d.total}`
                },
            },
            xAxis: { type: 'category', data: data.map((r) => r.filament_type), axisLabel: { color: this.fgColor(), rotate: 30 } },
            yAxis: { type: 'value', max: 100, axisLabel: { color: this.fgColor(), formatter: '{value}%' } },
            series: [{
                type: 'bar',
                data: data.map((r) => ({
                    value: r.fail_rate,
                    itemStyle: { color: r.fail_rate >= 20 ? '#f44336' : r.fail_rate >= 10 ? '#ff9800' : '#4caf50' },
                })),
                label: { show: true, position: 'top', formatter: '{c}%', color: this.fgColor() },
            }],
        }
    }

    // 6. Fail Rate by Spool
    get failRateBySpoolOptions() {
        if (!this.partAnalytics) return {}
        const data = this.partAnalytics.fail_rate_by_spool
        return {
            animation: false,
            tooltip: {
                trigger: 'axis', axisPointer: { type: 'shadow' },
                formatter: (params: any) => {
                    const d = data[params[0].dataIndex]
                    return `<b>${d.spool_qr_code}</b><br/>Fail Rate: ${d.fail_rate}%<br/>Failed: ${d.failed} / ${d.total}`
                },
            },
            xAxis: { type: 'category', data: data.map((r) => r.spool_qr_code), axisLabel: { color: this.fgColor(), rotate: 45, fontSize: 10 } },
            yAxis: { type: 'value', max: 100, axisLabel: { color: this.fgColor(), formatter: '{value}%' } },
            series: [{
                type: 'bar',
                data: data.map((r) => ({
                    value: r.fail_rate,
                    itemStyle: { color: r.fail_rate >= 20 ? '#f44336' : r.fail_rate >= 10 ? '#ff9800' : '#4caf50' },
                })),
            }],
        }
    }

    // 7. Inspector Activity (grouped bar)
    get inspectorActivityOptions() {
        if (!this.partAnalytics) return {}
        const data = this.partAnalytics.inspector_activity
        return {
            animation: false,
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: { data: ['Inspected', 'Pass Rate %'], textStyle: { color: this.fgColor() } },
            xAxis: { type: 'category', data: data.map((r) => r.inspector), axisLabel: { color: this.fgColor() } },
            yAxis: [
                { type: 'value', name: 'Count', axisLabel: { color: this.fgColor() } },
                { type: 'value', name: 'Rate %', max: 100, axisLabel: { color: this.fgColor(), formatter: '{value}%' } },
            ],
            series: [
                {
                    name: 'Inspected',
                    type: 'bar',
                    data: data.map((r) => r.inspected),
                    itemStyle: { color: '#2196f3' },
                },
                {
                    name: 'Pass Rate %',
                    type: 'bar',
                    yAxisIndex: 1,
                    data: data.map((r) => r.pass_rate),
                    itemStyle: { color: '#4caf50' },
                },
            ],
        }
    }

    // 8. QC Turnaround Time
    get qcTurnaroundOptions() {
        if (!this.partAnalytics) return {}
        const data = this.partAnalytics.qc_turnaround
        return {
            animation: false,
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'category', data: data.map((r) => r.week), axisLabel: { color: this.fgColor(), rotate: 45, fontSize: 10 } },
            yAxis: { type: 'value', name: 'Hours', axisLabel: { color: this.fgColor() } },
            series: [{
                type: 'line',
                data: data.map((r) => r.avg_hours),
                smooth: true,
                areaStyle: { opacity: 0.15 },
                itemStyle: { color: '#9c27b0' },
            }],
        }
    }

    // 9. Fail Rate by Nozzle
    get failRateByNozzleOptions() {
        if (!this.partAnalytics) return {}
        const data = this.partAnalytics.fail_rate_by_nozzle
        return {
            animation: false,
            tooltip: {
                trigger: 'axis', axisPointer: { type: 'shadow' },
                formatter: (params: any) => {
                    const d = data[params[0].dataIndex]
                    return `<b>${d.nozzle_size}mm</b><br/>Fail Rate: ${d.fail_rate}%<br/>Failed: ${d.failed} / ${d.total}`
                },
            },
            xAxis: { type: 'category', data: data.map((r) => `${r.nozzle_size}mm`), axisLabel: { color: this.fgColor() } },
            yAxis: { type: 'value', max: 100, axisLabel: { color: this.fgColor(), formatter: '{value}%' } },
            series: [{
                type: 'bar',
                data: data.map((r) => ({
                    value: r.fail_rate,
                    itemStyle: { color: r.fail_rate >= 20 ? '#f44336' : r.fail_rate >= 10 ? '#ff9800' : '#4caf50' },
                })),
                label: { show: true, position: 'top', formatter: '{c}%', color: this.fgColor() },
            }],
        }
    }

    // 10. Top Failing Files (horizontal bar)
    get topFailingFilesHeight(): string {
        const rows = this.partAnalytics?.top_failing_files.length ?? 0
        return `height: ${Math.max(200, rows * 28 + 60)}px; width: 100%`
    }

    get topFailingFilesOptions() {
        if (!this.partAnalytics) return {}
        const sorted = [...this.partAnalytics.top_failing_files].sort((a, b) => a.fail_rate - b.fail_rate)
        return {
            animation: false,
            tooltip: {
                trigger: 'axis', axisPointer: { type: 'shadow' },
                formatter: (params: any) => {
                    const d = sorted[params[0].dataIndex]
                    return `<b>${d.filename}</b><br/>Fail Rate: ${d.fail_rate}%<br/>Failed: ${d.failed} / ${d.total}`
                },
            },
            grid: { left: 200, right: 20, top: 10, bottom: 20 },
            xAxis: { type: 'value', max: 100, axisLabel: { color: this.fgColor(), formatter: '{value}%' } },
            yAxis: { type: 'category', data: sorted.map((r) => r.filename), axisLabel: { color: this.fgColor(), fontSize: 10 } },
            series: [{
                type: 'bar',
                data: sorted.map((r) => ({
                    value: r.fail_rate,
                    itemStyle: { color: r.fail_rate >= 20 ? '#f44336' : r.fail_rate >= 10 ? '#ff9800' : '#4caf50' },
                })),
                label: { show: true, position: 'right', formatter: '{c}%', color: this.fgColor() },
            }],
        }
    }

    // 11. Monthly QC Summary
    get monthlyQcSummaryOptions() {
        if (!this.partAnalytics) return {}
        const data = this.partAnalytics.monthly_qc_summary
        return {
            animation: false,
            tooltip: { trigger: 'axis' },
            legend: { data: ['Pass Rate %', 'Total Parts'], textStyle: { color: this.fgColor() } },
            xAxis: { type: 'category', data: data.map((r) => r.year_month), axisLabel: { color: this.fgColor() } },
            yAxis: [
                { type: 'value', name: 'Rate %', max: 100, axisLabel: { color: this.fgColor(), formatter: '{value}%' } },
                { type: 'value', name: 'Parts', axisLabel: { color: this.fgColor() } },
            ],
            series: [
                {
                    name: 'Pass Rate %',
                    type: 'line',
                    data: data.map((r) => r.pass_rate),
                    smooth: true,
                    itemStyle: { color: '#4caf50' },
                    areaStyle: { opacity: 0.15 },
                },
                {
                    name: 'Total Parts',
                    type: 'bar',
                    yAxisIndex: 1,
                    data: data.map((r) => r.total),
                    itemStyle: { color: '#2196f3', opacity: 0.6 },
                },
            ],
        }
    }
}
</script>
