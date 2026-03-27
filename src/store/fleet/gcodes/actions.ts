import { ActionTree } from 'vuex'
import { FleetGcodesState } from './types'
import { RootState } from '@/store/types'
import axios, { AxiosProgressEvent } from 'axios'

function extractError(err: any): string {
    if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail
        if (detail) return String(detail)
        if (err.response) return `Server error ${err.response.status}: ${err.response.statusText}`
        if (err.code === 'ECONNABORTED') return 'Request timed out — is fleet_daemon running?'
        if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error'))
            return 'Network error — cannot reach fleet_daemon'
        return err.message || 'Unknown request error'
    }
    if (err instanceof Error) return err.message
    return String(err)
}

export const actions: ActionTree<FleetGcodesState, RootState> = {
    async loadFiles({ commit, rootGetters }, path?: string) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        commit('setLoading', true)
        try {
            const p = path ?? ''
            const response = await axios.get(`${baseUrl}/gcodes?path=${encodeURIComponent(p)}&include_cache_status=true`)
            commit('setFiles', response.data.files ?? [])
        } catch (error) {
            const msg = extractError(error)
            console.error('Failed to load fleet gcodes:', msg)
            throw new Error(`Load fleet gcodes failed: ${msg}`)
        } finally {
            commit('setLoading', false)
        }
    },

    async pushToDevice({ commit, rootGetters }, payload: { filename: string; printer_hostname: string }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        const key = `${payload.filename}:${payload.printer_hostname}`
        commit('setPushing', { key, value: true })
        try {
            await axios.post(`${baseUrl}/gcodes/push`, payload)
        } catch (error) {
            const msg = extractError(error)
            throw new Error(`Push failed: ${msg}`)
        } finally {
            commit('setPushing', { key, value: false })
        }
    },

    async pushToAll({ rootGetters }, payload: { filename: string }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            const response = await axios.post(`${baseUrl}/gcodes/push-all`, payload)
            return response.data
        } catch (error) {
            const msg = extractError(error)
            throw new Error(`Push to all failed: ${msg}`)
        }
    },

    async uploadFile({ rootGetters, commit, state }, payload: File | { file: File; path?: string }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        const file = payload instanceof File ? payload : payload.file
        const explicitPath = payload instanceof File ? undefined : payload.path
        // Use explicit path if provided, otherwise fall back to current browsed path
        const path = explicitPath !== undefined ? explicitPath : state.currentPath
        console.log(`[Fleet GCode Upload] file=${file.name}, path='${path}'`)
        const formData = new FormData()
        formData.append('file', file)
        if (path) formData.append('path', path)

        // Drive the existing upload progress snackbar via root mutations
        commit('files/uploadClearState', null, { root: true })
        commit('files/uploadSetFilename', file.name, { root: true })
        commit('files/uploadSetShow', true, { root: true })

        try {
            await axios.post(`${baseUrl}/gcodes/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 600000,
                onUploadProgress: (progressEvent: AxiosProgressEvent) => {
                    const percent = (progressEvent.progress ?? 0) * 100
                    commit('files/uploadSetPercent', percent, { root: true })
                    commit('files/uploadSetSpeed', progressEvent.rate ?? 0, { root: true })
                },
            })
            commit('files/uploadSetShow', false, { root: true })
        } catch (error) {
            commit('files/uploadSetShow', false, { root: true })
            const msg = extractError(error)
            throw new Error(`Upload failed: ${msg}`)
        }
    },

    async deleteFile({ rootGetters }, filename: string) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            await axios.delete(`${baseUrl}/gcodes/${filename}`)
        } catch (error) {
            const msg = extractError(error)
            throw new Error(`Delete failed: ${msg}`)
        }
    },

    async triggerSync({ rootGetters }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            await axios.post(`${baseUrl}/gcodes/sync`)
        } catch (error) {
            const msg = extractError(error)
            throw new Error(`Sync failed: ${msg}`)
        }
    },

    async createDirectory({ rootGetters }, path: string) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            await axios.post(`${baseUrl}/gcodes/mkdir`, { path })
        } catch (error) {
            const msg = extractError(error)
            throw new Error(`Create directory failed: ${msg}`)
        }
    },

    async moveFile({ rootGetters }, payload: { source: string; destination: string }) {
        const baseUrl = rootGetters['gui/fleetDaemonUrl']
        try {
            await axios.post(`${baseUrl}/gcodes/move`, payload)
        } catch (error) {
            const msg = extractError(error)
            throw new Error(`Move failed: ${msg}`)
        }
    },
}
