import Vue from 'vue'
import { ActionTree } from 'vuex'
import { RootState } from '@/store/types'
import { ServerServiceTrackerState } from '@/store/server/serviceTracker/types'

export const actions: ActionTree<ServerServiceTrackerState, RootState> = {
    async resetTripmeter({ rootGetters }, axis: 'x' | 'y' | 'z' | 'e') {
        try {
            const baseUrl = rootGetters['socket/getUrl']
            await fetch(baseUrl + `/server/spool_tracker/status?reset_tripmeter_${axis}=true`, { method: 'POST' })
        } catch (e) {
            window.console.error(`Failed to reset tripmeter_${axis}`, e)
        }
    },

    setNozzleLife(_ctx, payload: { nozzle_type: string; nozzle_size: string; nozzle_life: number; remaining_nozzle_life: number }) {
        Vue.$socket.emit('server.database.post_item', { namespace: 'HS3', key: 'nozzle_type', value: payload.nozzle_type })
        Vue.$socket.emit('server.database.post_item', { namespace: 'HS3', key: 'nozzle_size', value: payload.nozzle_size })
        Vue.$socket.emit('server.database.post_item', { namespace: 'HS3', key: 'nozzle_life', value: payload.nozzle_life })
        Vue.$socket.emit('server.database.post_item', { namespace: 'HS3', key: 'remaining_nozzle_life', value: payload.remaining_nozzle_life })
    },
}
