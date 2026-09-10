import { GetterTree } from 'vuex'
import { FleetJobsState, FleetJob, FleetJobDetail, FleetJobRun, CLOSED_JOB_STATUSES } from './types'

export const getters: GetterTree<FleetJobsState, any> = {
    getJobs(state): FleetJob[] {
        return state.jobs
    },

    getOpenJobs(state): FleetJob[] {
        return state.jobs.filter((j) => !CLOSED_JOB_STATUSES.includes(j.status))
    },

    getCurrentJob(state): FleetJobDetail | null {
        return state.currentJob
    },

    getRuns(state): FleetJobRun[] {
        return state.runs
    },

    isLoading(state): boolean {
        return state.loading
    },

    getIncludeClosed(state): boolean {
        return state.includeClosed
    },

    getJobById: (state) => (id: number): FleetJob | undefined => {
        return state.jobs.find((j) => j.id === id)
    },
}
