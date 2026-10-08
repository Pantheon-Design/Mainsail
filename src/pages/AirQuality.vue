<template>
    <div>
        <!-- Title + fleet-wide sensor count -->
        <div class="air-header mb-3">
            <div class="air-title-row">
                <h2 class="air-title">{{ $t('AirQuality.Title') }}</h2>
                <span class="air-total">
                    {{ totalSensorCount }} {{ $t('AirQuality.Sensors') }}
                    <span v-if="totalSensorCount">&middot; {{ totalOnlineCount }} {{ $t('AirQuality.Online') }}</span>
                </span>
                <span v-if="!daemonConnected" class="air-offline-chip">{{ $t('FleetDashboard.DaemonOffline') }}</span>
            </div>
        </div>

        <!-- Metric selector: one chip per catalog entry (GET /air/metrics) -->
        <div class="air-metrics mb-2">
            <span class="air-metrics__label">{{ $t('AirQuality.Metric') }}</span>
            <v-chip-group v-if="metrics.length" v-model="metricKey" mandatory active-class="primary--text" column>
                <v-chip
                    v-for="m in metrics"
                    :key="m.key"
                    :value="m.key"
                    small
                    outlined
                    :color="m.key === metricKey ? 'primary' : undefined">
                    {{ m.label }}
                    <span v-if="unitOf(m)" class="air-chip-unit">{{ unitOf(m) }}</span>
                </v-chip>
            </v-chip-group>
            <v-progress-circular v-else-if="metricsLoading" indeterminate size="18" width="2" class="ml-2" />
        </div>
        <v-alert v-if="metricsError && !metrics.length" type="warning" dense text class="mb-3">
            {{ $t('AirQuality.MetricsUnavailable') }}
        </v-alert>

        <!-- Legend for the selected metric -->
        <div v-if="selectedMetric" class="air-legend mb-4">
            <span class="air-legend__label">{{ $t('AirQuality.Legend') }}</span>
            <span v-for="(b, i) in legendBands" :key="'band-' + i" class="air-legend__item" :title="b.range">
                <span class="air-legend__swatch" :style="{ backgroundColor: b.color }"></span>
                {{ b.name }}
                <span class="air-legend__range">{{ b.range }}</span>
            </span>
            <span class="air-legend__item">
                <span class="air-legend__swatch air-legend__swatch--neutral"></span>
                {{ $t('AirQuality.NoData') }}
            </span>
        </div>

        <!-- Two floors, same grid as the Fleet Map (positions are shared) -->
        <farm-map-section mode="air" location="farm" name="Print Farm" :metric-key="metricKey" class="mb-8" />
        <farm-map-section mode="air" location="ground" name="Ground Floor" :metric-key="metricKey" />
    </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import FarmMapSection from '@/components/panels/FarmMapSection.vue'
import { fleetDaemonEvents } from '@/plugins/fleetDaemonClient'
import { hostKey } from '@/plugins/hostKey'
import { AirMetric } from '@/store/fleet/air/types'
import { AirSensorFrame } from '@/store/farm/types'
import { AIR_NEUTRAL_COLOR, bandRangeText, isSensorOnline, metricUnit } from '@/components/panels/airQualityBands'

/**
 * Air Quality page: the fleet map (both floors) with minimal printer markers, the air
 * sensors coloured by the selected metric's quality band and the colour field underneath.
 * Metric definitions come from fleet_daemon (`GET /air/metrics`); live readings arrive as
 * `device_type: "air_sensor"` frames on the daemon websocket (farm.fleetDaemonAirSensors).
 */
@Component({
    components: {
        FarmMapSection,
    },
})
export default class PageAirQuality extends Mixins(BaseMixin) {
    readonly AIR_NEUTRAL_COLOR = AIR_NEUTRAL_COLOR

    private reloadTimer: ReturnType<typeof setTimeout> | null = null

    mounted() {
        this.loadMetrics()
        fleetDaemonEvents.$on('air_sensors_updated', this.onSensorsUpdated)
    }

    beforeDestroy() {
        fleetDaemonEvents.$off('air_sensors_updated', this.onSensorsUpdated)
        if (this.reloadTimer) clearTimeout(this.reloadTimer)
    }

    /** The catalog is static per daemon; a failed load leaves the markers neutral + an alert. */
    loadMetrics() {
        this.$store.dispatch('fleet/air/loadMetrics').catch(() => {})
    }

