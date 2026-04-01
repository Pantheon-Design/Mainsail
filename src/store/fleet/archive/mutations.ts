import { MutationTree } from 'vuex'
import { FleetArchiveState, FleetArchiveEntry, FleetArchiveStatus } from './types'

export const mutations: MutationTree<FleetArchiveState> = {
    setEntries(state, entries: FleetArchiveEntry[]) {
        state.entries = entries
    },
    setTotal(state, total: number) {
        state.total = total
    },
    setStatus(state, status: FleetArchiveStatus) {
        state.status = status
    },
    setLoading(state, loading: boolean) {
        state.loading = loading
    },
    setStatusLoading(state, loading: boolean) {
        state.statusLoading = loading
    },
    setSearchQuery(state, query: string) {
        state.searchQuery = query
    },
}
