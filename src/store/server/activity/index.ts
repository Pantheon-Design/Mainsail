import { Module } from 'vuex'
import { ServerActivityState } from '@/store/server/activity/types'
import { actions } from '@/store/server/activity/actions'
import { mutations } from '@/store/server/activity/mutations'
import { getters } from '@/store/server/activity/getters'

export const ACTIVITY_PAGE_LIMIT = 100

export const getDefaultState = (): ServerActivityState => {
    return {
        events: [],
        total: 0,
        max_seq: 0,
        min_seq: 0,
        epoch: null,
        serviceTypes: [],
        settings: {
            retention_days: 90,
            record_gcode: true,
            coalesce_window: 10,
        },
        filters: {
            tier: 1,
            types: [],
            after: null,
            before: null,
        },
        hasMore: false,
        loading: false,
        loadingMore: false,
    }
}

// initial state
const state = getDefaultState()

// eslint-disable-next-line
export const activity: Module<ServerActivityState, any> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}
