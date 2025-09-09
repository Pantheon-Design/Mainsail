import { getDefaultState } from './index'
import { MutationTree } from 'vuex'
import { ServerSpoolTrackerState } from './types'
import Vue from 'vue'

export const mutations: MutationTree<ServerSpoolTrackerState> = {
    reset(state) {
        Object.assign(state, getDefaultState())
    },

    setStatus(state, payload) {
        Vue.set(state, 'filament_type', payload.filament_type || 'N/A')
        Vue.set(state, 'filament_name', payload.filament_name || 'Unknown')
        Vue.set(state, 'filament_specs', payload.filament_specs || { density: 0, diameter: 0 })
        Vue.set(state, 'weights', payload.weights || { initial_weight: 0, used_weight: 0, remaining_weight: 0 })
        Vue.set(state, 'lengths', payload.lengths || { used_length: 0, remaining_length: 0 })
        Vue.set(state, 'usage_percentage', payload.usage_percentage || 0)
        Vue.set(state, 'pending_usage_mm', payload.pending_usage_mm || 0)
        Vue.set(state, 'can_track', payload.can_track || false)
        Vue.set(state, 'timestamps', payload.timestamps || { first_used: null, last_used: null })
        Vue.set(state, 'available_filaments', payload.available_filaments || { predefined: [], custom: [], all: [] })
    },

    updateWeights(state, payload) {
        const currentWeights = { ...state.weights, ...payload }
        Vue.set(state, 'weights', currentWeights)
    },

    updateFilament(state, payload) {
        if (payload.filament_type) {
            Vue.set(state, 'filament_type', payload.filament_type)
        }
        if (payload.filament_specs) {
            Vue.set(state, 'filament_specs', payload.filament_specs)
        }
    },

    updateCanTrack(state, canTrack) {
            Vue.set(state, 'can_track', canTrack)
        },

        updateUsagePercentage(state, usagePercentage) {
            Vue.set(state, 'usage_percentage', usagePercentage)
        },
}