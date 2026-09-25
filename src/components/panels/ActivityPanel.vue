<template>
    <div>
        <panel
            :icon="mdiTimelineClockOutline"
            :title="$t('Timeline.Timeline')"
            card-class="activity-panel"
            :loading="loading">
            <template #buttons>
                <v-btn icon tile :title="$t('Timeline.AddService')" @click="openCreateService">
                    <v-icon>{{ mdiPlus }}</v-icon>
                </v-btn>
                <v-btn icon tile :title="$t('Timeline.Settings.Title')" @click="settingsDialog = true">
                    <v-icon>{{ mdiCog }}</v-icon>
                </v-btn>
                <v-btn icon tile :title="$t('Timeline.Refresh')" :loading="loading" @click="refresh">
                    <v-icon>{{ mdiRefresh }}</v-icon>
                </v-btn>
            </template>
            <v-card-text class="pb-0">
                <activity-timeline-filters v-model="filters" :type-items="typeItems" @apply="applyFilters" />
            </v-card-text>
            <v-card-text class="pt-2">
                <activity-timeline
                    :events="filteredEvents"
                    :loading="loading"
                    :has-more="hasMore"
                    :loading-more="loadingMore"
                    can-edit-service
                    @load-more="loadMore"
                    @edit-service="openEditService"
                    @delete-service="askDeleteService"
                    @open-job="openJob" />
            </v-card-text>
        </panel>

        <service-event-dialog v-model="serviceDialog" :event="serviceEvent" :service-type-items="serviceTypeItems" />

        <activity-settings-dialog v-model="settingsDialog" />

        <v-dialog v-model="deleteDialog" max-width="400">
            <panel :title="$t('Timeline.Delete')" card-class="activity-delete-dialog" :margin-bottom="false">
                <template #buttons>
                    <v-btn icon tile @click="deleteDialog = false">
                        <v-icon>{{ mdiCloseThick }}</v-icon>
                    </v-btn>
                </template>
                <v-card-text>
                    <p class="mb-0">{{ $t('Timeline.DeleteServiceQuestion') }}</p>
                    <p v-if="deleteEvent" class="mb-0 mt-2 font-weight-medium">{{ deleteEvent.summary }}</p>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="deleteDialog = false">{{ $t('Timeline.Cancel') }}</v-btn>
                    <v-btn color="error" text @click="confirmDeleteService">{{ $t('Timeline.Delete') }}</v-btn>
                </v-card-actions>
            </panel>
        </v-dialog>
    </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import Panel from '@/components/ui/Panel.vue'
import ActivityTimeline from '@/components/timeline/ActivityTimeline.vue'
import ActivityTimelineFilters from '@/components/timeline/ActivityTimelineFilters.vue'
import ServiceEventDialog from '@/components/dialogs/ServiceEventDialog.vue'
import ActivitySettingsDialog from '@/components/dialogs/ActivitySettingsDialog.vue'
import { ActivityEvent, ActivityFilterValue } from '@/components/timeline/types'
import { mdiCloseThick, mdiCog, mdiPlus, mdiRefresh, mdiTimelineClockOutline } from '@mdi/js'

@Component({
    components: { Panel, ActivityTimeline, ActivityTimelineFilters, ServiceEventDialog, ActivitySettingsDialog },
})
export default class ActivityPanel extends Mixins(BaseMixin) {
    mdiCloseThick = mdiCloseThick
    mdiCog = mdiCog
    mdiPlus = mdiPlus
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

    serviceDialog = false
    serviceEvent: ActivityEvent | null = null
    settingsDialog = false
    deleteDialog = false
    deleteEvent: ActivityEvent | null = null

    get loading(): boolean {
        return this.$store.state.server.activity.loading
    }

    get loadingMore(): boolean {
        return this.$store.state.server.activity.loadingMore
    }

    get hasMore(): boolean {
        return this.$store.state.server.activity.hasMore
    }

    get filteredEvents(): ActivityEvent[] {
        return this.$store.getters['server/activity/getFilteredEvents'](this.filters.search)
    }

    get typeItems() {
        return this.$store.getters['server/activity/getTypeItems']
    }

    get serviceTypeItems() {
        return this.$store.getters['server/activity/getServiceTypeItems']
    }

    mounted() {
        const stored = this.$store.state.server.activity.filters
        this.filters = { ...this.filters, tier: stored.tier, types: [...stored.types] }
    }

    applyFilters(value: ActivityFilterValue) {
        const after = value.dateFrom ? Math.floor(new Date(`${value.dateFrom}T00:00:00`).getTime() / 1000) : null
        const before = value.dateTo ? Math.floor(new Date(`${value.dateTo}T00:00:00`).getTime() / 1000) + 86400 : null

        this.$store.dispatch('server/activity/setFilters', {
            tier: value.tier,
            types: [...value.types],
            after,
            before,
        })
    }

    refresh() {
        this.$store.dispatch('server/activity/refresh')
    }

    loadMore() {
        this.$store.dispatch('server/activity/loadMore')
    }

    openCreateService() {
        this.serviceEvent = null
        this.serviceDialog = true
    }

    openEditService(event: ActivityEvent) {
        this.serviceEvent = event
        this.serviceDialog = true
    }

    askDeleteService(event: ActivityEvent) {
        this.deleteEvent = event
        this.deleteDialog = true
    }

    confirmDeleteService() {
        if (this.deleteEvent) this.$store.dispatch('server/activity/deleteService', this.deleteEvent.id)
        this.deleteDialog = false
        this.deleteEvent = null
    }

    openJob() {
        // The History page has no job-id deep link; the filename is shown in the details row.
        this.$router.push('/history')
    }
}
</script>
