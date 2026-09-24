import { FarmPrinterState } from '@/store/farm/printer/types'

// ---- Oven WS frames (fleet_daemon `/ws`, `device_type: "oven"`) ----
// Wire shape is `_project_oven_for_broadcast` in fleet_daemon/fleet_manager.py; see
// ARCHITECTURE.md "WebSocket Protocol (/ws)". Ovens live in their own map so every
// printer-only consumer (counters, worker list, status derivation) stays untouched.

export interface OvenSpoolFrame {
    qr_code: string
    row: number
    slot: number
    oven_loaded_at: string | null
    ready_at: string | null
    is_ready: boolean
    material: string | null
    color_hex: string | null
}

export interface OvenConfigFrame {
    label?: string | null
    shelf_rows?: number
    slots_per_row?: number
    [key: string]: any
}

export interface OvenFrame {
    hostname: string
    device_type: 'oven'
    webhooks?: { state?: string; state_message?: string }
    /** `<temperature_sensor name>` -> °C */
    temperatures?: Record<string, number>
    oven?: {
        config?: OvenConfigFrame
        fleet_connected?: boolean
        spool_count?: number
        ready_count?: number
        spools?: OvenSpoolFrame[]
        /** Soft capacity mirrored from the roster's `maxSpools` (newer daemons only) */
        max_spools?: number | null
        /** Material with the most spools in the oven, null when empty (newer daemons only).
         *  The UI recomputes this from `spools[].material` and only uses it as a fallback. */
        top_material?: string | null
    }
    /** false while the daemon has no websocket to the oven's Moonraker */
    fleet_to_printer_ws?: boolean
    /** Client receive time (ms epoch), set by fleetDaemonClient */
    received_at?: number
}

export interface FarmState {
    fleetDaemonPrinters: { [hostname: string]: any };
    fleetDaemonOvens: { [hostname: string]: OvenFrame };
    fleetDaemonConnected: boolean;
    [printerId: string]: any; // <- allow dynamic printer namespaces
}
