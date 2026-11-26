import { FleetSchedulerStatus, FleetWorker, FleetWorkerNextGcode } from '@/store/fleet/jobs/types'
import { hostKey } from '@/plugins/hostKey'

/** Daemon worker reason while a no-fallback next-gcode is blocked
 *  (fleet_job_scheduler.NG_HOLD_PREFIX): the printer is held idle. */
export const NEXT_GCODE_HOLD_PREFIX = 'next-gcode (no fallback) blocked'

/** Scheduler gate state the helpers below need; the full FleetSchedulerStatus also fits. */
export type SchedulerGate = Pick<FleetSchedulerStatus, 'storage_available' | 'force_dispatch'> | null | undefined

export const NAS_OFFLINE_REASON = 'Fleet cannot start jobs: NAS is offline (auto dispatch paused)'
export const NAS_FORCED_REASON =
    'NAS offline, forced dispatch on: a job starts here only if its file is already on this printer'

/** True while the daemon reports the gcode storage (NAS mount) down. */
export function nasDispatchBlocked(scheduler: SchedulerGate): boolean {
    return scheduler?.storage_available === false
}

/** Reason shown on every enabled worker while the NAS is down, or null when it is up. */
export function nasAttentionReason(scheduler: SchedulerGate): string | null {
    if (!nasDispatchBlocked(scheduler)) return null
    return scheduler?.force_dispatch ? NAS_FORCED_REASON : NAS_OFFLINE_REASON
}

/** Worker that is held back by something an operator can fix on the spot: not
 *  primed, not enough filament, or a worn-out / unset nozzle (mirrors
 *  fleet_job_scheduler.attention_category()); or — with `scheduler` given —
 *  any enabled worker while the NAS is offline, because Fleet cannot start
 *  jobs on it until the mount is back (or dispatch is forced).
 *  A printer in maintenance mode never needs attention: the scheduler just skips it. */
export function workerNeedsAttention(w: FleetWorker, scheduler?: SchedulerGate): boolean {
    if (!w.enabled) return false
    if (workerUnderMaintenance(w)) return false
    if (nasDispatchBlocked(scheduler)) return true
    if (!w.connected) return false
    const r = (w.reason || '').toLowerCase()
    return (
        r.startsWith('not primed') ||
        (r.startsWith('filament') && r.includes('needed')) ||
        r.startsWith('remaining_weight unknown') ||
        r.startsWith('nozzle worn out') ||
        r.startsWith('nozzle life not set') ||
        r.startsWith(NEXT_GCODE_HOLD_PREFIX) ||
        w.next_gcode?.state === 'holding'
    )
}

/** Worker entry for a hostname from any source (roster, daemon frame, worker list). */
export function workerForHost(workers: FleetWorker[], hostname: string | null | undefined): FleetWorker | undefined {
    const h = hostKey(hostname)
    if (!h) return undefined
    return workers.find((w) => hostKey(w.printer_hostname) === h)
}

/** Hover lines for a printer's next-gcode: what is pinned, then its live state. */
export function nextGcodeLines(ng: FleetWorkerNextGcode | null | undefined): string[] {
    if (!ng) return []
    const job = `job #${ng.job_id}${ng.job_name ? ` '${ng.job_name}'` : ''}`
    const lines = [`Next-gcode: ${ng.gcode_filename} (${job})${ng.fallback === false ? ' · no fallback' : ''}`]
    const why = ng.blocked_reason || 'unknown'
    switch (ng.state) {
        case 'waiting':
            lines.push('  waiting for this printer to be free')
            break
        case 'dispatching':
            lines.push('  starting now')
            break
        case 'fallback_dispatching':
            lines.push('  blocked; a regular job is starting instead (clears the next-gcode)')
            break
        case 'blocked':
            lines.push(`  blocked: ${why} (regular jobs may run instead)`)
            break
        case 'holding':
            lines.push(`  blocked: ${why}; printer kept idle (no fallback)`)
            break
    }
    return lines
}

/** Maintenance mode (set on the printer's KlipperScreen); daemon reason "under maintenance". */
export function workerUnderMaintenance(w: FleetWorker): boolean {
    return w.maintenance === true || w.machine_state?.is_maintenance === 1
}

/** Hostnames currently enabled as fleet workers. */
export function enabledWorkerHostnames(workers: FleetWorker[]): string[] {
    return workers.filter((w) => w.enabled).map((w) => w.printer_hostname)
}

/** Hostnames of workers that need attention (see workerNeedsAttention). */
export function attentionWorkerHostnames(workers: FleetWorker[], scheduler?: SchedulerGate): string[] {
    return workers.filter((w) => workerNeedsAttention(w, scheduler)).map((w) => w.printer_hostname)
}

/** hostname -> reason, for map tooltips and sticker titles. While the NAS is
 *  down the NAS reason comes first; a worker's own blocker follows it. */
export function attentionWorkerReasons(workers: FleetWorker[], scheduler?: SchedulerGate): Record<string, string> {
    const out: Record<string, string> = {}
    const nas = nasAttentionReason(scheduler)
    for (const w of workers) {
        if (!workerNeedsAttention(w, scheduler)) continue
        const own = workerNeedsAttention(w) ? w.reason || '' : ''
        const reason = nas ? (own ? `${nas}; also ${own}` : nas) : own
        if (reason) out[w.printer_hostname] = reason
    }
    return out
}

/** Hover text for a "N need attention" chip: `host: reason` per worker, or what the chip means when 0. */
export function attentionChipTitle(hostnames: string[], reasons: Record<string, string>): string {
    if (!hostnames.length)
        return 'Workers that could run a job but are blocked by low filament, not primed, a worn-out / unset nozzle, a blocked no-fallback next-gcode, or the NAS being offline'
    return hostnames.map((h) => (reasons[h] ? `${h}: ${reasons[h]}` : h)).join('\n')
}
