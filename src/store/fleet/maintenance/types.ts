export interface ServiceTrackerRow {
    id: string
    printer_hostname: string
    day: string
    captured_at: string | null
    odometer_x: number | null
    odometer_y: number | null
    odometer_z: number | null
    odometer_e: number | null
    tripmeter_x: number | null
    tripmeter_y: number | null
    tripmeter_z: number | null
    tripmeter_e: number | null
    nozzle_life: number | null
    remaining_nozzle_life: number | null
    nozzle_size: string | number | null
    nozzle_type: string | null
    filament_type: string | null
    spool_qr_code: string | null
    initial_weight: number | null
    used_weight: number | null
    remaining_weight: number | null
    used_length: number | null
    remaining_length: number | null
    source: 'printer' | 'daemon' | string
    collected_at: string | null
}

export type MaintenanceMetric = 'odometer_x' | 'odometer_y' | 'odometer_z' | 'odometer_e' | 'nozzle_wear' | 'filament_used_g'

export type MetricValues = Record<MaintenanceMetric, number | null>

export interface ServiceTrackerPrinterSummary {
    printer_hostname: string
    days: number
    first_day: string | null
    last_day: string | null
    latest: ServiceTrackerRow | null
}

export interface ServiceTrackerDelta extends MetricValues {
    day: string
}

export interface ServiceTrackerPrinterDetail {
    hostname: string
    latest: ServiceTrackerRow | null
    history: ServiceTrackerRow[]
    deltas: ServiceTrackerDelta[]
}

export interface ServiceTrackerCurrent {
    odometer_x: number | null
    odometer_y: number | null
    odometer_z: number | null
    odometer_e: number | null
    tripmeter_x: number | null
    tripmeter_y: number | null
    tripmeter_z: number | null
    tripmeter_e: number | null
    nozzle_life: number | null
    remaining_nozzle_life: number | null
    nozzle_pct: number | null
    nozzle_size: string | number | null
    nozzle_type: string | null
    filament_type: string | null
    remaining_weight: number | null
}

export interface ServiceTrackerPerPrinter {
    printer_hostname: string
    days: number
    last_day: string | null
    avg_daily: MetricValues
    total: MetricValues
    current: ServiceTrackerCurrent
}

export interface ServiceTrackerTopEntry {
    printer_hostname: string
    value: number
}

export interface ServiceTrackerNozzleRank {
    printer_hostname: string
    remaining_nozzle_life: number | null
    nozzle_life: number | null
    pct: number | null
}

export interface ServiceTrackerAnalytics {
    kpis: {
        printers: number
        days_covered: number
        avg_daily: MetricValues
    }
    per_printer: ServiceTrackerPerPrinter[]
    top: Record<MaintenanceMetric, ServiceTrackerTopEntry[]>
    nozzle_life_ranking: ServiceTrackerNozzleRank[]
    daily_fleet: ServiceTrackerDelta[]
}

export interface FleetMaintenanceState {
    printers: ServiceTrackerPrinterSummary[]
    printerDetail: ServiceTrackerPrinterDetail | null
    analytics: ServiceTrackerAnalytics | null
    loading: boolean
    detailLoading: boolean
    printersLoading: boolean
}
