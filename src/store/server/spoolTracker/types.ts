export interface ServerSpoolTrackerState {
    filament_type: string
    filament_name: string
    filament_specs: {
        density: number
        diameter: number
    }
    weights: {
        initial_weight: number
        used_weight: number
        remaining_weight: number
    }
    lengths: {
        used_length: number
        remaining_length: number
    }
    usage_percentage: number
    pending_usage_mm: number
    can_track: boolean
    timestamps: {
        first_used: string | null
        last_used: string | null
    }
    available_filaments: {
        predefined: string[]
        custom: string[]
        all: string[]
    }
}