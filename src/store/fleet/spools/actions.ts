import { ActionTree } from 'vuex'
import { FleetSpoolsState } from './types'
import { RootState } from '@/store/types'
import axios from 'axios'

export const actions: ActionTree<FleetSpoolsState, RootState> = {
    // -- Vendors --

    async loadVendors({ commit, rootGetters }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.get(`${baseUrl}/spool/vendors`)
            commit('setVendors', response.data)
        } catch (error) {
            console.error('Failed to load vendors:', error)
        }
    },

    async createVendor({ commit, rootGetters }, payload: { name: string; comment?: string }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        const response = await axios.post(`${baseUrl}/spool/vendors`, payload)
        commit('addVendor', response.data)
        return response.data
    },

    async updateVendor({ commit, rootGetters }, payload: { id: number; name?: string; comment?: string }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        const { id, ...body } = payload
        const response = await axios.patch(`${baseUrl}/spool/vendors/${id}`, body)
        commit('updateVendor', response.data)
        return response.data
    },

    async deleteVendor({ commit, rootGetters }, id: number) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        await axios.delete(`${baseUrl}/spool/vendors/${id}`)
        commit('removeVendor', id)
    },

    // -- Filaments --

    async loadFilaments({ commit, rootGetters }, filters: { vendor_id?: number; material?: string } = {}) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const params = new URLSearchParams()
            if (filters.vendor_id != null) params.set('vendor_id', String(filters.vendor_id))
            if (filters.material) params.set('material', filters.material)
            const qs = params.toString()
            const response = await axios.get(`${baseUrl}/spool/filaments${qs ? '?' + qs : ''}`)
            commit('setFilaments', response.data)
        } catch (error) {
            console.error('Failed to load filaments:', error)
        }
    },

    async createFilament({ commit, rootGetters }, payload: any) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        const response = await axios.post(`${baseUrl}/spool/filaments`, payload)
        commit('addFilament', response.data)
        return response.data
    },

    async updateFilament({ commit, rootGetters }, payload: { id: number; [key: string]: any }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        const { id, ...body } = payload
        const response = await axios.patch(`${baseUrl}/spool/filaments/${id}`, body)
        commit('updateFilament', response.data)
        return response.data
    },

    async deleteFilament({ commit, rootGetters }, id: number) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        await axios.delete(`${baseUrl}/spool/filaments/${id}`)
        commit('removeFilament', id)
    },

    // -- Spools --

    async loadSpools({ commit, rootGetters }, filters: { filament_id?: number; material?: string; archived?: boolean; location?: string } = {}) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        commit('setLoading', true)
        try {
            const params = new URLSearchParams()
            if (filters.filament_id != null) params.set('filament_id', String(filters.filament_id))
            if (filters.material) params.set('material', filters.material)
            if (filters.archived != null) params.set('archived', String(filters.archived))
            if (filters.location) params.set('location', filters.location)
            const qs = params.toString()
            const response = await axios.get(`${baseUrl}/spool/spools${qs ? '?' + qs : ''}`)
            commit('setSpools', response.data)
        } catch (error) {
            console.error('Failed to load spools:', error)
        } finally {
            commit('setLoading', false)
        }
    },

    async createSpool({ commit, rootGetters }, payload: any) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        const response = await axios.post(`${baseUrl}/spool/spools`, payload)
        commit('addSpool', response.data)
        return response.data
    },

    async updateSpool({ commit, rootGetters }, payload: { id: number; [key: string]: any }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        const { id, ...body } = payload
        const response = await axios.patch(`${baseUrl}/spool/spools/${id}`, body)
        commit('updateSpool', response.data)
        return response.data
    },

    async archiveSpool({ commit, rootGetters }, id: number) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        await axios.delete(`${baseUrl}/spool/spools/${id}`)
        commit('removeSpool', id)
    },

    async lookupByQr({ rootGetters }, qrCode: string) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        const response = await axios.get(`${baseUrl}/spool/lookup/${encodeURIComponent(qrCode)}`)
        return response.data.spool
    },
}
