import { Module } from 'vuex'
import { FleetHistoryState } from './types'
import { actions } from './actions'
import { mutations } from './mutations'
import { getters } from './getters'

export const getDefaultState = (): FleetHistoryState => ({
    records: [],
    analytics: null,
    loading: false,
    analyticsLoading: false,
    total: 0,
    devMode: false,
})

const state = getDefaultState()

export const history: Module<FleetHistoryState, any> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}
