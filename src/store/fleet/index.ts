import { Module } from 'vuex'
import { history } from './history'
import { spools } from './spools'
import { gcodes } from './gcodes'
import { archive } from './archive'
import { jobs } from './jobs'
import { customers } from './customers'
import { workers } from './workers'
import { activity } from './activity'
import { maintenance } from './maintenance'

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
        archive,
        jobs,
        customers,
        workers,
        activity,
        maintenance,
    },
}
