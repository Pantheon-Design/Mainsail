import { GetterTree } from 'vuex'
import { hostKey } from '@/plugins/hostKey'
import {
    DEFAULT_SENSOR_RANGE,
    DeviceType,
    GuiRemoteprintersState,
    GuiRemoteprintersStatePrinter,
    MAX_SENSOR_RANGE,
    MIN_SENSOR_RANGE,
} from '@/store/gui/remoteprinters/types'
import { caseInsensitiveSort } from '@/plugins/helpers'

// eslint-disable-next-line
export const getters: GetterTree<GuiRemoteprintersState, any> = {
    getRemoteprinters: (state, getters, rootState, rootGetters) => {
        const printers: GuiRemoteprintersStatePrinter[] = []

        Object.keys(state.printers).forEach((id: string) => {
            const socket = { ...rootGetters['farm/getPrinterSocketState'](id) }

            printers.push({ ...state.printers[id], id, socket })
        })

        return caseInsensitiveSort(printers, 'hostname')
    },

    // Roster entries indexed by hostKey. Vuex caches this, so it is rebuilt only when the
    // roster changes; every per-frame roster lookup (fleetDaemonClient, the map, the status
    // panels) must go through it instead of scanning `state.printers` — with N printers
    // receiving frames, a scan per lookup is O(N^2) per store commit.
    byHostKey: (state): Record<string, GuiRemoteprintersStatePrinter> => {
        const index: Record<string, GuiRemoteprintersStatePrinter> = {}
        for (const printer of Object.values(state.printers)) {
            if (printer?.hostname) index[hostKey(printer.hostname)] = printer
        }
        return index
    },

    // Device type of the roster entry with this hostname (case-insensitive). Legacy entries
    // without a deviceType key, and hostnames not in the roster, are printers.
    getDeviceType:
        (state, getters) =>
        (hostname: string): DeviceType => {
            return getters.byHostKey[hostKey(hostname)]?.deviceType ?? 'printer'
        },

    // True when the roster entry with this hostname is a printer (or an unknown / legacy entry).
    // Printer-only views filter on this rather than on "not an oven" so every non-printer
    // device type (ovens, air sensors) stays off them.
    isPrinterHostname:
        (state, getters) =>
        (hostname: string): boolean => {
            return getters.getDeviceType(hostname) === 'printer'
        },

    // Overlay radius (grid cells) of the air sensor with this hostname, clamped to the allowed
    // range; the default when unset or not a sensor.
    getSensorRange:
        (state, getters) =>
        (hostname: string): number => {
            const entry = getters.byHostKey[hostKey(hostname)]
            const n = Number(entry?.sensorRange)
            if (!Number.isFinite(n) || n <= 0) return DEFAULT_SENSOR_RANGE
            return Math.min(MAX_SENSOR_RANGE, Math.max(MIN_SENSOR_RANGE, Math.round(n)))
        },

    // Soft spool capacity of the oven roster entry with this hostname; null when the
    // entry is missing, is a printer, or has no valid (integer >= 1) maxSpools.
    getMaxSpools:
        (state, getters) =>
        (hostname: string): number | null => {
            const printer = getters.byHostKey[hostKey(hostname)]
            if (!printer) return null
            const n = Number(printer.maxSpools)
            return Number.isInteger(n) && n >= 1 ? n : null
        },
}
