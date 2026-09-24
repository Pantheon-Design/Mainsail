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

export const OVEN_EMPTY_MATERIAL = 'EMPTY'

/** Per-spool weights in grams; null when unknown. */
export interface OvenSpoolWeights {
    remaining: number | null
    /** grams the spool holds when full (initial weight) */
    capacity: number | null
}
/** Fallback weights by QR code (the fleet spool list) for frames whose spools carry no
 *  weight fields (older daemons / oven firmware). */
export type OvenWeightLookup = (qrCode: string) => OvenSpoolWeights | null | undefined

export function ovenSpoolMaterial(spool: OvenSpoolFrame): string {
    return (spool.material || '').trim() || 'unknown'
}

const nonNegative = (v: unknown): number | null => {
    if (v == null || v === '') return null
    const n = Number(v)
    return isFinite(n) && n >= 0 ? n : null
}

/** Weights for one oven spool: the frame's own fields first, then the lookup fallback. */
export function ovenSpoolWeights(spool: OvenSpoolFrame, lookup?: OvenWeightLookup): OvenSpoolWeights {
    let remaining = nonNegative(spool.remaining_weight)
    let capacity = nonNegative(spool.initial_weight)
    if ((remaining === null || capacity === null) && lookup && spool.qr_code) {
        const fb = lookup(spool.qr_code)
        if (fb) {
            if (remaining === null) remaining = nonNegative(fb.remaining)
            if (capacity === null) capacity = nonNegative(fb.capacity)
        }
    }
    return { remaining, capacity }
}

export interface OvenMaterialStat {
    material: string
    count: number
    /** spools whose dryer time has elapsed (see ovenSpoolIsReady); drying = count - ready */
    ready: number
    /** grams left across the weighed spools of this material */
    remaining: number
    /** grams those same spools hold when full */
    capacity: number
    /** spools with both weights known (the only ones counted in remaining/capacity) */
    weighed: number
}

/**
 * Per-material spool counts, readiness and weights, best first: most spools, then (tie) most
 * filament left by weight, then name. Only spools with both weights known contribute to the sums.
 */
export function ovenMaterialStats(
    frame: OvenFrame | null | undefined,
    lookup?: OvenWeightLookup,
    now: number = Date.now()
): OvenMaterialStat[] {
    const spools = frame?.oven?.spools
    if (!Array.isArray(spools)) return []
    const stats = new Map<string, OvenMaterialStat>()
    spools.forEach((s) => {
        const m = ovenSpoolMaterial(s)
        const st = stats.get(m) ?? { material: m, count: 0, ready: 0, remaining: 0, capacity: 0, weighed: 0 }
        st.count++
        if (ovenSpoolIsReady(s, now)) st.ready++
        const w = ovenSpoolWeights(s, lookup)
        if (w.remaining !== null && w.capacity !== null && w.capacity > 0) {
            st.remaining += w.remaining
            st.capacity += w.capacity
            st.weighed++
        }
        stats.set(m, st)
    })
    return [...stats.values()].sort(
        (a, b) => b.count - a.count || b.remaining - a.remaining || a.material.localeCompare(b.material)
    )
}

/**
 * Material shown on the marker: the one with the most spools; a tie goes to the one with
 * more filament left by weight (see ovenMaterialStats). Falls back to the daemon's
 * `top_material` when the frame has no spool list. `EMPTY` for an empty oven, `—` without a frame.
 */
export function ovenTopMaterial(frame: OvenFrame | null | undefined, lookup?: OvenWeightLookup): string {
    if (!frame) return '—'
    if (Array.isArray(frame.oven?.spools)) {
        const stats = ovenMaterialStats(frame, lookup)
        return stats.length ? stats[0].material : OVEN_EMPTY_MATERIAL
    }
    if (ovenSpoolCount(frame) === 0) return OVEN_EMPTY_MATERIAL
    const top = frame.oven?.top_material
    return top && String(top).trim() ? String(top).trim() : 'unknown'
}

/** Fill bar for the shown material: grams left / grams when full over its weighed spools; null when unknown. */
export function ovenMaterialFill(frame: OvenFrame | null | undefined, lookup?: OvenWeightLookup): number | null {
    const top = ovenMaterialStats(frame, lookup)[0]
    if (!top || top.capacity <= 0) return null
    return Math.max(0, Math.min(1, top.remaining / top.capacity))
}

/** `2.4kg` / `850g`. */
export function formatWeight(grams: number): string {
    return grams >= 1000 ? `${(grams / 1000).toFixed(grams >= 10000 ? 0 : 1)}kg` : `${Math.round(grams)}g`
}

/** Tooltip text: `PC-PBT · 2.0kg / 3.0kg (67%)`; just the name when no weights are known. */
export function ovenTopMaterialDetail(frame: OvenFrame | null | undefined, lookup?: OvenWeightLookup): string {
    const top = ovenMaterialStats(frame, lookup)[0]
    if (!top) return ovenTopMaterial(frame, lookup)
    if (top.capacity <= 0) return top.material
    const pct = Math.round((top.remaining / top.capacity) * 100)
    const partial = top.weighed < top.count ? ` · ${top.weighed}/${top.count} spools weighed` : ''
    return `${top.material} · ${formatWeight(top.remaining)} / ${formatWeight(top.capacity)} (${pct}%)${partial}`
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
 * Fire colour on the oven marker, judged on the spools of the shown (top) material only:
 *   off    no fire: offline, Klipper error, or nothing loaded
 *   red    none of that material's spools are ready
 *   blue   at least one of them is ready
 *   green  all of them are ready
 * Without a per-spool list (daemon summary only) the oven-wide ready/total counts are used.
 */
export type OvenFire = 'off' | 'red' | 'blue' | 'green'
export function ovenFire(
    frame: OvenFrame | null | undefined,
    status: OvenStatus,
    lookup?: OvenWeightLookup,
    now: number = Date.now()
): OvenFire {
    if (!frame || status === 'disconnected' || status === 'error' || status === 'empty') return 'off'
    const spools = frame.oven?.spools
    let total: number
    let ready: number
    if (Array.isArray(spools)) {
        const top = ovenTopMaterial(frame, lookup)
        const ofType = spools.filter((s) => ovenSpoolMaterial(s) === top)
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

/**
 * The oven's own temperature for the tooltip: the sensor named like "oven" first, else the
 * first sensor that is not a Pi/CPU probe, else the first one; `—` when nothing is reported.
 */
export function ovenTemperatureText(frame: OvenFrame | null | undefined): string {
    const temps = frame?.temperatures ?? {}
    const names = Object.keys(temps).sort()
    const pick = names.find((n) => /oven/i.test(n)) ?? names.find((n) => !/cpu|\bpi\b|_pi/i.test(n)) ?? names[0]
    if (!pick) return '—'
    const v = temps[pick]
    return typeof v === 'number' && !isNaN(v) ? `${v.toFixed(1)}°C` : '—'
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
