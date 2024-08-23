import { ActionTree } from 'vuex'
import { RootState } from '@/store/types'
import { v4 as uuidv4 } from 'uuid'
import Vue from 'vue'
import { GuiRemoteprintersState } from '@/store/gui/remoteprinters/types'

export const actions: ActionTree<GuiRemoteprintersState, RootState> = {
    reset({ commit, dispatch, state }) {
        Object.keys(state.printers).forEach((printerId) => {
            dispatch('farm/unregisterPrinter', printerId, { root: true })
        })

        commit('reset')
    },

    initFromLocalstorage({ dispatch, rootState }) {
        let value = rootState.configInstances ?? []
        if (rootState.instancesDB === 'browser') value = JSON.parse(localStorage.getItem('printers') ?? '{}')
        if (Array.isArray(value)) {
            const printers: any = {}

            value.forEach((printer) => {
                const id = uuidv4()
                printers[id] = printer
            })

            dispatch('initStore', printers)
        }
    },

    async initStore({ commit, dispatch }, payload) {
        Vue.$toast.success("init Store :");
        //console.log(payload);
        dispatch('reset')
        Object.keys(payload).forEach((printerId: string) => {
            const printer = payload[printerId]
            Vue.$toast.success(printer);
            commit('store', { id: printerId, values: printer })
            dispatch(
                'farm/registerPrinter',
                {
                    id: printerId,
                    hostname: printer.hostname ?? '',
                    port: printer.port ?? 7125,
                    settings: printer.settings ?? {},
                    lastPrintedFilament: printer.lastPrintedFilament ?? '',
                    position: printer.position ?? { x: 400, y: 400 },
                },
                { root: true }
            )
        })
    },

    upload({ state, rootState }, id) {

        //console.log(state.printers);
        if (rootState.instancesDB === 'browser') {
            const printers: any[] = []
            Object.keys(state.printers).forEach((id: string) => {
                printers.push({
                    hostname: state.printers[id].hostname,
                    port: state.printers[id].port,
                    settings: state.printers[id].settings,
                    lastPrintedFilament: state.printers[id].lastPrintedFilament ?? '',
                    position: state.printers[id].position ?? { x: 400, y: 400 },
                })
            })

            localStorage.setItem('printers', JSON.stringify(printers))
        } else if (rootState.instancesDB === 'moonraker' && id in state.printers) {
            const value = {
                hostname: state.printers[id].hostname,
                port: state.printers[id].port,
                settings: state.printers[id].settings ?? {},
                lastPrintedFilament: state.printers[id].lastPrintedFilament ?? '',
                position: state.printers[id].position ?? { x: 400, y: 400 },
            }
            //console.log(`API database post item: ${value.hostname} :` + value.lastPrintedFilament);
            console.log(state);
            console.log('upload root state: ');
            console.log(rootState);
            console.log('upload value')
            console.log(value);

            Vue.$socket.emit('server.database.post_item', {
                namespace: 'mainsail',
                key: 'remoteprinters.printers.' + id,
                value,
            })
        }
    },

    store({ commit, dispatch }, payload) {
        const id = uuidv4()

        commit('store', { id, values: payload.values })
        dispatch(
            'farm/registerPrinter',
            {
                id,
                hostname: payload.values.hostname ?? '',
                port: payload.values.port ?? 7125,
                position: payload.values.position
            },
            { root: true }
        )

        dispatch('upload', id)
    },

    update({ commit, dispatch }, payload) {
        commit('update', payload)
        dispatch('farm/updatePrinter', payload, { root: true })
        dispatch('upload', payload.id)
    },

    updateOnDrag({ commit, dispatch }, payload) {
        commit('update', payload)
        dispatch('farm/updatePrinterOnDrag', payload, { root: true })
        dispatch('upload', payload.id)
    },

    updateSettings({ commit, dispatch }, payload) {
        commit('update', {
            id: payload.id,
            values: {
                settings: payload.values,
            },
        })
        dispatch('upload', payload.id)
    },

    delete({ commit, dispatch, rootState }, id) {
        commit('delete', id)
        dispatch('farm/unregisterPrinter', id, { root: true })

        if (rootState.instancesDB === 'browser') dispatch('upload')
        else {
            Vue.$socket.emit('server.database.delete_item', {
                namespace: 'mainsail',
                key: 'remoteprinters.printers.' + id,
            })
        }
    },
}
