import { FarmPrinterStateSocket } from '@/store/farm/printer/types'

// All known printer models. Add new models here; square-icon models are listed in
// SQUARE_PRINTER_MODELS, and taller-than-standard models in PRINTER_MODEL_HEIGHT_SCALE.
export type PrinterModel = 'HS-3' | 'HS-Pro' | 'Tallboi'
export const PRINTER_MODELS: PrinterModel[] = ['HS-3', 'HS-Pro', 'Tallboi']
export const SQUARE_PRINTER_MODELS: PrinterModel[] = ['HS-Pro', 'Tallboi']
export const PRINTER_MODEL_HEIGHT_SCALE: Partial<Record<PrinterModel, number>> = { Tallboi: 1.5 }

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
}
