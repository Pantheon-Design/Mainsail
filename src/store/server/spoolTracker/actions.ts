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

    async init({ dispatch, commit, rootGetters }) {
        try {
            const baseUrl = rootGetters['socket/getUrl']
            const response = await fetch(baseUrl + '/server/spool_tracker/status')
            const data = await response.json()
            if (data.result) {
                commit('setStatus', data.result)
            }
        } catch (e) {
            window.console.error('Failed to fetch spool tracker status', e)
        }
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
        //Vue.$toast.error(payload)

        // Handle spoolTracker:usage_updated WebSocket events
        if ('requestParams' in payload) delete payload.requestParams
        
        // Update weights from usage update
        if (payload.remaining_weight !== undefined || payload.used_weight !== undefined) {
            commit('updateWeights', {
                remaining_weight: payload.remaining_weight || 0,
                used_weight: payload.used_weight || 0
            })
        }
        
        // Update filament info to prevent desync if provided in payload
        const filamentUpdate: any = {}
        if (payload.filament_type !== undefined) {
            filamentUpdate.filament_type = payload.filament_type
        }
        if (payload.filament_specs !== undefined) {
            filamentUpdate.filament_specs = payload.filament_specs
        }
        
        if (Object.keys(filamentUpdate).length > 0) {
            commit('updateFilament', filamentUpdate)
        }
        // Update tracking capability status if provided
        if (payload.can_track !== undefined) {
            commit('updateCanTrack', payload.can_track)
        }
        
        // Update usage percentage if provided
        if (payload.usage_percentage !== undefined) {
            commit('updateUsagePercentage', payload.usage_percentage)
        }
    },

    handleFilamentChange({ commit }, payload) {
        // Handle spoolTracker:filament_changed WebSocket events
        if ('requestParams' in payload) delete payload.requestParams
        commit('updateFilament', {
            filament_type: payload.new_type,
            filament_specs: payload.new_specs
        })
    },

    async refreshStatus({ commit, dispatch, rootGetters }) {
        dispatch('socket/addLoading', 'refreshSpoolTrackerStatus', { root: true })
        try {
            const baseUrl = rootGetters['socket/getUrl']
            const response = await fetch(baseUrl + '/server/spool_tracker/status')
            const data = await response.json()
            if (data.result) {
                commit('setStatus', data.result)
            }
        } catch (e) {
            window.console.error('Failed to refresh spool tracker status', e)
        }
        dispatch('socket/removeLoading', 'refreshSpoolTrackerStatus', { root: true })
    },
}
