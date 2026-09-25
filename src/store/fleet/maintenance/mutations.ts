import Vue from 'vue'
import { MutationTree } from 'vuex'
import {
    FleetMaintenanceState,
    ServiceTrackerAnalytics,
    ServiceTrackerPrinterDetail,
    ServiceTrackerPrinterSummary,
} from './types'
import { getDefaultState } from './index'

export const mutations: MutationTree<FleetMaintenanceState> = {
    reset(state) {
        Object.assign(state, getDefaultState())
    },

    setLoading(state, loading: boolean) {
        Vue.set(state, 'loading', loading)
    },

    setDetailLoading(state, loading: boolean) {
        Vue.set(state, 'detailLoading', loading)
    },

    setPrintersLoading(state, loading: boolean) {
        Vue.set(state, 'printersLoading', loading)
    },

    setPrinters(state, printers: ServiceTrackerPrinterSummary[]) {
        Vue.set(state, 'printers', printers)
    },

    setPrinterDetail(state, detail: ServiceTrackerPrinterDetail | null) {
        Vue.set(state, 'printerDetail', detail)
    },

    setAnalytics(state, analytics: ServiceTrackerAnalytics | null) {
        Vue.set(state, 'analytics', analytics)
    },
}
