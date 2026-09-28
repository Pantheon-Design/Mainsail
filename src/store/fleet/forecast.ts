/**
 * Pure helpers for the fleet dashboard forecast: remaining print time of a
 * printer, "finishes within N hours" buckets and compact duration / weight text.
 * No store access so every piece can be reasoned about (and unit-tested) alone.
 */
import { parsePrintTimeSecs } from '@/store/fleet/jobs/gcodeFilename'

export interface RemainingInput {
    /** slicer estimate for the running file (seconds), e.g. from GET /workers */
    estimated_time?: number | null
    /** print_stats.print_duration (seconds) when the daemon sends it */
    print_duration?: number | null
    /** virtual_sdcard.progress 0..1 */
    progress?: number | null
    /** file being printed; the `12h0m` name token is the fallback estimate */
    filename?: string | null
}

const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null)

/**
 * Seconds until the current print finishes, averaged over the estimates that
 * can be formed (like Mainsail's ETA): slicer time minus elapsed, elapsed
 * extrapolated by progress, or slicer time scaled by progress when only the
 * name token and progress are known (older daemon). Null when nothing fits.
 */
export function remainingSecs(input: RemainingInput): number | null {
    const est = num(input.estimated_time) ?? parsePrintTimeSecs(input.filename)
    const elapsed = num(input.print_duration)
    const progress = num(input.progress)
    const candidates: number[] = []
    if (est !== null && est > 0 && elapsed !== null && elapsed >= 0) {
        candidates.push(Math.max(0, est - elapsed))
    }
    if (elapsed !== null && elapsed > 0 && progress !== null && progress > 0.02) {
        candidates.push(Math.max(0, elapsed / Math.min(1, progress) - elapsed))
    }
    if (!candidates.length && est !== null && est > 0 && progress !== null && progress >= 0) {
        candidates.push(Math.max(0, est * (1 - Math.min(1, progress))))
    }
    if (!candidates.length) return null
    return candidates.reduce((a, b) => a + b, 0) / candidates.length
}

export interface FinishEntry {
    remaining: number | null
    isWorker: boolean
}

export interface FinishCount {
    workers: number
    others: number
}

export interface FinishBand extends FinishCount {
    /** e.g. `< 1h`, `1–2h`, `> 2h` */
    label: string
    /** upper bound in hours, null for the open-ended last band */
    upper: number | null
}

export interface FinishWithin extends FinishCount {
    hours: number
}

export interface FinishBuckets {
    intervals: number[]
    bands: FinishBand[]
    within: FinishWithin[]
    unknown: FinishCount
    total: FinishCount
}

/** Positive, unique, ascending hour marks; falls back to [1, 2] when nothing is valid. */
export function sanitizeIntervals(intervals: unknown): number[] {
    const arr = Array.isArray(intervals) ? intervals : []
    const out = Array.from(
        new Set(
            arr
                .map((v) => (typeof v === 'string' ? parseFloat(v) : v))
                .filter((v): v is number => typeof v === 'number' && isFinite(v) && v > 0)
                .map((v) => Math.round(v * 100) / 100)
        )
    ).sort((a, b) => a - b)
    return out.length ? out : [1, 2]
}

function fmtHours(h: number): string {
    return Number.isInteger(h) ? `${h}h` : `${h}h`
}

/**
 * Bucket printing printers by remaining time. Bands are exclusive (`< 1h`,
 * `1–2h`, `> 2h`); `within` is cumulative (`within 1h`, `within 2h`). Entries
 * without an estimate land in `unknown`. Each entry is split worker / other.
 */
export function bucketFinishes(entries: FinishEntry[], intervalsHours: unknown): FinishBuckets {
    const intervals = sanitizeIntervals(intervalsHours)
    const bands: FinishBand[] = intervals.map((h, i) => ({
        label: i === 0 ? `< ${fmtHours(h)}` : `${fmtHours(intervals[i - 1])} – ${fmtHours(h)}`,
        upper: h,
        workers: 0,
        others: 0,
    }))
    bands.push({ label: `> ${fmtHours(intervals[intervals.length - 1])}`, upper: null, workers: 0, others: 0 })
    const within: FinishWithin[] = intervals.map((h) => ({ hours: h, workers: 0, others: 0 }))
    const unknown: FinishCount = { workers: 0, others: 0 }
    const total: FinishCount = { workers: 0, others: 0 }
    const key = (e: FinishEntry): keyof FinishCount => (e.isWorker ? 'workers' : 'others')

    entries.forEach((e) => {
        total[key(e)]++
        if (e.remaining === null || !isFinite(e.remaining)) {
            unknown[key(e)]++
            return
        }
        const hours = Math.max(0, e.remaining) / 3600
        let placed = false
        for (const band of bands) {
            if (band.upper === null || hours < band.upper) {
                band[key(e)]++
                placed = true
                break
            }
        }
        if (!placed) bands[bands.length - 1][key(e)]++
        within.forEach((w) => {
            if (hours <= w.hours) w[key(e)]++
        })
    })
    return { intervals, bands, within, unknown, total }
}

/** `45m`, `5h 20m`, `1d 3h` (days drop the minutes). Null / 0 -> `0m`. */
export function formatHoursDh(secs: number | null | undefined): string {
    if (!secs || !isFinite(secs) || secs <= 0) return '0m'
    const totalMin = Math.round(secs / 60)
    const days = Math.floor(totalMin / 1440)
    const hours = Math.floor((totalMin % 1440) / 60)
    const mins = totalMin % 60
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return mins ? `${hours}h ${mins}m` : `${hours}h`
    return `${mins}m`
}

/** `869 g` below 1 kg, `1.24 kg` above. Null / 0 -> `0 g`. */
export function formatGrams(grams: number | null | undefined): string {
    if (!grams || !isFinite(grams) || grams <= 0) return '0 g'
    if (grams >= 1000) return `${(grams / 1000).toFixed(grams >= 10000 ? 1 : 2)} kg`
    return `${Math.round(grams)} g`
}
