<template>
    <v-container fluid class="pa-4">
        <panel
            :icon="mdiTimelineClockOutline"
            :title="$t('FleetTimeline.Title')"
            card-class="fleet-activity-panel"
            :loading="loading">
            <template #buttons>
                <v-btn icon tile :title="$t('Timeline.Refresh')" :loading="loading" @click="reloadAll">
                    <v-icon>{{ mdiRefresh }}</v-icon>
                </v-btn>
            </template>
            <v-card-text class="pb-0">
                <v-row dense class="align-center">
                    <v-col cols="12" md="5">
                        <v-autocomplete
                            v-model="selectedPrinters"
                            :items="printerItems"
                            :label="$t('FleetTimeline.Printers')"
                            multiple
                            chips
                            small-chips
                            deletable-chips
                            clearable
                            dense
                            outlined
                            hide-details
                            :prepend-inner-icon="mdiPrinter3d" />
                    </v-col>
                    <v-col cols="12" md="7">
                        <activity-timeline-filters
                            v-model="filters"
                            :show-tier="false"
                            :type-items="typeItems"
                            @apply="reloadAll" />
                    </v-col>
                </v-row>
            </v-card-text>
            <v-card-text class="pt-2">
                <v-alert v-if="selectedPrinters.length === 0" dense text type="info" class="ma-3">
                    {{ $t('FleetTimeline.SelectPrinters') }}
                </v-alert>
                <template v-else>
                    <div class="fleet-lanes">
                        <div class="fleet-lanes-header">
                            <div v-for="lane of lanes" :key="lane.printer" class="fleet-lane fleet-lane-head">
                                <v-chip small color="primary" outlined class="mr-2">{{ lane.printer }}</v-chip>
                                <span class="caption text--secondary">
                                    {{
                                        $t('FleetTimeline.Loaded', {
                                            loaded: lane.loaded,
                                            total: lane.total,
                                        })
                                    }}
                                </span>
                                <v-progress-linear
                                    v-if="lane.loading || lane.loadingMore"
                                    indeterminate
                                    height="2"
                                    class="mt-1" />
                            </div>
                        </div>
                        <v-alert v-if="!loading && dayRows.length === 0" dense text type="info" class="ma-3">
                            {{ $t('FleetTimeline.NoEvents') }}
                        </v-alert>
                        <div v-for="row of dayRows" :key="row.key" class="fleet-lanes-day">
                            <div class="fleet-lanes-day-head caption">
                                {{ $t('Timeline.EventsOnDate', { date: row.label }) }}
                            </div>
                            <div class="fleet-lanes-row">
                                <div v-for="lane of lanes" :key="lane.printer" class="fleet-lane fleet-lane-cell">
                                    <activity-timeline
                                        v-if="row.cells[lane.printer] && row.cells[lane.printer].length"
                                        :events="row.cells[lane.printer]"
                                        hide-day-header
                                        @open-job="openJob" />
                                    <div v-else class="fleet-lane-empty text--disabled">&mdash;</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div v-if="anyHasMore" class="text-center pt-3">
                        <v-btn small text color="primary" :loading="anyLoadingMore" @click="loadMore">
                            {{ $t('Timeline.LoadMore') }}
                        </v-btn>
                    </div>
                </template>
            </v-card-text>
        </panel>

        <fleet-history-record-dialog v-model="detailDialog" :record="detailRecord" />
    </v-container>
</template>

<script lang="ts">
import { Component, Mixins, Watch } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import Panel from '@/components/ui/Panel.vue'
import ActivityTimeline from '@/components/timeline/ActivityTimeline.vue'
import ActivityTimelineFilters from '@/components/timeline/ActivityTimelineFilters.vue'
import FleetHistoryRecordDialog from '@/components/dialogs/FleetHistoryRecordDialog.vue'
import { ActivityEvent, ActivityFilterValue } from '@/components/timeline/types'
import { FleetActivityFilters, FleetActivityLane } from '@/store/fleet/activity/types'
import { FleetHistoryRecord } from '@/store/fleet/history/types'
import { fleetDaemonEvents } from '@/plugins/fleetDaemonClient'
import { hostKey } from '@/plugins/hostKey'
import { mdiPrinter3d, mdiRefresh, mdiTimelineClockOutline } from '@mdi/js'

interface LaneView {
    printer: string
    events: ActivityEvent[]
    loaded: number
    total: number
    hasMore: boolean
    loading: boolean
    loadingMore: boolean
    /** ts of the oldest loaded event, or null when the lane is empty */
    oldestTs: number | null
}

