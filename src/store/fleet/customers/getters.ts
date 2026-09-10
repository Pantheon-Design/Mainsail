import { GetterTree } from 'vuex'
import { FleetCustomersState, FleetCustomer } from '@/store/fleet/jobs/types'

export const getters: GetterTree<FleetCustomersState, any> = {
    getCustomers(state): FleetCustomer[] {
        return state.customers
    },

    isLoading(state): boolean {
        return state.loading
    },

    getCustomerById: (state) => (id: number): FleetCustomer | undefined => {
        return state.customers.find((c) => c.id === id)
    },
}
