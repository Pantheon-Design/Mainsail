export interface FleetFile {
    filename: string
    size: number
    modified_epoch: number
    age_days: number
    is_local: boolean
}

export interface FleetDownloadStatus {
    filename: string
    status: 'idle' | 'requesting' | 'downloading' | 'processing' | 'starting_print' | 'complete' | 'error'
    error?: string
}

export interface FleetState {
    connected: boolean
    files: FleetFile[]
    downloadStatus: FleetDownloadStatus | null
}
