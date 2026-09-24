import { OvenFrame, OvenSpoolFrame } from '@/store/farm/types'

/**
 * Oven (filament dryer) status vocabulary for the fleet map. Ovens are not printers:
 * they never carry print_stats, so they get their own derivation and colors.
 *
 *  disconnected  no frame / daemon WS down / daemon has no WS to the oven -> grey
 *  error         Klipper webhooks.state shutdown|error                     -> red
 *  empty         online, no spools                                         -> neutral
 *  drying        online, at least one spool not yet ready                  -> amber
 *  ready         online, every spool ready                                 -> green
 */
export type OvenStatus = 'disconnected' | 'error' | 'empty' | 'drying' | 'ready'

export const OVEN_STATUS_META: Record<OvenStatus, { color: string; label: string }> = {
    ready: { color: 'hsl(90, 100%, 32%)', label: 'Ready' },
    drying: { color: '#ffa000', label: 'Drying' },
    empty: { color: '#607d8b', label: 'Empty' },
    error: { color: '#d32f2f', label: 'Error' },
    disconnected: { color: '#8a8a8a', label: 'Offline' },
}
export const OVEN_STATUS_ORDER: OvenStatus[] = ['drying', 'ready', 'empty', 'error', 'disconnected']

/** Legend entry shared by Farm.vue and FarmMapSection.vue (keep the two in sync via this). */
export const OVEN_LEGEND = { color: OVEN_STATUS_META.drying.color, label: 'Oven' }

export function getOvenStatus(frame: OvenFrame | null | undefined, fleetDaemonConnected: boolean): OvenStatus {
    if (!frame || !fleetDaemonConnected) return 'disconnected'
    if (frame.fleet_to_printer_ws === false) return 'disconnected'
    const st = frame.webhooks?.state
    if (st === 'shutdown' || st === 'error') return 'error'
    const total = frame.oven?.spool_count ?? frame.oven?.spools?.length ?? 0
    if (total === 0) return 'empty'
    const ready = frame.oven?.ready_count ?? (frame.oven?.spools ?? []).filter((s) => s.is_ready).length
    return ready < total ? 'drying' : 'ready'
}

export function ovenSpoolCount(frame: OvenFrame | null | undefined): number {
    return frame?.oven?.spool_count ?? frame?.oven?.spools?.length ?? 0
}

export function ovenReadyCount(frame: OvenFrame | null | undefined): number {
    return frame?.oven?.ready_count ?? (frame?.oven?.spools ?? []).filter((s) => s.is_ready).length
}

/** Marker glyph: `5` when every spool is ready (or none), else `2/5`. */
export function ovenGlyph(frame: OvenFrame | null | undefined): string {
    const total = ovenSpoolCount(frame)
    const ready = ovenReadyCount(frame)
    if (total === 0) return '0'
    return ready === total ? String(total) : `${ready}/${total}`
}

/**
 * Material with the most spools in the oven (ties -> alphabetical), computed from
 * `oven.spools[].material`; falls back to the daemon's `top_material` when the frame has
 * no spool list. `EMPTY` for an empty oven, `—` when there is no frame at all.
 */
export const OVEN_EMPTY_MATERIAL = 'EMPTY'
export function ovenTopMaterial(frame: OvenFrame | null | undefined): string {
    if (!frame) return '—'
    const spools = frame.oven?.spools
    if (Array.isArray(spools)) {
        if (spools.length === 0) return OVEN_EMPTY_MATERIAL
        const counts = new Map<string, number>()
        spools.forEach((s) => {
            const m = (s.material || '').trim() || 'unknown'
            counts.set(m, (counts.get(m) ?? 0) + 1)
        })
        let best = ''
        let bestN = -1
        counts.forEach((n, m) => {
            if (n > bestN || (n === bestN && m.localeCompare(best) < 0)) {
                best = m
                bestN = n
            }
        })
        return best
    }
    if (ovenSpoolCount(frame) === 0) return OVEN_EMPTY_MATERIAL
    const top = frame.oven?.top_material
    return top && String(top).trim() ? String(top).trim() : 'unknown'
}

/** True when the spool's dryer time has elapsed (server flag first, then the `ready_at` clock). */
export function ovenSpoolIsReady(spool: OvenSpoolFrame, now: number = Date.now()): boolean {
    if (spool.is_ready) return true
    if (spool.ready_at) {
        const t = new Date(spool.ready_at).getTime()
        return !isNaN(t) && t <= now
    }
    return false
}

/**
 * Fire colour on the oven marker, judged on the spools of the top material only
 * (the material printed on the icon):
 *   off    no fire: offline, Klipper error, or nothing loaded
 *   red    none of that material's spools are ready
 *   blue   at least one of them is ready
 *   green  all of them are ready
 * Without a per-spool list (daemon summary only) the oven-wide ready/total counts are used.
 */
export type OvenFire = 'off' | 'red' | 'blue' | 'green'
export function ovenFire(frame: OvenFrame | null | undefined, status: OvenStatus, now: number = Date.now()): OvenFire {
    if (!frame || status === 'disconnected' || status === 'error' || status === 'empty') return 'off'
    const spools = frame.oven?.spools
    let total: number
    let ready: number
    if (Array.isArray(spools)) {
        const top = ovenTopMaterial(frame)
        const ofType = spools.filter((s) => ((s.material || '').trim() || 'unknown') === top)
        total = ofType.length
        ready = ofType.filter((s) => ovenSpoolIsReady(s, now)).length
    } else {
        total = ovenSpoolCount(frame)
        ready = ovenReadyCount(frame)
    }
    if (total === 0) return 'off'
    if (ready === 0) return 'red'
    return ready < total ? 'blue' : 'green'
}

