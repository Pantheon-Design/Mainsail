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
    /** Grams left / grams when full. Newer daemons + oven firmware only; the map falls back to
     *  the fleet spool list (by qr_code) when these are missing. */
    remaining_weight?: number | null
    initial_weight?: number | null
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

// ---- Air sensor WS frames (fleet_daemon `/ws`, `device_type: "air_sensor"`) ----
// Wire shape is `_project_air_sensor_for_broadcast` in fleet_daemon/fleet_manager.py. Metric keys
// as the daemon normalises them for every vendor; the catalog (labels, units, decimals, bands,
// vendors) comes from `GET /air/metrics` (store/fleet/air), never from here. AirGradient VOC/NOx
// indices, Dyson indices and Panda eTVOC are different quantities with their own keys.
export type AirMetricKey =
    | 'temperature'
    | 'humidity'
    | 'pm1'
    | 'pm2_5'
    | 'pm10'
    | 'co2'
    | 'etvoc'
    | 'ch2o'
    | 'aqi'
    | 'voc_index'
    | 'nox_index'
    | 'dyson_voc'
    | 'dyson_no2'

export type AirSensorValues = Partial<Record<AirMetricKey, number | null>> & Record<string, number | null | undefined>

/**
 * Per-metric quality (AirGradient / Dyson only). Only `valid` (or no entry, for vendors
 * without quality) may drive bands, alerts and averages; e.g. AirGradient CO₂ below 300 ppm is
 * `suspect_low`: kept and shown, flagged, never alerted on.
 */
export type AirMetricQuality =
    | 'valid'
    | 'missing'
    | 'out_of_range'
    | 'invalid'
    | 'warming_or_invalid'
    | 'suspect_low'
    | 'error'

export interface AirSensorFrame {
    /** hostname as the daemon resolved it (`pandasensepro1.local`, `airgradient_<serial>.local`) */
    hostname: string
    device_type: 'air_sensor'
    /** roster sensorVendor; absent from older daemons = pandasense */
    vendor?: 'pandasense' | 'airgradient' | 'dyson'
    /** false once the sensor stops reporting (stale) or is unreachable */
    online: boolean
    /** epoch seconds of the last successful reading, null before the first one */
    last_update: number | null
    /** last values (Panda: kept while offline; AirGradient: cleared on a failed read) */
    values: AirSensorValues
    /** per-metric quality, see AirMetricQuality */
    metric_quality?: Record<string, AirMetricQuality | string>
    /** human-readable data flags, e.g. the AirGradient low-CO₂ note */
    flags?: string[]
    /** Dyson fan status (display only) */
    status?: {
        power?: boolean
        auto?: boolean
        fan_speed?: number | string
        hepa_filter_pct?: number
        carbon_filter_pct?: number
        filter_hours?: number
    }
    /** daemon-side error text (broker unreachable, HTTP error, serial mismatch, ...) */
    error?: string | null
    /** Client receive time (ms epoch), set by fleetDaemonClient */
    received_at?: number
}

export interface FarmState {
    fleetDaemonPrinters: { [hostname: string]: any };
    fleetDaemonOvens: { [hostname: string]: OvenFrame };
    fleetDaemonAirSensors: { [hostname: string]: AirSensorFrame };
    fleetDaemonConnected: boolean;
    [printerId: string]: any; // <- allow dynamic printer namespaces
}
