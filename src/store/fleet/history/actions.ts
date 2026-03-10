import { ActionTree } from 'vuex'
import { FleetHistoryState } from './types'
import { RootState } from '@/store/types'
import axios from 'axios'

export const actions: ActionTree<FleetHistoryState, RootState> = {
    async loadHistory({ commit, rootGetters }, filters: { printer?: string; status?: string; qr_code?: string; limit?: number; offset?: number } = {}) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        commit('setLoading', true)
        try {
            const params = new URLSearchParams()
            if (filters.printer) params.set('printer', filters.printer)
            if (filters.status) params.set('status', filters.status)
            if (filters.qr_code) params.set('qr_code', filters.qr_code)
            params.set('limit', String(filters.limit ?? 200))
            params.set('offset', String(filters.offset ?? 0))
            const response = await axios.get(`${baseUrl}/history?${params}`)
            commit('setRecords', response.data.records ?? response.data)
            commit('setTotal', response.data.total ?? (response.data.records ?? response.data).length)
        } catch (error) {
            console.error('Failed to load fleet history:', error)
        } finally {
            commit('setLoading', false)
        }
    },

    async loadAnalytics({ commit, rootGetters }, days = 365) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        commit('setAnalyticsLoading', true)
        try {
            const response = await axios.get(`${baseUrl}/history/analytics?days=${days}`)
            commit('setAnalytics', response.data)
        } catch (error) {
            console.error('Failed to load fleet analytics:', error)
        } finally {
            commit('setAnalyticsLoading', false)
        }
    },

    async updateQC({ commit, rootGetters }, payload: { id: string; qc_status?: string; qc_inspector?: string; qc_note?: string; qr_code?: string; parts_passed?: number; parts_printed?: number }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.patch(`${baseUrl}/history/${payload.id}/qc`, payload)
            commit('updateRecord', response.data)
        } catch (error) {
            console.error('Failed to update QC:', error)
            throw error
        }
    },

    async triggerCollect({ rootGetters }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        await axios.post(`${baseUrl}/history/collect`)
    },
}
