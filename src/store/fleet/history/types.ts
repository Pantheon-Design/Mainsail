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
    parts_printed: number
    parts_passed: number | null
    qc_status: string | null
    qc_inspector: string | null
    qc_date: string | null
    collected_at: string
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
    day: string
    print_hours: number
    utilization_pct: number
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
}

export interface FleetHistoryState {
    records: FleetHistoryRecord[]
    analytics: FleetAnalytics | null
    loading: boolean
    analyticsLoading: boolean
    total: number
}
