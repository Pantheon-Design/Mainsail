export type PrinterStatus = 'disconnected' | 'error' | 'printing' | 'complete' | 'ready'

export function getPrinterStatus(printer: any, fleetDaemonConnected: boolean): PrinterStatus {
    if (printer?.fleet_to_printer_ws === false) return 'disconnected'
    if (!fleetDaemonConnected || !printer?.socket?.isConnected) return 'disconnected'
    if (printer?.webhooks?.state === 'shutdown') return 'error'

    const state = printer?.print_stats?.state
    if (state === 'printing') return 'printing'
    if (state === 'error' || state === 'paused' || state === 'cancelled') return 'error'
    if (state === 'complete') return 'complete'
    if (state === 'standby') return 'ready'

    return 'disconnected'
}

export function getStatusBorderStyle(
    printer: any,
    model: 'HS-3' | 'HS-Pro' | null | undefined,
    fleetDaemonConnected: boolean,
    borderEm = 0.25,
    printingEffect: 'spin' | 'arm' = 'spin',
    blueColor = 'blue'
): Record<string, string | number> {
    const isSquare = model === 'HS-Pro'
    const radius = isSquare ? '0%' : '50%'

    const base: Record<string, string | number> = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        borderRadius: radius,
        zIndex: 2,
        pointerEvents: 'none',
    }

    if (printer?.fleet_to_printer_ws === false) {
        return { ...base, border: `${borderEm}em solid gray` }
    }
    if (!fleetDaemonConnected || !printer?.socket?.isConnected) {
        return { ...base, border: `${borderEm}em solid gray` }
    }
    if (printer?.webhooks?.state === 'shutdown') {
        return { ...base, border: `${borderEm}em solid red` }
    }

    const state = printer?.print_stats?.state
    if (state === 'printing') {
        if (printingEffect === 'arm' && isSquare) {
            return {
                ...base,
                border: `${borderEm}em solid ${blueColor}`,
                boxShadow: 'inset 0 0 0 1px black',
            }
        }
        if (isSquare) {
            return {
                ...base,
                background: `conic-gradient(transparent 0%, ${blueColor} 10%, transparent 90%)`,
                mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                maskComposite: 'subtract',
                padding: `${borderEm}em`,
                animation: 'spin 2s linear infinite',
            }
        }
        return {
            ...base,
            background: `conic-gradient(transparent 0%, lightgreen 100%, transparent 90%), ${blueColor}`,
            mask: `radial-gradient(farthest-side, transparent calc(100% - ${borderEm + 0.05}em), black calc(100% - ${borderEm + 0.05}em))`,
            animation: 'spin 2s linear infinite',
        }
    }

    let color = 'gray'
    if (state === 'error' || state === 'paused' || state === 'cancelled') color = 'red'
    else if (state === 'complete') color = blueColor
    else if (state === 'standby') color = 'hsl(90, 100%, 32%)'

    return { ...base, border: `${borderEm}em solid ${color}` }
}

export function displayFilamentType(rawType: string | null | undefined): string {
    switch (rawType) {
        case 'PA-CF':
            return 'CN'
        case 'PA-GF':
            return 'GN'
        case 'PETG-CF':
            return 'CP'
        case 'TPU':
            return 'FL'
    }

    if (rawType && rawType.length > 4) {
        return `${rawType.slice(0, 2)}...${rawType.slice(-1)}`
    }

    return rawType || ''
}

export function getPrinterPrintPercent(printer: any): number {
    const progress = printer?.virtual_sdcard?.progress ?? 0
    return Math.floor(progress * 100)
}

export function computeRemainingFilamentG(printer: any): number | null {
    const remaining = printer?.toolhead?.remaining_weight
    if (typeof remaining !== 'number' || isNaN(remaining)) return null
    return Math.max(0, remaining)
}

const FILAMENT_TOTAL_WEIGHTS: Record<string, number> = {
    'PETG-CF': 3000,
    'PA-CF': 3000,
    TPU: 2500,
    'PA-GF (Natural)': 3000,
    'PA-GF (Dark Grey)': 3000,
}

export function computeRemainingWeightPct(printer: any): number | null {
    const remaining = printer?.toolhead?.remaining_weight
    if (typeof remaining !== 'number' || isNaN(remaining)) return null

    const filamentType = printer?.toolhead?.filament_type
    const fixedTotal = typeof filamentType === 'string' ? FILAMENT_TOTAL_WEIGHTS[filamentType] : undefined
    if (typeof fixedTotal === 'number' && fixedTotal > 0) {
        return Math.max(0, Math.min(100, (remaining / fixedTotal) * 100))
    }

    const used = printer?.toolhead?.used_weight
    if (typeof used !== 'number') return null
    const total = remaining + used
    if (total <= 0) return null
    return Math.max(0, Math.min(100, (remaining / total) * 100))
}
