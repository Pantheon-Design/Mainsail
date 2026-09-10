// Live config-mismatch comparison between a gcode's embedded YAML block
// (PantheonSlicer "---...---" footer) and the printer's running features.yml.
//
// Mirrors the KlipperScreen helper at KlipperScreen/ks_includes/config_verifier.py
// so warning strings render the same in both UIs. Returns [] if either input
// is missing or the gcode YAML can't be parsed.

import yaml from 'js-yaml'

export function checkConfig(
    gcodeConfigYml: string | undefined | null,
    machineConfig: any | null
): string[] {
    if (!gcodeConfigYml || !machineConfig) return []

    const cleaned = gcodeConfigYml
        .replace(/---/g, '')
        .replace(/\.\.\./g, '')
        .replace(/;/g, '\n')
        .replace(/\\n/g, '')

    let header: any
    try {
        header = yaml.load(cleaned)
    } catch (err) {
        window.console.warn('configVerifier: failed to parse gcode YAML', err)
        return []
    }
    if (!header || typeof header !== 'object') return []

    const out: string[] = []

    try {
        const gcodeProcess = header.printer?.process
        const printerProcess = machineConfig.printer?.process
        if (gcodeProcess && printerProcess && gcodeProcess !== printerProcess) {
            out.push(`Warning! Process mismatch!\n\tExpected ${gcodeProcess} got ${printerProcess}`)
        }
    } catch (err) {
        window.console.warn('configVerifier: process compare failed', err)
    }

    try {
        const gcodeAxes = header.printer?.['axes-limits'] ?? {}
        const printerAxes = machineConfig.printer?.['axes-limits'] ?? {}
        for (const axis of Object.keys(gcodeAxes)) {
            const val = gcodeAxes[axis]
            const printerVal = printerAxes[axis]
            if (typeof val !== 'number' || typeof printerVal !== 'number') continue
            if (val > printerVal) {
                const a = axis.toUpperCase()
                out.push(
                    `Caution! Slicer requested ${val} mm ${a} axis, \n\tthe printer has ${printerVal} mm ${a} axis.`
                )
            }
        }
    } catch (err) {
        window.console.warn('configVerifier: axes-limits compare failed', err)
    }

    try {
        const gcodeHw = header.printer?.hardware ?? {}
        const printerHw = machineConfig.printer?.hardware ?? {}
        for (const key of Object.keys(gcodeHw)) {
            const val = gcodeHw[key]
            if (!(key in printerHw)) {
                out.push(`Caution! Slicer requested ${key} which the printer does not have!`)
            } else if (val !== 'any' && val !== printerHw[key]) {
                out.push(
                    `Caution! Mismatched ${key} found! \n\tSlicer requested ${val}, the printer has ${printerHw[key]}`
                )
            }
        }
    } catch (err) {
        window.console.warn('configVerifier: hardware compare failed', err)
    }

    return out
}
