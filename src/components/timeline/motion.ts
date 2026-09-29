import { ActivityEvent } from '@/components/timeline/types'

/**
 * Motion travel snapshot attached by the Moonraker `activity` component to
 * lubrication / belts-motion service events (`details.motion`, spool_tracker
 * odometer + tripmeter in mm at the time of the service) plus the travel since
 * the previous service of the same type (`details.motion_since_last`).
 * The fleet-host build also gets both synthesised from the daemon's flattened
 * columns when the printer did not record them (source 'daemon').
 */
export interface AxisValues {
    x: number | null
    y: number | null
    z: number | null
    e: number | null
}

export interface MotionSnapshot {
    odometer: AxisValues
    tripmeter: AxisValues | null
    captured_at: number | null
    /** 'live' (counters at record time) | 'daily_snapshot' (backdated service: that day's snapshot) */
    basis: string | null
    /** local day of a daily_snapshot basis, YYYY-MM-DD */
    day: string | null
    /** 'printer' (recorded on the printer) | 'daemon' (estimated from daily snapshots) */
    source: string
}

export interface MotionSinceLast extends AxisValues {
    days: number | null
    prev_event_id: string | null
    /** epoch seconds of the previous same-type service */
    prev_ts: number | null
    /** 'printer' | 'daemon' */
    source: string
}

export const motionAxes: (keyof AxisValues)[] = ['x', 'y', 'z', 'e']

/** Service types that carry a motion snapshot (activity.py MOTION_SERVICE_TYPES). */
export const motionServiceTypes = ['lubrication', 'belts_motion']

function toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(n) ? n : null
}

function toAxes(raw: unknown): AxisValues | null {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    const out: AxisValues = { x: toNumber(r.x), y: toNumber(r.y), z: toNumber(r.z), e: toNumber(r.e) }
    if (motionAxes.every((axis) => out[axis] === null)) return null

    return out
}

export function normalizeMotion(raw: unknown): MotionSnapshot | null {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    const odometer = toAxes(r.odometer)
    if (!odometer) return null

    return {
        odometer,
        tripmeter: toAxes(r.tripmeter),
        captured_at: toNumber(r.captured_at),
        basis: (r.basis as string | null | undefined) ?? null,
        day: (r.day as string | null | undefined) ?? null,
        source: (r.source as string | null | undefined) ?? 'printer',
    }
}

export function normalizeMotionSinceLast(raw: unknown): MotionSinceLast | null {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    const prevId = (r.prev_event_id as string | null | undefined) ?? null
    const axes = toAxes(r) ?? { x: null, y: null, z: null, e: null }
    const days = toNumber(r.days)
    if (!prevId && days === null && motionAxes.every((axis) => axes[axis] === null)) return null

    return {
        ...axes,
        days,
        prev_event_id: prevId,
        prev_ts: toNumber(r.prev_ts),
        source: (r.source as string | null | undefined) ?? 'printer',
    }
}

export function isMotionServiceEvent(event: ActivityEvent): boolean {
    return event.type === 'service' && motionServiceTypes.includes(event.details?.service_type)
}

/** Travel counters at the moment of the service. */
export function getMotion(event: ActivityEvent): MotionSnapshot | null {
    return normalizeMotion(event.details?.motion)
}

/** Travel since the previous service of the same type (null = baseline / unknown). */
export function getMotionSinceLast(event: ActivityEvent): MotionSinceLast | null {
    return normalizeMotionSinceLast(event.details?.motion_since_last)
}

/** mm -> '—' | '523 mm' | '12.3 m' | '1.23 km' */
export function formatDistance(mm: number | null | undefined): string {
    if (mm === null || mm === undefined || !Number.isFinite(mm)) return '—'
    if (mm < 1000) return `${Math.round(mm)} mm`
    if (mm < 1e6) return `${(mm / 1000).toFixed(1)} m`
    return `${(mm / 1e6).toFixed(2)} km`
}

/** X + Y travel, or null when either axis is unknown. */
export function xyTravel(s: AxisValues | null): number | null {
    if (!s || s.x === null || s.y === null) return null
    return s.x + s.y
}

/** Keys rendered by the dedicated motion block, not the generic details table. */
export const motionDetailKeys = ['motion', 'motion_since_last']
