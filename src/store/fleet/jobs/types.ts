/**
 * Single source of truth for the fleet_daemon jobs API shapes
 * (GET /jobs, /jobs/{id}, /runs, /workers, /scheduler/status, /gcodes/{f}/meta).
 * Field names mirror the daemon rows exactly.
 */

export type JobStatus = 'pending' | 'in_progress' | 'on_hold' | 'complete' | 'cancelled'
export type JobPriority = 'low' | 'medium' | 'high'
export type JobType = 'sample' | 'production'
export type RunStatus = 'queued' | 'uploading' | 'starting' | 'printing' | 'success' | 'failed' | 'cancelled'
export type RunSource = 'auto' | 'manual'
export type FleetPrinterModel = 'HS-3' | 'HS-Pro' | 'Tallboi'
/** Value of the job-item model select: explicit 'any' = no constraint, null = let the daemon autofill. */
export type ItemPrinterModelChoice = FleetPrinterModel | 'any' | null

export const JOB_STATUSES: JobStatus[] = ['pending', 'in_progress', 'on_hold', 'complete', 'cancelled']
export const JOB_PRIORITIES: JobPriority[] = ['low', 'medium', 'high']
export const JOB_TYPES: JobType[] = ['sample', 'production']
export const ACTIVE_RUN_STATUSES: RunStatus[] = ['queued', 'uploading', 'starting', 'printing']
export const CLOSED_JOB_STATUSES: JobStatus[] = ['complete', 'cancelled']
export const FLEET_PRINTER_MODELS: FleetPrinterModel[] = ['HS-3', 'HS-Pro', 'Tallboi']

export interface FleetCustomer {
    id: number
    name: string
    contact: string | null
    notes: string | null
    created_at: string
    updated_at: string
    /** Added by GET /customers */
    job_count: number
}

export interface FleetJob {
    id: number
    customer_id: number | null
    /** Joined from fleet_customer */
    customer_name: string | null
    name: string
    description: string | null
    operator_name: string | null
    job_type: JobType
    priority: JobPriority
    status: JobStatus
    due_date: string | null
    started_at: string | null
    finished_at: string | null
    ready_to_ship: boolean
    shipped: boolean
    created_at: string
    updated_at: string
    // Aggregates from the list query
    items_count: number
    qty_total: number
    qty_done: number
    qty_active: number
    qty_failed: number
}

export interface FleetJobItem {
    id: number
    job_id: number
    gcode_filename: string
    quantity: number
    printer_model: FleetPrinterModel | null
    filament_type: string | null
    filament_grams: number | null
    nozzle_diameter: number | null
    notes: string | null
    created_at: string
    updated_at: string
    // Run counters from GET /jobs/{id}
    success_count: number
    active_count: number
    failed_count: number
    cancelled_count: number
    qc_passed: number
    qc_failed: number
    remaining: number
}

export interface FleetJobRun {
    id: number
    item_id: number
    job_id: number
    printer_hostname: string
    printer_filename: string
    status: RunStatus
    source: RunSource
    moonraker_job_id: string | null
    history_id: string | null
    dispatched_at: string
    started_at: string | null
    completed_at: string | null
    error: string | null
    notes: string | null
    // Joined fields
    gcode_filename: string
    job_name: string
    history_status: string | null
    print_duration_secs: number | null
    total_duration_secs: number | null
    filament_used_mm: number | null
    qc_status: string | null
    qc_inspector: string | null
    qc_date: string | null
    parts_printed: number | null
    parts_passed: number | null
    history_start_time: string | null
    history_end_time: string | null
}

export interface FleetJobDetail {
    job: FleetJob
    items: FleetJobItem[]
    runs: FleetJobRun[]
}

export interface FleetWorkerActiveRun {
    id: number
    job_id: number
    item_id: number
    printer_hostname: string
    status: RunStatus
    source: RunSource
    started_at: string | null
    dispatched_at: string
    job_name: string
    gcode_filename: string
}

