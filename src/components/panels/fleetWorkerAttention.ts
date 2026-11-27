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

/** Short state label + chip colour for a next-gcode state. */
export const NEXT_GCODE_STATE_META: Record<string, { label: string; color: string }> = {
    waiting: { label: 'waiting', color: 'deep-purple' },
    dispatching: { label: 'starting', color: 'blue' },
    fallback_dispatching: { label: 'superseded', color: 'orange' },
    blocked: { label: 'blocked', color: 'orange' },
    holding: { label: 'holding', color: 'red' },
}

/** "14:05" today, else "Nov 27 14:05" (browser local time). */
export function nextGcodeClock(ts: string | null | undefined): string {
    if (!ts) return ''
    const d = new Date(ts)
    if (isNaN(d.getTime())) return ''
    const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (d.toDateString() === new Date().toDateString()) return hm
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${hm}`
}

/** "45 min" / "2 h" / "1 h 30 min" / "3 d". */
export function formatHoldMinutes(m: number): string {
    if (m % 1440 === 0) return `${m / 1440} d`
    if (m < 60) return `${m} min`
    return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`
}

/** Fallback / hold policy of a next-gcode, e.g. "no fallback · hold 30 min". Empty with fallback on. */
export function nextGcodePolicy(ng: FleetWorkerNextGcode): string {
    if (ng.fallback !== false) return ''
    return ng.hold_minutes
        ? `no fallback · hold ${formatHoldMinutes(ng.hold_minutes)}`
        : 'no fallback · hold indefinitely'
}

/** Hold-timer sentence for a no-fallback next-gcode ('' when not applicable). */
export function nextGcodeHoldText(ng: FleetWorkerNextGcode): string {
    if (ng.fallback !== false) return ''
    if (!ng.hold_minutes) return 'held until it can run or is changed/cleared'
    if (ng.hold_until) return `held until ${nextGcodeClock(ng.hold_until)}, then cleared and regular jobs resume`
    return `hold timer (${formatHoldMinutes(ng.hold_minutes)}) starts the first time it is blocked on a free printer`
}

/** One-line live state of a next-gcode (no leading indent). */
export function nextGcodeStateText(ng: FleetWorkerNextGcode): string {
    const why = ng.blocked_reason || 'unknown'
    const hold = nextGcodeHoldText(ng)
    switch (ng.state) {
        case 'waiting':
            return 'waiting for this printer to be free' + (hold && ng.hold_until ? `; ${hold}` : '')
        case 'dispatching':
            return 'starting now' + (ng.pending_run_id ? ` (run #${ng.pending_run_id})` : '')
        case 'fallback_dispatching':
            return `blocked${
                ng.pending_reason ? `: ${ng.pending_reason}` : ''
            }; a regular job is starting instead (clears the next-gcode)`
        case 'blocked':
            return `blocked: ${why} (regular jobs may run instead)`
        case 'holding':
            return `blocked: ${why}; printer kept idle — ${hold}`
    }
    return ng.state || ''
}

/** "set 14:05 by azi: “note”" ('' when nothing is known). */
export function nextGcodeSetText(ng: FleetWorkerNextGcode): string {
    const parts: string[] = []
    if (ng.set_at) parts.push(`set ${nextGcodeClock(ng.set_at)}`)
    if (ng.set_by) parts.push(`by ${ng.set_by}`)
    let s = parts.join(' ')
    if (ng.note) s = s ? `${s}: “${ng.note}”` : `note: “${ng.note}”`
    return s
}

/** Hover lines for a printer's next-gcode: [0] what is pinned, [1] its live state,
 *  then who set it (when known). Indented lines are detail. */
export function nextGcodeLines(ng: FleetWorkerNextGcode | null | undefined): string[] {
    if (!ng) return []
    const job = `job #${ng.job_id}${ng.job_name ? ` '${ng.job_name}'` : ''}`
    const tags = [nextGcodePolicy(ng), ng.next_gcode_only ? 'next-gcode-only job' : ''].filter(Boolean)
    const lines = [`Next-gcode: ${ng.gcode_filename} (${job})${tags.length ? ' · ' + tags.join(' · ') : ''}`]
    lines.push(`  ${nextGcodeStateText(ng)}`)
    const set = nextGcodeSetText(ng)
    if (set) lines.push(`  ${set}`)
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
