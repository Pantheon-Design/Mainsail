import Vue from 'vue'
import { MutationTree } from 'vuex'
import { FleetJobsState, FleetJob, FleetJobDetail, FleetJobItem, FleetJobRun } from './types'
import { getDefaultState } from './index'

export const mutations: MutationTree<FleetJobsState> = {
    reset(state) {
        Object.assign(state, getDefaultState())
    },

    setLoading(state, loading: boolean) {
        Vue.set(state, 'loading', loading)
    },

    setIncludeClosed(state, value: boolean) {
        Vue.set(state, 'includeClosed', value)
    },

    setJobs(state, jobs: FleetJob[]) {
        Vue.set(state, 'jobs', jobs)
    },

    upsertJob(state, job: FleetJob) {
        const idx = state.jobs.findIndex((j) => j.id === job.id)
        if (idx !== -1) Vue.set(state.jobs, idx, job)
        else state.jobs.unshift(job)
    },

    removeJob(state, id: number) {
        const idx = state.jobs.findIndex((j) => j.id === id)
        if (idx !== -1) state.jobs.splice(idx, 1)
        if (state.currentJob?.job.id === id) Vue.set(state, 'currentJob', null)
    },

    setCurrentJob(state, detail: FleetJobDetail | null) {
        Vue.set(state, 'currentJob', detail)
    },

    /** Replace currentJob only when it is the same job (keeps an open details dialog fresh). */
    setCurrentJobIfMatches(state, detail: FleetJobDetail) {
        if (state.currentJob && state.currentJob.job.id === detail.job.id) {
            Vue.set(state, 'currentJob', detail)
        }
    },

    upsertCurrentItem(state, payload: { jobId: number; item: FleetJobItem }) {
        if (!state.currentJob || state.currentJob.job.id !== payload.jobId) return
        const idx = state.currentJob.items.findIndex((i) => i.id === payload.item.id)
        if (idx !== -1) Vue.set(state.currentJob.items, idx, payload.item)
        else state.currentJob.items.push(payload.item)
    },

    removeCurrentItem(state, payload: { jobId: number; itemId: number }) {
        if (!state.currentJob || state.currentJob.job.id !== payload.jobId) return
        const idx = state.currentJob.items.findIndex((i) => i.id === payload.itemId)
        if (idx !== -1) state.currentJob.items.splice(idx, 1)
    },

    setRuns(state, runs: FleetJobRun[]) {
        Vue.set(state, 'runs', runs)
    },
}
