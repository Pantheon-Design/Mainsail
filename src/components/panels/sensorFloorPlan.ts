/**
 * Air sensor floor plan (Air Quality page + history): the CAD-based SF office plans,
 * separate from the printer grid map (farmMapGeometry.ts / FarmMapSection.vue).
 *
 * Coordinates: every layer (background, floor mask, sensor positions) shares one
 * 1200 × 980 SVG canvas. The building origin is SVG (40, 40) and the scale is
 * 1120 / 38 SVG units per metre (source: Fusion document "645 Mariposa Detailed Layout",
 * package pantheon-fleet-floor-plans 2026-10-27 v1).
 *
 * Sensor placement lives on the gui/remoteprinters roster entry as
 * `mapPosition: { layoutId, x, y }` (SVG units). It is separate from `gridPosition`,
 * which stays the printer-grid cell and is left untouched for sensors.
 */
import { hostKey } from '@/plugins/hostKey'
import { MapLocation } from '@/components/panels/farmMapGeometry'

export const SENSOR_LAYOUT_ID = 'pantheon-sf-office-v1'

export const PLAN_WIDTH = 1200
export const PLAN_HEIGHT = 980
/** SVG units per metre on the plan. */
export const PLAN_UNITS_PER_METRE = 1120 / 38

export interface SensorFloor {
    location: MapLocation
    name: string
    background: string
    /** luminance mask: white = floor, black = void / outside (air field only) */
    mask: string
}

const PLAN_DIR = '/img/floorplans/sf/'

export const SENSOR_FLOORS: SensorFloor[] = [
    {
        location: 'farm',
        name: 'Upstairs + Mezzanine',
        background: PLAN_DIR + 'upstairs.svg',
        mask: PLAN_DIR + 'upstairs-floor-mask.svg',
    },
    {
        location: 'ground',
        name: 'Ground Floor',
        background: PLAN_DIR + 'downstairs.svg',
        mask: PLAN_DIR + 'downstairs-floor-mask.svg',
    },
]

export interface SensorMapPosition {
    layoutId: string
    x: number
    y: number
}

/**
 * Surveyed AirGradient positions (CAD sensor bodies + marked-up screenshots, 2026-10-27),
 * keyed by serial. Used until a sensor has a saved `mapPosition` for this layout; the
 * "Apply surveyed positions" button writes them (with the floor) to the roster.
 */
export const SURVEYED_SENSOR_ANCHORS: {
    serial: string
    name: string
    location: MapLocation
    x: number
    y: number
}[] = [
    { serial: 'f85b1b005354', name: 'Electronics rack', location: 'farm', x: 777.336, y: 341.155 },
    { serial: 'f85b1b004ba8', name: 'Mezzanine', location: 'farm', x: 236.212, y: 766.135 },
    { serial: 'a0f262dc4620', name: 'Haas / production', location: 'ground', x: 981.024, y: 45.334 },
    { serial: '80f1b25b5790', name: 'Ground-floor QC', location: 'ground', x: 227.534, y: 282.442 },
    { serial: '80f1b267ee28', name: 'R&D', location: 'ground', x: 984.821, y: 637.393 },
]

/** AirGradient serial from `sensorSerial` or an `airgradient_<serial>[.local]` hostname. */
export function sensorSerialOf(entry: any): string | null {
    const explicit = String(entry?.sensorSerial ?? '')
        .trim()
        .toLowerCase()
    if (explicit) return explicit
    const m = /^airgradient_([0-9a-f]{12})$/.exec(hostKey(String(entry?.hostname ?? '')))
    return m ? m[1] : null
}

export function surveyedAnchor(entry: any) {
    const serial = sensorSerialOf(entry)
    return serial ? SURVEYED_SENSOR_ANCHORS.find((a) => a.serial === serial) ?? null : null
}

function isFiniteNum(v: unknown): v is number {
    return typeof v === 'number' && Number.isFinite(v)
}

/** Saved position on this layout, or null (other layout / missing / out of bounds). */
export function savedMapPosition(entry: any): { x: number; y: number } | null {
    const p = entry?.mapPosition
    if (!p || p.layoutId !== SENSOR_LAYOUT_ID || !isFiniteNum(p.x) || !isFiniteNum(p.y)) return null
    if (p.x < 0 || p.x > PLAN_WIDTH || p.y < 0 || p.y > PLAN_HEIGHT) return null
    return { x: p.x, y: p.y }
}

export interface ResolvedSensorPlacement {
    location: MapLocation
    x: number
    y: number
    /** 'saved' = roster mapPosition; 'surveyed' = package default not yet written to the roster */
    source: 'saved' | 'surveyed'
}

/**
 * Where a sensor is drawn: its saved mapPosition on its roster floor; otherwise its
 * surveyed anchor (with the surveyed floor); otherwise null = unplaced.
 */
export function resolveSensorPlacement(entry: any): ResolvedSensorPlacement | null {
    const saved = savedMapPosition(entry)
    if (saved) return { location: (entry?.location as MapLocation) ?? 'farm', ...saved, source: 'saved' }
    const anchor = surveyedAnchor(entry)
    if (anchor) return { location: anchor.location, x: anchor.x, y: anchor.y, source: 'surveyed' }
    return null
}

/** Uniform fit of the plan into a display box (letterboxed, centred). */
export function fitPlan(width: number, height: number): { scale: number; offsetX: number; offsetY: number } {
    const scale = Math.min(width / PLAN_WIDTH, height / PLAN_HEIGHT)
    return { scale, offsetX: (width - PLAN_WIDTH * scale) / 2, offsetY: (height - PLAN_HEIGHT * scale) / 2 }
}

export function clampToPlan(x: number, y: number): { x: number; y: number } {
    return {
        x: Math.min(PLAN_WIDTH, Math.max(0, x)),
        y: Math.min(PLAN_HEIGHT, Math.max(0, y)),
    }
}

/** Round to 0.1 SVG unit (≈ 3 mm) so repeated saves don't accumulate float noise. */
export function roundPlan(v: number): number {
    return Math.round(v * 10) / 10
}
