export type ActivityTier = 1 | 2

/**
 * One activity/timeline event. Shared between the printer build (Moonraker `activity`
 * component records) and the fleet-host build (fleet_daemon `fleet_printer_activity`
 * rows, normalised by the fleet/activity store getter).
 */
export interface ActivityEvent {
    id: string
    seq?: number
    /** event time, epoch SECONDS */
    ts: number
    recorded_at?: number | null
    updated_at?: number | string | null
    type: string
    tier: ActivityTier
    /** mainsail | klipperscreen | fleet_daemon | http | websocket | system */
    source: string
    client?: string | null
    ip?: string | null
    summary: string
    details: Record<string, any> | null
    job_id?: string | null
    filename?: string | null
    deleted?: boolean
    /** fleet-host build only */
    printer_hostname?: string
}

export interface ActivityDayGroup {
    date: Date
    key: string
    events: ActivityEvent[]
}

export interface ActivityServiceType {
    id: string
    label: string
}

export interface ActivityServiceForm {
    id?: string
    service_time: number
    service_type: string
    service_type_other: string
    operator: string
    comment: string
}

export interface ActivityFilterValue {
    tier: ActivityTier
    types: string[]
    dateFrom: string | null
    dateTo: string | null
    search: string
    printer: string | null
}
