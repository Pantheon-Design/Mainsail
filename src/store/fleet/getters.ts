import { GetterTree } from 'vuex'
import { FleetState, FleetFile } from './types'

export const getters: GetterTree<FleetState, any> = {
    isConnected(state): boolean {
        return state.connected
    },

    getFiles(state): FleetFile[] {
        return state.files
    },

    getLocalFiles(state): FleetFile[] {
        return state.files.filter((f) => f.is_local)
    },

    getRemoteFiles(state): FleetFile[] {
        return state.files.filter((f) => !f.is_local)
    },

    isDownloading(state): boolean {
        const s = state.downloadStatus?.status
        return s === 'requesting' || s === 'downloading' || s === 'processing' || s === 'starting_print'
    },
}
