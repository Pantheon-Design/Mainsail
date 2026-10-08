import { AirMetric, AirMetricBand } from '@/store/fleet/air/types'
import { AirSensorFrame } from '@/store/farm/types'

/**
 * Air-quality helpers shared by the Air Quality page, the map section and the overlay.
 * Everything is driven by the metric catalog from fleet_daemon (`GET /air/metrics`):
 * no range, unit or colour is hardcoded here.
 */

/** Marker fill / legend swatch for an offline sensor or a metric without a reading. */
export const AIR_NEUTRAL_COLOR = '#9e9e9e'
/** Overlay opacity: strong enough to read, light enough to keep the floor markings visible. */
export const AIR_OVERLAY_ALPHA = 0.4

/**
 * Band a value falls in: the first band with `min <= v < max` (null bounds are open).
 * A value below every band's lower bound maps to the first band (the catalog's lowest).
 * Null when the metric has no bands or the value is not a number.
 */
export function bandFor(metric: AirMetric | null | undefined, value: number | null | undefined): AirMetricBand | null {
    if (!metric || !metric.bands?.length) return null
    if (value === null || value === undefined || !Number.isFinite(value)) return null
    for (const band of metric.bands) {
        const aboveMin = band.min === null || band.min === undefined || value >= band.min
        const belowMax = band.max === null || band.max === undefined || value < band.max
        if (aboveMin && belowMax) return band
    }
    return metric.bands[0]
}

export function bandColor(metric: AirMetric | null | undefined, value: number | null | undefined): string {
    return bandFor(metric, value)?.color ?? AIR_NEUTRAL_COLOR
}

/** Numeric reading of `key` from a frame, null when missing or not a number. */
export function sensorValue(frame: AirSensorFrame | null | undefined, key: string | null | undefined): number | null {
    if (!frame || !key) return null
    const raw = frame.values?.[key]
    if (raw === null || raw === undefined) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
}

/** Online = the daemon says so AND we still have the daemon websocket. */
export function isSensorOnline(frame: AirSensorFrame | null | undefined, daemonConnected: boolean): boolean {
    return !!frame && !!frame.online && daemonConnected
}

/** Decimals shown for a metric: temperature/humidity 1, everything else 0 (ch2o/etvoc need more). */
export function metricDecimals(metric: AirMetric | null | undefined): number {
    const key = metric?.key ?? ''
    if (key === 'temperature' || key === 'humidity') return 1
    if (key === 'ch2o' || key === 'etvoc') return 3
    return 0
}

/** `23.4` / `650` / `0.012`, `—` when there is no reading. */
export function formatMetricValue(metric: AirMetric | null | undefined, value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—'
    return value.toFixed(metricDecimals(metric))
}

/** Unit suffix for the marker/legend; the catalog uses `-` for unitless metrics (AQI). */
export function metricUnit(metric: AirMetric | null | undefined): string {
    const unit = (metric?.unit ?? '').trim()
    return unit === '-' ? '' : unit
}

/** `23.4 °C`, `650 ppm`, `35` (unitless). */
export function formatMetricReading(metric: AirMetric | null | undefined, value: number | null | undefined): string {
    const text = formatMetricValue(metric, value)
    const unit = metricUnit(metric)
    return unit ? `${text} ${unit}` : text
}

/** Legend range text: `0–50 µg/m³`, `≥ 300 ppm`, `< 10 °C`. */
export function bandRangeText(band: AirMetricBand, metric: AirMetric | null | undefined): string {
    const unit = metricUnit(metric)
    const suffix = unit ? ` ${unit}` : ''
    const fmt = (n: number) => String(Number(n.toFixed(3)))
    const hasMin = band.min !== null && band.min !== undefined
    const hasMax = band.max !== null && band.max !== undefined
    if (hasMin && hasMax) return `${fmt(band.min as number)}–${fmt(band.max as number)}${suffix}`
    if (hasMin) return `≥ ${fmt(band.min as number)}${suffix}`
    if (hasMax) return `< ${fmt(band.max as number)}${suffix}`
    return ''
}

/** Seconds since the daemon's last sample, null when unknown. */
export function sensorAgeSeconds(frame: AirSensorFrame | null | undefined, now: number = Date.now()): number | null {
    if (!frame?.last_update) return null
    return Math.max(0, Math.round(now / 1000 - frame.last_update))
}

/** `12s ago`, `3m ago`, `2h ago`. */
export function formatAge(seconds: number | null): string {
    if (seconds === null) return '—'
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
}

/** `#rrggbb` / `#rgb` to [r, g, b]; grey for anything unparseable. */
export function hexToRgb(hex: string): [number, number, number] {
    const h = (hex || '').trim().replace(/^#/, '')
    const full =
        h.length === 3
            ? h
                  .split('')
                  .map((c) => c + c)
                  .join('')
            : h
    const n = parseInt(full, 16)
    if (!/^[0-9a-fA-F]{6}$/.test(full) || Number.isNaN(n)) return [158, 158, 158]
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
