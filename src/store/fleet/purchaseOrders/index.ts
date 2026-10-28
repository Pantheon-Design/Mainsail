import { Module } from 'vuex'
import { FleetPurchaseOrdersState } from './types'
import { actions } from './actions'
import { mutations } from './mutations'
import { getters } from './getters'

export const getDefaultState = (): FleetPurchaseOrdersState => ({
    list: [],
    current: null,
    loading: false,
    includeClosed: false,
    config: null,
})

const state = getDefaultState()

export const purchaseOrders: Module<FleetPurchaseOrdersState, any> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}
