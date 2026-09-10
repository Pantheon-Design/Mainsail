import { FleetPrinterModel } from './types'

/**
 * Best-effort hints parsed from a gcode filename, used by the job form only
 * to fill fields the daemon's gcode metadata could not provide.
 * Ported from the Fleet2.0 JobListPanel; model names normalised to the
 * daemon's canonical 'HS-3' | 'HS-Pro' | 'Tallboi'.
 */
export interface ParsedGcodeFilename {
    printer_model: FleetPrinterModel | null
    filament_type: string | null
    quantity: number | null
}

const FILAMENT_PATTERNS: Array<[RegExp, string]> = [
    [/pa[-_ ]?cf/, 'PA-CF'],
    [/petg[-_ ]?cf/, 'PETG-CF'],
    [/pa[-_ ]?gf/, 'PA-GF'],
    [/petg/, 'PETG'],
    [/(^|[^a-z])pla([^a-z]|$)/, 'PLA'],
    [/(^|[^a-z])abs([^a-z]|$)/, 'ABS'],
    [/(^|[^a-z])tpu([^a-z]|$)/, 'TPU'],
]

export function parsePrinterModel(name: string): FleetPrinterModel | null {
    const s = name.toLowerCase()
    if (/hs[-_ ]?pro/.test(s)) return 'HS-Pro'
    if (/hs[-_ ]?3(?![0-9])/.test(s)) return 'HS-3'
    if (/tall[-_ ]?boi/.test(s)) return 'Tallboi'
    return null
}

export function parseGcodeFilename(filename: string): ParsedGcodeFilename {
    const base = filename.split('/').pop() ?? filename
    const stem = base.replace(/\.(gcode|gco|g)$/i, '')
    const lower = stem.toLowerCase()

    const printer_model = parsePrinterModel(lower)

    let filament_type: string | null = null
    for (const [re, label] of FILAMENT_PATTERNS) {
        if (re.test(lower)) {
            filament_type = label
            break
        }
    }

    // "x3", "qty_3", "quantity-3", "runs 3" or "3x" — token must be delimited.
    let quantity: number | null = null
    const m =
        lower.match(/(?:^|[^a-z0-9])(?:x|qty|quantity|runs?)[_\-\s]?(\d{1,4})(?![a-z0-9])/) ??
        lower.match(/(?:^|[^a-z0-9])(\d{1,4})x(?![a-z0-9])/)
    if (m) {
        const q = parseInt(m[1], 10)
        if (q > 0) quantity = q
    }

    return { printer_model, filament_type, quantity }
}