interface DayRow {
    key: string
    label: string
    /** printer -> that printer's events on this day (newest first) */
    cells: Record<string, ActivityEvent[]>
}

@Component({
    components: { Panel, ActivityTimeline, ActivityTimelineFilters, FleetHistoryRecordDialog },
})
export default class PageFleetTimeline extends Mixins(BaseMixin) {
    mdiPrinter3d = mdiPrinter3d
    mdiRefresh = mdiRefresh
    mdiTimelineClockOutline = mdiTimelineClockOutline

    filters: ActivityFilterValue = {
        tier: 1,
        types: [],
        dateFrom: null,
        dateTo: null,
        search: '',
        printer: null,
    }

    detailDialog = false
    detailRecord: FleetHistoryRecord | null = null
    debounceTimers: Record<string, number> = {}

    get selectedPrinters(): string[] {
        const stored = this.$store.state.gui.view.fleetTimeline?.printers
        return Array.isArray(stored) ? stored : []
    }

    set selectedPrinters(value: string[]) {
        const printers = [...new Set((value ?? []).map((p) => hostKey(p)).filter((p) => p))].sort()
        this.$store.dispatch('gui/saveSetting', { name: 'view.fleetTimeline.printers', value: printers })
    }

    get loading(): boolean {
        return this.$store.getters['fleet/activity/isAnyLaneLoading']
    }

    get typeItems() {
        return this.$store.getters['fleet/activity/getTypeItems']
    }

    get printerItems(): string[] {
        const keys = new Set<string>()
        const add = (hostname: string | null | undefined) => {
            const key = hostKey(hostname)
            if (key) keys.add(key)
        }

        Object.keys(this.$store.getters['farm/getFleetDaemonPrinters'] ?? {}).forEach(add)
        ;(this.$store.getters['fleet/workers/getWorkers'] ?? []).forEach((w: any) => add(w.printer_hostname))
        ;(this.$store.getters['fleet/activity/getPrinterHostnames'] ?? []).forEach(add)
        this.selectedPrinters.forEach(add)

        return [...keys].sort()
    }

    get searchNeedle(): string {
        return (this.filters.search ?? '').trim().toLowerCase()
    }

    /** One entry per selected printer, in selection order. */
    get lanes(): LaneView[] {
        return this.selectedPrinters.map((printer) => {
            const lane: FleetActivityLane = this.$store.getters['fleet/activity/getLane'](printer)
            const all: ActivityEvent[] = this.$store.getters['fleet/activity/getLaneEvents'](printer)
            const events = this.searchNeedle ? all.filter((e) => this.matchesSearch(e)) : all
            return {
                printer,
                events,
                loaded: lane.records.length,
                total: lane.total,
                hasMore: lane.hasMore,
                loading: lane.loading,
                loadingMore: lane.loadingMore,
                oldestTs: all.length ? all[all.length - 1].ts : null,
            }
        })
    }

    /**
     * Alignment cutoff: lanes page independently, so a lane that still has more
     * server-side rows has only been loaded down to its oldest loaded ts.  Anything
     * older than the NEWEST such boundary cannot be shown consistently across lanes
     * and is hidden until "Load more" pulls the lagging lanes further back.  Fully
     * loaded lanes impose no cutoff.
     */
    get cutoffTs(): number | null {
        let cutoff: number | null = null
        this.lanes.forEach((lane) => {
            if (!lane.hasMore || lane.oldestTs === null) return
            if (cutoff === null || lane.oldestTs > cutoff) cutoff = lane.oldestTs
        })
        return cutoff
    }

    /** Union of days across all lanes (newest first); one row per day, one cell per lane. */
    get dayRows(): DayRow[] {
        const cutoff = this.cutoffTs
        const rows = new Map<string, DayRow & { sort: number }>()

        this.lanes.forEach((lane) => {
            lane.events.forEach((event) => {
                if (cutoff !== null && event.ts < cutoff) return
                const date = new Date((event.ts ?? 0) * 1000)
                const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
                let row = rows.get(key)
                if (!row) {
                    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
                    row = {
                        key,
                        sort: dayStart.getTime(),
                        label: dayStart.toLocaleDateString(this.browserLocale, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                        }),
                        cells: {},
                    }
                    rows.set(key, row)
                }
                if (!row.cells[lane.printer]) row.cells[lane.printer] = []
                row.cells[lane.printer].push(event)
            })
        })

