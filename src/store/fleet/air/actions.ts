import { ActionTree } from 'vuex'
import axios from 'axios'
import { RootState } from '@/store/types'
import { toApiError } from '@/store/fleet/utils'
import { AirMetric, FleetAirState } from '@/store/fleet/air/types'

/** The request currently in flight, so concurrent callers share one GET (and its failure). */
let inflight: Promise<void> | null = null

export const actions: ActionTree<FleetAirState, RootState> = {
    /**
     * GET /air/metrics — ordered metric catalog (keys, units, quality bands).
     * Callers that dispatch while a load is running get that load's promise instead of a
     * second request; a failed load rejects every waiter and the next dispatch tries again.
     */
    loadMetrics({ commit, rootGetters }): Promise<void> {
        if (inflight) return inflight
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        commit('setLoading', true)
        inflight = (async () => {
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
                inflight = null
            }
        })()
        return inflight
    },
}
