/**
 * Air-quality metric catalog served by fleet_daemon `GET /air/metrics`.
 * The daemon derives the Panda keys/units from the Panda Sense Pro Moonraker conf, appends the
 * AirGradient / Dyson metrics and attaches the quality bands (Good .. Hazardous); the UI never
 * hardcodes ranges or colours.
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
    /** display decimals (older daemons may omit it) */
    decimals?: number
    /** sensor vendors that report this metric (older daemons may omit it = every vendor) */
    vendors?: string[]
    bands: AirMetricBand[]
}

/** One bucket (an hour by default) of `GET /air/history`: every sensor's frame for that bucket. */
export interface AirHistoryHour {
    /** ISO-8601 UTC, bucket-aligned */
    ts: string
    /** epoch seconds of `ts` */
    epoch: number
    /** readings = means of the per-minute readings; snapshot = the legacy hourly snapshot */
    source?: 'readings' | 'snapshot'
    /** hostname -> air-sensor frame (+ label/location at the time) */
    sensors: Record<string, AirHistoryFrame>
}

export interface AirHistoryFrame {
    hostname: string
    device_type: 'air_sensor'
    vendor?: string
    online: boolean
    last_update: number | null
    /** readings buckets: mean of the valid, fresh minute readings; snapshots: the value at that hour */
    values: Record<string, number | null>
    /** readings buckets: valid minute samples behind each mean */
    counts?: Record<string, number>
    /** readings buckets: fresh minute readings in the bucket / readings expected for a full bucket */
    samples?: number
    expected?: number
    error?: string | null
    label?: string | null
    location?: string | null
    /** latest row timestamp in this bucket */
    ts?: string
}

export interface AirHistoryResponse {
    since: string
    until: string
    /** bucket width in seconds (3600 for hourly) */
    bucket?: number
    /** where the rows came from: Postgres or the NAS/staging day-files */
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
