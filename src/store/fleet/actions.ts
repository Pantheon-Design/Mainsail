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
            'server.fleet.download',
            { filename: payload.filename },
            { action: 'fleet/receiveDownloadResult' }
        )
    },

    receiveDownloadResult({ commit }, payload: any) {
        // Download completed and print started
        if (payload.status === 'started') {
            commit('setDownloadStatus', {
                filename: payload.filename,
                status: 'complete',
            })
        }
    },

    // Called from WebSocket notification handler
    onFilesChanged({ commit }, payload: any) {
        if (payload.files) {
            commit('setFiles', payload.files)
        }
    },

    onDownloadStatus({ commit }, payload: any) {
        if (payload.download_status) {
            commit('setDownloadStatus', payload.download_status)
        }
    },
}
