<template>
    <div>
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
    </div>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import ThemeMixin from '@/components/mixins/theme'
import { FleetAnalytics, FleetDailyUtilization, FleetPrinterHealth, FleetModelSummary } from '@/store/fleet/history/types'

@Component
export default class FleetAnalyticsPanel extends Mixins(BaseMixin, ThemeMixin) {
    heatmapModelFilter = 'all'

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

    // Model donut chart
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

    // Model comparison bar chart
    get modelComparisonOptions() {
        if (!this.analytics?.model_summary) return {}
        const models = this.analytics.model_summary.map((r: FleetModelSummary) => r.printer_model)
        const modelColors: Record<string, string> = {
            'HS-3': '#2196f3',
            'HS-Pro': '#ff9800',
        }
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

    // 2. Utilization line chart
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

    // 3. Filament by type line chart
    get filamentByTypeChartOptions() {
        if (!this.analytics) return {}
        const mf = this.analytics.monthly_filament
        const allTypes = [...new Set(mf.map((r) => r.filament_type))]
        // Top 5 by total mass
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

    // 4. Heatmap
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

    // 5. Health bar chart
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

    // 6. Status donut
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

    // 7. Weekly success rate
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
}
</script>