        return [...rows.values()]
            .sort((a, b) => b.sort - a.sort)
            .map((row) => ({ key: row.key, label: row.label, cells: row.cells }))
    }

    get anyHasMore(): boolean {
        return this.lanes.some((lane) => lane.hasMore)
    }

    get anyLoadingMore(): boolean {
        return this.lanes.some((lane) => lane.loadingMore)
    }

    get apiFilters(): FleetActivityFilters {
        return {
            types: this.filters.types,
            since: this.filters.dateFrom ? new Date(`${this.filters.dateFrom}T00:00:00`).toISOString() : null,
            until: this.filters.dateTo
                ? new Date(new Date(`${this.filters.dateTo}T00:00:00`).getTime() + 86400000).toISOString()
                : null,
        }
    }

    matchesSearch(event: ActivityEvent): boolean {
        const haystack = [event.summary, event.type, event.filename ?? ''].join(' ').toLowerCase()
        return haystack.includes(this.searchNeedle)
    }

    mounted() {
        this.$store.dispatch('fleet/activity/loadTypes')
        this.$store.dispatch('fleet/activity/loadPrinters')
        this.reloadAll()
        fleetDaemonEvents.$on('activity_updated', this.onActivityUpdated)
    }

    beforeDestroy() {
        fleetDaemonEvents.$off('activity_updated', this.onActivityUpdated)
        Object.values(this.debounceTimers).forEach((t) => window.clearTimeout(t))
    }

    @Watch('selectedPrinters')
    onSelectedPrintersChanged(newVal: string[], oldVal: string[]) {
        const previous = new Set(oldVal ?? [])
        newVal.filter((p) => !previous.has(p)).forEach((p) => this.reloadLane(p))
    }

    reloadLane(printer: string) {
        this.$store.dispatch('fleet/activity/loadLane', { printer, filters: this.apiFilters })
    }

    reloadAll() {
        this.selectedPrinters.forEach((p) => this.reloadLane(p))
    }

    loadMore() {
        this.lanes
            .filter((lane) => lane.hasMore && !lane.loadingMore)
            .forEach((lane) =>
                this.$store.dispatch('fleet/activity/loadMoreLane', {
                    printer: lane.printer,
                    filters: this.apiFilters,
                })
            )
    }

    onActivityUpdated(hostname: string | null) {
        const key = hostname ? hostKey(hostname) : '*'
        if (key !== '*' && !this.selectedPrinters.includes(key)) return
        if (this.debounceTimers[key]) window.clearTimeout(this.debounceTimers[key])
        this.debounceTimers[key] = window.setTimeout(() => {
            delete this.debounceTimers[key]
            if (key === '*') this.reloadAll()
            else this.reloadLane(key)
            this.$store.dispatch('fleet/activity/loadTypes')
        }, 500)
    }

    async openJob(event: ActivityEvent) {
        if (!event.job_id || !event.printer_hostname) return

        try {
            const record = await this.$store.dispatch('fleet/history/fetchRecord', {
                printer_hostname: event.printer_hostname,
                moonraker_job_id: event.job_id,
            })
            if (!record) {
                this.$toast.info(this.$t('FleetTimeline.NoHistoryRecord').toString())
                return
            }
            this.detailRecord = record
            this.detailDialog = true
        } catch (error) {
            console.error('Failed to fetch fleet history record:', error)
            this.$toast.error(this.$t('FleetTimeline.NoHistoryRecord').toString())
        }
    }
}
</script>

<style scoped>
.fleet-lanes {
    overflow: auto;
    max-height: calc(100vh - 260px);
    position: relative;
}

.fleet-lanes-header {
    display: flex;
    position: sticky;
    top: 0;
    z-index: 3;
    border-bottom: 1px solid rgba(128, 128, 128, 0.3);
}

.theme--dark .fleet-lanes-header {
    background-color: #1e1e1e;
}

.theme--light .fleet-lanes-header {
    background-color: #ffffff;
}

.fleet-lane {
    min-width: 380px;
    flex: 1 0 380px;
    padding: 0 8px;
    box-sizing: border-box;
}

.fleet-lane-head {
    padding: 8px;
}

.fleet-lanes-day-head {
    position: sticky;
    left: 0;
    padding: 16px 8px 4px;
    opacity: 0.8;
    font-weight: 500;
}

.fleet-lanes-row {
    display: flex;
    align-items: stretch;
}

.fleet-lane-cell {
    border-left: 1px solid rgba(255, 255, 255, 0.08);
}

.fleet-lane-cell:first-child {
    border-left: none;
}

.fleet-lane-empty {
    padding: 8px 12px;
}

/* The per-cell timelines have no day heading, so pull their top padding in. */
.fleet-lane-cell ::v-deep .activity-timeline-list {
    padding-top: 4px;
}
</style>
