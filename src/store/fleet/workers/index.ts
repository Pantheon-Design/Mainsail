import { Module } from 'vuex'
import { FleetWorkersState } from '@/store/fleet/jobs/types'
import { actions } from './actions'
import { mutations } from './mutations'
import { getters } from './getters'

export const getDefaultState = (): FleetWorkersState => ({
    workers: [],
    schedulerStatus: null,
    loading: false,
})

const state = getDefaultState()

export const workers: Module<FleetWorkersState, any> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}
