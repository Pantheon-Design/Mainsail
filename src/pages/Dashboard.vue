<template>
    <div class="fleet-dashboard" :class="{ 'fleet-dashboard--fixed': fixedLayout }">
        <div class="fleet-dashboard__col fleet-dashboard__col--maps">
            <dashboard-status-bar :workers="workers" class="fleet-dashboard__status" />
            <dashboard-fleet-map
                v-for="floor in floors"
                :key="floor.location"
                :location="floor.location"
                :name="floor.name"
                :worker-hostnames="enabledHostnames"
                :attention-hostnames="attentionHostnames"
                :attention-reasons="attentionReasons"
                :highlight-hostname="hoverHost"
                class="fleet-dashboard__map" />
        </div>
        <div class="fleet-dashboard__col fleet-dashboard__col--side">
            <dashboard-jobs-panel class="fleet-dashboard__jobs" />
            <dashboard-workers-panel
                :workers="workers"
                :intervals-hours="intervalsHours"
                class="fleet-dashboard__workers"
                @hover="hoverHost = $event" />
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Mixins, Watch } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import DashboardStatusBar from '@/components/panels/DashboardStatusBar.vue'
import DashboardFleetMap from '@/components/panels/DashboardFleetMap.vue'
import DashboardWorkersPanel from '@/components/panels/DashboardWorkersPanel.vue'
import DashboardJobsPanel from '@/components/panels/DashboardJobsPanel.vue'
import { fleetDaemonEvents } from '@/plugins/fleetDaemonClient'
import { FleetWorker } from '@/store/fleet/jobs/types'
import {
    enabledWorkerHostnames,
    attentionWorkerHostnames,
    attentionWorkerReasons,
} from '@/components/panels/fleetWorkerAttention'
import { MAP_LOCATIONS } from '@/components/panels/farmMapGeometry'
import { sanitizeIntervals } from '@/store/fleet/forecast'

/**
 * Fleet dashboard: everything an operator needs on one screen — both floor
 * maps (cropped to the placed printers), fleet totals, workers needing
 * attention + finish forecast, and open fleet jobs with time / filament left.
 * Desktop and wider fill the viewport without page scrolling; below that the
 * sections stack.
 */
@Component({
    components: {
        DashboardStatusBar,
        DashboardFleetMap,
        DashboardWorkersPanel,
        DashboardJobsPanel,
    },
})
export default class PageDashboard extends Mixins(BaseMixin) {
    readonly floors = MAP_LOCATIONS

    private workersTimer: ReturnType<typeof setTimeout> | null = null
    private jobsTimer: ReturnType<typeof setTimeout> | null = null
    private pollTimer: ReturnType<typeof setInterval> | null = null
    private snapshotTimer: ReturnType<typeof setInterval> | null = null
    private polling = false

    /** Worker hovered in the workers list; its icon is highlighted on the map. */
    hoverHost = ''

    /** Fallback poll period (ms); WS events refresh immediately, this covers missed events. */
    static readonly POLL_MS = 10000
    /** Service-tracker snapshot (nozzle life fallback for older daemons) refresh period. */
    static readonly SNAPSHOT_MS = 60000

    /** Class on <html> while a worker needs attention: the page background flashes red
     *  (see the unscoped style below), alternating with the banner in the workers panel. */
    static readonly ATTENTION_CLASS = 'fleet-attention'

    mounted() {
        this.loadAll()
        fleetDaemonEvents.$on('workers_updated', this.onWorkersUpdated)
        fleetDaemonEvents.$on('jobs_updated', this.onJobsUpdated)
        document.addEventListener('visibilitychange', this.onVisibility)
        this.pollTimer = setInterval(this.poll, PageDashboard.POLL_MS)
        this.loadSnapshot()
        this.snapshotTimer = setInterval(() => {
            if (document.visibilityState === 'visible') this.loadSnapshot()
        }, PageDashboard.SNAPSHOT_MS)
        this.applyAttentionClass(this.attentionActive)
    }

    beforeDestroy() {
        fleetDaemonEvents.$off('workers_updated', this.onWorkersUpdated)
        fleetDaemonEvents.$off('jobs_updated', this.onJobsUpdated)
        document.removeEventListener('visibilitychange', this.onVisibility)
        if (this.workersTimer) clearTimeout(this.workersTimer)
        if (this.jobsTimer) clearTimeout(this.jobsTimer)
        if (this.pollTimer) clearInterval(this.pollTimer)
        if (this.snapshotTimer) clearInterval(this.snapshotTimer)
        this.applyAttentionClass(false)
    }

    /** Daily service-tracker rows: nozzle life for the worker list when the daemon frame lacks it. */
    loadSnapshot() {
        this.$store.dispatch('fleet/maintenance/loadPrinters').catch(() => {})
    }

