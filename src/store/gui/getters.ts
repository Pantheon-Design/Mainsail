import { GetterTree } from 'vuex'
import { GuiState } from '@/store/gui/types'

// eslint-disable-next-line
export const getters: GetterTree<GuiState, any> = {
    getDatasetValue: (state) => (payload: { name: string; type: string }) => {
        if (
            payload.name in state.view.tempchart.datasetSettings &&
            payload.type in state.view.tempchart.datasetSettings[payload.name]
        )
            return state.view.tempchart.datasetSettings[payload.name][payload.type]

        return ['temperature', 'target'].includes(payload.type)
    },

    getDatasetAdditionalSensorValue: (state) => (payload: { name: string; sensor: string }) => {
        if (
            payload.name in state.view.tempchart.datasetSettings &&
            'additionalSensors' in state.view.tempchart.datasetSettings[payload.name] &&
            payload.sensor in state.view.tempchart.datasetSettings[payload.name].additionalSensors
        )
            return state.view.tempchart.datasetSettings[payload.name].additionalSensors[payload.sensor]

        return true
    },

    getPanelExpand: (state) => (name: string, viewport: string) => {
        if ('dashboard' in state && viewport in state.dashboard.nonExpandPanels) {
            return !state.dashboard.nonExpandPanels[viewport].includes(name) ?? true
        }

        return true
    },

    getDefaultControlActionButton: (state, getters, rootState, rootGetters) => {
        if (rootGetters['printer/existsQGL']) return 'qgl'
        else if (rootGetters['printer/existsZtilt']) return 'ztilt'

        return 'm84'
    },

    getHours12Format: (state) => {
        const setting = state.general.timeFormat
        if (setting === '12hours') return true
        if (setting === null) {
            return Intl.DateTimeFormat(navigator.language, { hour: 'numeric' }).resolvedOptions().hour12
        }

        return false
    },

    // Default: the daemon runs on the same host that serves this UI, so derive
    // the URL from how the browser reached us — works on LAN (.local) and over
    // ZeroTier/VPN (IP), where mDNS names don't resolve. Daemon is plain HTTP.
    /** Backup URL connected from Settings > General wins for this page load; else the
     *  URL saved in Settings > Printers; else the same host on port 8090. */
    fleetDaemonUrl: (state) =>
        state.fleetDaemonUrlOverride || state.fleetDaemonUrl || `http://${window.location.hostname}:8090`,
    fleetDaemonUrlOverride: (state) => state.fleetDaemonUrlOverride ?? null,
}
