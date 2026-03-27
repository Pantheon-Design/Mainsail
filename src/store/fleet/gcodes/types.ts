export interface FleetGcodeFile {
    filename: string
    size: number
    modified: string
    modified_epoch: number
    age_days: number
    cached_on: string[]
}

export interface FleetGcodesState {
    files: FleetGcodeFile[]
    loading: boolean
    pushing: Record<string, boolean>
}
