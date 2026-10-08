<template>
    <div class="dash-air">
        <div class="dash-air__head">
            <v-icon small class="mr-1">{{ mdiAirSensor }}</v-icon>
            {{ $t('FleetDashboard.AirSensors') }}
            <span class="dash-air__pill" :class="{ 'dash-air__pill--down': sensorsTotal && !sensorsOnline }">
                {{ sensorsOnline }}/{{ sensorsTotal }}
            </span>
            <span class="dash-air__totals text--secondary">
                {{ $t('FleetDashboard.SensorsOnline', { online: sensorsOnline, total: sensorsTotal }) }}
            </span>
        </div>
        <div v-if="!sensorsTotal" class="dash-air__empty">{{ $t('FleetDashboard.AirNoSensors') }}</div>
        <div v-else-if="!alerts.length" class="dash-air__empty dash-air__empty--ok">
            <v-icon small color="#00e400" class="mr-1">{{ mdiCheckCircle }}</v-icon>
            {{ $t('FleetDashboard.AirAllClear') }}
        </div>
        <div v-else class="dash-air__list">
            <div
                v-for="a in alerts"
                :key="a.key"
                class="dash-air-row"
                :class="{ 'dash-air-row--hover': hoverHostname === a.hostname }"
                :style="{ borderLeftColor: a.color }"
                @mouseenter="setHover(a.hostname)"
                @mouseleave="setHover('')">
                <div class="dash-air-row__line">
                    <span class="dash-air-row__dot" :style="{ backgroundColor: a.color }"></span>
                    <span class="dash-air-row__sensor text-truncate" :title="a.hostname">{{ a.sensor }}</span>
                    <span class="dash-air-row__where text--secondary text-truncate">{{ a.where }}</span>
                    <span class="dash-air-row__band" :style="{ backgroundColor: a.color, color: a.chipText }">
                        {{ a.band }}
                    </span>
                </div>
                <div class="dash-air-row__line dash-air-row__line--sub">
                    <span class="dash-air-row__metric text-truncate">{{ a.metric }}</span>
                    <span class="dash-air-row__value" :style="{ color: a.valueColor }">{{ a.reading }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import { mdiCheckCircle } from '@mdi/js'
import BaseMixin from '@/components/mixins/base'
import { hostKey } from '@/plugins/hostKey'
import { mdiAirSensor } from '@/components/panels/airSensorIcon'
import {
    MAP_LOCATIONS,
    MapLocation,
    airSensorHostnames,
    printerGridPosition,
} from '@/components/panels/farmMapGeometry'
import {
    formatMetricReading,
    hexToRgb,
    isSensorOnline,
    readingStates,
    SEVERITY_ATTENTION,
} from '@/components/panels/airQualityBands'
import { AirSensorFrame } from '@/store/farm/types'
import { AirMetric } from '@/store/fleet/air/types'

interface AirAlertRow {
    key: string
    hostname: string
    sensor: string
    where: string
    metric: string
    reading: string
    band: string
    color: string
    /** chip text: dark on light bands, white on dark ones (Hazardous maroon) */
    chipText: string
    /** value text: the band colour, lightened when it is too dark for the card background */
    valueColor: string
    severity: number
}

function luminance(hex: string): number {
    const [r, g, b] = hexToRgb(hex)
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

function lighten(hex: string, amount: number): string {
    const [r, g, b] = hexToRgb(hex)
    const mix = (c: number) => Math.round(c + (255 - c) * amount)
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

/**
 * Dashboard card under Fleet Jobs: how many air sensors are online, then one row per
 * (sensor, metric) whose reading is worse than Fair (Marginal, Poor, Severe, Hazardous),
 * coloured by its band. Bands and colours come from the daemon's metric catalog.
 */
@Component
export default class DashboardAirPanel extends Mixins(BaseMixin) {
    mdiAirSensor = mdiAirSensor
    mdiCheckCircle = mdiCheckCircle
    hoverHostname = ''

    /** Hovering a row emits `hover` so the page can halo the sensor on the map (like the workers list). */
    setHover(hostname: string) {
        if (this.hoverHostname === hostname) return
        this.hoverHostname = hostname
        this.$emit('hover', hostname)
    }

    get roster(): Record<string, any> {
        return this.$store.state.gui?.remoteprinters?.printers || {}
    }

    get frames(): Record<string, AirSensorFrame> {
        return this.$store.state.farm.fleetDaemonAirSensors || {}
    }

    get connected(): boolean {
        return !!this.$store.state.farm.fleetDaemonConnected
    }

    get metrics(): AirMetric[] {
        return this.$store.getters['fleet/air/getMetrics'] ?? []
    }

    /** Every registered sensor (roster-driven, deduplicated by hostKey), with its floor. */
    get sensorHostnames(): { hostname: string; location: MapLocation }[] {
        const out: { hostname: string; location: MapLocation }[] = []
        for (const { location } of MAP_LOCATIONS) {
            for (const hostname of airSensorHostnames(this.roster, location)) out.push({ hostname, location })
        }
        return out
    }

    frameFor(hostname: string): AirSensorFrame | null {
        const key = hostKey(hostname)
        for (const [h, frame] of Object.entries(this.frames)) {
            if (hostKey(h) === key) return frame
        }
        return null
    }

    labelFor(hostname: string): string {
        const key = hostKey(hostname)
        const entry = Object.values(this.roster).find((e: any) => hostKey(e?.hostname) === key) as any
        return entry?.label || hostname.replace(/\.local$/i, '')
    }

    get sensorsTotal(): number {
        return this.sensorHostnames.length
    }

    get sensorsOnline(): number {
        return this.sensorHostnames.filter((s) => isSensorOnline(this.frameFor(s.hostname), this.connected)).length
    }

    /** Readings worse than Fair, worst first, then by sensor and catalog order. */
    get alerts(): AirAlertRow[] {
        const rows: AirAlertRow[] = []
        for (const { hostname, location } of this.sensorHostnames) {
            const frame = this.frameFor(hostname)
            if (!isSensorOnline(frame, this.connected)) continue
            const floor = MAP_LOCATIONS.find((l) => l.location === location)?.name ?? location
            const pos = printerGridPosition(this.roster, hostname)
            const sensor = this.labelFor(hostname)
            for (const r of readingStates(this.metrics, frame)) {
                if (r.severity <= SEVERITY_ATTENTION) continue
                rows.push({
                    key: `${hostKey(hostname)}/${r.metric.key}`,
                    hostname,
                    sensor,
                    where: `${floor} · ${pos.x},${pos.y}`,
                    metric: r.metric.label,
                    reading: formatMetricReading(r.metric, r.value),
                    band: r.band.name,
                    color: r.band.color,
                    chipText: luminance(r.band.color) < 0.4 ? '#fff' : '#1a1712',
                    valueColor: luminance(r.band.color) < 0.3 ? lighten(r.band.color, 0.45) : r.band.color,
                    severity: r.severity,
                })
            }
        }
        return rows.sort((a, b) => b.severity - a.severity || a.sensor.localeCompare(b.sensor))
    }

    mounted() {
        // Bands/colours come from the daemon's metric catalog (loaded on demand, kept in the store).
        const air = this.$store.state.fleet?.air
        if (air && !air.metrics?.length && !air.loading) {
            this.$store.dispatch('fleet/air/loadMetrics').catch(() => undefined)
        }
    }
}
</script>

<style scoped>
.dash-air {
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(128, 128, 128, 0.25);
    border-radius: 6px;
    padding: 8px 12px 10px;
}
.dash-air__head {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 24px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 6px;
    flex: 0 0 auto;
}
.dash-air__pill {
    font-size: 22px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 9px;
    background: var(--v-primary-base, #f0d3b0);
    color: #1a1712;
}
.dash-air__pill--down {
    background: #8a8a8a;
    color: #fff;
}
.dash-air__totals {
    margin-left: auto;
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
}
.dash-air__empty {
    font-size: 22px;
    opacity: 0.6;
    padding: 6px 0;
    display: flex;
    align-items: center;
}
.dash-air__empty--ok {
    opacity: 0.85;
}
.dash-air__list {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.dash-air-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 21px;
    line-height: 1.2;
    padding: 6px 10px 6px 12px;
    border-left: 5px solid transparent;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.04);
    min-width: 0;
}
.dash-air-row--hover {
    background: rgba(255, 235, 59, 0.14);
}
.dash-air-row__line {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}
.dash-air-row__line--sub {
    padding-left: 20px;
    font-size: 19px;
}
.dash-air-row__where {
    font-size: 17px;
    flex: 1 1 auto;
}
.dash-air-row__metric {
    flex: 1 1 auto;
}
.dash-air-row__dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-block;
    flex: 0 0 auto;
}
.dash-air-row__sensor {
    font-weight: 700;
}
.dash-air-row__metric {
    font-weight: 500;
}
.dash-air-row__value {
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}
.dash-air-row__band {
    margin-left: auto;
    flex: 0 0 auto;
    font-size: 14px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #1a1712;
    padding: 2px 8px;
    border-radius: 9px;
    white-space: nowrap;
}
</style>
