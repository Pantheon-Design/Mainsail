import { ActionTree } from 'vuex'
import axios from 'axios'
import { RootState } from '@/store/types'
import { toApiError, encodePath } from '@/store/fleet/utils'
import {
    FleetJobsState,
    FleetJobDetail,
    FleetJobItem,
    FleetGcodeMeta,
    JobCreatePayload,
    JobUpdatePayload,
    JobItemCreatePayload,
    JobItemUpdatePayload,
    JobListFilters,
    RunListFilters,
    JobStatus,
} from './types'

export const actions: ActionTree<FleetJobsState, RootState> = {
    /** GET /jobs — list with aggregates. Closed jobs only when includeClosed. */
    async loadJobs({ commit, state, rootGetters }, filters: JobListFilters = {}) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        commit('setLoading', true)
        try {
            const includeClosed = filters.includeClosed ?? state.includeClosed
            const params = new URLSearchParams()
            if (includeClosed) params.set('include_closed', '1')
            if (filters.status) params.set('status', filters.status)
            if (filters.customer_id != null) params.set('customer_id', String(filters.customer_id))
            if (filters.limit != null) params.set('limit', String(filters.limit))
            const qs = params.toString()
            const response = await axios.get(`${baseUrl}/jobs${qs ? '?' + qs : ''}`)
            commit('setIncludeClosed', includeClosed)
            commit('setJobs', response.data ?? [])
        } catch (error) {
            const err = toApiError(error)
            console.error('Failed to load jobs:', err.message)
            throw new Error(`Load jobs failed: ${err.message}`)
        } finally {
            commit('setLoading', false)
        }
    },

    /** GET /jobs/{id} — {job, items, runs}; becomes currentJob. */
    async loadJob({ commit, rootGetters }, id: number): Promise<FleetJobDetail> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.get(`${baseUrl}/jobs/${id}`)
            const detail: FleetJobDetail = response.data
            commit('setCurrentJob', detail)
            commit('upsertJob', detail.job)
            return detail
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** POST /jobs — job + items in one call. Returns the detail. */
    async createJob({ commit, rootGetters }, payload: JobCreatePayload): Promise<FleetJobDetail> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.post(`${baseUrl}/jobs`, payload)
            const detail: FleetJobDetail = response.data
            commit('upsertJob', detail.job)
            return detail
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** PATCH /jobs/{id} — header fields only. Returns the detail. */
    async updateJob(
        { commit, rootGetters },
        payload: { id: number } & JobUpdatePayload
    ): Promise<FleetJobDetail> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const { id, ...body } = payload
            const response = await axios.patch(`${baseUrl}/jobs/${id}`, body)
            const detail: FleetJobDetail = response.data
            commit('upsertJob', detail.job)
            commit('setCurrentJobIfMatches', detail)
            return detail
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** POST /jobs/{id}/status — pending | on_hold | cancelled | complete. */
    async setJobStatus(
        { commit, rootGetters },
        payload: { id: number; status: JobStatus }
    ): Promise<FleetJobDetail> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.post(`${baseUrl}/jobs/${payload.id}/status`, { status: payload.status })
            const detail: FleetJobDetail = response.data
            commit('upsertJob', detail.job)
            commit('setCurrentJobIfMatches', detail)
            return detail
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** DELETE /jobs/{id} — 409 while the job has active runs. */
    async deleteJob({ commit, rootGetters }, id: number) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            await axios.delete(`${baseUrl}/jobs/${id}`)
            commit('removeJob', id)
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** POST /jobs/{id}/items — returns the new item row. */
    async addItem(
        { commit, rootGetters },
        payload: { jobId: number } & JobItemCreatePayload
    ): Promise<FleetJobItem> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const { jobId, ...body } = payload
            const response = await axios.post(`${baseUrl}/jobs/${jobId}/items`, body)
            commit('upsertCurrentItem', { jobId, item: response.data })
            return response.data
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** PATCH /jobs/{id}/items/{item_id} */
    async updateItem(
        { commit, rootGetters },
        payload: { jobId: number; itemId: number } & JobItemUpdatePayload
    ): Promise<FleetJobItem> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const { jobId, itemId, ...body } = payload
            const response = await axios.patch(`${baseUrl}/jobs/${jobId}/items/${itemId}`, body)
            commit('upsertCurrentItem', { jobId, item: response.data })
            return response.data
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** DELETE /jobs/{id}/items/{item_id}[?force=1] — 409 when runs exist and not forced. */
    async deleteItem({ commit, rootGetters }, payload: { jobId: number; itemId: number; force?: boolean }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const qs = payload.force ? '?force=1' : ''
            await axios.delete(`${baseUrl}/jobs/${payload.jobId}/items/${payload.itemId}${qs}`)
            commit('removeCurrentItem', { jobId: payload.jobId, itemId: payload.itemId })
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** POST /runs/{id}/cancel */
    async cancelRun({ rootGetters }, payload: { runId: number; cancel_print?: boolean; notes?: string | null }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.post(`${baseUrl}/runs/${payload.runId}/cancel`, {
                cancel_print: payload.cancel_print ?? true,
                notes: payload.notes ?? null,
            })
            return response.data
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** GET /runs?printer=&status=&job_id=&active=&limit= */
    async loadRuns({ commit, rootGetters }, filters: RunListFilters = {}) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const params = new URLSearchParams()
            if (filters.printer) params.set('printer', filters.printer)
            if (filters.status) params.set('status', filters.status)
            if (filters.job_id != null) params.set('job_id', String(filters.job_id))
            if (filters.active) params.set('active', '1')
            if (filters.limit != null) params.set('limit', String(filters.limit))
            const qs = params.toString()
            const response = await axios.get(`${baseUrl}/runs${qs ? '?' + qs : ''}`)
            commit('setRuns', response.data ?? [])
            return response.data
        } catch (error) {
            const err = toApiError(error)
            throw new Error(`Load runs failed: ${err.message}`)
        }
    },

    /** GET /gcodes/{filename}/meta — no commit; used by the job form to prefill items. */
    async fetchGcodeMeta({ rootGetters }, filename: string): Promise<FleetGcodeMeta> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.get(`${baseUrl}/gcodes/${encodePath(filename)}/meta`)
            return response.data
        } catch (error) {
            throw toApiError(error)
        }
    },
}
