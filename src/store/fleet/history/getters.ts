import { GetterTree } from 'vuex'
import { FleetHistoryState, FleetHistoryRecord } from './types'

export const getters: GetterTree<FleetHistoryState, any> = {
    getRecords(state): FleetHistoryRecord[] {
        return state.records
    },

    getAnalytics(state) {
        return state.analytics
    },

    isLoading(state): boolean {
        return state.loading
    },

    isAnalyticsLoading(state): boolean {
        return state.analyticsLoading
    },

    // Monthly utilization with 3-month rolling average
    getMonthlyUtilizationSeries(state) {
        const data = state.analytics?.monthly_summary ?? []
        const actual = data.map((d) => d.utilization_pct)
        const rolling: (number | null)[] = data.map((_, i) => {
            if (i < 2) return null
            const slice = actual.slice(i - 2, i + 1)
            return Math.round((slice.reduce((a, b) => a + b, 0) / 3) * 10) / 10
        })
        return { labels: data.map((d) => d.year_month), actual, rolling }
    },

    // Weekly success rate with 4-week rolling average
    getWeeklySuccessRateSeries(state) {
        const data = state.analytics?.weekly_success_rate ?? []
        const actual = data.map((d) => d.success_rate)
        const rolling: (number | null)[] = data.map((_, i) => {
            if (i < 3) return null
            const slice = actual.slice(i - 3, i + 1)
            return Math.round((slice.reduce((a, b) => a + b, 0) / 4) * 10) / 10
        })
        return { labels: data.map((d) => d.week), actual, rolling }
    },
}
