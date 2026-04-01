import { Module } from 'vuex'
import { FleetArchiveState } from './types'
import { actions } from './actions'
import { mutations } from './mutations'
import { getters } from './getters'

export const getDefaultState = (): FleetArchiveState => ({
    entries: [],
    total: 0,
    status: null,
    loading: false,
    statusLoading: false,
    searchQuery: '',
})

const state = getDefaultState()

export const archive: Module<FleetArchiveState, any> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}
