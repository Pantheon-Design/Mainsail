/**
 * Pure helper: turn a job item's run counters (from GET /jobs/{id}) into the
 * four-segment progress bar used by the job details dialog.
 *
 * Segments (left to right): remaining (grey) / active (breathing blue) /
 * success without QC (blue) / QC passed (green). Failures are shown as a
 * separate red badge and never consume bar width.
 */

export interface RunStatsInput {
    quantity: number
    success_count: number
    active_count: number
    failed_count: number
    qc_passed?: number | null
    qc_failed?: number | null
}

export interface RunStatsPercentages {
    remaining: number
    active: number
    success: number
    passed: number
}

export interface RunStats {
    quantity: number
    active: number
    /** success runs whose linked history has no QC verdict */
    successNoQc: number
    /** success runs whose linked history passed QC */
    qcPassed: number
    /** runs whose linked history failed QC (counted as failures, not as good runs) */
    qcFailed: number
    /** technical failures (run status = failed) */
    technicalFailed: number
    /** technicalFailed + qcFailed */
    totalFailed: number
    /** active + successNoQc + qcPassed */
    good: number
    remaining: number
    percentages: RunStatsPercentages
}

const n = (v: number | null | undefined): number => (typeof v === 'number' && !isNaN(v) ? v : 0)

export function computeRunStats(item: RunStatsInput): RunStats {
    const quantity = Math.max(0, n(item.quantity))
    const active = Math.max(0, n(item.active_count))
    const success = Math.max(0, n(item.success_count))
    const technicalFailed = Math.max(0, n(item.failed_count))
    const qcPassed = Math.min(success, Math.max(0, n(item.qc_passed)))
    const qcFailed = Math.min(success - qcPassed, Math.max(0, n(item.qc_failed)))
    const successNoQc = Math.max(0, success - qcPassed - qcFailed)

    const totalFailed = technicalFailed + qcFailed
    const good = active + successNoQc + qcPassed
    const remaining = Math.max(0, quantity - good)
    const total = Math.max(quantity, good)
    const safeTotal = total > 0 ? total : 1

    return {
        quantity,
        active,
        successNoQc,
        qcPassed,
        qcFailed,
        technicalFailed,
        totalFailed,
        good,
        remaining,
        percentages: {
            remaining: (remaining / safeTotal) * 100,
            active: (active / safeTotal) * 100,
            success: (successNoQc / safeTotal) * 100,
            passed: (qcPassed / safeTotal) * 100,
        },
    }
}
