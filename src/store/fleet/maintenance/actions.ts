import { ActionTree } from 'vuex'
import axios from 'axios'
import { FleetMaintenanceState } from './types'
import { RootState } from '@/store/types'

export const actions: ActionTree<FleetMaintenanceState, RootState> = {
    async loadPrinters({ commit, rootGetters }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        commit('setPrintersLoading', true)
        try {
            const response = await axios.get(`${baseUrl}/service_tracker/printers`)
            commit('setPrinters', Array.isArray(response.data) ? response.data : (response.data.printers ?? []))
        } catch (error) {
            console.error('Failed to load service tracker printers:', error)
        } finally {
            commit('setPrintersLoading', false)
        }
    },

    async loadPrinter({ commit, rootGetters }, payload: { hostname: string; days?: number }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        const hostname = payload.hostname
        if (!hostname) {
            commit('setPrinterDetail', null)
            return
        }
        commit('setDetailLoading', true)
        try {
            const days = payload.days ?? 90
            const response = await axios.get(
                `${baseUrl}/service_tracker/printer/${encodeURIComponent(hostname)}?days=${days}`
            )
            commit('setPrinterDetail', {
                hostname,
                latest: response.data.latest ?? null,
                history: response.data.history ?? [],
                deltas: response.data.deltas ?? [],
            })
        } catch (error) {
            console.error('Failed to load service tracker printer detail:', error)
            commit('setPrinterDetail', { hostname, latest: null, history: [], deltas: [] })
        } finally {
            commit('setDetailLoading', false)
        }
    },

    async loadAnalytics({ commit, rootGetters }, days = 0) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        commit('setLoading', true)
        try {
            const response = await axios.get(`${baseUrl}/service_tracker/analytics?days=${days}`)
            commit('setAnalytics', response.data)
        } catch (error) {
            console.error('Failed to load maintenance analytics:', error)
        } finally {
            commit('setLoading', false)
        }
    },
}
