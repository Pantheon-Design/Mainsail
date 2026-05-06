import Vue from 'vue'
import { MutationTree } from 'vuex'
import { ExclusiveLockState, LockRecord, LockStatus } from './types'

export const mutations: MutationTree<ExclusiveLockState> = {
    setStatus(state, status: LockStatus) {
        Vue.set(state, 'status', status)
    },

    setLockData(state, data: LockRecord | null) {
        Vue.set(state, 'lockData', data)
    },

    setHeartbeatTimer(state, id: number | null) {
        Vue.set(state, 'heartbeatTimer', id)
    },

    setPollTimer(state, id: number | null) {
        Vue.set(state, 'pollTimer', id)
    },
}
