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
// (air-quality sensors of any vendor, see SettingsAirSensorsTab.vue).
export const AIR_SENSOR_PRINTER_MODEL: PrinterModel = 'Air Sensor'
/**
 * Air sensor vendor (roster `sensorVendor`); picks fleet_daemon's collector. Entries saved
 * before this field existed are Panda Sense Pro sensors.
 *  - pandasense: BIGTREETECH Panda Sense Pro, its own MQTT broker
 *  - airgradient: AirGradient ONE, read-only HTTP poll of /measures/current
 *  - dyson: Dyson purifier, local MQTT (credentials live on the daemon host only)
 */
export type AirSensorVendor = 'pandasense' | 'airgradient' | 'dyson'
export const AIR_SENSOR_VENDORS: AirSensorVendor[] = ['airgradient', 'dyson', 'pandasense']
export const AIR_SENSOR_VENDOR_LABELS: Record<AirSensorVendor, string> = {
    pandasense: 'Panda Sense Pro',
    airgradient: 'AirGradient ONE',
    dyson: 'Dyson purifier',
}
/** Air sensors: port fleet_daemon talks to, per vendor (not editable in the UI). */
export const AIR_SENSOR_VENDOR_PORTS: Record<AirSensorVendor, number> = {
    pandasense: 1883,
    airgradient: 80,
    dyson: 1883,
}
/** Panda Sense Pro broker port (kept for older callers). */
export const AIR_SENSOR_PORT = AIR_SENSOR_VENDOR_PORTS.pandasense
export function airSensorVendor(entry: { sensorVendor?: string | null } | null | undefined): AirSensorVendor {
    const v = entry?.sensorVendor
    return v === 'airgradient' || v === 'dyson' ? v : 'pandasense'
}
/** Air sensors: radius (grid cells) the reading is drawn over on the Air Quality map. */
export const DEFAULT_SENSOR_RANGE = 3
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
    // NEW: air sensors only. Vendor (absent = 'pandasense', see airSensorVendor) and the
    // device serial (AirGradient: 12 hex digits, checked against every response; Dyson:
    // the MQTT username and the key into the daemon's credential file).
    sensorVendor?: AirSensorVendor | null
    sensorSerial?: string | null
}
