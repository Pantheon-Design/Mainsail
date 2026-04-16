import Vue from 'vue'
import { MutationTree } from 'vuex'
import { FleetGcodesState, FleetGcodeFile, FleetDiskUsage, FleetDownloadQueueEntry } from './types'
import { getDefaultState } from './index'

export const mutations: MutationTree<FleetGcodesState> = {
    reset(state) {
        Object.assign(state, getDefaultState())
    },

    setLoading(state, loading: boolean) {
        Vue.set(state, 'loading', loading)
    },

    setFiles(state, files: FleetGcodeFile[]) {
        Vue.set(state, 'files', files)
    },

    setPushing(state, { key, value }: { key: string; value: boolean }) {
        if (value) {
            Vue.set(state.pushing, key, true)
        } else {
            Vue.delete(state.pushing, key)
        }
    },

    setCurrentPath(state, path: string) {
        Vue.set(state, 'currentPath', path)
    },

    setDiskUsage(state, usage: FleetDiskUsage | null) {
        Vue.set(state, 'diskUsage', usage)
    },

    setDownloadQueue(state, queue: FleetDownloadQueueEntry[]) {
        Vue.set(state, 'downloadQueue', queue)
    },

    setDownloadQueueLoading(state, loading: boolean) {
        Vue.set(state, 'downloadQueueLoading', loading)
    },
}
