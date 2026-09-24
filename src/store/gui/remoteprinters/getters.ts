import { GetterTree } from 'vuex'
import { DeviceType, GuiRemoteprintersState, GuiRemoteprintersStatePrinter } from '@/store/gui/remoteprinters/types'
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

    // Device type of the roster entry with this hostname (case-insensitive). Legacy entries
    // without a deviceType key, and hostnames not in the roster, are printers.
    getDeviceType:
        (state) =>
        (hostname: string): DeviceType => {
            const key = hostname.toLowerCase()
            for (const printer of Object.values(state.printers)) {
                if (printer.hostname?.toLowerCase() === key) return printer.deviceType ?? 'printer'
            }
            return 'printer'
        },

    // Soft spool capacity of the oven roster entry with this hostname; null when the
    // entry is missing, is a printer, or has no valid (integer >= 1) maxSpools.
    getMaxSpools:
        (state) =>
        (hostname: string): number | null => {
            const key = hostname.toLowerCase()
            for (const printer of Object.values(state.printers)) {
                if (printer.hostname?.toLowerCase() !== key) continue
                const n = Number(printer.maxSpools)
                return Number.isInteger(n) && n >= 1 ? n : null
            }
            return null
        },
}
