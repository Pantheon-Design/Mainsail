import { ActionTree } from 'vuex'
import axios from 'axios'
import { FleetActivityFilters, FleetActivityState } from './types'
import { RootState } from '@/store/types'
import { FLEET_ACTIVITY_PAGE_LIMIT } from './index'

function buildParams(printer: string, filters: FleetActivityFilters): URLSearchParams {
    const params = new URLSearchParams()
    params.set('printer', printer)
    if (filters.types && filters.types.length) params.set('type', filters.types.join(','))
    if (filters.since) params.set('since', filters.since)
    if (filters.until) params.set('until', filters.until)
    if (filters.job_id) params.set('job_id', filters.job_id)
    params.set('limit', String(filters.limit ?? FLEET_ACTIVITY_PAGE_LIMIT))
    params.set('offset', String(filters.offset ?? 0))

    return params
}

export const actions: ActionTree<FleetActivityState, RootState> = {
    resetLanes({ commit }) {
        commit('resetLanes')
    },

    /** (Re)load the first page of one printer's lane. */
    async loadLane({ commit, rootGetters }, payload: { printer: string; filters?: FleetActivityFilters }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        const printer = payload.printer
        commit('setLaneLoading', { printer, loading: true })
        try {
            const params = buildParams(printer, { ...(payload.filters ?? {}), offset: 0 })
            const response = await axios.get(`${baseUrl}/activity?${params}`)
            commit('setLaneRecords', {
                printer,
                records: response.data.records ?? [],
                total: response.data.total ?? 0,
            })
        } catch (error) {
            console.error(`Failed to load fleet activity for ${printer}:`, error)
            commit('setLaneRecords', { printer, records: [], total: 0 })
        } finally {
            commit('setLaneLoading', { printer, loading: false })
        }
    },

    /** Load the next page of one printer's lane (offset = records loaded so far). */
    async loadMoreLane(
        { commit, rootGetters, state },
        payload: { printer: string; filters?: FleetActivityFilters }
    ): Promise<number> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        const printer = payload.printer
        const lane = state.lanes[printer]
        if (!lane || !lane.hasMore || lane.loadingMore) return 0
        commit('setLaneLoadingMore', { printer, loading: true })
        try {
            const params = buildParams(printer, { ...(payload.filters ?? {}), offset: lane.records.length })
            const response = await axios.get(`${baseUrl}/activity?${params}`)
            const records = response.data.records ?? []
            commit('appendLaneRecords', { printer, records, total: response.data.total ?? 0 })
            return records.length
        } catch (error) {
            console.error(`Failed to load more fleet activity for ${printer}:`, error)
            return 0
        } finally {
            commit('setLaneLoadingMore', { printer, loading: false })
        }
    },

    async loadTypes({ commit, rootGetters }, printer: string | null = null) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const params = new URLSearchParams()
            if (printer) params.set('printer', printer)
            const query = params.toString()
            const response = await axios.get(`${baseUrl}/activity/types${query ? `?${query}` : ''}`)
            commit('setTypes', Array.isArray(response.data) ? response.data : [])
        } catch (error) {
            console.error('Failed to load fleet activity types:', error)
        }
    },

    async loadPrinters({ commit, rootGetters }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.get(`${baseUrl}/activity/printers`)
            commit('setPrinters', Array.isArray(response.data) ? response.data : [])
        } catch (error) {
            console.error('Failed to load fleet activity printers:', error)
        }
    },
}
