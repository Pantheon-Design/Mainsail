import { ActionTree } from 'vuex'
import { EditorState } from '@/store/editor/types'
import { RootState } from '@/store/types'
import axios from 'axios'
import { sha256 } from 'js-sha256'
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
        commit('setPermissions', payload.permissions)

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

    async saveFile(
        { state, commit, getters, rootGetters, dispatch },
        payload: { content: string; restartServiceName: string | null }
    ) {
        const content = new Blob([payload.content], { type: 'text/plain' })
        const formData = new FormData()
        formData.append('file', content, state.filename)
        formData.append('root', state.fileroot)
        formData.append('path', state.filepath)
        formData.append('checksum', sha256(payload.content))

        const url = rootGetters['socket/getUrl'] + '/server/files/upload'
        if (state.cancelToken) dispatch('cancelLoad')
        const CancelToken = axios.CancelToken
        const source = CancelToken.source()
        commit('updateCancelTokenSource', source)
        commit('updateLoaderState', true)

        axios
            .post(url, formData, {
                cancelToken: source.token,
                onUploadProgress: (progressEvent) =>
                    dispatch('downloadProgress', {
                        progressEvent,
                        direction: 'uploading',
                        filesize: null,
                    }),
            })
            .then((response) => {
                return response.data
            })
            .then((data) => {
                dispatch('clearLoader')
                Vue.$toast.success(i18n.t('Editor.SuccessfullySaved', { filename: data.item.path }).toString())
                if (payload.restartServiceName === 'klipper') {
                    const klipperRestartMethod = getters['getKlipperRestartMethod']
                    Vue.$socket.emit('printer.gcode.script', { script: klipperRestartMethod })
                } else if (payload.restartServiceName === 'moonraker') {
                    Vue.$socket.emit('server.restart', {})
                } else if (payload.restartServiceName !== null) {
                    Vue.$socket.emit('machine.services.restart', { service: payload.restartServiceName })
                }

                commit('updateLoadedHash', payload.content)

                if (payload.restartServiceName !== null) dispatch('close')
            })
            .catch((error) => {
                window.console.log(error.response?.data.error)
                dispatch('clearLoader')
                Vue.$toast.error(i18n.t('Editor.FailedSave', { filename: state.filename }).toString())
            })
    },


    regeneratePrinterConfig(
        { state, commit, getters, rootGetters, dispatch },
        payload: { content: string}
    ) {


        const content = new Blob([payload.content], { type: 'text/plain' })
        const temp_formData = new FormData()
        temp_formData.append('file', content, 'temp_'+state.filename)
        temp_formData.append('root', state.fileroot)
        temp_formData.append('path', state.filepath)
        temp_formData.append('checksum', sha256(payload.content))
        const url = rootGetters['socket/getUrl'] + '/server/files/upload'
        if (state.cancelToken) dispatch('cancelLoad')
        const CancelToken = axios.CancelToken
        const source = CancelToken.source()
        commit('updateCancelTokenSource', source)
        commit('updateLoaderState', true)

        // saving temp_features.yml file
        axios
            .post(url, temp_formData, {
                cancelToken: source.token,
                onUploadProgress: (progressEvent) =>
                    dispatch('downloadProgress', {
                        progressEvent,
                        direction: 'uploading',
                        filesize: null,
                    }),
            })
            .then((response) => {
                return response.data
            })
            .then((data) => {
                dispatch('clearLoader')
                //Vue.$toast.success(i18n.t('Editor.SuccessfullySaved', { filename: data.item.path }).toString())
                //commit('updateLoadedHash', payload.content)
            })
            .catch((error) => {
                window.console.log(error.response?.data.error)
                dispatch('clearLoader')
                Vue.$toast.error(i18n.t('Editor.FailedSave', { filename: state.filename }).toString())
            })

        // regenerate and restart
        const regenerate_url = rootGetters['socket/getUrl'] + '/server/files/configgenerate'
        axios
            .post(regenerate_url, {
                cancelToken: source.token
            })
            .then((response) => {
                return response.data
            })
            .then((data) => {
                
                if (data == null || data === '') {
                    Vue.$toast.success('Printer.cfg generated')
                    const formData = new FormData()
                    formData.append('file', content, state.filename)
                    formData.append('root', state.fileroot)
                    formData.append('path', state.filepath)
                    formData.append('checksum', sha256(payload.content))
                    axios
                        .post(url, formData, {
                            cancelToken: source.token,
                            onUploadProgress: (progressEvent) =>
                                dispatch('downloadProgress', {
                                    progressEvent,
                                    direction: 'uploading',
                                    filesize: null,
                                }),
                        })
                        .then((response) => {
                            return response.data
                        })
                        .then((data) => {
                            dispatch('clearLoader')
                            Vue.$toast.success(i18n.t('Editor.SuccessfullySaved', { filename: data.item.path }).toString())
                            commit('updateLoadedHash', payload.content)
                        })
                        .catch((error) => {
                            window.console.log(error.response?.data.error)
                            dispatch('clearLoader')
                            Vue.$toast.error(i18n.t('Editor.FailedSave', { filename: state.filename }).toString())
                        })
                    const klipperRestartMethod = getters['getKlipperRestartMethod']
                    Vue.$socket.emit('printer.gcode.script', { script: klipperRestartMethod })
                    Vue.$socket.emit('server.restart', {})
                    dispatch('close')

                } else {
                    Vue.$toast.error('Printer.cfg generation failed')
                    Vue.$toast.error(data['error'], {message:data['error'], duration:50000})
                }

                // delete temp_features.yml after configgenerate finishes
                Vue.$socket.emit(
                    'server.files.delete_file',
                    { path: 'config' + '/' + 'temp_features.yml' },
                    {}
                )
            })
            .catch((error) => {
                window.console.log(error.response?.data.error)
                dispatch('clearLoader')
                Vue.$toast.error(error.response?.data.error)
                Vue.$toast.error(error)
            })


        // Vue.$socket.emit('server.files.configgenerate',
        //     { action: 'editor/getRegeneratePrinterConfig' }
        // )
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
