import { GetterTree } from 'vuex'
import { AirMetric, FleetAirState } from '@/store/fleet/air/types'
import { airSensorVendor } from '@/store/gui/remoteprinters/types'
import { metricsForVendors } from '@/components/panels/airQualityBands'

export const getters: GetterTree<FleetAirState, any> = {
    getMetrics(state): AirMetric[] {
        return state.metrics
    },

    getMetric:
        (state) =>
        (key: string): AirMetric | null => {
            return state.metrics.find((m) => m.key === key) ?? null
        },

    /** Vendors of the air sensors on the roster (absent sensorVendor = pandasense). */
    getRosterVendors(_state, _getters, rootState): string[] {
        const printers = rootState.gui?.remoteprinters?.printers ?? {}
        const vendors = new Set<string>()
        for (const entry of Object.values(printers) as any[]) {
            if (entry?.deviceType === 'air_sensor') vendors.add(airSensorVendor(entry))
        }
        return [...vendors]
    },

    /**
     * Catalog entries some rostered sensor can report (e.g. no eTVOC chip without a Panda Sense
     * Pro, no CO₂ chip with only Dyson purifiers). The whole catalog while the roster is empty.
     */
    getRosterMetrics(state, getters): AirMetric[] {
        return metricsForVendors(state.metrics, getters.getRosterVendors)
    },

    /** First metric a rostered sensor reports, or null until the catalog is loaded. */
    defaultMetricKey(state, getters): string | null {
        const metrics: AirMetric[] = getters.getRosterMetrics
        return metrics.length ? metrics[0].key : null
    },

    isLoading(state): boolean {
        return state.loading
    },

    getError(state): string | null {
        return state.error
    },
}
