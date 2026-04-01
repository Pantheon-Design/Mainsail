import { GetterTree } from 'vuex'
import { FleetArchiveState } from './types'
import { RootState } from '@/store/types'

export const getters: GetterTree<FleetArchiveState, RootState> = {
    getEntries(state) {
        return state.entries
    },
    getTotal(state) {
        return state.total
    },
    getStatus(state) {
        return state.status
    },
    isLoading(state) {
        return state.loading
    },
    isStatusLoading(state) {
        return state.statusLoading
    },
    getSearchQuery(state) {
        return state.searchQuery
    },
}
