import { FarmPrinterStateSocket } from '@/store/farm/printer/types'

// All known printer models. Add new models here; square-icon models are listed in
// SQUARE_PRINTER_MODELS, and taller-than-standard models in PRINTER_MODEL_HEIGHT_SCALE.
// 'Oven' is a label only: roster entries with deviceType === 'oven' store it as their
// printerModel. It is not selectable in the Printer Model dropdown (PRINTER_MODELS) and
// never matches a job's printer_model in the scheduler.
export type PrinterModel = 'HS-3' | 'HS-Pro' | 'Tallboi' | 'Oven' | 'Air Sensor'
export const PRINTER_MODELS: PrinterModel[] = ['HS-3', 'HS-Pro', 'Tallboi']
export const OVEN_PRINTER_MODEL: PrinterModel = 'Oven'
// 'Air Sensor' is the same kind of label-only model for deviceType === 'air_sensor' entries
// (Panda Sense Pro air-quality sensors, see SettingsAirSensorsTab.vue).
export const AIR_SENSOR_PRINTER_MODEL: PrinterModel = 'Air Sensor'
/** Air sensors: MQTT port of the Panda Sense Pro built-in broker (not editable in the UI). */
export const AIR_SENSOR_PORT = 1883
/** Air sensors: radius (grid cells) the reading is drawn over on the Air Quality map. */
export const DEFAULT_SENSOR_RANGE = 6
export const MIN_SENSOR_RANGE = 1
export const MAX_SENSOR_RANGE = 25
export const SQUARE_PRINTER_MODELS: PrinterModel[] = ['HS-Pro', 'Tallboi']
export const PRINTER_MODEL_HEIGHT_SCALE: Partial<Record<PrinterModel, number>> = { Tallboi: 1.5 }

// Kind of fleet device a roster entry describes. Optional on stored records for backward
// compatibility: entries saved before this field existed are printers.
export type DeviceType = 'printer' | 'oven' | 'air_sensor'
export const DEVICE_TYPES: DeviceType[] = ['printer', 'oven', 'air_sensor']

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
    // NEW: optional display name (air sensors; shown instead of the hostname on the map/settings).
    label?: string | null
    // NEW: air sensors only. Radius in grid cells the reading is painted over on the
    // Air Quality map (default DEFAULT_SENSOR_RANGE). Absent/null = default.
    sensorRange?: number | null
}
