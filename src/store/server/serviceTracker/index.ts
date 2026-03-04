import { Module } from 'vuex'
import { ServerServiceTrackerState } from '@/store/server/serviceTracker/types'
import { actions } from '@/store/server/serviceTracker/actions'
import { getters } from '@/store/server/serviceTracker/getters'

export const getDefaultState = (): ServerServiceTrackerState => ({})

// eslint-disable-next-line
export const serviceTracker: Module<ServerServiceTrackerState, any> = {
    namespaced: true,
    state: getDefaultState(),
    getters,
    actions,
}
