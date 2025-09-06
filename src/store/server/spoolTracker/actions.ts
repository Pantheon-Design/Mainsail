import Vue from 'vue'
import { ActionTree } from 'vuex'
import { RootState } from '@/store/types'
import { ServerSpoolTrackerState } from '@/store/server/spoolTracker/types'

function convertV2response(payload: { error?: { message: string } | null; response: any }) {
    if ((payload.error?.message ?? null) !== null) {
        Vue.$toast.error(payload.error?.message ?? 'unknown spool tracker error')
        return null
    }

    // if the response is v2, we need to get the response into the payload
    if ('response' in payload) return payload.response

    return payload
}

export const actions: ActionTree<ServerSpoolTrackerState, RootState> = {
    reset({ commit }) {
        commit('reset')
    },

    init({ dispatch }) {
        Vue.$socket.emit(
            'server.spool_tracker.status',
            {},
            { action: 'server/spoolTracker/getStatus' }
        )

        dispatch('socket/addInitModule', 'server/spoolTracker/getStatus', { root: true })
        dispatch('socket/removeInitModule', 'server/spoolTracker/init', { root: true })
    },

    getStatus({ commit, dispatch }, payload) {
        if ('requestParams' in payload) delete payload.requestParams
        dispatch('socket/removeInitModule', 'server/spoolTracker/getStatus', { root: true })
        
        payload = convertV2response(payload)
        if (payload === null) return

        commit('setStatus', payload)
    },

    handleUsageUpdate({ commit }, payload) {
        // Handle spoolTracker:usage_updated WebSocket events
        if ('requestParams' in payload) delete payload.requestParams
        
        // Update only the weights from usage update
        commit('updateWeights', {
            remaining_weight: payload.remaining_weight || 0
        })
    },

    handleFilamentChange({ commit }, payload) {
        // Handle spoolTracker:filament_changed WebSocket events
        if ('requestParams' in payload) delete payload.requestParams
        
        commit('updateFilament', {
            filament_type: payload.new_type,
            filament_specs: payload.new_specs
        })
    },

    refreshStatus({ dispatch }) {
        dispatch('getStatus')
        dispatch('socket/addLoading', 'refreshSpoolTrackerStatus', { root: true })
    },
}