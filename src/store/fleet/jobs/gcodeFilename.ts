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
    /** slicer print time per run in seconds, from a `12h0m` / `1d2h30m` / `45m` token */
    print_time_secs: number | null
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

const PRINT_TIME_TOKEN = /^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?$/i

/**
 * Seconds from a `NdNhNm` token (any subset, at least one part) such as `12h0m`,
 * `1d2h30m` or `45m`. Mirrors parse_print_time_from_name in fleet_daemon.
 */
export function parsePrintTimeSecs(filename: string | null | undefined): number | null {
    if (!filename) return null
    const tokens = stem(filename).split(/[_\s]+/)
    for (const t of tokens) {
        if (!t) continue
        const m = t.match(PRINT_TIME_TOKEN)
        if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) continue
        const secs = (parseInt(m[1] ?? '0', 10) || 0) * 86400 + (parseInt(m[2] ?? '0', 10) || 0) * 3600 + (parseInt(m[3] ?? '0', 10) || 0) * 60
        if (secs > 0) return secs
    }
    return null
}

/** Free text typed by an operator (`1d 2h 30m`, `12h0m`, `90m`, `2.5h`) -> seconds, or null. */
export function parsePrintTimeInput(text: string | null | undefined): number | null {
    if (!text) return null
    const s = text.trim().toLowerCase()
    if (!s) return null
    let secs = 0
    let matched = false
    const re = /(\d+(?:\.\d+)?)\s*(d|h|m)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(s)) !== null) {
        matched = true
        const v = parseFloat(m[1])
        secs += m[2] === 'd' ? v * 86400 : m[2] === 'h' ? v * 3600 : v * 60
    }
    if (!matched) {
        // bare number = hours
        const v = parseFloat(s)
        if (!isNaN(v)) secs = v * 3600
    }
    secs = Math.round(secs)
    return secs > 0 ? secs : null
}

/** Seconds -> `1d 2h 30m` style text for the job form (empty string for null / 0). */
export function formatPrintTimeInput(secs: number | null | undefined): string {
    if (!secs || secs <= 0) return ''
    const d = Math.floor(secs / 86400)
    const h = Math.floor((secs % 86400) / 3600)
    const m = Math.round((secs % 3600) / 60)
    const parts: string[] = []
    if (d) parts.push(`${d}d`)
    if (h || d) parts.push(`${h}h`)
    parts.push(`${m}m`)
    return parts.join(' ')
}

export function parseGcodeFilename(filename: string): ParsedGcodeFilename {
    return {
        printer_model: parsePrinterModel(filename),
        filament_type: parseFilamentType(filename),
        filament_grams: parseFilamentGrams(filename),
        nozzle_diameter: parseNozzle(filename),
        quantity: parseQuantity(filename),
        print_time_secs: parsePrintTimeSecs(filename),
    }
}