export interface FleetWorkerMachineState {
    is_primed: number | null
    is_purging: number | null
    enable_prime: number | null
}

/** One row of GET /workers — every connected printer, worker or not. */
export interface FleetWorker {
    printer_hostname: string
    enabled: boolean
    note: string | null
    worker_updated_at: string | null
    printer_model: FleetPrinterModel | null
    in_printer_list: boolean
    connected: boolean
    klippy_state: string | null
    print_state: string | null
    filename: string | null
    progress: number | null
    filament_type: string | null
    remaining_weight: number | null
    nozzle_size: number | null
    machine_state: FleetWorkerMachineState | null
    primed: boolean | null
    eligible: boolean
    reason: string | null
    eval_item_id: number | null
    eval_job_name: string | null
    evaluated_at: string | null
    active_run: FleetWorkerActiveRun | null
}

/** Response of PATCH /workers/{hostname} and entries of POST /workers/bulk `updated`. */
export interface FleetWorkerRow {
    printer_hostname: string
    enabled: boolean
    note: string | null
    updated_at: string | null
}

export interface FleetSchedulerEval {
    eligible: boolean
    reason: string | null
    item_id: number | null
    job_name: string | null
    evaluated_at: string | null
}

export interface FleetSchedulerStatus {
    running: boolean
    interval_s: number
    require_primed: boolean
    filament_safety_factor: number
    filament_min_margin_g: number
    last_tick_at: string | null
    last_tick_ms: number | null
    last_error: string | null
    in_flight: Record<string, string>
    eval: Record<string, FleetSchedulerEval>
    pending_items?: number
    active_runs?: number
    enabled_workers?: number
    free_workers?: number
    db_error?: string
}

/** GET /gcodes/{filename}/meta */
export interface FleetGcodeMeta {
    filename: string
    size: number
    filament_type: string | null
    nozzle_diameter: number | null
    filament_used_g: number | null
    printer_model: FleetPrinterModel | null
}

// -- Request payloads -----------------------------------------------------------

export interface JobItemCreatePayload {
    gcode_filename: string
    quantity: number
    /** 'any' = explicitly unconstrained; null = let the daemon autofill (only when autofill_from_gcode) */
    printer_model?: ItemPrinterModelChoice
    filament_type?: string | null
    filament_grams?: number | null
    notes?: string | null
    /** false = the daemon must NOT read the gcode footer to fill blanks (UI prefills from the file name only) */
    autofill_from_gcode?: boolean
}

export interface JobItemUpdatePayload {
    quantity?: number
    printer_model?: ItemPrinterModelChoice
    filament_type?: string | null
    filament_grams?: number | null
    notes?: string | null
    autofill_from_gcode?: boolean
}

export interface JobCreatePayload {
    customer_id: number | null
    name: string
    description?: string | null
    operator_name?: string | null
    job_type: JobType
    priority: JobPriority
    /** ISO 8601 */
    due_date?: string | null
    items: JobItemCreatePayload[]
}

export interface JobUpdatePayload {
    customer_id?: number | null
    name?: string
    description?: string | null
    operator_name?: string | null
    job_type?: JobType
    priority?: JobPriority
    /** ISO 8601; '' clears */
    due_date?: string
    ready_to_ship?: boolean
    shipped?: boolean
}

export interface JobListFilters {
    status?: JobStatus
    customer_id?: number
    includeClosed?: boolean
    limit?: number
}

export interface RunListFilters {
    printer?: string
    status?: RunStatus
    job_id?: number
    active?: boolean
    limit?: number
}

export interface FleetJobsState {
    jobs: FleetJob[]
    currentJob: FleetJobDetail | null
    runs: FleetJobRun[]
    loading: boolean
    includeClosed: boolean
}

export interface FleetCustomersState {
    customers: FleetCustomer[]
    loading: boolean
}

export interface FleetWorkersState {
    workers: FleetWorker[]
    schedulerStatus: FleetSchedulerStatus | null
    loading: boolean
}
