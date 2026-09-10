import { ActionTree } from 'vuex'
import axios from 'axios'
import { RootState } from '@/store/types'
import { toApiError } from '@/store/fleet/utils'
import { FleetCustomersState, FleetCustomer } from '@/store/fleet/jobs/types'

export interface CustomerPayload {
    name: string
    contact?: string | null
    notes?: string | null
}

export const actions: ActionTree<FleetCustomersState, RootState> = {
    /** GET /customers — includes job_count. */
    async loadCustomers({ commit, rootGetters }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        commit('setLoading', true)
        try {
            const response = await axios.get(`${baseUrl}/customers`)
            commit('setCustomers', response.data ?? [])
        } catch (error) {
            const err = toApiError(error)
            console.error('Failed to load customers:', err.message)
            throw new Error(`Load customers failed: ${err.message}`)
        } finally {
            commit('setLoading', false)
        }
    },

    /** POST /customers — 409 on duplicate name. */
    async createCustomer({ commit, rootGetters }, payload: CustomerPayload): Promise<FleetCustomer> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.post(`${baseUrl}/customers`, payload)
            commit('upsertCustomer', response.data)
            return response.data
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** PATCH /customers/{id} */
    async updateCustomer(
        { commit, rootGetters },
        payload: { id: number } & Partial<CustomerPayload>
    ): Promise<FleetCustomer> {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const { id, ...body } = payload
            const response = await axios.patch(`${baseUrl}/customers/${id}`, body)
            commit('upsertCustomer', response.data)
            return response.data
        } catch (error) {
            throw toApiError(error)
        }
    },

    /** DELETE /customers/{id}[?force=1] — 409 while jobs reference it and not forced. */
    async deleteCustomer({ commit, rootGetters }, payload: { id: number; force?: boolean }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const qs = payload.force ? '?force=1' : ''
            const response = await axios.delete(`${baseUrl}/customers/${payload.id}${qs}`)
            commit('removeCustomer', payload.id)
            return response.data
        } catch (error) {
            throw toApiError(error)
        }
    },
}
