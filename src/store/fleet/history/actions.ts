import { ActionTree } from 'vuex'
import { FleetHistoryState } from './types'
import { RootState } from '@/store/types'
import axios from 'axios'

export const actions: ActionTree<FleetHistoryState, RootState> = {
    async loadHistory({ commit, rootGetters }, filters: { printer?: string; status?: string; qr_code?: string; has_qr_code?: boolean; limit?: number; offset?: number } = {}) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        commit('setLoading', true)
        try {
            const params = new URLSearchParams()
            if (filters.printer) params.set('printer', filters.printer)
            if (filters.status) params.set('status', filters.status)
            if (filters.qr_code) params.set('qr_code', filters.qr_code)
            if (filters.has_qr_code !== undefined) params.set('has_qr_code', String(filters.has_qr_code))
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

    async loadMoreHistory({ commit, rootGetters }, filters: { printer?: string; status?: string; qr_code?: string; has_qr_code?: boolean; limit?: number; offset?: number } = {}) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const params = new URLSearchParams()
            if (filters.printer) params.set('printer', filters.printer)
            if (filters.status) params.set('status', filters.status)
            if (filters.qr_code) params.set('qr_code', filters.qr_code)
            if (filters.has_qr_code !== undefined) params.set('has_qr_code', String(filters.has_qr_code))
            params.set('limit', String(filters.limit ?? 200))
            params.set('offset', String(filters.offset ?? 0))
            const response = await axios.get(`${baseUrl}/history?${params}`)
            const records = response.data.records ?? response.data
            commit('appendRecords', records)
            commit('setTotal', response.data.total ?? 0)
            return records.length
        } catch (error) {
            console.error('Failed to load more fleet history:', error)
            return 0
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

    async updateQC({ state, commit, rootGetters }, payload: { id: string; qc_status?: string; qc_inspector?: string; qc_date?: string; qc_note?: string; qr_code?: string; parts_passed?: number; parts_printed?: number }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            if (state.devMode) console.log('updateQC request:', `PATCH ${baseUrl}/history/${payload.id}/qc`, payload)
            const response = await axios.patch(`${baseUrl}/history/${payload.id}/qc`, payload)
            if (state.devMode) console.log('updateQC response:', response.data)
            commit('updateRecord', response.data)
        } catch (error) {
            console.error('Failed to update QC:', error)
            throw error
        }
    },

    async fetchInspectors({ rootGetters }): Promise<string[]> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        const response = await axios.get(`${baseUrl}/history/inspectors`)
        return response.data ?? []
    },

    async searchByQrCode({ rootGetters }, qrCode: string): Promise<any> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        const params = new URLSearchParams()
        params.set('qr_code', qrCode)
        params.set('limit', '1')
        const response = await axios.get(`${baseUrl}/history?${params}`)
        const records = response.data.records ?? response.data
        return records.length > 0 ? records[0] : null
    },

    async fetchPartsForJob({ rootGetters }, payload: { printer_hostname: string; moonraker_job_id: string }): Promise<any[]> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        const params = new URLSearchParams()
        params.set('printer', payload.printer_hostname)
        params.set('moonraker_job_id', payload.moonraker_job_id)
        params.set('limit', '500')
        const response = await axios.get(`${baseUrl}/history?${params}`)
        const records = response.data.records ?? response.data
        return records.filter((r: any) => r.qr_code != null)
    },

    async triggerCollect({ rootGetters }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        await axios.post(`${baseUrl}/history/collect`)
    },

    async linkQrCode({ state, commit, rootGetters }, payload: { printer_hostname: string; moonraker_job_id: string; qr_code: string }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            if (state.devMode) console.log('linkQrCode request:', `POST ${baseUrl}/history/qr-link`, payload)
            const response = await axios.post(`${baseUrl}/history/qr-link`, payload)
            if (state.devMode) console.log('linkQrCode response:', response.data)
            commit('addRecord', response.data)
            return response.data
        } catch (error) {
            console.error('Failed to link QR code:', error)
            throw error
        }
    },
}