    get attentionActive(): boolean {
        return this.attentionHostnames.length > 0
    }

    @Watch('attentionActive')
    onAttentionChange(active: boolean) {
        this.applyAttentionClass(active)
    }

    applyAttentionClass(active: boolean) {
        document.documentElement.classList.toggle(PageDashboard.ATTENTION_CLASS, active)
    }

    /** Both loads are informational: a failure just leaves the last data (or the panel's own hint). */
    loadWorkers() {
        this.$store.dispatch('fleet/workers/loadWorkers').catch(() => {})
    }

    loadForecast() {
        this.$store.dispatch('fleet/jobs/loadForecast').catch(() => {})
    }

    loadAll() {
        this.loadWorkers()
        this.loadForecast()
    }

    onVisibility() {
        if (document.visibilityState === 'visible') this.loadAll()
    }

    async poll() {
        if (this.polling || document.visibilityState !== 'visible') return
        this.polling = true
        try {
            await Promise.allSettled([
                this.$store.dispatch('fleet/workers/loadWorkers'),
                this.$store.dispatch('fleet/jobs/loadForecast'),
            ])
        } finally {
            this.polling = false
        }
    }

    /** Debounced: the daemon broadcasts several events per scheduler step. */
    onWorkersUpdated() {
        if (this.workersTimer) clearTimeout(this.workersTimer)
        this.workersTimer = setTimeout(() => {
            this.workersTimer = null
            this.loadWorkers()
            this.loadForecast()
        }, 500)
    }

    onJobsUpdated() {
        if (this.jobsTimer) clearTimeout(this.jobsTimer)
        this.jobsTimer = setTimeout(() => {
            this.jobsTimer = null
            this.loadForecast()
            this.loadWorkers()
        }, 500)
    }

    /** Desktop and up: fixed viewport-height grid (no page scroll). Smaller: stacked flow. */
    get fixedLayout(): boolean {
        return !this.$vuetify.breakpoint.mdAndDown
    }

    get workers(): FleetWorker[] {
        return this.$store.getters['fleet/workers/getWorkers']
    }

    get enabledHostnames(): string[] {
        return enabledWorkerHostnames(this.workers)
    }

    get attentionHostnames(): string[] {
        return attentionWorkerHostnames(this.workers)
    }

    get attentionReasons(): Record<string, string> {
        return attentionWorkerReasons(this.workers)
    }

    get intervalsHours(): number[] {
        return sanitizeIntervals(this.$store.state.gui?.dashboard?.finishIntervalsHours)
    }
}
</script>

<style>
/* Worker needs attention: the whole page (v-main) flashes red during the first half of the
   cycle, the banner in the workers panel (DashboardWorkersPanel) during the second half.
   Both animations share the 2.4s period so they alternate. Unscoped on purpose: the class
   sits on <html> and the target is the app's main area. */
html.fleet-attention #content {
    animation: fleet-attention-page 2.4s ease-in-out infinite;
}
@keyframes fleet-attention-page {
    0%,
    50%,
    100% {
        background-color: transparent;
    }
    25% {
        background-color: rgba(211, 47, 47, 0.55);
    }
}
</style>

<style scoped>
/* stacked flow (tablet / phone) */
.fleet-dashboard {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
/* desktop and up: fixed viewport-height grid, no page scroll.
   topbar (48px) + the page container's py-sm-6 (24px top + 24px bottom) */
.fleet-dashboard.fleet-dashboard--fixed {
    height: calc(100vh - 48px - 48px);
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    gap: 12px;
    overflow: hidden;
}
.fleet-dashboard__col {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    min-width: 0;
}
.fleet-dashboard__status {
    flex: 0 0 auto;
}
.fleet-dashboard__map {
    flex: 1 1 0;
    min-height: 0;
}
/* a floor with nothing placed only needs its header line */
.fleet-dashboard__map.dash-map--empty {
    flex: 0 0 auto;
}
/* right column: jobs on top (grow with content, at most 40% of the column, list scrolls),
   workers below taking the rest (its worker list scrolls) */
.fleet-dashboard__jobs {
    flex: 0 1 auto;
    max-height: 34%;
    min-height: 0;
}
.fleet-dashboard__workers {
    flex: 1 1 0;
    min-height: 0;
}
/* stacked layout (tablet / phone): give the maps and lists a sensible height */
.fleet-dashboard:not(.fleet-dashboard--fixed) .fleet-dashboard__map {
    height: 260px;
    flex: 0 0 auto;
}
.fleet-dashboard:not(.fleet-dashboard--fixed) .fleet-dashboard__jobs {
    max-height: 50vh;
}
.fleet-dashboard:not(.fleet-dashboard--fixed) .fleet-dashboard__workers {
    max-height: 70vh;
}
</style>
