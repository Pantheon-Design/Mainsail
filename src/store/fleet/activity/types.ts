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
