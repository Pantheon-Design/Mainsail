import { ActionTree } from 'vuex'
import { EditorState } from '@/store/editor/types'
import { RootState } from '@/store/types'
import axios from 'axios'
import Vue from 'vue'
import i18n from '@/plugins/i18n'
import { windowBeforeUnloadFunction } from '@/plugins/helpers'

export const actions: ActionTree<EditorState, RootState> = {
    reset({ commit }) {
        commit('reset')
    },

    downloadProgress({ state, commit }, payload: { progressEvent: any; direction: string; filesize: number | null }) {
        let speedOutput: string = state.loaderProgress.speed
        let lastTimestamp = state.loaderProgress.lastTimestamp
        let lastLoaded = state.loaderProgress.lastLoaded

        const diffTime = payload.progressEvent.timeStamp - state.loaderProgress.lastTimestamp
        if (diffTime > 500) {
            const diffData = payload.progressEvent.loaded - lastLoaded
            let speed = diffData / diffTime
            const unit = ['kB', 'MB', 'GB']
            let unitSelect = 0
            while (speed > 1024) {
                speed /= 1024.0
                unitSelect = Math.min(2, unitSelect + 1)
            }
            speedOutput = speed.toFixed(2) + unit[unitSelect]
            lastTimestamp = payload.progressEvent.timeStamp
            lastLoaded = payload.progressEvent.loaded
        }

        commit('updateLoader', {
            direction: payload.direction,
            speed: speedOutput,
            loaded: payload.progressEvent.loaded,
            total: payload.filesize ?? payload.progressEvent.total,
            lastLoaded,
            lastTimestamp,
        })
    },

    openFile({ state, dispatch, commit, rootGetters }, payload) {
        const fullFilepathArray = []
        fullFilepathArray.push(payload.root)
        let path = payload.path
        if (path.slice(0, 1) === '/') path = path.slice(1)
        if (path.slice(-1) === '/') path = path.slice(0, -1)
        if (path !== '') fullFilepathArray.push(path)
        fullFilepathArray.push(payload.filename)

        const fullFilepath = fullFilepathArray.join('/')
        const url = rootGetters['socket/getUrl'] + '/server/files/' + encodeURI(fullFilepath) + `?${Date.now()}`

        if (state.cancelToken) dispatch('cancelLoad')

        const CancelToken = axios.CancelToken
        const source = CancelToken.source()
        commit('updateCancelTokenSource', source)
        commit('updateLoaderState', true)

        commit('setFilename', payload.filename)
        // Force read-only: this Mainsail variant disallows editing files from the UI.
        commit('setPermissions', 'r')

        axios
            .get(url, {
                cancelToken: source.token,
                onDownloadProgress: (progressEvent) =>
                    dispatch('downloadProgress', {
                        progressEvent,
                        direction: 'downloading',
                        filesize: payload.size,
                    }),
                responseType: 'blob',
            })
            .then((res) => res.data.text())
            .then((file) => {
                commit('openFile', {
                    filename: payload.filename,
                    fileroot: payload.root,
                    filepath: path,
                    file,
                })
            })
            .finally(() => {
                setTimeout(() => {
                    dispatch('clearLoader')
                }, 100)
            })
    },

    async saveFile() {
        // Read-only mode: file edits are disallowed from this Mainsail variant.
        Vue.$toast.warning(i18n.t('Editor.FileReadOnly').toString())
    },

    regeneratePrinterConfig() {
        // Read-only mode: regeneration writes printer.cfg, blocked in this variant.
        Vue.$toast.warning(i18n.t('Editor.FileReadOnly').toString())
    },

    getRegeneratePrinterConfig({ commit, dispatch }, payload) {
        Vue.$toast.success('ran regeneration')

        if (payload == null) {
            Vue.$toast.error('return is null')
        } else {
            Vue.$toast.success(payload.result)
        }
    },

    cancelLoad({ state, commit, dispatch }) {
        if (state.cancelToken) {
            state.cancelToken.cancel('User canceled upload/download')
            commit('updateCancelTokenSource', null)
            dispatch('clearLoader')
        }
    },

    clearLoader({ commit }) {
        commit('updateLoaderState', false)
        commit('updateLoader', {
            direction: 'downloading',
            lastLoaded: 0,
            lastTimestamp: 0,
            loaded: 0,
            total: 0,
            speed: '',
        })
    },

    close({ commit }) {
        commit('reset')

        window.removeEventListener('beforeunload', windowBeforeUnloadFunction)
    },

    updateSourcecode({ commit }, payload) {
        commit('updateSourcecode', payload)
    },
}
