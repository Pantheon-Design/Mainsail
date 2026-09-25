<template>
    <v-container fluid class="pa-4">
        <panel
            :icon="mdiTimelineClockOutline"
            :title="$t('FleetTimeline.Title')"
            card-class="fleet-activity-panel"
            :loading="loading">
            <template #buttons>
                <v-btn icon tile :title="$t('Timeline.Refresh')" :loading="loading" @click="applyFilters">
                    <v-icon>{{ mdiRefresh }}</v-icon>
                </v-btn>
            </template>
            <v-card-text class="pb-0">
                <activity-timeline-filters
                    v-model="filters"
                    :show-tier="false"
                    :printer-items="printerItems"
                    :type-items="typeItems"
                    @apply="applyFilters" />
            </v-card-text>
            <v-card-text class="pt-2">
                <activity-timeline
                    :events="visibleEvents"
                    :loading="loading"
                    :has-more="hasMore"
                    :loading-more="loadingMore"
                    show-printer
                    :empty-text="$t('FleetTimeline.NoEvents')"
                    @load-more="loadMore"
                    @open-job="openJob" />
            </v-card-text>
        </panel>

        <fleet-history-record-dialog v-model="detailDialog" :record="detailRecord" />
    </v-container>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import Panel from '@/components/ui/Panel.vue'
import ActivityTimeline from '@/components/timeline/ActivityTimeline.vue'
import ActivityTimelineFilters from '@/components/timeline/ActivityTimelineFilters.vue'
import FleetHistoryRecordDialog from '@/components/dialogs/FleetHistoryRecordDialog.vue'
import { ActivityEvent, ActivityFilterValue } from '@/components/timeline/types'
import { FleetActivityFilters } from '@/store/fleet/activity/types'
import { FleetHistoryRecord } from '@/store/fleet/history/types'
import { fleetDaemonEvents } from '@/plugins/fleetDaemonClient'
import { hostKey } from '@/plugins/hostKey'
import { mdiRefresh, mdiTimelineClockOutline } from '@mdi/js'

@Component({
    components: { Panel, ActivityTimeline, ActivityTimelineFilters, FleetHistoryRecordDialog },
})
export default class PageFleetTimeline extends Mixins(BaseMixin) {
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
    debounceTimer: number | null = null

    get loading(): boolean {
        return this.$store.getters['fleet/activity/isLoading']
    }

    get loadingMore(): boolean {
        return this.$store.getters['fleet/activity/isLoadingMore']
    }

    get total(): number {
        return this.$store.getters['fleet/activity/getTotal']
    }

    get events(): ActivityEvent[] {
        return this.$store.getters['fleet/activity/getEvents']
    }

    get hasMore(): boolean {
        return this.$store.state.fleet.activity.records.length < this.total
    }

    get visibleEvents(): ActivityEvent[] {
        const needle = (this.filters.search ?? '').trim().toLowerCase()
        if (!needle) return this.events

        return this.events.filter((event) => {
            const haystack = [event.summary, event.type, event.filename ?? '', event.printer_hostname ?? '']
                .join(' ')
                .toLowerCase()
            return haystack.includes(needle)
        })
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
        this.events.forEach((e) => add(e.printer_hostname))

        return [...keys].sort()
    }

    mounted() {
        this.$store.dispatch('fleet/activity/loadTypes')
        this.$store.dispatch('fleet/activity/loadPrinters')
        this.applyFilters()
        fleetDaemonEvents.$on('activity_updated', this.onActivityUpdated)
    }

    beforeDestroy() {
        fleetDaemonEvents.$off('activity_updated', this.onActivityUpdated)
        if (this.debounceTimer) window.clearTimeout(this.debounceTimer)
    }

    get apiFilters(): FleetActivityFilters {
        return {
            printer: this.filters.printer,
            types: this.filters.types,
            since: this.filters.dateFrom ? new Date(`${this.filters.dateFrom}T00:00:00`).toISOString() : null,
            until: this.filters.dateTo
                ? new Date(new Date(`${this.filters.dateTo}T00:00:00`).getTime() + 86400000).toISOString()
                : null,
        }
    }

    applyFilters() {
        this.$store.dispatch('fleet/activity/loadActivity', this.apiFilters)
    }

    loadMore() {
        this.$store.dispatch('fleet/activity/loadMoreActivity', this.apiFilters)
    }

    onActivityUpdated() {
        if (this.debounceTimer) window.clearTimeout(this.debounceTimer)
        this.debounceTimer = window.setTimeout(() => {
            this.applyFilters()
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
