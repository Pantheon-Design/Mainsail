import { Module } from 'vuex'
import { FleetActivityState } from './types'
import { actions } from './actions'
import { mutations } from './mutations'
import { getters } from './getters'

export const FLEET_ACTIVITY_PAGE_LIMIT = 100

export const getDefaultState = (): FleetActivityState => ({
    records: [],
    total: 0,
    types: [],
    printers: [],
    loading: false,
    loadingMore: false,
})

const state = getDefaultState()

export const activity: Module<FleetActivityState, any> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}
