import { Module } from 'vuex'
import { FleetGcodesState } from './types'
import { actions } from './actions'
import { mutations } from './mutations'
import { getters } from './getters'

export const getDefaultState = (): FleetGcodesState => ({
    files: [],
    loading: false,
    pushing: {},
    currentPath: '',
})

const state = getDefaultState()

export const gcodes: Module<FleetGcodesState, any> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}
