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

export interface FleetAirState {
    metrics: AirMetric[]
    loading: boolean
    error: string | null
    loadedAt: number | null
}
