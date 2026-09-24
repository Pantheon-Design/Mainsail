import { FleetWorker } from '@/store/fleet/jobs/types'

/** Enabled worker that could take a job but is held back by something an
 *  operator can fix on the spot: not primed, or not enough filament. */
export function workerNeedsAttention(w: FleetWorker): boolean {
    if (!w.enabled || !w.connected) return false
    const r = (w.reason || '').toLowerCase()
    return r.startsWith('not primed') || (r.startsWith('filament') && r.includes('needed')) || r.startsWith('remaining_weight unknown')
}

/** Hostnames currently enabled as fleet workers. */
export function enabledWorkerHostnames(workers: FleetWorker[]): string[] {
    return workers.filter((w) => w.enabled).map((w) => w.printer_hostname)
}

/** Hostnames of workers that need attention (see workerNeedsAttention). */
export function attentionWorkerHostnames(workers: FleetWorker[]): string[] {
    return workers.filter((w) => workerNeedsAttention(w)).map((w) => w.printer_hostname)
}

/** hostname -> scheduler reason, for map tooltips and sticker titles. */
export function attentionWorkerReasons(workers: FleetWorker[]): Record<string, string> {
    const out: Record<string, string> = {}
    for (const w of workers) {
        if (workerNeedsAttention(w) && w.reason) out[w.printer_hostname] = w.reason
    }
    return out
}

/** Hover text for a "N need attention" chip: `host: reason` per worker, or what the chip means when 0. */
export function attentionChipTitle(hostnames: string[], reasons: Record<string, string>): string {
    if (!hostnames.length) return 'Workers that could run a job but are blocked by low filament or not primed'
    return hostnames.map((h) => (reasons[h] ? `${h}: ${reasons[h]}` : h)).join('\n')
}
