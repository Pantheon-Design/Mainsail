<template>
    <e-chart
        ref="airHistoryChart"
        :option="chartOptions"
        :init-options="{ renderer: 'svg' }"
        autoresize
        style="height: 280px; width: 100%"
        @click="onClick"></e-chart>
</template>

<script lang="ts">
/**
 * One air-quality metric over time, one line per sensor (`GET /air/history` buckets).
 * Each point is the bucket mean of the sensor's valid per-minute readings; a missing bucket
 * stays a gap (no line drawn across it), and a bucket with clearly fewer readings than a full
 * one is drawn as a hollow marker so a partial hour never reads as a full one. The metric's
 * quality bands are shaded behind the lines, and the hour selected on the map timeline is
 * marked; clicking a point selects its hour.
 */
import Component from 'vue-class-component'
import { Mixins, Prop } from 'vue-property-decorator'
import { use } from 'echarts/core'
import { MarkAreaComponent, MarkLineComponent } from 'echarts/components'
import BaseMixin from '../mixins/base'
import ThemeMixin from '../mixins/theme'
import { AirHistoryHour, AirMetric } from '@/store/fleet/air/types'
import { formatMetricReading, metricDecimals, metricUnit } from '@/components/panels/airQualityBands'

use([MarkAreaComponent, MarkLineComponent])

/** A bucket with fewer valid samples than this share of `expected` is drawn as partial. */
const PARTIAL_SHARE = 0.9

export interface AirChartSensor {
    hostname: string
    label: string
}

@Component
export default class AirHistoryChart extends Mixins(BaseMixin, ThemeMixin) {
    @Prop({ type: Array, required: true }) readonly hours!: AirHistoryHour[]
    @Prop({ type: Object, required: true }) readonly metric!: AirMetric
    @Prop({ type: Array, required: true }) readonly sensors!: AirChartSensor[]
    /** epoch seconds of the hour selected on the map timeline (marked with a vertical line) */
    @Prop({ type: Number, default: null }) readonly selectedEpoch!: number | null

    get seriesData() {
        const key = this.metric.key
        return this.sensors.map((s) => ({
            sensor: s,
            points: this.hours.map((h) => {
                const f = h.sensors[s.hostname]
                const raw = f?.values?.[key]
                const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : null
                const count = f?.counts?.[key]
                const expected = f?.expected
                const partial =
                    value !== null &&
                    typeof count === 'number' &&
                    typeof expected === 'number' &&
                    count < expected * PARTIAL_SHARE
                return { epoch: h.epoch, value, count, expected, partial }
            }),
        }))
    }

    /** Sensors that have at least one value for this metric (others would be empty lines). */
    get visibleSeries() {
        return this.seriesData.filter((s) => s.points.some((p) => p.value !== null))
    }

    get bandAreas() {
        return (this.metric.bands ?? []).map((b) => [
            {
                yAxis: b.min ?? undefined,
                itemStyle: { color: b.color, opacity: 0.07 },
                name: b.name,
            },
            { yAxis: b.max ?? undefined },
        ])
    }

    get chartOptions(): any {
        const decimals = metricDecimals(this.metric)
        const unit = metricUnit(this.metric)
        const series: any[] = this.visibleSeries.map((s, i) => ({
            name: s.sensor.label,
            type: 'line',
            showSymbol: true,
            connectNulls: false,
            lineStyle: { width: 1.5 },
            emphasis: { focus: 'series' },
            data: s.points.map((p) => ({
                value: [p.epoch * 1000, p.value],
                symbol: p.partial ? 'emptyCircle' : 'none',
                symbolSize: p.partial ? 6 : 0,
                count: p.count,
                expected: p.expected,
            })),
            ...(i === 0
                ? {
                      markArea: { silent: true, label: { show: false }, data: this.bandAreas },
                      markLine:
                          this.selectedEpoch !== null
                              ? {
                                    silent: true,
                                    symbol: 'none',
                                    label: { show: false },
                                    lineStyle: { color: this.fgColorMid, type: 'dashed', width: 1 },
                                    data: [{ xAxis: this.selectedEpoch * 1000 }],
                                }
                              : undefined,
                  }
                : {}),
        }))
        return {
            animation: false,
            grid: { top: 40, right: 24, bottom: 30, left: 56 },
            legend: {
                type: 'scroll',
                top: 0,
                textStyle: { color: this.fgColorHi },
                pageTextStyle: { color: this.fgColorMid },
            },
            tooltip: {
                trigger: 'axis',
                borderWidth: 0,
                formatter: (params: any[]) => this.tooltip(params),
            },
            xAxis: {
                type: 'time',
                axisLabel: { color: this.fgColorLow },
                splitLine: { show: false },
                axisLine: { lineStyle: { color: this.fgColorLow } },
            },
            yAxis: {
                type: 'value',
                name: unit ? `${this.metric.label} (${unit})` : this.metric.label,
                nameTextStyle: { color: this.fgColorLow, align: 'left' },
                scale: true,
                splitLine: { lineStyle: { color: this.fgColorFaint } },
                axisLabel: {
                    color: this.fgColorLow,
                    formatter: (v: number) => Number(v.toFixed(Math.max(decimals, 0))).toString(),
                },
            },
            series,
        }
    }

    tooltip(params: any[]): string {
        if (!params?.length) return ''
        const epochMs = params[0].value?.[0]
        const head = new Date(epochMs).toLocaleString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
        const rows = params
            .filter((p) => p.value?.[1] !== null && p.value?.[1] !== undefined)
            .map((p) => {
                const d = p.data ?? {}
                const n =
                    typeof d.count === 'number' && typeof d.expected === 'number' ? ` · ${d.count}/${d.expected}` : ''
                return `${p.marker}${p.seriesName}: <b>${formatMetricReading(this.metric, p.value[1])}</b>${n}`
            })
        return [head, ...rows].join('<br/>')
    }

    onClick(e: any) {
        const ms = e?.value?.[0]
        if (typeof ms !== 'number') return
        const index = this.hours.findIndex((h) => h.epoch * 1000 === ms)
        if (index >= 0) this.$emit('select', index)
    }
}
</script>
