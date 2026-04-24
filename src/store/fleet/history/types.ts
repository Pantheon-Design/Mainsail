export interface FleetHistoryRecord {
    id: string
    printer_hostname: string
    moonraker_job_id: string
    filename: string | null
    status: string | null
    start_time: string | null
    end_time: string | null
    print_duration_secs: number | null
    total_duration_secs: number | null
    filament_used_mm: number | null
    filament_type: string | null
    moonraker_user: string | null
    printer_model: string | null
    gcode_nozzle_size: number | null
    printer_nozzle_size: string | null
    printer_nozzle_type: string | null
    nozzle_life: number | null
    printer_nozzle_start_health: number | null
    filament_remaining_weight: number | null
    parts_printed: number
    parts_passed: number | null
    qc_status: string | null
    qc_inspector: string | null
    qc_date: string | null
    qc_note: string | null
    qr_code: string | null
    qr_linked_at: string | null
    spool_qr_code: string | null
    gcode_archive_hash: string | null
    telemetry_archive_path: string | null
    telemetry_archive_status: string | null
    collected_at: string
    parts_count?: number
}

export interface FleetAnalyticsKpis {
    total_jobs: number
    total_print_hours: number
    total_filament_kg: number
    jobs_30d: number
    print_hours_30d: number
    filament_kg_30d: number
    active_printers_30d: number
    completion_rate_30d: number
}

export interface FleetMonthlySummary {
    year_month: string
    jobs: number
    print_hours: number
    active_printers: number
    utilization_pct: number
}

export interface FleetFilamentSummary {
    filament_type: string
    jobs: number
    print_hours: number
    mass_kg: number
}

export interface FleetMonthlyFilament {
    year_month: string
    filament_type: string
    mass_kg: number
}

export interface FleetPrinterHealth {
    printer_hostname: string
    total_jobs: number
    failed_jobs: number
    health_pct: number
}

export interface FleetStatusSummary {
    status: string
    jobs: number
    print_hours: number
}

export interface FleetWeeklySuccessRate {
    week: string
    total_jobs: number
    completed_jobs: number
    success_rate: number
}

export interface FleetDailyUtilization {
    printer_hostname: string
    printer_model: string
    day: string
    print_hours: number
    utilization_pct: number
}

export interface FleetModelSummary {
    printer_model: string
    total_jobs: number
    completed_jobs: number
    failed_jobs: number
    print_hours: number
    filament_kg: number
    completion_rate: number
}

export interface FleetAnalytics {
    kpis: FleetAnalyticsKpis
    monthly_summary: FleetMonthlySummary[]
    filament_summary: FleetFilamentSummary[]
    monthly_filament: FleetMonthlyFilament[]
    printer_health: FleetPrinterHealth[]
    status_summary: FleetStatusSummary[]
    weekly_success_rate: FleetWeeklySuccessRate[]
    daily_utilization: FleetDailyUtilization[]
    model_summary: FleetModelSummary[]
}

export interface FleetPartAnalyticsKpis {
    total_inspected: number
    passed: number
    failed: number
    pending: number
    pass_rate: number
    fail_rate: number
    coverage_pct: number
    avg_turnaround_hours: number
}

export interface FleetWeeklyQcTrend {
    week: string
    total: number
    passed: number
    failed: number
    pass_rate: number
}

export interface FleetFailRateByPrinter {
    printer_hostname: string
    total: number
    failed: number
    fail_rate: number
}

export interface FleetFailRateByFilament {
    filament_type: string
    total: number
    failed: number
    fail_rate: number
}

export interface FleetFailRateBySpool {
    spool_qr_code: string
    total: number
    failed: number
    fail_rate: number
}

export interface FleetInspectorActivity {
    inspector: string
    inspected: number
    passed: number
    failed: number
    pass_rate: number
}

export interface FleetQcStatusSummary {
    status: string
    count: number
}

export interface FleetFailRateByNozzle {
    nozzle_size: number
    total: number
    failed: number
    fail_rate: number
}

export interface FleetTopFailingFile {
    filename: string
    total: number
    failed: number
    fail_rate: number
}

export interface FleetMonthlyQcSummary {
    year_month: string
    total: number
    passed: number
    failed: number
    pass_rate: number
}

export interface FleetQcTurnaround {
    week: string
    avg_hours: number
}

export interface FleetPartAnalytics {
    kpis: FleetPartAnalyticsKpis
    weekly_qc_trend: FleetWeeklyQcTrend[]
    fail_rate_by_printer: FleetFailRateByPrinter[]
    fail_rate_by_filament: FleetFailRateByFilament[]
    fail_rate_by_spool: FleetFailRateBySpool[]
    inspector_activity: FleetInspectorActivity[]
    qc_status_summary: FleetQcStatusSummary[]
    fail_rate_by_nozzle: FleetFailRateByNozzle[]
    top_failing_files: FleetTopFailingFile[]
    monthly_qc_summary: FleetMonthlyQcSummary[]
    qc_turnaround: FleetQcTurnaround[]
}

export interface FleetHistoryState {
    records: FleetHistoryRecord[]
    analytics: FleetAnalytics | null
    partAnalytics: FleetPartAnalytics | null
    loading: boolean
    analyticsLoading: boolean
    partAnalyticsLoading: boolean
    total: number
    devMode: boolean
}
