import { ActionTree } from 'vuex'
import { FleetHistoryState } from './types'
import { RootState } from '@/store/types'
import axios from 'axios'

const FLEET_API_URL = 'http://localhost:8090'

export const actions: ActionTree<FleetHistoryState, RootState> = {
    async loadHistory({ commit }, filters: { printer?: string; status?: string; limit?: number; offset?: number } = {}) {
        commit('setLoading', true)
        try {
            const params = new URLSearchParams()
            if (filters.printer) params.set('printer', filters.printer)
            if (filters.status) params.set('status', filters.status)
            params.set('limit', String(filters.limit ?? 200))
            params.set('offset', String(filters.offset ?? 0))
            const response = await axios.get(`${FLEET_API_URL}/history?${params}`)
            commit('setRecords', response.data.records ?? response.data)
            commit('setTotal', response.data.total ?? (response.data.records ?? response.data).length)
        } catch (error) {
            console.error('Failed to load fleet history:', error)
        } finally {
            commit('setLoading', false)
        }
    },

    async loadAnalytics({ commit }, days = 365) {
        commit('setAnalyticsLoading', true)
        try {
            const response = await axios.get(`${FLEET_API_URL}/history/analytics?days=${days}`)
            commit('setAnalytics', response.data)
        } catch (error) {
            console.error('Failed to load fleet analytics:', error)
        } finally {
            commit('setAnalyticsLoading', false)
        }
    },

    async updateQC({ commit }, payload: { id: string; qc_status?: string; qc_inspector?: string; parts_passed?: number; parts_printed?: number }) {
        try {
            const response = await axios.patch(`${FLEET_API_URL}/history/${payload.id}/qc`, payload)
            commit('updateRecord', response.data)
        } catch (error) {
            console.error('Failed to update QC:', error)
            throw error
        }
    },

    async triggerCollect() {
        await axios.post(`${FLEET_API_URL}/history/collect`)
    },
}
