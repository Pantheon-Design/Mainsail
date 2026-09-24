export interface FleetVendor {
    id: number
    name: string
    comment: string | null
    registered: string
}

export interface FleetFilament {
    id: number
    vendor_id: number | null
    vendor_name: string | null
    name: string | null
    material: string
    density: number
    diameter: number
    weight: number | null
    spool_weight: number | null
    color_hex: string | null
    settings_extruder_temp: number | null
    settings_bed_temp: number | null
    /** Hours in an oven before a spool of this filament counts as dry (null -> daemon default). */
    dry_time_hours: number | null
    comment: string | null
    registered: string
}

export interface FleetSpool {
    id: number
    filament_id: number
    qr_code: string | null
    initial_weight: number | null
    used_weight: number
    remaining_weight: number | null
    spool_weight: number | null
    location: string | null
    lot_nr: string | null
    comment: string | null
    archived: boolean
    first_used: string | null
    last_used: string | null
    last_printer: string | null
    loaded_on_printer: string | null
    // Oven placement (a spool is in at most one of {printer, oven}; see ARCHITECTURE.md "Ovens")
    in_oven: string | null
    oven_row: number | null
    oven_slot: number | null
    oven_loaded_at: string | null
    /** Effective dry time (filament value or daemon default), hours */
    dry_time_hours: number | null
    ready_at: string | null
    is_ready: boolean | null
    /** List/detail endpoints only */
    seconds_in_oven?: number | null
    registered: string
    // Joined fields from the API
    filament_name: string | null
    material: string | null
    density: number | null
    diameter: number | null
    color_hex: string | null
    filament_weight: number | null
    settings_extruder_temp: number | null
    settings_bed_temp: number | null
    vendor_id: number | null
    vendor_name: string | null
}

export interface FleetSpoolsState {
    vendors: FleetVendor[]
    filaments: FleetFilament[]
    spools: FleetSpool[]
    loading: boolean
}
