import { GetterTree } from 'vuex'
import { AirMetric, FleetAirState } from '@/store/fleet/air/types'

export const getters: GetterTree<FleetAirState, any> = {
    getMetrics(state): AirMetric[] {
        return state.metrics
    },

    getMetric:
        (state) =>
        (key: string): AirMetric | null => {
            return state.metrics.find((m) => m.key === key) ?? null
        },

    /** First catalog entry, or null until the catalog is loaded. */
    defaultMetricKey(state): string | null {
        return state.metrics.length ? state.metrics[0].key : null
    },

    isLoading(state): boolean {
        return state.loading
    },

    getError(state): string | null {
        return state.error
    },
}
