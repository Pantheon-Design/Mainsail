import Vue from 'vue'
import { MutationTree } from 'vuex'
import { FleetHistoryState, FleetHistoryRecord, FleetAnalytics } from './types'
import { getDefaultState } from './index'

export const mutations: MutationTree<FleetHistoryState> = {
    reset(state) {
        Object.assign(state, getDefaultState())
    },

    setLoading(state, loading: boolean) {
        Vue.set(state, 'loading', loading)
    },

    setAnalyticsLoading(state, loading: boolean) {
        Vue.set(state, 'analyticsLoading', loading)
    },

    setRecords(state, records: FleetHistoryRecord[]) {
        Vue.set(state, 'records', records)
    },

    setTotal(state, total: number) {
        Vue.set(state, 'total', total)
    },

    setAnalytics(state, analytics: FleetAnalytics) {
        Vue.set(state, 'analytics', analytics)
    },

    updateRecord(state, updated: FleetHistoryRecord) {
        const index = state.records.findIndex((r) => r.id === updated.id)
        if (index !== -1) {
            Vue.set(state.records, index, updated)
        }
    },
}
