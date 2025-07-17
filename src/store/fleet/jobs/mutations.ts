import { getDefaultState } from './index'
import Vue from 'vue'
import { MutationTree } from 'vuex'
import { FleetJobsState, FleetJob, FleetCustomer } from './types'

export const mutations: MutationTree<FleetJobsState> = {
    reset(state) {
        Object.assign(state, getDefaultState())
    },

    setLoading(state, loading: boolean) {
        Vue.set(state, 'loading', loading)
    },

    setJobs(state, jobs: FleetJob[]) {
        Vue.set(state, 'jobs', jobs)
    },

    addJob(state, job: FleetJob) {
        const jobs = [...state.jobs]
        jobs.push(job)
        Vue.set(state, 'jobs', jobs)
    },

    updateJob(state, updatedJob: FleetJob) {
        const index = state.jobs.findIndex((job) => job.id === updatedJob.id)
        if (index !== -1) {
            Vue.set(state.jobs, index, updatedJob)
        }
    },

    removeJob(state, jobId: string) {
        const index = state.jobs.findIndex((job) => job.id === jobId)
        if (index !== -1) {
            state.jobs.splice(index, 1)
        }
    },

    setCustomers(state, customers: FleetCustomer[]) {
        Vue.set(state, 'customers', customers)
    },

    addCustomer(state, customer: FleetCustomer) {
        const customers = [...state.customers]
        customers.push(customer)
        Vue.set(state, 'customers', customers)
    },

    updateCustomer(state, updatedCustomer: FleetCustomer) {
        const index = state.customers.findIndex((customer) => customer.id === updatedCustomer.id)
        if (index !== -1) {
            Vue.set(state.customers, index, updatedCustomer)
        }
    },

    removeCustomer(state, customerId: string) {
        const index = state.customers.findIndex((customer) => customer.id === customerId)
        if (index !== -1) {
            state.customers.splice(index, 1)
        }
    },
}
