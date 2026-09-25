import { ActionTree } from 'vuex'
import { FleetSpoolsState, FleetSpoolLookup, FleetScanRelayRecord } from './types'
import { toApiError } from '../utils'
import { RootState } from '@/store/types'
import axios from 'axios'

/**
 * Extract a human-readable error message from an axios error or generic Error.
 * Prioritises the backend's `detail` field, then status text, then message.
 */
function extractError(err: any): string {
    if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail
        if (detail) return String(detail)
        if (err.response) return `Server error ${err.response.status}: ${err.response.statusText}`
        if (err.code === 'ECONNABORTED') return 'Request timed out — is fleet_daemon running?'
        if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error'))
            return 'Network error — cannot reach fleet_daemon'
        return err.message || 'Unknown request error'
    }
    if (err instanceof Error) return err.message
    return String(err)
}

export const actions: ActionTree<FleetSpoolsState, RootState> = {
    // -- Vendors --

    async loadVendors({ commit, rootGetters }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.get(`${baseUrl}/spool/vendors`)
            commit('setVendors', response.data)
        } catch (error) {
            const msg = extractError(error)
            console.error('Failed to load vendors:', msg)
            throw new Error(`Load vendors failed: ${msg}`)
        }
    },

    async createVendor({ commit, rootGetters }, payload: { name: string; comment?: string }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.post(`${baseUrl}/spool/vendors`, payload)
            commit('addVendor', response.data)
            return response.data
        } catch (error) {
            throw new Error(extractError(error))
        }
    },

    async updateVendor({ commit, rootGetters }, payload: { id: number; name?: string; comment?: string }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const { id, ...body } = payload
            const response = await axios.patch(`${baseUrl}/spool/vendors/${id}`, body)
            commit('updateVendor', response.data)
            return response.data
        } catch (error) {
            throw new Error(extractError(error))
        }
    },

    async deleteVendor({ commit, rootGetters }, id: number) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            await axios.delete(`${baseUrl}/spool/vendors/${id}`)
            commit('removeVendor', id)
        } catch (error) {
            throw new Error(extractError(error))
        }
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
            const msg = extractError(error)
            console.error('Failed to load filaments:', msg)
            throw new Error(`Load filaments failed: ${msg}`)
        }
    },

    async createFilament({ commit, rootGetters }, payload: any) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.post(`${baseUrl}/spool/filaments`, payload)
            commit('addFilament', response.data)
            return response.data
        } catch (error) {
            throw new Error(extractError(error))
        }
    },

    async updateFilament({ commit, rootGetters }, payload: { id: number; [key: string]: any }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const { id, ...body } = payload
            const response = await axios.patch(`${baseUrl}/spool/filaments/${id}`, body)
            commit('updateFilament', response.data)
            return response.data
        } catch (error) {
            throw new Error(extractError(error))
        }
    },

    async deleteFilament({ commit, rootGetters }, id: number) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            await axios.delete(`${baseUrl}/spool/filaments/${id}`)
            commit('removeFilament', id)
        } catch (error) {
            throw new Error(extractError(error))
        }
    },

    // -- Spools --

    async loadSpools({ commit, rootGetters }, filters: { filament_id?: number; material?: string; archived?: boolean; location?: string; lot_nr?: string } = {}) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        commit('setLoading', true)
        try {
            const params = new URLSearchParams()
            if (filters.filament_id != null) params.set('filament_id', String(filters.filament_id))
            if (filters.material) params.set('material', filters.material)
            if (filters.archived != null) params.set('archived', String(filters.archived))
            if (filters.location) params.set('location', filters.location)
            if (filters.lot_nr) params.set('lot_nr', filters.lot_nr)
            const qs = params.toString()
            const response = await axios.get(`${baseUrl}/spool/spools${qs ? '?' + qs : ''}`)
            commit('setSpools', response.data)
        } catch (error) {
            const msg = extractError(error)
            console.error('Failed to load spools:', msg)
            throw new Error(`Load spools failed: ${msg}`)
        } finally {
            commit('setLoading', false)
        }
    },

    async createSpool({ commit, rootGetters }, payload: any) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.post(`${baseUrl}/spool/spools`, payload)
            commit('addSpool', response.data)
            return response.data
        } catch (error) {
            throw new Error(extractError(error))
        }
    },

    async updateSpool({ commit, rootGetters }, payload: { id: number; [key: string]: any }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const { id, ...body } = payload
            const response = await axios.patch(`${baseUrl}/spool/spools/${id}`, body)
            commit('updateSpool', response.data)
            return response.data
        } catch (error) {
            throw new Error(extractError(error))
        }
    },

    async archiveSpool({ commit, rootGetters }, id: number) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            await axios.delete(`${baseUrl}/spool/spools/${id}`)
            commit('removeSpool', id)
        } catch (error) {
            throw new Error(extractError(error))
        }
    },

    async destroySpool({ commit, rootGetters }, id: number) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            await axios.delete(`${baseUrl}/spool/spools/${id}/destroy`)
            commit('removeSpool', id)
        } catch (error) {
            throw new Error(extractError(error))
        }
    },

    async lookupByQr({ rootGetters }, qrCode: string): Promise<FleetSpoolLookup> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.get(`${baseUrl}/spool/lookup/${encodeURIComponent(qrCode)}`)
            return response.data.spool
        } catch (error) {
            throw toApiError(error)
        }
    },

    /**
     * GET /spool/qr-available/{qr} — Scanner Lite Add Spool pre-flight.
     * Resolves when the QR is free; throws FleetApiError with status 409 when
     * it is already assigned (message names the owner). Other statuses mean
     * the check itself failed (daemon down etc.), not that the QR is taken.
     */
    async checkQrAvailable({ rootGetters }, qrCode: string): Promise<void> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            await axios.get(`${baseUrl}/spool/qr-available/${encodeURIComponent(qrCode)}`)
        } catch (error) {
            throw toApiError(error)
        }
    },

    // ---- Scanner Lite "Load Spool" relay (see FleetScanRelayRecord) ----

    /** POST /spool/scan-relay — hand a spool scan to a printer's KlipperScreen. 404: unknown spool or printer. */
    async relayLoadScan(
        { rootGetters },
        payload: { qr_code: string; printer_hostname: string }
    ): Promise<FleetScanRelayRecord> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.post(`${baseUrl}/spool/scan-relay`, payload)
            return response.data
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** GET /spool/scan-relay/{hostname} — outcome of the last relayed scan for that printer. */
    async getLoadScanStatus({ rootGetters }, hostname: string): Promise<FleetScanRelayRecord> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.get(`${baseUrl}/spool/scan-relay/${encodeURIComponent(hostname)}`)
            return response.data
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** DELETE /spool/scan-relay/{hostname} — withdraw a relayed scan that was not confirmed. */
    async cancelLoadScan({ rootGetters }, hostname: string): Promise<void> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            await axios.delete(`${baseUrl}/spool/scan-relay/${encodeURIComponent(hostname)}`)
        } catch (error) {
            throw toApiError(error)
        }
    },
}
