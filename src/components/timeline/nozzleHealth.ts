import { ActivityEvent } from '@/components/timeline/types'

/**
 * Nozzle health snapshot attached by the Moonraker `activity` component to
 * nozzle_set / nozzle_life_reset / service:nozzle_change events
 * (`details.nozzle_health`, plus `details.nozzle_health_after` on a reset).
 * The fleet-host build also gets one synthesised from the daemon's flattened
 * columns when the printer did not record a snapshot (source 'daemon').
 */
export interface NozzleHealth {
    nozzle_life: number | null
    remaining_nozzle_life: number | null
    health_pct: number | null
    nozzle_size: string | number | null
    nozzle_type: string | null
    odometer_e?: number | null
    filament_type?: string | null
    captured_at?: number | null
    /** 'printer' (recorded on the printer) | 'daemon' (estimated from a daily snapshot) */
    source?: string | null
}

function toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(n) ? n : null
}

export function normalizeNozzleHealth(raw: unknown): NozzleHealth | null {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    const life = toNumber(r.nozzle_life)
    const remaining = toNumber(r.remaining_nozzle_life)
    let pct = toNumber(r.health_pct)
    if (pct === null && life && remaining !== null) pct = (remaining / life) * 100
    if (pct !== null) pct = Math.max(0, Math.min(100, pct))
    if (life === null && remaining === null && pct === null) return null

    return {
        nozzle_life: life,
        remaining_nozzle_life: remaining,
        health_pct: pct,
        nozzle_size: (r.nozzle_size as string | number | null | undefined) ?? null,
        nozzle_type: (r.nozzle_type as string | null | undefined) ?? null,
        odometer_e: toNumber(r.odometer_e),
        filament_type: (r.filament_type as string | null | undefined) ?? null,
        captured_at: toNumber(r.captured_at),
        source: (r.source as string | null | undefined) ?? 'printer',
    }
}

export function isNozzleChangeEvent(event: ActivityEvent): boolean {
    if (event.type === 'nozzle_set' || event.type === 'nozzle_life_reset') return true
    return event.type === 'service' && event.details?.service_type === 'nozzle_change'
}

/** Health of the nozzle at the moment of the change (before a reset). */
export function getNozzleHealth(event: ActivityEvent): NozzleHealth | null {
    return normalizeNozzleHealth(event.details?.nozzle_health)
}

/** Health right after a nozzle_life_reset. */
export function getNozzleHealthAfter(event: ActivityEvent): NozzleHealth | null {
    return normalizeNozzleHealth(event.details?.nozzle_health_after)
}

/** Same thresholds as FleetMaintenanceAnalytics.nozzleColor */
export function nozzleHealthColor(pct: number | null | undefined): string {
    if (pct === null || pct === undefined) return 'grey'
    if (pct < 20) return 'error'
    if (pct < 50) return 'warning'
    return 'success'
}

export function formatKg(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—'
    return `${value.toFixed(2)} kg`
}

export function formatPct(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—'
    return `${Math.round(value)}%`
}

/** "0.4 mm hardened", "0.4 mm", "hardened" or '' */
export function formatNozzle(h: NozzleHealth | null): string {
    if (!h) return ''
    const parts: string[] = []
    if (h.nozzle_size !== null && h.nozzle_size !== undefined && h.nozzle_size !== '') parts.push(`${h.nozzle_size} mm`)
    if (h.nozzle_type) parts.push(String(h.nozzle_type))
    return parts.join(' ')
}

/** Keys rendered by the dedicated nozzle-health block, not the generic details table. */
export const nozzleHealthDetailKeys = ['nozzle_health', 'nozzle_health_after']
