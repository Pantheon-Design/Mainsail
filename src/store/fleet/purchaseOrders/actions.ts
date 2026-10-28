import { ActionTree, Commit } from 'vuex'
import axios from 'axios'
import { RootState } from '@/store/types'
import { toApiError } from '@/store/fleet/utils'
import {
    FleetPurchaseOrdersState,
    FleetPoDetail,
    FleetPoConfig,
    FleetPoListRow,
    FleetPoTimelineEntry,
    PartLinkPayload,
    PoCreatePayload,
    PoItemPayload,
    PoListFilters,
    PoStatus,
    PoUpdatePayload,
} from './types'
import { JobItemPartLinkRow } from '@/store/fleet/jobs/types'

/** PDF extraction runs Claude on the document server-side: allow a few minutes. */
const EXTRACT_TIMEOUT_MS = 300000

function apply(commit: Commit, detail: FleetPoDetail): FleetPoDetail {
    commit('setCurrentIfMatches', detail)
    return detail
}

function opQuery(operatorName?: string | null): string {
    return operatorName ? `?operator_name=${encodeURIComponent(operatorName)}` : ''
}

export const actions: ActionTree<FleetPurchaseOrdersState, RootState> = {
    /** GET /pos/config — whether PDF reading is configured. */
    async loadConfig({ commit, rootGetters }): Promise<FleetPoConfig> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.get(`${baseUrl}/pos/config`)
            commit('setConfig', response.data)
            return response.data
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** GET /pos — list with fulfillment totals. Closed/cancelled only when include_closed. */
    async loadList({ commit, state, rootGetters }, filters: PoListFilters = {}): Promise<FleetPoListRow[]> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        commit('setLoading', true)
        try {
            const includeClosed = filters.include_closed ?? state.includeClosed
            const params = new URLSearchParams()
            if (includeClosed) params.set('include_closed', 'true')
            if (filters.status) params.set('status', filters.status)
            if (filters.customer_id != null) params.set('customer_id', String(filters.customer_id))
            if (filters.q) params.set('q', filters.q)
            if (filters.limit != null) params.set('limit', String(filters.limit))
            const qs = params.toString()
            const response = await axios.get(`${baseUrl}/pos${qs ? '?' + qs : ''}`)
            commit('setIncludeClosed', includeClosed)
            commit('setList', response.data ?? [])
            return response.data ?? []
        } catch (error) {
            const err = toApiError(error)
            throw new Error(`Load purchase orders failed: ${err.message}`)
        } finally {
            commit('setLoading', false)
        }
    },

    /** GET /pos/{id} — becomes current. */
    async loadPo({ commit, rootGetters }, id: number): Promise<FleetPoDetail> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.get(`${baseUrl}/pos/${id}`)
            commit('setCurrent', response.data)
            return response.data
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** GET /pos/{id} without touching current (job dialogs need the PO parts). */
    async fetchPo({ rootGetters }, id: number): Promise<FleetPoDetail> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.get(`${baseUrl}/pos/${id}`)
            return response.data
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** POST /pos/extract — store the PDF as a draft and fill it from the document (slow). */
    async extractPo(
        { rootGetters },
        payload: { file: File; operator_name?: string | null }
    ): Promise<FleetPoDetail> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        const fd = new FormData()
        fd.append('file', payload.file, payload.file.name)
        if (payload.operator_name) fd.append('operator_name', payload.operator_name)
        try {
            const response = await axios.post(`${baseUrl}/pos/extract`, fd, { timeout: EXTRACT_TIMEOUT_MS })
            return response.data
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** POST /pos — manual draft. */
    async createPo({ rootGetters }, payload: PoCreatePayload): Promise<FleetPoDetail> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.post(`${baseUrl}/pos`, payload)
            return response.data
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** PATCH /pos/{id} — header fields. */
    async updatePo({ commit, rootGetters }, payload: { id: number } & PoUpdatePayload): Promise<FleetPoDetail> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const { id, ...body } = payload
            const response = await axios.patch(`${baseUrl}/pos/${id}`, body)
            return apply(commit, response.data)
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** POST /pos/{id}/confirm — draft -> open. */
    async confirmPo(
        { commit, rootGetters },
        payload: { id: number; operator_name?: string | null }
    ): Promise<FleetPoDetail> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.post(`${baseUrl}/pos/${payload.id}/confirm${opQuery(payload.operator_name)}`)
            return apply(commit, response.data)
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** POST /pos/{id}/status */
    async setPoStatus(
        { commit, rootGetters },
        payload: { id: number; status: PoStatus; operator_name?: string | null }
    ): Promise<FleetPoDetail> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.post(`${baseUrl}/pos/${payload.id}/status`, {
                status: payload.status,
                operator_name: payload.operator_name ?? null,
            })
            return apply(commit, response.data)
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** DELETE /pos/{id} — drafts without jobs only. */
    async deletePo({ commit, rootGetters }, id: number) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            await axios.delete(`${baseUrl}/pos/${id}`)
            commit('removeFromList', id)
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** GET /pos/{id}/timeline — newest first; `before` (ISO) pages backwards. */
    async loadTimeline(
        { rootGetters },
        payload: { id: number; limit?: number; before?: string | null }
    ): Promise<FleetPoTimelineEntry[]> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const params = new URLSearchParams()
            if (payload.limit != null) params.set('limit', String(payload.limit))
            if (payload.before) params.set('before', payload.before)
            const qs = params.toString()
            const response = await axios.get(`${baseUrl}/pos/${payload.id}/timeline${qs ? '?' + qs : ''}`)
            return response.data ?? []
        } catch (error) {
            throw toApiError(error)
        }
    },

    // -- Items and parts --------------------------------------------------------

    /** POST /pos/{id}/items — the daemon adds a default part named after the item. */
    async addItem({ commit, rootGetters }, payload: { poId: number } & PoItemPayload): Promise<FleetPoDetail> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const { poId, ...body } = payload
            const response = await axios.post(`${baseUrl}/pos/${poId}/items`, body)
            return apply(commit, response.data)
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** PATCH /pos/{id}/items/{item_id} */
    async updateItem(
        { commit, rootGetters },
        payload: { poId: number; itemId: number } & PoItemPayload
    ): Promise<FleetPoDetail> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const { poId, itemId, ...body } = payload
            const response = await axios.patch(`${baseUrl}/pos/${poId}/items/${itemId}`, body)
            return apply(commit, response.data)
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** DELETE /pos/{id}/items/{item_id} — 409 when its parts have output. */
    async deleteItem(
        { commit, rootGetters },
        payload: { poId: number; itemId: number; operator_name?: string | null }
    ): Promise<FleetPoDetail> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.delete(
                `${baseUrl}/pos/${payload.poId}/items/${payload.itemId}${opQuery(payload.operator_name)}`
            )
            return apply(commit, response.data)
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** POST /pos/{id}/items/{item_id}/parts */
    async addPart(
        { commit, rootGetters },
        payload: { poId: number; itemId: number; name: string; qty_per_item: number; operator_name?: string | null }
    ): Promise<FleetPoDetail> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const { poId, itemId, ...body } = payload
            const response = await axios.post(`${baseUrl}/pos/${poId}/items/${itemId}/parts`, body)
            return apply(commit, response.data)
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** PATCH /pos/{id}/parts/{part_id} */
    async updatePart(
        { commit, rootGetters },
        payload: {
            poId: number
            partId: number
            name?: string
            qty_per_item?: number
            notes?: string | null
            operator_name?: string | null
        }
    ): Promise<FleetPoDetail> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const { poId, partId, ...body } = payload
            const response = await axios.patch(`${baseUrl}/pos/${poId}/parts/${partId}`, body)
            return apply(commit, response.data)
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** DELETE /pos/{id}/parts/{part_id} — 409 when the part has output. */
    async deletePart(
        { commit, rootGetters },
        payload: { poId: number; partId: number; operator_name?: string | null }
    ): Promise<FleetPoDetail> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.delete(
                `${baseUrl}/pos/${payload.poId}/parts/${payload.partId}${opQuery(payload.operator_name)}`
            )
            return apply(commit, response.data)
        } catch (error) {
            throw toApiError(error)
        }
    },

    // -- Jobs -------------------------------------------------------------------

    /** POST /pos/{id}/jobs — link an existing job, optionally with gcode -> part mappings. */
    async linkJob(
        { commit, rootGetters },
        payload: {
            poId: number
            job_id: number
            links: { job_item_id: number; parts: PartLinkPayload[] }[]
            operator_name?: string | null
        }
    ): Promise<FleetPoDetail> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const { poId, ...body } = payload
            const response = await axios.post(`${baseUrl}/pos/${poId}/jobs`, body)
            return apply(commit, response.data)
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** DELETE /pos/{id}/jobs/{job_id} — unlink; drops that job's part links. */
    async unlinkJob(
        { commit, rootGetters },
        payload: { poId: number; jobId: number; operator_name?: string | null }
    ): Promise<FleetPoDetail> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.delete(
                `${baseUrl}/pos/${payload.poId}/jobs/${payload.jobId}${opQuery(payload.operator_name)}`
            )
            return apply(commit, response.data)
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** PUT /jobs/{job_id}/items/{item_id}/parts — which PO parts one gcode produces. */
    async setGcodeParts(
        { rootGetters },
        payload: { jobId: number; itemId: number; parts: PartLinkPayload[]; operator_name?: string | null }
    ): Promise<{ job_id: number; item_id: number; parts: JobItemPartLinkRow[] }> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.put(`${baseUrl}/jobs/${payload.jobId}/items/${payload.itemId}/parts`, {
                parts: payload.parts,
                operator_name: payload.operator_name ?? null,
            })
            return response.data
        } catch (error) {
            throw toApiError(error)
        }
    },
}
