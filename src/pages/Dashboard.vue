<template>
    <div
        class="fleet-dashboard"
        :class="{ 'fleet-dashboard--fixed': fixedLayout, 'fleet-dashboard--reduced': reducedMotion }">
        <!-- attention: a fixed red sheet behind the panels whose opacity pulses. Compositor only,
             no repaint of the page, so it keeps flashing under reduced motion too -->
        <div v-if="attentionActive" class="fleet-dashboard__attention" />
        <div class="fleet-dashboard__col fleet-dashboard__col--maps">
            <dashboard-status-bar
                :workers="workers"
                :reduced-motion="reducedMotion"
                class="fleet-dashboard__status"
                @toggle-reduced-motion="setReducedMotion(!reducedMotion)" />
            <dashboard-fleet-map
                v-for="floor in floors"
                :key="floor.location"
                :location="floor.location"
                :name="floor.name"
                :worker-hostnames="enabledHostnames"
                :attention-hostnames="attentionHostnames"
                :attention-reasons="attentionReasons"
                :highlight-hostname="hoverHost"
                :reduced-motion="reducedMotion"
                class="fleet-dashboard__map"
                :class="`fleet-dashboard__map--${floor.location}`" />
        </div>
        <div class="fleet-dashboard__col fleet-dashboard__col--jobs">
            <dashboard-jobs-panel class="fleet-dashboard__jobs" />
            <dashboard-air-panel class="fleet-dashboard__air" />
        </div>
        <div class="fleet-dashboard__col fleet-dashboard__col--workers">
            <dashboard-workers-panel
                :workers="workers"
                :intervals-hours="intervalsHours"
                :reduced-motion="reducedMotion"
                class="fleet-dashboard__workers"
                @hover="hoverHost = $event" />
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import DashboardStatusBar from '@/components/panels/DashboardStatusBar.vue'
import DashboardFleetMap from '@/components/panels/DashboardFleetMap.vue'
import DashboardWorkersPanel from '@/components/panels/DashboardWorkersPanel.vue'
import DashboardJobsPanel from '@/components/panels/DashboardJobsPanel.vue'
import DashboardAirPanel from '@/components/panels/DashboardAirPanel.vue'
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
 * Fleet dashboard: everything an operator needs on one screen, in three columns —
 * fleet totals + both floor maps (cropped to the placed printers; the Ground Floor
 * gets half the Print Farm's height when both have printers), open fleet jobs with
 * time / filament left, and workers needing attention + finish forecast.
 * Desktop and wider fill the viewport without page scrolling; below that the
 * sections stack.
 *
 * Reduced motion (button in the status bar, remembered per browser, defaults to the OS
 * `prefers-reduced-motion` setting): drops the decorative animations that make slow
 * devices such as smart TVs lag — pulse rings and wave fills on the maps, the flashing
 * attention banner — while keeping the information itself. The red attention sheet keeps
 * flashing: it animates opacity only, which costs nothing on the main thread.
 */
@Component({
    components: {
        DashboardStatusBar,
        DashboardFleetMap,
        DashboardWorkersPanel,
        DashboardJobsPanel,
        DashboardAirPanel,
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

    /** Reduced motion: per-browser (a TV keeps its own), see REDUCED_MOTION_KEY. */
    reducedMotion = false
    static readonly REDUCED_MOTION_KEY = 'fleetDashboardReducedMotion'

    /** Fallback poll period (ms); WS events refresh immediately, this covers missed events. */
    static readonly POLL_MS = 10000
    /** Service-tracker snapshot (nozzle life fallback for older daemons) refresh period. */
    static readonly SNAPSHOT_MS = 60000

    created() {
        this.reducedMotion = PageDashboard.loadReducedMotion()
    }

    /** Stored choice wins; otherwise follow the OS / browser "prefers reduced motion" setting. */
    static loadReducedMotion(): boolean {
        try {
            const stored = localStorage.getItem(PageDashboard.REDUCED_MOTION_KEY)
            if (stored === '1') return true
            if (stored === '0') return false
        } catch (e) {
            // storage unavailable — fall through to the media query
        }
        return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }

    setReducedMotion(on: boolean) {
        this.reducedMotion = on
        try {
            localStorage.setItem(PageDashboard.REDUCED_MOTION_KEY, on ? '1' : '0')
        } catch (e) {
            // ignore
        }
    }

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
    }

    beforeDestroy() {
        fleetDaemonEvents.$off('workers_updated', this.onWorkersUpdated)
        fleetDaemonEvents.$off('jobs_updated', this.onJobsUpdated)
        document.removeEventListener('visibilitychange', this.onVisibility)
        if (this.workersTimer) clearTimeout(this.workersTimer)
        if (this.jobsTimer) clearTimeout(this.jobsTimer)
        if (this.pollTimer) clearInterval(this.pollTimer)
        if (this.snapshotTimer) clearInterval(this.snapshotTimer)
    }

    /** Daily service-tracker rows: nozzle life for the worker list when the daemon frame lacks it. */
    loadSnapshot() {
        this.$store.dispatch('fleet/maintenance/loadPrinters').catch(() => {})
    }

    get attentionActive(): boolean {
        return this.attentionHostnames.length > 0
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

<style scoped>
/* Worker needs attention: a fixed red sheet behind the panels flashes during the first half
   of the cycle, the banner in the workers panel (DashboardWorkersPanel) during the second
   half; both share the 2.4s period so they alternate. Only opacity is animated, which the
   compositor does without repainting the page (animating the page background did). */
.fleet-dashboard__attention {
    position: fixed;
    inset: 0;
    z-index: 0;
    background: rgba(211, 47, 47, 0.55);
    opacity: 0;
    pointer-events: none;
    will-change: opacity;
    animation: fleet-attention-page 2.4s ease-in-out infinite;
}
@keyframes fleet-attention-page {
    0%,
    50%,
    100% {
        opacity: 0;
    }
    25% {
        opacity: 1;
    }
}
/* reduced motion: the sheet still flashes, but as an on/off blink — two compositor frames per
   cycle instead of one per screen refresh, which matters on devices that composite in software
   (a Raspberry Pi browser without GPU acceleration blends the whole screen on the CPU) */
.fleet-dashboard--reduced .fleet-dashboard__attention {
    animation-timing-function: steps(1, end);
    will-change: auto;
}
/* the panels sit above the attention sheet */
.fleet-dashboard__col {
    position: relative;
    z-index: 1;
}
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
    grid-template-columns: minmax(0, 5fr) minmax(0, 3fr) minmax(0, 3fr);
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
/* Print Farm gets twice the Ground Floor's height when both have placed printers;
   when one is empty (header only, below) the other takes the rest of the column */
.fleet-dashboard__map {
    flex: 1 1 0;
    min-height: 0;
}
.fleet-dashboard__map--farm {
    flex-grow: 1.5;
}
/* a floor with nothing placed only needs its header line */
.fleet-dashboard__map.dash-map--empty {
    flex: 0 0 auto;
}
/* jobs and workers each fill their own column (their lists scroll) */
.fleet-dashboard__jobs,
.fleet-dashboard__workers {
    flex: 1 1 0;
    min-height: 0;
}
/* air sensor card under the jobs: takes what its rows need, never more than 40% of the column */
.fleet-dashboard__air {
    flex: 0 1 auto;
    max-height: 40%;
    min-height: 0;
}
/* stacked layout (tablet / phone): give the maps and lists a sensible height */
.fleet-dashboard:not(.fleet-dashboard--fixed) .fleet-dashboard__map {
    height: 320px;
    flex: 0 0 auto;
}
.fleet-dashboard:not(.fleet-dashboard--fixed) .fleet-dashboard__map--ground {
    height: 160px;
}
.fleet-dashboard:not(.fleet-dashboard--fixed) .fleet-dashboard__map.dash-map--empty {
    height: auto;
}
.fleet-dashboard:not(.fleet-dashboard--fixed) .fleet-dashboard__jobs {
    max-height: 50vh;
}
.fleet-dashboard:not(.fleet-dashboard--fixed) .fleet-dashboard__air {
    max-height: 40vh;
}
.fleet-dashboard:not(.fleet-dashboard--fixed) .fleet-dashboard__workers {
    max-height: 70vh;
}
</style>
