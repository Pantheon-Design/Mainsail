import { Module } from 'vuex'
import { FleetMaintenanceState } from './types'
import { actions } from './actions'
import { mutations } from './mutations'
import { getters } from './getters'

export const getDefaultState = (): FleetMaintenanceState => ({
    printers: [],
    printerDetail: null,
    analytics: null,
    loading: false,
    detailLoading: false,
    printersLoading: false,
})

const state = getDefaultState()

export const maintenance: Module<FleetMaintenanceState, any> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}
