/**
 * Air-quality metric catalog served by fleet_daemon `GET /air/metrics`.
 * The daemon derives keys/units from the Panda Sense Pro Moonraker conf and attaches the
 * quality bands (Good .. Hazardous); the UI never hardcodes ranges or colours.
 */
export interface AirMetricBand {
    /** Good | Fair | Marginal | Poor | Severe | Hazardous (two-sided metrics repeat names) */
    name: string
    /** inclusive lower bound; null = unbounded below */
    min: number | null
    /** exclusive upper bound; null = open-ended */
    max: number | null
    /** CSS colour */
    color: string
}

export interface AirMetric {
    /** metric key as sent in sensor frames (`pm2_5`, `co2`, ...) */
    key: string
    label: string
    unit: string
    bands: AirMetricBand[]
}

/** One hour of `GET /air/history`: every sensor's archived frame at that hour. */
export interface AirHistoryHour {
    /** ISO-8601 UTC, hour-aligned */
    ts: string
    /** epoch seconds of `ts` */
    epoch: number
    /** hostname -> air-sensor frame as archived (+ label/location at the time) */
    sensors: Record<string, AirHistoryFrame>
}

export interface AirHistoryFrame {
    hostname: string
    device_type: 'air_sensor'
    online: boolean
    last_update: number | null
    values: Record<string, number | null>
    error?: string | null
    label?: string | null
    location?: string | null
    /** exact archive timestamp of this row */
    ts?: string
}

export interface AirHistoryResponse {
    since: string
    until: string
    /** where the rows came from: fleet_air_snapshot or the NAS/staging day-files */
    source: 'postgres' | 'files' | null
    hours: AirHistoryHour[]
    rows?: number
    truncated?: boolean
    db_error?: string
}

export interface FleetAirState {
    metrics: AirMetric[]
    loading: boolean
    error: string | null
    loadedAt: number | null
}
