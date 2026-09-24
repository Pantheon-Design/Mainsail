import { FarmPrinterStateSocket } from '@/store/farm/printer/types'

// All known printer models. Add new models here; square-icon models are listed in
// SQUARE_PRINTER_MODELS, and taller-than-standard models in PRINTER_MODEL_HEIGHT_SCALE.
// 'Oven' is a label only: roster entries with deviceType === 'oven' store it as their
// printerModel. It is not selectable in the Printer Model dropdown (PRINTER_MODELS) and
// never matches a job's printer_model in the scheduler.
export type PrinterModel = 'HS-3' | 'HS-Pro' | 'Tallboi' | 'Oven'
export const PRINTER_MODELS: PrinterModel[] = ['HS-3', 'HS-Pro', 'Tallboi']
export const OVEN_PRINTER_MODEL: PrinterModel = 'Oven'
export const SQUARE_PRINTER_MODELS: PrinterModel[] = ['HS-Pro', 'Tallboi']
export const PRINTER_MODEL_HEIGHT_SCALE: Partial<Record<PrinterModel, number>> = { Tallboi: 1.5 }

// Kind of fleet device a roster entry describes. Optional on stored records for backward
// compatibility: entries saved before this field existed are printers.
export type DeviceType = 'printer' | 'oven'
export const DEVICE_TYPES: DeviceType[] = ['printer', 'oven']

export interface GuiRemoteprintersState {
    printers: {
        [key: string]: GuiRemoteprintersStatePrinter
    }
}

export interface GuiRemoteprintersStatePrinter {
    id?: string | null
    hostname: string
    port: number
    socket?: FarmPrinterStateSocket
    settings?: {
        [key: string]: any
    }
    lastPrintedFilament: string
    position?: { x: number, y: number }
    gridPosition?: { x: number, y: number }
    printerModel?: PrinterModel
    // NEW: which map tab the printer lives on. Optional for backward compatibility —
    // printers saved before this field existed have no value and default to 'farm'.
    location?: 'farm' | 'ground'
    // NEW: 'printer' (default) or 'oven'. fleet_daemon routes ovens into its own
    // connection dict; Fleet Mainsail keeps them off the printer map in Phase 1.
    deviceType?: DeviceType
    // NEW: ovens only — soft spool capacity (integer >= 1). Shown as `count/max` on the
    // map marker and mirrored by fleet_daemon as `max_spools`; nothing blocks adding
    // spools beyond it. Absent/null = unknown (the map falls back to the oven layout).
    maxSpools?: number
}
