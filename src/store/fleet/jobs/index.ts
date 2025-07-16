import { Module } from 'vuex'
import { FleetJobsState } from './types'
import { actions } from './actions'
import { mutations } from './mutations'
import { getters } from './getters'

export const getDefaultState = (): FleetJobsState => {
    return {
        jobs: [],
        customers: [],
        loading: false,
    }
}

const state = getDefaultState()

export const jobs: Module<FleetJobsState, any> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}