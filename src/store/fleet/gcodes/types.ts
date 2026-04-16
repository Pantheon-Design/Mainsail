export interface FleetGcodeFile {
    filename: string
    is_directory: boolean
    size: number
    modified: string
    modified_epoch: number
    age_days: number
    cached_on: string[]
}

export interface FleetDiskUsage {
    used: number
    free: number
    total: number
}

export interface FleetDownloadQueueEntry {
    id: number
    filename: string
    printer_hostname: string
    status: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled'
    priority: number
    progress_pct: number
    error_message: string | null
    created_at: string
    started_at: string | null
    completed_at: string | null
    source: 'user' | 'auto_cache'
}

export interface FleetGcodesState {
    files: FleetGcodeFile[]
    loading: boolean
    pushing: Record<string, boolean>
    currentPath: string
    diskUsage: FleetDiskUsage | null
    downloadQueue: FleetDownloadQueueEntry[]
    downloadQueueLoading: boolean
}
