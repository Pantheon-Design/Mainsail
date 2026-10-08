import Vue from 'vue'
import { MutationTree } from 'vuex'
import { AirMetric, FleetAirState } from '@/store/fleet/air/types'
import { getDefaultState } from './index'

export const mutations: MutationTree<FleetAirState> = {
    reset(state) {
        Object.assign(state, getDefaultState())
    },

    setLoading(state, loading: boolean) {
        Vue.set(state, 'loading', loading)
    },

    setMetrics(state, metrics: AirMetric[]) {
        Vue.set(state, 'metrics', metrics)
        Vue.set(state, 'error', null)
        Vue.set(state, 'loadedAt', Date.now())
    },

    setError(state, error: string | null) {
        Vue.set(state, 'error', error)
    },
}
