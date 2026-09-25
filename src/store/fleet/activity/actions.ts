import { ActionTree } from 'vuex'
import axios from 'axios'
import { FleetActivityFilters, FleetActivityState } from './types'
import { RootState } from '@/store/types'
import { FLEET_ACTIVITY_PAGE_LIMIT } from './index'

function buildParams(filters: FleetActivityFilters): URLSearchParams {
    const params = new URLSearchParams()
    if (filters.printer) params.set('printer', filters.printer)
    if (filters.types && filters.types.length) params.set('type', filters.types.join(','))
    if (filters.since) params.set('since', filters.since)
    if (filters.until) params.set('until', filters.until)
    if (filters.job_id) params.set('job_id', filters.job_id)
    params.set('limit', String(filters.limit ?? FLEET_ACTIVITY_PAGE_LIMIT))
    params.set('offset', String(filters.offset ?? 0))

    return params
}

export const actions: ActionTree<FleetActivityState, RootState> = {
    async loadActivity({ commit, rootGetters }, filters: FleetActivityFilters = {}) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        commit('setLoading', true)
        try {
            const params = buildParams({ ...filters, offset: 0 })
            const response = await axios.get(`${baseUrl}/activity?${params}`)
            commit('setRecords', response.data.records ?? [])
            commit('setTotal', response.data.total ?? 0)
        } catch (error) {
            console.error('Failed to load fleet activity:', error)
            commit('setRecords', [])
            commit('setTotal', 0)
        } finally {
            commit('setLoading', false)
        }
    },

    async loadMoreActivity({ commit, rootGetters, state }, filters: FleetActivityFilters = {}) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        commit('setLoadingMore', true)
        try {
            const params = buildParams({ ...filters, offset: filters.offset ?? state.records.length })
            const response = await axios.get(`${baseUrl}/activity?${params}`)
            const records = response.data.records ?? []
            commit('appendRecords', records)
            commit('setTotal', response.data.total ?? 0)
            return records.length
        } catch (error) {
            console.error('Failed to load more fleet activity:', error)
            return 0
        } finally {
            commit('setLoadingMore', false)
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
