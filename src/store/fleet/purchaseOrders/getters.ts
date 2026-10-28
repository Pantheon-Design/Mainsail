import { GetterTree } from 'vuex'
import { FleetPurchaseOrdersState, FleetPoListRow, FleetPoDetail, FleetPoConfig } from './types'

export const getters: GetterTree<FleetPurchaseOrdersState, any> = {
    getList(state): FleetPoListRow[] {
        return state.list
    },

    getCurrent(state): FleetPoDetail | null {
        return state.current
    },

    isLoading(state): boolean {
        return state.loading
    },

    getConfig(state): FleetPoConfig | null {
        return state.config
    },

    /** URL of the PO's source PDF (latest document unless docId); for an iframe src or window.open. */
    documentUrl:
        (_state, _getters, _rootState, rootGetters) =>
        (poId: number, opts: { docId?: number; download?: boolean } = {}): string => {
            const params = new URLSearchParams()
            if (opts.docId != null) params.set('doc_id', String(opts.docId))
            if (opts.download) params.set('download', '1')
            const qs = params.toString()
            return `${rootGetters['gui/fleetDaemonUrl']}/pos/${poId}/document${qs ? '?' + qs : ''}`
        },
}
