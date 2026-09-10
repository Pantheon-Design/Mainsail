import Vue from 'vue'
import { MutationTree } from 'vuex'
import { FleetCustomersState, FleetCustomer } from '@/store/fleet/jobs/types'
import { getDefaultState } from './index'

export const mutations: MutationTree<FleetCustomersState> = {
    reset(state) {
        Object.assign(state, getDefaultState())
    },

    setLoading(state, loading: boolean) {
        Vue.set(state, 'loading', loading)
    },

    setCustomers(state, customers: FleetCustomer[]) {
        Vue.set(state, 'customers', customers)
    },

    upsertCustomer(state, customer: FleetCustomer) {
        const idx = state.customers.findIndex((c) => c.id === customer.id)
        if (idx !== -1) Vue.set(state.customers, idx, customer)
        else {
            state.customers.push(customer)
            state.customers.sort((a, b) => a.name.localeCompare(b.name))
        }
    },

    removeCustomer(state, id: number) {
        const idx = state.customers.findIndex((c) => c.id === id)
        if (idx !== -1) state.customers.splice(idx, 1)
    },
}
