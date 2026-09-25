import Vue from 'vue'
import { MutationTree } from 'vuex'
import { FleetActivityPrinterCount, FleetActivityRecord, FleetActivityState, FleetActivityTypeCount } from './types'
import { getDefaultState } from './index'

export const mutations: MutationTree<FleetActivityState> = {
    reset(state) {
        Object.assign(state, getDefaultState())
    },

    setLoading(state, loading: boolean) {
        Vue.set(state, 'loading', loading)
    },

    setLoadingMore(state, loading: boolean) {
        Vue.set(state, 'loadingMore', loading)
    },

    setRecords(state, records: FleetActivityRecord[]) {
        Vue.set(state, 'records', records)
    },

    appendRecords(state, records: FleetActivityRecord[]) {
        const existing = new Set(state.records.map((r) => r.id))
        const novel = records.filter((r) => !existing.has(r.id))
        Vue.set(state, 'records', [...state.records, ...novel])
    },

    setTotal(state, total: number) {
        Vue.set(state, 'total', total)
    },

    setTypes(state, types: FleetActivityTypeCount[]) {
        Vue.set(state, 'types', types)
    },

    setPrinters(state, printers: FleetActivityPrinterCount[]) {
        Vue.set(state, 'printers', printers)
    },
}
