import Vue from 'vue'
import { MutationTree } from 'vuex'
import { FleetPurchaseOrdersState, FleetPoListRow, FleetPoDetail, FleetPoConfig } from './types'
import { getDefaultState } from './index'

export const mutations: MutationTree<FleetPurchaseOrdersState> = {
    reset(state) {
        Object.assign(state, getDefaultState())
    },

    setLoading(state, loading: boolean) {
        Vue.set(state, 'loading', loading)
    },

    setIncludeClosed(state, value: boolean) {
        Vue.set(state, 'includeClosed', value)
    },

    setList(state, rows: FleetPoListRow[]) {
        Vue.set(state, 'list', rows)
    },

    removeFromList(state, id: number) {
        const idx = state.list.findIndex((p) => p.id === id)
        if (idx !== -1) state.list.splice(idx, 1)
        if (state.current?.po.id === id) Vue.set(state, 'current', null)
    },

    setCurrent(state, detail: FleetPoDetail | null) {
        Vue.set(state, 'current', detail)
    },

    /** Replace current only when it is the same PO (keeps an open details dialog fresh). */
    setCurrentIfMatches(state, detail: FleetPoDetail) {
        if (state.current && state.current.po.id === detail.po.id) Vue.set(state, 'current', detail)
    },

    setConfig(state, config: FleetPoConfig | null) {
        Vue.set(state, 'config', config)
    },
}
