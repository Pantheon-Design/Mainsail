import { FarmPrinterStateSocket } from '@/store/farm/printer/types'

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
    printerModel?: 'HS-3' | 'HS-Pro'
    // NEW: which map tab the printer lives on. Optional for backward compatibility —
    // printers saved before this field existed have no value and default to 'farm'.
    location?: 'farm' | 'ground'
}
