import { GetterTree } from 'vuex'
import { FleetWorkersState, FleetWorker, FleetSchedulerStatus } from '@/store/fleet/jobs/types'

export const getters: GetterTree<FleetWorkersState, any> = {
    getWorkers(state): FleetWorker[] {
        return state.workers
    },

    getEnabledWorkers(state): FleetWorker[] {
        return state.workers.filter((w) => w.enabled)
    },

    getSchedulerStatus(state): FleetSchedulerStatus | null {
        return state.schedulerStatus
    },

    isLoading(state): boolean {
        return state.loading
    },

    getWorkerByHostname: (state) => (hostname: string): FleetWorker | undefined => {
        const h = hostname.toLowerCase()
        return state.workers.find((w) => w.printer_hostname.toLowerCase() === h)
    },
}
