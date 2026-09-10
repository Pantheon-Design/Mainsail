import { Module } from 'vuex'
import { FleetCustomersState } from '@/store/fleet/jobs/types'
import { actions } from './actions'
import { mutations } from './mutations'
import { getters } from './getters'

export const getDefaultState = (): FleetCustomersState => ({
    customers: [],
    loading: false,
})

const state = getDefaultState()

export const customers: Module<FleetCustomersState, any> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}
