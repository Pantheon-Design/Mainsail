import Vue from 'vue'
import { MutationTree } from 'vuex'
import { FleetState, FleetFile, FleetDownloadStatus } from './types'

export const mutations: MutationTree<FleetState> = {
    setConnected(state, connected: boolean) {
        Vue.set(state, 'connected', connected)
    },

    setFiles(state, files: FleetFile[]) {
        Vue.set(state, 'files', files)
    },

    setDownloadStatus(state, status: FleetDownloadStatus | null) {
        Vue.set(state, 'downloadStatus', status)
    },
}
