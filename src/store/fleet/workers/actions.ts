import { ActionTree } from 'vuex'
import axios from 'axios'
import { RootState } from '@/store/types'
import { toApiError } from '@/store/fleet/utils'
import { FleetWorkersState, FleetWorkerRow, FleetSchedulerStatus } from '@/store/fleet/jobs/types'

export interface FleetAutoExtruderTempResult {
    hostname: string
    filament_type: string | null
    spool_qr_code: string | null
    applied: boolean
    /** Why nothing was sent (only when applied is false). */
    reason?: string
    filament?: { id: number; name: string | null; material: string; vendor_name: string | null; extrude_temp: number }
    temp?: number
    script?: string
    result?: string
}

export interface FleetServiceEventResult {
    hostname: string
    service_type: string
    /** True when the printer's Moonraker did not know the preset and it was filed as "other" + label. */
    fallback_other: boolean
    event: Record<string, any> | null
    /** True when the record was already pulled into fleet_printer_activity. */
    collected: boolean
}

export const actions: ActionTree<FleetWorkersState, RootState> = {
    /** GET /workers — one row per connected printer (workers and non-workers). */
    async loadWorkers({ commit, rootGetters }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        commit('setLoading', true)
        try {
            const response = await axios.get(`${baseUrl}/workers`)
            commit('setWorkers', response.data ?? [])
        } catch (error) {
            const err = toApiError(error)
            console.error('Failed to load workers:', err.message)
            throw new Error(`Load workers failed: ${err.message}`)
        } finally {
            commit('setLoading', false)
        }
    },

    /** PATCH /workers/{hostname} — never cancels a running job. */
    async setWorkerEnabled(
        { commit, rootGetters },
        payload: { hostname: string; enabled: boolean; note?: string | null }
    ): Promise<FleetWorkerRow> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const body: { enabled: boolean; note?: string | null } = { enabled: payload.enabled }
            if (payload.note !== undefined) body.note = payload.note
            const response = await axios.patch(
                `${baseUrl}/workers/${encodeURIComponent(payload.hostname)}`,
                body
            )
            commit('patchWorker', response.data)
            return response.data
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** POST /workers/bulk */
    async bulkSetEnabled(
        { commit, rootGetters },
        payload: { hostnames: string[]; enabled: boolean }
    ): Promise<FleetWorkerRow[]> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.post(`${baseUrl}/workers/bulk`, payload)
            const updated: FleetWorkerRow[] = response.data?.updated ?? []
            for (const row of updated) commit('patchWorker', row)
            return updated
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** GET /scheduler/status */
    async loadSchedulerStatus({ commit, rootGetters }): Promise<FleetSchedulerStatus> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.get(`${baseUrl}/scheduler/status`)
            commit('setSchedulerStatus', response.data)
            return response.data
        } catch (error) {
            const err = toApiError(error)
            throw new Error(`Load scheduler status failed: ${err.message}`)
        }
    },

    /**
     * POST /printer/{hostname}/gcode — run a G-code script on one printer.
     * The daemon forwards it to Moonraker's `printer.gcode.script` and only
     * answers once Klipper has finished the script (a G28 waits for homing).
     */
    async sendGcode(
        { rootGetters },
        payload: { hostname: string; script: string }
    ): Promise<{ hostname: string; script: string; result: string }> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.post(
                `${baseUrl}/printer/${encodeURIComponent(payload.hostname)}/gcode`,
                { script: payload.script },
                { timeout: 190_000 }
            )
            return response.data
        } catch (error) {
            throw toApiError(error)
        }
    },

    /**
     * POST /printer/{hostname}/auto_extruder_temp — Scanner Lite "Auto Set
     * Extruder Temp". The daemon matches the printer's filament type against
     * the fleet filament database and sends SET_HEATER_TEMPERATURE only when
     * the matching filament has an extrude_temp; otherwise `applied` is false.
     */
    async autoSetExtruderTemp(
        { rootGetters },
        payload: { hostname: string }
    ): Promise<FleetAutoExtruderTempResult> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.post(
                `${baseUrl}/printer/${encodeURIComponent(payload.hostname)}/auto_extruder_temp`,
                {},
                { timeout: 190_000 }
            )
            return response.data
        } catch (error) {
            throw toApiError(error)
        }
    },

    /**
     * POST /printer/{hostname}/service — add a manual maintenance (service)
     * record to one printer's timeline. Only service_type is required; time
     * defaults to now and the other fields stay empty (Scanner Lite MACROS).
     */
    async addServiceEvent(
        { rootGetters },
        payload: {
            hostname: string
            service_type: string
            service_type_label?: string
            service_type_other?: string
            operator?: string
            comment?: string
            service_time?: number
        }
    ): Promise<FleetServiceEventResult> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        const { hostname, ...body } = payload
        try {
            const response = await axios.post(
                `${baseUrl}/printer/${encodeURIComponent(hostname)}/service`,
                body,
                { timeout: 60_000 }
            )
            return response.data
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** POST /scheduler/tick — wakes the scheduler loop. */
    async triggerTick({ rootGetters }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.post(`${baseUrl}/scheduler/tick`)
            return response.data
        } catch (error) {
            throw toApiError(error)
        }
    },
}
