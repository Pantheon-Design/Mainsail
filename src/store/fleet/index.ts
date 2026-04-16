import { Module } from 'vuex'
import { FleetState } from './types'
import { actions } from './actions'
import { mutations } from './mutations'
import { getters } from './getters'

export const getDefaultState = (): FleetState => ({
    connected: false,
    files: [],
    downloadStatus: null,
})

const state = getDefaultState()

export const fleet: Module<FleetState, any> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}
