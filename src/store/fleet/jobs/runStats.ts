/**
 * Pure helper: turn a job item's run counters (from GET /jobs/{id}) into the
 * four-segment progress bar used by the job details dialog.
 *
 * Segments (left to right): QC passed (green) / success without QC (blue) /
 * QC failed (red, still counts as complete) / active (breathing blue) /
 * remaining (grey). Technical failures (run status = failed) are shown as a
 * separate badge and never consume bar width.
 *
 * A QC failure is a quality verdict on a finished print: the run is complete
 * and the job does not reopen; the failure is surfaced as a rate instead.
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
    qcFailed: number
}

export interface RunStats {
    quantity: number
    active: number
    /** success runs whose linked history has no QC verdict */
    successNoQc: number
    /** success runs whose linked history passed QC */
    qcPassed: number
    /** completed runs whose linked history failed QC (still complete; flagged) */
    qcFailed: number
    /** technical failures (run status = failed) */
    technicalFailed: number
    /** technical failures only (kept for callers that show a "failed" badge) */
    totalFailed: number
    /** QC-failed / QC-checked, 0..1; null when nothing was checked */
    qcFailRate: number | null
    /** active + all completed runs (QC passed, unchecked, or QC failed) */
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

    const totalFailed = technicalFailed
    const checked = qcPassed + qcFailed
    const qcFailRate = checked > 0 ? qcFailed / checked : null
    const good = active + success
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
        qcFailRate,
        good,
        remaining,
        percentages: {
            remaining: (remaining / safeTotal) * 100,
            active: (active / safeTotal) * 100,
            success: (successNoQc / safeTotal) * 100,
            passed: (qcPassed / safeTotal) * 100,
            qcFailed: (qcFailed / safeTotal) * 100,
        },
    }
}
