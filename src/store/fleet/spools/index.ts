import { Module } from 'vuex'
import { FleetSpoolsState } from './types'
import { actions } from './actions'
import { mutations } from './mutations'
import { getters } from './getters'

export const getDefaultState = (): FleetSpoolsState => ({
    vendors: [],
    filaments: [],
    spools: [],
    loading: false,
})

const state = getDefaultState()

export const spools: Module<FleetSpoolsState, any> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}
