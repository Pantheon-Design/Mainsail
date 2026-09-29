export interface FleetActivityRecord {
    id: string
    printer_hostname: string
    printer_epoch: string | null
    printer_seq: number
    /** ISO timestamp from the daemon */
    ts: string
    recorded_at: string | null
    printer_updated_at: string | null
    type: string
    tier: number
    source: string | null
    client: string | null
    ip: string | null
    summary: string | null
    details: Record<string, any> | null
    moonraker_job_id: string | null
    filename: string | null
    deleted: boolean
    collected_at: string
    updated_at: string
    /** Nozzle health at a nozzle change, flattened by fleet_activity_collector.py */
    nozzle_life?: number | null
    remaining_nozzle_life?: number | null
    nozzle_health_pct?: number | null
    nozzle_size?: string | null
    nozzle_type?: string | null
    /** 'printer' | 'daemon' (estimated from a daily snapshot) | 'none' */
    nozzle_health_source?: string | null
    /** Motion travel at a lubrication / belts service, flattened by fleet_activity_collector.py (mm) */
    odometer_x?: number | null
    odometer_y?: number | null
    odometer_z?: number | null
    odometer_e?: number | null
    travel_since_service_x?: number | null
    travel_since_service_y?: number | null
    travel_since_service_z?: number | null
    travel_since_service_e?: number | null
    days_since_service?: number | null
    prev_service_id?: string | null
    /** 'printer' | 'printer+daemon' (since-last estimated by the daemon) | 'daemon' | 'none' */
    motion_source?: string | null
}

export interface FleetActivityTypeCount {
    type: string
    count: number
}

export interface FleetActivityPrinterCount {
    printer_hostname: string
    count: number
    last_ts: string | null
}

export interface FleetActivityFilters {
    types?: string[]
    /** ISO */
    since?: string | null
    /** ISO */
    until?: string | null
    job_id?: string | null
    limit?: number
    offset?: number
}

/** One printer's independently paged slice of the activity table. */
export interface FleetActivityLane {
    records: FleetActivityRecord[]
    total: number
    hasMore: boolean
    loading: boolean
    loadingMore: boolean
}

export interface FleetActivityState {
    /** keyed by hostKey(printer) */
    lanes: Record<string, FleetActivityLane>
    types: FleetActivityTypeCount[]
    printers: FleetActivityPrinterCount[]
}
