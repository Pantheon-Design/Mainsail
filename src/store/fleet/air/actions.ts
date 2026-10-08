import { ActionTree } from 'vuex'
import axios from 'axios'
import { RootState } from '@/store/types'
import { toApiError } from '@/store/fleet/utils'
import { AirMetric, FleetAirState } from '@/store/fleet/air/types'

export const actions: ActionTree<FleetAirState, RootState> = {
    /** GET /air/metrics — ordered metric catalog (keys, units, quality bands). */
    async loadMetrics({ commit, rootGetters }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        commit('setLoading', true)
        try {
            const response = await axios.get(`${baseUrl}/air/metrics`, { timeout: 10000 })
            const metrics: AirMetric[] = Array.isArray(response.data) ? response.data : []
            commit('setMetrics', metrics)
        } catch (error) {
            const err = toApiError(error)
            commit('setError', err.message)
            console.error('Failed to load air quality metrics:', err.message)
            throw new Error(`Load air metrics failed: ${err.message}`)
        } finally {
            commit('setLoading', false)
        }
    },
}
