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

export interface FleetGcodesState {
    files: FleetGcodeFile[]
    loading: boolean
    pushing: Record<string, boolean>
    currentPath: string
    diskUsage: FleetDiskUsage | null
}
