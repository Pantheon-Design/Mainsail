import { Module } from 'vuex'
import { ServerSpoolTrackerState } from '@/store/server/spoolTracker/types'
import { actions } from '@/store/server/spoolTracker/actions'
import { mutations } from '@/store/server/spoolTracker/mutations'
import { getters } from '@/store/server/spoolTracker/getters'

export const getDefaultState = (): ServerSpoolTrackerState => {
    return {
        filament_type: 'N/A',
        filament_name: 'Unknown',
        filament_specs: {
            density: 0,
            diameter: 0,
        },
        weights: {
            initial_weight: 0,
            used_weight: 0,
            remaining_weight: 0,
        },
        lengths: {
            used_length: 0,
            remaining_length: 0,
        },
        usage_percentage: 0,
        pending_usage_mm: 0,
        can_track: false,
        timestamps: {
            first_used: null,
            last_used: null,
        },
        available_filaments: {
            predefined: [],
            custom: [],
            all: [],
        },
    }
}

// initial state
const state = getDefaultState()

// eslint-disable-next-line
export const spoolTracker: Module<ServerSpoolTrackerState, any> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}