import { printer } from '@/store/farm/printer'
import { Module } from 'vuex'
import { FarmState } from '@/store/farm/types'
import { RootState } from '@/store/types'
import Vue from 'vue'

export const getDefaultState = (): FarmState => {
    return {
        fleetDaemonPrinters: {},
        fleetDaemonConnected: false,
    }
}

// initial state
const state = () => {
    return getDefaultState()
}

export const farm: Module<FarmState, RootState> = {
    namespaced: true,
    state: state,
    getters: {
        countPrinters: (state) => {
            return Object.keys(state).length
        },
        getPrinters: (state) => {
            return state
        },
        getPrinterName: (state, getters) => (namespace: string) => {
            return getters[namespace + '/getPrinterName']
        },
        getPrinterSocketState: (state, getters) => (namespace: string) => {
            return (
                getters[namespace + '/getPrinterSocketState'] ?? {
                    isConnecting: false,
                    isConnected: false,
                }
            )
        },
        existsPrinter: (state) => (namespace: string) => {
            return Object.keys(state).includes(namespace)
        },
        getFleetDaemonPrinters: (state) => {
            return state.fleetDaemonPrinters || {}
        },
    },
    actions: {
        registerPrinter({ commit, dispatch, rootState }, payload) {
            if (!this.hasModule(['farm', payload.id])) {
                this.registerModule(['farm', payload.id], printer)
                commit('farm/' + payload.id + '/setSocketData', { ...payload, _namespace: payload.id }, { root: true })

                if ('settings' in payload)
                    commit('farm/' + payload.id + '/setSettings', payload.settings, { root: true })
                // In moonraker mode fleet_daemon owns the printer connections; Mainsail only
                // connects directly in browser-instances mode (TheSelectPrinterDialog)
                if (rootState.instancesDB !== 'moonraker')
                    dispatch('farm/' + payload.id + '/connect', {}, { root: true })
            }
        },
        updatePrinter({ dispatch, commit, rootState }, payload) {
            commit(payload.id + '/setSocketData', {
                hostname: payload.values.hostname,
                port: payload.values.port,
                position: payload.values.position
            })
            if (rootState.instancesDB !== 'moonraker') dispatch(payload.id + '/reconnect')
        },
        updatePrinterOnDrag({ dispatch, commit }, payload) {
            commit(payload.id + '/setSocketData', {
                hostname: payload.values.hostname,
                port: payload.values.port,
                isConnecting: true,
                position: payload.values.position
            })
        },
        unregisterPrinter({ state }, id) {
            if (id in state) {
                state[id].socket?.instance?.close()
                this.unregisterModule(['farm', id])
            }
        },
    },
    mutations: {
        // Individual printer mutation
        SET_FLEET_DAEMON_PRINTER(state, payload: { hostname: string; data: any }) {
            const { hostname, data } = payload;
            const existing = state.fleetDaemonPrinters?.[hostname];

            // Ensure the printer data has the expected structure
            // Merge with existing socket data to preserve position/model during rapid WS updates
            const printerData = {
                ...data,
                socket: {
                    hostname: hostname,
                    isConnected: true,
                    webPort: 80,
                    ...(existing?.socket || {}),
                    ...data.socket
                },
                _namespace: hostname
            };

            Vue.set(state.fleetDaemonPrinters, hostname, printerData);
        },

        // Bulk update mutation
        SET_FLEET_DAEMON_PRINTERS(state, payload) {
            Vue.set(state, 'fleetDaemonPrinters', {
                ...state.fleetDaemonPrinters,
                ...payload,
            })
        },

        // Remove individual printer mutation
        REMOVE_FLEET_DAEMON_PRINTER(state, hostname: string) {
            if (state.fleetDaemonPrinters && hostname in state.fleetDaemonPrinters) {
                Vue.delete(state.fleetDaemonPrinters, hostname);
            }
        },

        // Clear all fleet daemon printers
        CLEAR_FLEET_DAEMON_PRINTERS(state) {
            Vue.set(state, 'fleetDaemonPrinters', {});
        },

        // Track fleet daemon WebSocket connection state
        SET_FLEET_DAEMON_CONNECTED(state, connected: boolean) {
            Vue.set(state, 'fleetDaemonConnected', connected);
        }
    },
}
