import { FleetPrinterModel } from './types'

/**
 * Hints parsed from a gcode FILE NAME only (never from file contents).
 *
 * Expected slicer naming, e.g.
 *   Cube_PETG-CF_10h11m_787.858g.gcode
 *   HS-Pro_0.2mm_tallbunny_PETG-CF_13h26m_258.879g.gcode
 *
 * Rules:
 *  - printer model: only when the name STARTS with a model token
 *    (HS-Pro / HS-3 / Tallboi, separators - _ space optional)
 *  - filament type: an underscore-delimited token matching a known material
 *  - grams: a token like `787.858g`
 *  - anything not found is returned as null and the form leaves it blank
 */
export interface ParsedGcodeFilename {
    printer_model: FleetPrinterModel | null
    filament_type: string | null
    filament_grams: number | null
    /** only from an explicit token such as `0.6n`, `n0.6`, `0.6nozzle`, `nozzle0.6` */
    nozzle_diameter: number | null
    quantity: number | null
}

/** Known filament tokens, longest first so PETG-CF wins over PETG. */
const FILAMENT_TOKENS: string[] = ['PETG-CF', 'PETG-GF', 'PA-CF', 'PA-GF', 'PA6-CF', 'PC-CF', 'ABS-CF', 'ASA-CF', 'PETG', 'PLA', 'ABS', 'ASA', 'TPU', 'PA', 'PC', 'PP']

const MODEL_PREFIXES: Array<[RegExp, FleetPrinterModel]> = [
    [/^hs[-_ ]?pro(?![a-z0-9])/i, 'HS-Pro'],
    [/^hs[-_ ]?3(?![0-9])/i, 'HS-3'],
    [/^tall[-_ ]?boi(?![a-z0-9])/i, 'Tallboi'],
]

function stem(filename: string): string {
    const base = filename.split('/').pop() ?? filename
    return base.replace(/\.(gcode|gco|g)$/i, '')
}

export function parsePrinterModel(filename: string): FleetPrinterModel | null {
    const s = stem(filename)
    for (const [re, model] of MODEL_PREFIXES) {
        if (re.test(s)) return model
    }
    return null
}

export function parseFilamentType(filename: string): string | null {
    const tokens = stem(filename)
        .split(/[_\s]+/)
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean)
    for (const known of FILAMENT_TOKENS) {
        if (tokens.includes(known.toUpperCase())) return known
    }
    return null
}

export function parseFilamentGrams(filename: string): number | null {
    const tokens = stem(filename).split(/[_\s]+/)
    for (const t of tokens) {
        const m = t.match(/^(\d+(?:\.\d+)?)g$/i)
        if (m) {
            const g = parseFloat(m[1])
            if (g > 0) return Math.round(g * 10) / 10
        }
    }
    return null
}

export function parseNozzle(filename: string): number | null {
    const tokens = stem(filename).split(/[_\s]+/)
    for (const t of tokens) {
        const m = t.match(/^(?:n|nozzle)(\d(?:\.\d+)?)$/i) ?? t.match(/^(\d(?:\.\d+)?)(?:n|nozzle)$/i)
        if (m) {
            const n = parseFloat(m[1])
            if (n > 0 && n <= 2) return n
        }
    }
    return null
}

export function parseQuantity(filename: string): number | null {
    const lower = stem(filename).toLowerCase()
    const m =
        lower.match(/(?:^|[^a-z0-9])(?:x|qty|quantity|runs?)[_\-\s]?(\d{1,4})(?![a-z0-9])/) ??
        lower.match(/(?:^|[^a-z0-9])(\d{1,4})x(?![a-z0-9])/)
    if (m) {
        const q = parseInt(m[1], 10)
        if (q > 0) return q
    }
    return null
}

export function parseGcodeFilename(filename: string): ParsedGcodeFilename {
    return {
        printer_model: parsePrinterModel(filename),
        filament_type: parseFilamentType(filename),
        filament_grams: parseFilamentGrams(filename),
        nozzle_diameter: parseNozzle(filename),
        quantity: parseQuantity(filename),
    }
}
