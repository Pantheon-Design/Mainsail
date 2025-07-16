import { Module } from 'vuex'
import { jobs } from './jobs'

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
        jobs,
    },
}