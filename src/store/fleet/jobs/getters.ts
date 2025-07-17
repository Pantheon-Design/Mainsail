import { GetterTree } from 'vuex'
import { FleetJobsState, FleetJob } from './types'

export const getters: GetterTree<FleetJobsState, any> = {
    getTotalJobsCount(state): number {
        return state.jobs.length
    },

    getPendingJobsCount(state): number {
        return state.jobs.filter((job: FleetJob) => job.status === 'pending').length
    },

    getInProgressJobsCount(state): number {
        return state.jobs.filter((job: FleetJob) => job.status === 'in_progress').length
    },

    getCompletedJobsCount(state): number {
        return state.jobs.filter((job: FleetJob) => job.status === 'complete').length
    },

    getCancelledJobsCount(state): number {
        return state.jobs.filter((job: FleetJob) => job.status === 'cancelled').length
    },

    getSampleJobsCount(state): number {
        return state.jobs.filter((job: FleetJob) => job.job_type === 'sample').length
    },

    getProductionJobsCount(state): number {
        return state.jobs.filter((job: FleetJob) => job.job_type === 'production').length
    },

    // Updated priority getters to use string comparison
    getHighPriorityJobsCount(state): number {
        return state.jobs.filter((job: FleetJob) => job.priority === 'high').length
    },

    getMediumPriorityJobsCount(state): number {
        return state.jobs.filter((job: FleetJob) => job.priority === 'medium').length
    },

    getLowPriorityJobsCount(state): number {
        return state.jobs.filter((job: FleetJob) => job.priority === 'low').length
    },

    getOverdueJobsCount(state): number {
        const now = new Date()
        return state.jobs.filter((job: FleetJob) => {
            if (!job.due_date || job.status === 'complete' || job.status === 'cancelled') return false
            return new Date(job.due_date) < now
        }).length
    },

    getJobById: (state) => (jobId: string): FleetJob | undefined => {
        return state.jobs.find((job: FleetJob) => job.id === jobId)
    },

    getJobsByCustomerId: (state) => (customerId: string): FleetJob[] => {
        return state.jobs.filter((job: FleetJob) => job.customer_id === customerId)
    },

    getJobsByStatus: (state) => (status: string): FleetJob[] => {
        return state.jobs.filter((job: FleetJob) => job.status === status)
    },

    // Add new getter for jobs by priority
    getJobsByPriority: (state) => (priority: string): FleetJob[] => {
        return state.jobs.filter((job: FleetJob) => job.priority === priority)
    },

    getCustomerById: (state) => (customerId: string) => {
        return state.customers.find(customer => customer.id === customerId)
    },

    getCustomersCount(state): number {
        return state.customers.length
    },

    // Optional: Add priority distribution getter
    getPriorityDistribution(state): { high: number, medium: number, low: number } {
        return {
            high: state.jobs.filter((job: FleetJob) => job.priority === 'high').length,
            medium: state.jobs.filter((job: FleetJob) => job.priority === 'medium').length,
            low: state.jobs.filter((job: FleetJob) => job.priority === 'low').length,
        }
    },
}
