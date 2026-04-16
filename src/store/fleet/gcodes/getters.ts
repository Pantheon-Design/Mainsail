import { GetterTree } from 'vuex'
import { FleetGcodesState, FleetGcodeFile, FleetDownloadQueueEntry } from './types'

export const getters: GetterTree<FleetGcodesState, any> = {
    getFiles(state): FleetGcodeFile[] {
        return state.files
    },

    recentFiles(state): FleetGcodeFile[] {
        return state.files.filter((f) => f.age_days <= 30)
    },

    archivedFiles(state): FleetGcodeFile[] {
        return state.files.filter((f) => f.age_days > 30)
    },

    isLoading(state): boolean {
        return state.loading
    },

    isPushing: (state) => (filename: string, hostname: string): boolean => {
        return !!state.pushing[`${filename}:${hostname}`]
    },

    isFileCachedOn: (state) => (filename: string, hostname: string): boolean => {
        const file = state.files.find((f) => f.filename === filename)
        return file ? file.cached_on.includes(hostname) : false
    },

    activeDownloads(state): FleetDownloadQueueEntry[] {
        return state.downloadQueue.filter((e) => e.status === 'pending' || e.status === 'downloading')
    },

    downloadHistory(state): FleetDownloadQueueEntry[] {
        return state.downloadQueue.filter((e) => e.status !== 'pending' && e.status !== 'downloading')
    },

    activeDownloadCount(state): number {
        return state.downloadQueue.filter((e) => e.status === 'pending' || e.status === 'downloading').length
    },
}
