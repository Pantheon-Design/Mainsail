import { ActionTree } from 'vuex'
import axios from 'axios'
import { RootState } from '@/store/types'
import { toApiError } from '@/store/fleet/utils'
import { FleetWorkersState, FleetWorkerRow, FleetSchedulerStatus } from '@/store/fleet/jobs/types'

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
