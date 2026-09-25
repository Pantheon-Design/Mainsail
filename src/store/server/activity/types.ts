import { ActivityEvent, ActivityServiceType, ActivityTier } from '@/components/timeline/types'

export interface ServerActivitySettings {
    retention_days: number
    record_gcode: boolean
    coalesce_window: number
}

export interface ServerActivityFilters {
    tier: ActivityTier
    types: string[]
    /** epoch seconds, inclusive lower bound on ts */
    after: number | null
    /** epoch seconds, exclusive upper bound on ts */
    before: number | null
}

export interface ServerActivityState {
    /** newest-first, unique by id */
    events: ActivityEvent[]
    total: number
    max_seq: number
    min_seq: number
    epoch: string | null
    serviceTypes: ActivityServiceType[]
    settings: ServerActivitySettings
    filters: ServerActivityFilters
    hasMore: boolean
    loading: boolean
    loadingMore: boolean
}
