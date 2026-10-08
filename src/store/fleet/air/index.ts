import { Module } from 'vuex'
import { FleetAirState } from '@/store/fleet/air/types'
import { actions } from './actions'
import { mutations } from './mutations'
import { getters } from './getters'

export const getDefaultState = (): FleetAirState => ({
    metrics: [],
    loading: false,
    error: null,
    loadedAt: null,
})

const state = getDefaultState()

export const air: Module<FleetAirState, any> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}
