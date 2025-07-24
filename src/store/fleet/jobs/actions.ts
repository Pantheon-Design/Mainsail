import Vue from 'vue'
import { ActionTree } from 'vuex'
import { FleetJobsState, FleetJob, FleetCustomer, FleetJobGcode } from './types'
import { FleetJobGcodeRun, FleetJobGcodeRunCreate, FleetJobGcodeRunUpdate } from './types'
import { RootState } from '@/store/types'
import axios from 'axios'

const FLEET_API_URL = 'http://localhost:8090'

// Add these new interfaces for the complete response
interface FleetJobGcodeWithRuns extends FleetJobGcode {
    runs: FleetJobGcodeRun[]
}

interface FleetJobCompleteResponse {
    job: FleetJob
    gcode_files: FleetJobGcodeWithRuns[]
}

export const actions: ActionTree<FleetJobsState, RootState> = {
    reset({ commit }) {
        commit('reset')
    },

    async loadJobs({ commit }) {
        commit('setLoading', true)
        try {
            const response = await axios.get(`${FLEET_API_URL}/jobs`)
            commit('setJobs', response.data)
        } catch (error) {
            console.error('Failed to load jobs:', error)
            throw error
        } finally {
            commit('setLoading', false)
        }
    },

    async loadCustomers({ commit }) {
        try {
            const response = await axios.get(`${FLEET_API_URL}/customers`)
            commit('setCustomers', response.data)
        } catch (error) {
            console.error('Failed to load customers:', error)
            throw error
        }
    },

    async createJob({ commit }, jobData) {
        try {
            const response = await axios.post(`${FLEET_API_URL}/jobs`, jobData)
            commit('addJob', response.data)
            return response.data
        } catch (error) {
            console.error('Failed to create job:', error)
            throw error
        }
    },

    async updateJob({ commit }, { jobId, jobData }) {
        try {
            const response = await axios.put(`${FLEET_API_URL}/jobs/${jobId}`, jobData)
            commit('updateJob', response.data)
            return response.data
        } catch (error) {
            console.error('Failed to update job:', error)
            throw error
        }
    },

    async createCustomer({ commit }, customerData) {
        try {
            const response = await axios.post(`${FLEET_API_URL}/customers`, customerData)
            commit('addCustomer', response.data)
            return response.data
        } catch (error) {
            console.error('Failed to create customer:', error)
            throw error
        }
    },

    async updateJobStatus({ commit, state }, { jobId, status }) {
        try {
            await axios.put(`${FLEET_API_URL}/jobs/${jobId}/status?status=${status}`)

            // Update local state
            const job = state.jobs.find(j => j.id === jobId)
            if (job) {
                const updatedJob = { ...job, status, updated_at: new Date().toISOString() }
                commit('updateJob', updatedJob)
            }
        } catch (error) {
            console.error('Failed to update job status:', error)
            throw error
        }
    },

    async deleteJob({ commit }, jobId: string) {
        try {
            await axios.delete(`${FLEET_API_URL}/jobs/${jobId}`)
            commit('removeJob', jobId)
        } catch (error) {
            console.error('Failed to delete job:', error)
            throw error
        }
    },

    // NEW: Load complete job data (job + gcode files + runs) in single API call
    async loadJobComplete({ }, jobId: string): Promise<FleetJobCompleteResponse> {
        try {
            const response = await axios.get(`${FLEET_API_URL}/jobs/${jobId}/complete`)
            return response.data
        } catch (error) {
            console.error('Failed to load complete job data:', error)
            throw error
        }
    },

    async loadJobGcodes({ }, jobId: string): Promise<FleetJobGcode[]> {
        try {
            const response = await axios.get(`${FLEET_API_URL}/jobs/${jobId}/gcode`)
            return response.data
        } catch (error) {
            console.error('Failed to load job gcodes:', error)
            throw error
        }
    },

    async createJobGcode({ }, { jobId, gcode }) {
        try {
            const response = await axios.post(`${FLEET_API_URL}/jobs/${jobId}/gcode`, gcode)
            return response.data
        } catch (error) {
            console.error('Failed to create job gcode:', error)
            throw error
        }
    },

    // NEW: Update job gcode
    async updateJobGcode({ }, { gcodeId, gcode }) {
        try {
            const response = await axios.put(`${FLEET_API_URL}/gcode/${gcodeId}`, gcode)
            return response.data
        } catch (error) {
            console.error('Failed to update job gcode:', error)
            throw error
        }
    },

    // NEW: Delete job gcode
    async deleteJobGcode({ }, gcodeId: string) {
        try {
            await axios.delete(`${FLEET_API_URL}/gcode/${gcodeId}`)
        } catch (error) {
            console.error('Failed to delete job gcode:', error)
            throw error
        }
    },

    async loadJobGcodeRuns({ }, jobGcodeId: string): Promise<FleetJobGcodeRun[]> {
        try {
            const response = await axios.get(`${FLEET_API_URL}/gcode/${jobGcodeId}/runs`)
            return response.data
        } catch (error) {
            console.error('Failed to load job gcode runs:', error)
            throw error
        }
    },

    async createJobGcodeRun({ }, { jobGcodeId, run }: { jobGcodeId: string, run: FleetJobGcodeRunCreate }) {
        try {
            const response = await axios.post(`${FLEET_API_URL}/gcode/${jobGcodeId}/runs`, run)
            return response.data
        } catch (error) {
            console.error('Failed to create job gcode run:', error)
            throw error
        }
    },

    async getJobGcodeRun({ }, runId: string): Promise<FleetJobGcodeRun> {
        try {
            const response = await axios.get(`${FLEET_API_URL}/runs/${runId}`)
            return response.data
        } catch (error) {
            console.error('Failed to get job gcode run:', error)
            throw error
        }
    },

    async updateJobGcodeRun({ }, { runId, updateData }: { runId: string, updateData: FleetJobGcodeRunUpdate }) {
        try {
            const response = await axios.put(`${FLEET_API_URL}/runs/${runId}`, updateData)
            return response.data
        } catch (error) {
            console.error('Failed to update job gcode run:', error)
            throw error
        }
    },

    async updateJobGcodeRunQC({ }, { runId, qc }: { runId: string, qc: string | null }) {
        try {
            await axios.put(`${FLEET_API_URL}/runs/${runId}/qc?qc=${qc || ''}`)
        } catch (error) {
            console.error('Failed to update job gcode run QC:', error)
            throw error
        }
    },

    async deleteJobGcodeRun({ }, runId: string) {
        try {
            await axios.delete(`${FLEET_API_URL}/runs/${runId}`)
        } catch (error) {
            console.error('Failed to delete job gcode run:', error)
            throw error
        }
    },

    async updateCustomer({ commit }, { customerId, customerData }) {
        try {
            const response = await axios.put(`${FLEET_API_URL}/customers/${customerId}`, customerData)
            commit('updateCustomer', response.data)
            return response.data
        } catch (error) {
            console.error('Failed to update customer:', error)
            throw error
        }
    },

    async deleteCustomer({ commit }, customerId: string) {
        try {
            await axios.delete(`${FLEET_API_URL}/customers/${customerId}`)
            commit('removeCustomer', customerId)
        } catch (error) {
            console.error('Failed to delete customer:', error)
            throw error
        }
    },

    async createJobGcodesBatch({ }, { jobId, gcodeFiles }) {
        try {
            const response = await axios.post(`${FLEET_API_URL}/jobs/${jobId}/gcode/batch`, {
                gcode_files: gcodeFiles
            })
            return response.data
        } catch (error) {
            console.error('Failed to create job gcodes batch:', error)
            throw error
        }
    },

}
