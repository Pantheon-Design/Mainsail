export interface FleetArchiveEntry {
    content_hash: string
    original_filename: string
    file_size: number
    archived_at: string | null
    source_printer: string
    source_type: string
}

export interface FleetArchiveStatus {
    total_files: number
    total_size_bytes: number
    total_size_mb: number
    unarchived_jobs: number
    staged_files: number
}

export interface FleetArchiveState {
    entries: FleetArchiveEntry[]
    total: number
    status: FleetArchiveStatus | null
    loading: boolean
    statusLoading: boolean
    searchQuery: string
}
