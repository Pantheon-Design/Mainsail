/**
 * Fleet map geometry + roster lookups shared by FarmMapSection (full map) and
 * DashboardFleetMap (condensed read-only map). Positions live on the
 * gui/remoteprinters roster: `location` (floor) and `gridPosition` (1-based cell).
 */
import { hostKey } from '@/plugins/hostKey'
import { PrinterModel } from '@/store/gui/remoteprinters/types'

export type MapLocation = 'farm' | 'ground'

export const MAP_LOCATIONS: { location: MapLocation; name: string }[] = [
    { location: 'farm', name: 'Print Farm' },
    { location: 'ground', name: 'Ground Floor' },
]

export const GRID_COLS = 25
/** Base cell size in px (the full map renders at this size; the dashboard scales it). */
export const CELL = 46

/** Rows per location: the Print Farm has one extra row along the bottom. */
export function gridRows(location: MapLocation): number {
    return location === 'farm' ? 13 : 12
}

/** Print Farm: thick separators after Post Processing (col 1) and each aisle boundary. */
export const FARM_DIVIDER_COLS = [1, 5, 9, 13, 17, 21]

/** Ground floor rooms in grid-cell units (1-based origin, width/height in cells). */
export const GROUND_ROOMS: {
    name: string
    gx: number
    gy: number
    wc: number
    hc: number
    side: 'left' | 'top' | 'bottom'
}[] = [
    { name: 'Production', gx: 1, gy: 1, wc: 3, hc: 12, side: 'left' },
    { name: 'R&D', gx: 4, gy: 1, wc: 22, hc: 9, side: 'top' },
    { name: 'Fulfilment', gx: 4, gy: 10, wc: 22, hc: 3, side: 'bottom' },
]

export interface GridPosition {
    x: number
    y: number
}

type Roster = Record<string, any>

function rosterEntry(roster: Roster, hostname: string): any | null {
    const key = hostKey(hostname)
    for (const entry of Object.values(roster)) {
        if (entry?.hostname && hostKey(entry.hostname) === key) return entry
    }
    return null
}

/** Floor of a printer; legacy roster entries without a location default to 'farm'. */
export function printerLocation(roster: Roster, hostname: string): MapLocation {
    return (rosterEntry(roster, hostname)?.location as MapLocation) ?? 'farm'
}

/** Grid cell of a printer; unplaced printers sit at (1,1) like the full map. */
export function printerGridPosition(roster: Roster, hostname: string): GridPosition {
    const pos = rosterEntry(roster, hostname)?.gridPosition
    return pos && typeof pos.x === 'number' && typeof pos.y === 'number' ? { x: pos.x, y: pos.y } : { x: 1, y: 1 }
}

export function printerModel(roster: Roster, hostname: string): PrinterModel | null {
    return rosterEntry(roster, hostname)?.printerModel ?? null
}

export function isOvenEntry(entry: any): boolean {
    return entry?.deviceType === 'oven'
}

/** Roster printers (not ovens) placed on a floor (deduplicated by hostname), sorted by hostname. */
export function printerHostnames(roster: Roster, location: MapLocation): string[] {
    const seen = new Set<string>()
    const out: string[] = []
    for (const entry of Object.values(roster)) {
        if (isOvenEntry(entry) || !entry?.hostname) continue
        if (((entry.location as MapLocation) ?? 'farm') !== location) continue
        const key = hostKey(entry.hostname)
        if (seen.has(key)) continue
        seen.add(key)
        out.push(entry.hostname)
    }
    return out.sort((a, b) => a.localeCompare(b))
}

/** Roster ovens placed on a floor (deduplicated by hostname), sorted by hostname. */
export function ovenHostnames(roster: Roster, location: MapLocation): string[] {
    const seen = new Set<string>()
    const out: string[] = []
    for (const entry of Object.values(roster)) {
        if (!isOvenEntry(entry) || !entry.hostname) continue
        if (((entry.location as MapLocation) ?? 'farm') !== location) continue
        const key = hostKey(entry.hostname)
        if (seen.has(key)) continue
        seen.add(key)
        out.push(entry.hostname)
    }
    return out.sort((a, b) => a.localeCompare(b))
}

export interface CropBox {
    /** first / last occupied column and row (1-based, inclusive) */
    minX: number
    minY: number
    maxX: number
    maxY: number
}

/**
 * Bounding box of the occupied cells plus `margin` cells on every side,
 * clamped to the grid. Null when nothing is placed.
 */
export function cropBox(positions: GridPosition[], location: MapLocation, margin = 1): CropBox | null {
    if (!positions.length) return null
    const rows = gridRows(location)
    let minX = GRID_COLS
    let minY = rows
    let maxX = 1
    let maxY = 1
    positions.forEach((p) => {
        minX = Math.min(minX, p.x)
        minY = Math.min(minY, p.y)
        maxX = Math.max(maxX, p.x)
        maxY = Math.max(maxY, p.y)
    })
    return {
        minX: Math.max(1, minX - margin),
        minY: Math.max(1, minY - margin),
        maxX: Math.min(GRID_COLS, maxX + margin),
        maxY: Math.min(rows, maxY + margin),
    }
}
