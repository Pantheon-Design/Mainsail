import { Module } from 'vuex'
import { FleetJobsState } from './types'
import { actions } from './actions'
import { mutations } from './mutations'
import { getters } from './getters'

export const getDefaultState = (): FleetJobsState => ({
    jobs: [],
    currentJob: null,
    runs: [],
    loading: false,
    includeClosed: false,
})

const state = getDefaultState()

export const jobs: Module<FleetJobsState, any> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}
