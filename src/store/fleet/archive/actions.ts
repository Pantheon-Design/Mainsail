import { ActionTree } from 'vuex'
import { FleetArchiveState } from './types'
import { RootState } from '@/store/types'
import axios from 'axios'

export const actions: ActionTree<FleetArchiveState, RootState> = {
    async loadRecent({ commit, rootGetters }, payload?: { limit?: number; offset?: number }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        const limit = payload?.limit ?? 100
        const offset = payload?.offset ?? 0
        commit('setLoading', true)
        commit('setSearchQuery', '')
        try {
            const response = await axios.get(`${baseUrl}/archive/list`, {
                params: { limit, offset },
            })
            commit('setEntries', response.data.entries ?? [])
            commit('setTotal', response.data.total ?? 0)
        } catch (error) {
            console.error('Failed to load archive list:', error)
            commit('setEntries', [])
        } finally {
            commit('setLoading', false)
        }
    },

    async loadStatus({ commit, rootGetters }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        commit('setStatusLoading', true)
        try {
            const response = await axios.get(`${baseUrl}/archive/status`)
            commit('setStatus', response.data)
        } catch (error) {
            console.error('Failed to load archive status:', error)
        } finally {
            commit('setStatusLoading', false)
        }
    },

    async searchFiles({ commit, rootGetters }, filename: string) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        commit('setLoading', true)
        commit('setSearchQuery', filename)
        try {
            const response = await axios.get(`${baseUrl}/archive/search`, {
                params: { filename },
            })
            commit('setEntries', response.data)
        } catch (error) {
            console.error('Failed to search archive:', error)
            commit('setEntries', [])
        } finally {
            commit('setLoading', false)
        }
    },

    async triggerSweep({ rootGetters }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        await axios.post(`${baseUrl}/archive/sweep`)
    },
}
