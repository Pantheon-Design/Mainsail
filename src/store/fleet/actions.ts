import Vue from 'vue'
import { ActionTree } from 'vuex'
import { FleetState } from './types'
import { RootState } from '@/store/types'

export const actions: ActionTree<FleetState, RootState> = {
    init({ dispatch }) {
        dispatch('loadFiles')
    },

    loadFiles({ commit }) {
        Vue.$socket.emit(
            'server.fleet.files',
            {},
            { action: 'fleet/receiveFiles' }
        )
        // Also subscribe to fleet notifications
        Vue.$socket.emit('server.fleet.status', {}, {})
    },

    receiveStatus({ commit }, payload: any) {
        if (payload.connected !== undefined) {
            commit('setConnected', payload.connected)
        }
        if (payload.download_status) {
            commit('setDownloadStatus', payload.download_status)
        }
    },

    receiveFiles({ commit }, payload: any) {
        if (payload.files) {
            commit('setFiles', payload.files)
        }
        if (payload.connected !== undefined) {
            commit('setConnected', payload.connected)
        }
    },

    downloadAndPrint({ commit }, payload: { filename: string }) {
        Vue.$socket.emit(
            'server.fleet.download_and_print',
            { filename: payload.filename },
            { action: 'fleet/receiveDownloadResult' }
        )
    },

    download({ commit }, payload: { filename: string }) {
        Vue.$socket.emit(
            'server.fleet.download_file',
            { filename: payload.filename },
            { action: 'fleet/receiveDownloadResult' }
        )
    },

    receiveDownloadResult({ commit }, payload: any) {
        if (payload.status === 'queued') {
            // Download accepted — progress will come via notifications
            commit('setDownloadStatus', {
                filename: payload.filename,
                status: 'downloading',
            })
        } else if (payload.status === 'started' || payload.status === 'already_local' || payload.status === 'downloaded') {
            commit('setDownloadStatus', {
                filename: payload.filename,
                status: 'complete',
            })
        }
    },

    // Called from WebSocket notification handler
    onFilesChanged({ commit, dispatch }, payload: any) {
        if (payload.files) {
            commit('setFiles', payload.files)
        } else {
            // Fallback: if notification didn't include files, fetch them
            dispatch('loadFiles')
        }
    },

    onDownloadStatus({ commit, state }, payload: any) {
        const ds = payload?.download_status
        commit('setDownloadStatus', ds ?? null)
        if (!ds) return

        const key = `${ds.filename}|${ds.status}`
        if (key === state.lastDownloadToastKey) return

        if (ds.status === 'complete') {
            commit('setLastDownloadToastKey', key)
            const base = ds.filename.split('/').pop() ?? ds.filename
            Vue.$toast.success(`Fleet download complete: ${base}`)
        } else if (ds.status === 'error') {
            commit('setLastDownloadToastKey', key)
            const base = ds.filename.split('/').pop() ?? ds.filename
            const detail = ds.error ? `: ${ds.error}` : ''
            Vue.$toast.error(`Fleet download failed — ${base}${detail}`)
        }
    },

    onConnectionStatus({ commit, state }, payload: any) {
        const connected = !!payload?.connected
        if (connected === state.connected) return
        commit('setConnected', connected)

        if (connected) {
            Vue.$toast.success('Moonraker reconnected to fleet_daemon')
        } else {
            Vue.$toast.error('Moonraker lost connection to fleet_daemon')
        }
    },
}
