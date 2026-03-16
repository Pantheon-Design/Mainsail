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
