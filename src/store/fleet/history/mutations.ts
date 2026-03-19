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

    appendRecords(state, records: FleetHistoryRecord[]) {
        const existing = new Set(state.records.map((r) => r.id))
        const novel = records.filter((r) => !existing.has(r.id))
        Vue.set(state, 'records', [...state.records, ...novel])
    },

    setTotal(state, total: number) {
        Vue.set(state, 'total', total)
    },

    setAnalytics(state, analytics: FleetAnalytics) {
        Vue.set(state, 'analytics', analytics)
    },

    setDevMode(state, enabled: boolean) {
        Vue.set(state, 'devMode', enabled)
    },

    updateRecord(state, updated: FleetHistoryRecord) {
        const index = state.records.findIndex((r) => r.id === updated.id)
        if (index !== -1) {
            Vue.set(state.records, index, updated)
        }
    },

    addRecord(state, record: FleetHistoryRecord) {
        state.records.unshift(record)
    },

    removeRecord(state, id: string) {
        const index = state.records.findIndex((r) => r.id === id)
        if (index !== -1) {
            state.records.splice(index, 1)
        }
    },
}
