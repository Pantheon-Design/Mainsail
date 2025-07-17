export interface FleetJobsState {
    jobs: FleetJob[]
    customers: FleetCustomer[]
    loading: boolean
}

export interface FleetJob {
    id: string
    customer_id: string
    name: string
    operator_name?: string
    description?: string
    job_type: string
    priority: string
    status: string
    ready_to_ship: boolean
    shipped: boolean
    fulfilled_date?: string
    due_date?: string
    finished_date?: string
    created_at: string
    updated_at: string
}

export interface FleetCustomer {
    id: string
    name: string
    notes?: string
    created_at: string
    updated_at: string
}

export interface FleetJobGcode {
    id: string
    job_id: string
    gcode_filename: string
    required_runs: number
    preferred_printer: string
    filament_type: string
    created_at: string
}


export interface FleetJobGcodeRun {
    id: string
    job_gcode_id: string
    printer_hostname: string
    started_at: string
    completed_at?: string
    status: string  // 'in_progress', 'success', 'fail', 'cancelled'
    moonraker_job_id?: string
    notes?: string
    qc?: string  // 'pass', 'fail', or null
}

export interface FleetJobGcodeRunCreate {
    printer_hostname: string
    moonraker_job_id?: string
    notes?: string
}

export interface FleetJobGcodeRunUpdate {
    printer_hostname?: string
    status?: string
    moonraker_job_id?: string
    notes?: string
    qc?: string
    completed_at?: string
}