    /** Debounced: the roster set changed (sensor added/removed); refresh the catalog too in case the daemon was updated. */
    onSensorsUpdated() {
        if (this.reloadTimer) clearTimeout(this.reloadTimer)
        this.reloadTimer = setTimeout(() => {
            this.reloadTimer = null
            this.loadMetrics()
        }, 500)
    }

    get metrics(): AirMetric[] {
        return this.$store.getters['fleet/air/getMetrics'] || []
    }

    get metricsLoading(): boolean {
        return !!this.$store.getters['fleet/air/isLoading']
    }

    get metricsError(): string | null {
        return this.$store.getters['fleet/air/getError'] ?? null
    }

    get daemonConnected(): boolean {
        return !!this.$store.state.farm.fleetDaemonConnected
    }

    /** Selected metric: the saved choice if it still exists in the catalog, else the first entry. */
    get metricKey(): string {
        const saved: string | null = this.$store.state.gui?.airquality?.metric ?? null
        if (saved && this.metrics.some((m) => m.key === saved)) return saved
        return this.$store.getters['fleet/air/defaultMetricKey'] ?? saved ?? ''
    }

    set metricKey(value: string) {
        if (!value || value === this.$store.state.gui?.airquality?.metric) return
        this.$store.dispatch('gui/saveSetting', { name: 'airquality.metric', value })
    }

    get selectedMetric(): AirMetric | null {
        return this.metricKey ? this.$store.getters['fleet/air/getMetric'](this.metricKey) : null
    }

    unitOf(metric: AirMetric): string {
        return metricUnit(metric)
    }

    /** Legend entries: band name + range, duplicates (two-sided metrics) merged by name. */
    get legendBands(): { name: string; color: string; range: string }[] {
        const metric = this.selectedMetric
        if (!metric) return []
        const byName = new Map<string, { name: string; color: string; ranges: string[] }>()
        metric.bands.forEach((b) => {
            const entry = byName.get(b.name) ?? { name: b.name, color: b.color, ranges: [] }
            const r = bandRangeText(b, metric)
            if (r) entry.ranges.push(r)
            byName.set(b.name, entry)
        })
        return [...byName.values()].map((e) => ({ name: e.name, color: e.color, range: e.ranges.join(', ') }))
    }

    // ---- fleet-wide sensor counts (both floors) ----
    get sensorHostnames(): string[] {
        const roster = this.$store.state.gui?.remoteprinters?.printers || {}
        const seen = new Set<string>()
        const out: string[] = []
        Object.values(roster).forEach((e: any) => {
            if (e?.deviceType !== 'air_sensor' || !e.hostname) return
            const key = hostKey(e.hostname)
            if (seen.has(key)) return
            seen.add(key)
            out.push(e.hostname)
        })
        return out
    }

    get totalSensorCount(): number {
        return this.sensorHostnames.length
    }

    sensorFrame(hostname: string): AirSensorFrame | null {
        const frames: Record<string, AirSensorFrame> = this.$store.state.farm.fleetDaemonAirSensors || {}
        const key = hostKey(hostname)
        for (const [h, frame] of Object.entries(frames)) {
            if (hostKey(h) === key) return frame
        }
        return null
    }

    get totalOnlineCount(): number {
        return this.sensorHostnames.filter((h) => isSensorOnline(this.sensorFrame(h), this.daemonConnected)).length
    }
}
</script>

<style scoped>
.air-title-row {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
}
.air-title {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
}
.air-total {
    font-size: 13px;
    opacity: 0.75;
    font-weight: 600;
    padding-left: 14px;
    border-left: 1px solid rgba(255, 255, 255, 0.15);
}
.air-offline-chip {
    font-size: 11px;
    font-weight: 700;
    padding: 1px 8px;
    border-radius: 11px;
    background: #d32f2f;
    color: #fff;
}

/* Metric chips */
.air-metrics {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}
.air-metrics__label,
.air-legend__label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.6;
}
.air-chip-unit {
    margin-left: 5px;
    font-size: 10px;
    opacity: 0.7;
}

/* Legend */
.air-legend {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    font-size: 12px;
}
.air-legend__item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
}
.air-legend__swatch {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    display: inline-block;
    border: 1px solid rgba(255, 255, 255, 0.35);
}
.air-legend__swatch--neutral {
    background: #9e9e9e;
    border-style: dashed;
}
.air-legend__range {
    opacity: 0.6;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
}
</style>
