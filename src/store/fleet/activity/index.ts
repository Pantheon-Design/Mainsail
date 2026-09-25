import { Module } from 'vuex'
import { FleetActivityLane, FleetActivityState } from './types'
import { actions } from './actions'
import { mutations } from './mutations'
import { getters } from './getters'

export const FLEET_ACTIVITY_PAGE_LIMIT = 100

export const getDefaultLane = (): FleetActivityLane => ({
    records: [],
    total: 0,
    hasMore: false,
    loading: false,
    loadingMore: false,
})

export const getDefaultState = (): FleetActivityState => ({
    lanes: {},
    types: [],
    printers: [],
})

const state = getDefaultState()

export const activity: Module<FleetActivityState, any> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}
