import { Module } from 'vuex'
import { history } from './history'
import { spools } from './spools'
import { gcodes } from './gcodes'

const state = {}
const getters = {}
const mutations = {}
const actions = {}

export const fleet: Module<any, any> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
    modules: {
        history,
        spools,
        gcodes,
    },
}