/**
 * Soft spool capacity: the roster's `maxSpools` first, then the daemon's `max_spools`,
 * then `shelf_rows * slots_per_row` from the oven config; null when none is known.
 */
export function ovenMaxSpools(frame: OvenFrame | null | undefined, rosterMax: number | null | undefined): number | null {
    const valid = (v: unknown): number | null => {
        const n = Number(v)
        return Number.isInteger(n) && n >= 1 ? n : null
    }
    const fromRoster = valid(rosterMax)
    if (fromRoster !== null) return fromRoster
    const fromFrame = valid(frame?.oven?.max_spools)
    if (fromFrame !== null) return fromFrame
    const cfg = frame?.oven?.config
    const rows = valid(cfg?.shelf_rows)
    const slots = valid(cfg?.slots_per_row)
    if (rows !== null && slots !== null) return rows * slots
    return null
}

/** Marker bottom row: `5/12`, `5/?` when the capacity is unknown, `?/12` without a frame. */
export function ovenCountText(frame: OvenFrame | null | undefined, max: number | null): string {
    const count = frame ? String(ovenSpoolCount(frame)) : '?'
    return `${count}/${max ?? '?'}`
}

/** Fullness 0..1 for the marker fill bar (clamped; 0 when the capacity is unknown). */
export function ovenFillFraction(frame: OvenFrame | null | undefined, max: number | null): number {
    if (!frame || !max) return 0
    return Math.min(ovenSpoolCount(frame) / max, 1)
}

/** True when the oven holds more spools than its soft capacity (allowed, just highlighted). */
export function ovenOverCapacity(frame: OvenFrame | null | undefined, max: number | null): boolean {
    if (!frame || !max) return false
    return ovenSpoolCount(frame) > max
}

/** Display label: configured `oven.config.label`, else the hostname without `.local`. */
export function ovenLabel(frame: OvenFrame | null | undefined, hostname: string): string {
    const label = frame?.oven?.config?.label
    if (label && String(label).trim()) return String(label).trim()
    return shortHostname(hostname)
}

export function shortHostname(hostname: string | null | undefined): string {
    return (hostname || '').replace(/\.local$/i, '')
}

/** `R1S3` for row 1 / slot 3 (1-based as sent by the daemon). */
export function ovenSlotLabel(row: number | null | undefined, slot: number | null | undefined): string {
    if (row == null || slot == null) return ''
    return `R${row}S${slot}`
}

/** `oven1 · R1S3` placement text for a spool in an oven. */
export function ovenPlacementText(
    ovenHostname: string | null | undefined,
    row: number | null | undefined,
    slot: number | null | undefined
): string {
    const host = shortHostname(ovenHostname)
    const slotText = ovenSlotLabel(row, slot)
    return slotText ? `${host} · ${slotText}` : host
}

/** `3h 12m` (or `45m`, `<1m`) until `readyAt`; empty when it is in the past or unknown. */
export function formatTimeLeft(readyAt: string | null | undefined, now: number = Date.now()): string {
    if (!readyAt) return ''
    const t = new Date(readyAt).getTime()
    if (isNaN(t)) return ''
    const diffMs = t - now
    if (diffMs <= 0) return ''
    const totalMin = Math.ceil(diffMs / 60000)
    if (totalMin < 1) return '<1m'
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    if (h === 0) return `${m}m`
    if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`
    return `${h}h ${m}m`
}

/**
 * Readiness text for a spool in an oven: `READY`, `3h 12m left`, or `—` when the ready time
 * is unknown. Uses `ready_at` first (client-side countdown), then the server `is_ready` flag.
 */
export function formatReadiness(
    readyAt: string | null | undefined,
    isReady: boolean | null | undefined,
    now: number = Date.now()
): string {
    if (readyAt) {
        const t = new Date(readyAt).getTime()
        if (!isNaN(t)) return t <= now ? 'READY' : `${formatTimeLeft(readyAt, now)} left`
    }
    if (isReady) return 'READY'
    return '—'
}

/** One tooltip line per spool: `QR123 · PA-CF · READY` / `QR123 · PA-CF · 3h 12m left`. */
export function ovenSpoolLine(spool: OvenSpoolFrame, now: number = Date.now()): string {
    const parts = [spool.qr_code, spool.material || 'unknown', formatReadiness(spool.ready_at, spool.is_ready, now)]
    const slot = ovenSlotLabel(spool.row, spool.slot)
    return (slot ? `${slot}  ` : '') + parts.join(' · ')
}

/** `pi_cpu 41.2°C` per sensor, sorted by name. */
export function ovenTemperatureLines(frame: OvenFrame | null | undefined): string[] {
    const temps = frame?.temperatures ?? {}
    return Object.keys(temps)
        .sort()
        .map((name) => {
            const v = temps[name]
            const text = typeof v === 'number' && !isNaN(v) ? `${v.toFixed(1)}°C` : '—'
            return `${name.replace(/^temperature_sensor\s+/, '')} ${text}`
        })
}
