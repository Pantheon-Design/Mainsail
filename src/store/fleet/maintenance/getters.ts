import { GetterTree } from 'vuex'
import {
    FleetMaintenanceState,
    ServiceTrackerAnalytics,
    ServiceTrackerPrinterDetail,
    ServiceTrackerPrinterSummary,
} from './types'

export const getters: GetterTree<FleetMaintenanceState, any> = {
    getPrinters(state): ServiceTrackerPrinterSummary[] {
        return state.printers
    },

    getPrinterDetail(state): ServiceTrackerPrinterDetail | null {
        return state.printerDetail
    },

    getAnalytics(state): ServiceTrackerAnalytics | null {
        return state.analytics
    },

    isLoading(state): boolean {
        return state.loading
    },

    isDetailLoading(state): boolean {
        return state.detailLoading
    },

    isPrintersLoading(state): boolean {
        return state.printersLoading
    },
}
