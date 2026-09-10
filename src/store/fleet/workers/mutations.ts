import Vue from 'vue'
import { MutationTree } from 'vuex'
import { FleetWorkersState, FleetWorker, FleetWorkerRow, FleetSchedulerStatus } from '@/store/fleet/jobs/types'
import { getDefaultState } from './index'

export const mutations: MutationTree<FleetWorkersState> = {
    reset(state) {
        Object.assign(state, getDefaultState())
    },

    setLoading(state, loading: boolean) {
        Vue.set(state, 'loading', loading)
    },

    setWorkers(state, workers: FleetWorker[]) {
        Vue.set(state, 'workers', workers)
    },

    /** Apply the enabled/note fields from a PATCH /workers response to the matching row. */
    patchWorker(state, row: FleetWorkerRow) {
        const host = row.printer_hostname.toLowerCase()
        const idx = state.workers.findIndex((w) => w.printer_hostname.toLowerCase() === host)
        if (idx === -1) return
        Vue.set(state.workers, idx, {
            ...state.workers[idx],
            enabled: row.enabled,
            note: row.note ?? state.workers[idx].note,
            worker_updated_at: row.updated_at ?? state.workers[idx].worker_updated_at,
        })
    },

    setSchedulerStatus(state, status: FleetSchedulerStatus | null) {
        Vue.set(state, 'schedulerStatus', status)
    },
}
