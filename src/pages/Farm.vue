<template>
    <div>
        <!-- Title + TOTAL fleet status -->
        <div class="fleet-header mb-4">
            <div class="fleet-title-row">
                <h2 class="fleet-title">Fleet Map</h2>
                <span class="fleet-total">{{ totalPrinterCount }} total</span>
                <div class="status-counters">
                    <span
                        class="status-counter status-counter--total"
                        :title="`${totalWorkerCount} of ${totalPrinterCount} printers are enabled as fleet workers`">
                        <v-icon x-small color="orange">{{ mdiHammer }}</v-icon>
                        Workers {{ totalWorkerCount }}
                    </span>
                    <span v-for="s in totalStatusList" :key="'total-' + s.key" class="status-counter">
                        <span class="status-dot" :class="{ square: s.key === 'error' || s.key === 'printing' }"
                              :style="{ backgroundColor: s.color }"></span>
                        {{ s.label }} {{ s.count }}
                    </span>
                </div>
            </div>
        </div>

        <!-- Print Farm map (worker stickers + count mirror the Jobs → Workers map) -->
        <farm-map-section
            location="farm"
            name="Print Farm"
            show-workers
            :worker-hostnames="enabledHostnames"
            :attention-hostnames="attentionHostnames"
            :attention-reasons="attentionReasons"
            class="mb-8" />

        <!-- Ground Floor map -->
        <farm-map-section
            location="ground"
            name="Ground Floor"
            show-workers
            :worker-hostnames="enabledHostnames"
            :attention-hostnames="attentionHostnames"
            :attention-reasons="attentionReasons" />
    </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import { mdiHammer } from '@mdi/js'
import BaseMixin from '@/components/mixins/base'
import FarmMapSection from '@/components/panels/FarmMapSection.vue'
import { FleetWorker } from '@/store/fleet/jobs/types'
import { fleetDaemonEvents } from '@/plugins/fleetDaemonClient'
import {
    enabledWorkerHostnames,
    attentionWorkerHostnames,
    attentionWorkerReasons,
} from '@/components/panels/fleetWorkerAttention'
import {
    getPrinterStatus as getPrinterStatusUtil,
    PrinterStatus,
} from '@/components/panels/farmPrinterStatus'

@Component({
    components: {
        FarmMapSection,
    },
})
export default class PageFarm extends Mixins(BaseMixin) {
    mdiHammer = mdiHammer

    private workersTimer: ReturnType<typeof setTimeout> | null = null
    private pollTimer: ReturnType<typeof setInterval> | null = null

    /** Fallback poll period (ms); WS events refresh immediately, this covers missed events. */
    static readonly POLL_MS = 10000

    mounted() {
        this.loadWorkers()
        fleetDaemonEvents.$on('workers_updated', this.onWorkersUpdated)
        fleetDaemonEvents.$on('jobs_updated', this.onWorkersUpdated)
        document.addEventListener('visibilitychange', this.onVisibility)
        this.pollTimer = setInterval(this.onVisibility, PageFarm.POLL_MS)
    }

    beforeDestroy() {
        fleetDaemonEvents.$off('workers_updated', this.onWorkersUpdated)
        fleetDaemonEvents.$off('jobs_updated', this.onWorkersUpdated)
        document.removeEventListener('visibilitychange', this.onVisibility)
        if (this.workersTimer) clearTimeout(this.workersTimer)
        if (this.pollTimer) clearInterval(this.pollTimer)
    }

    /** Worker state is informational here, so a failed load just leaves the stickers off. */
    loadWorkers() {
        this.$store.dispatch('fleet/workers/loadWorkers').catch(() => {})
    }

    onVisibility() {
        if (document.visibilityState === 'visible') this.loadWorkers()
    }

    /** Debounced: the daemon broadcasts several events per scheduler step. */
    onWorkersUpdated() {
        if (this.workersTimer) clearTimeout(this.workersTimer)
        this.workersTimer = setTimeout(() => {
            this.workersTimer = null
            this.loadWorkers()
        }, 500)
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

    /** Daemon printers currently enabled as workers (same figure as the Workers map header). */
    get totalWorkerCount(): number {
        const enabled = new Set(this.enabledHostnames.map((h) => h.toLowerCase()))
        return Object.keys(this.fleetDaemonPrinters).filter((h) => enabled.has(h.toLowerCase())).length
    }

    // Ovens (roster deviceType === 'oven') are not printers; keep them out of the counters
    isOvenHostname(hostname: string): boolean {
        return this.$store.getters['gui/remoteprinters/getDeviceType'](hostname) === 'oven'
    }

    // Status color/label vocabulary (matches farmPrinterStatus + FarmPrinterGridPanel)
    readonly STATUS_META: Record<PrinterStatus, { color: string; label: string }> = {
        printing: { color: '#2196f3', label: 'Printing' },
        ready: { color: 'hsl(90, 100%, 32%)', label: 'Ready' },
        complete: { color: '#1976d2', label: 'Complete' },
        error: { color: '#d32f2f', label: 'Error' },
        disconnected: { color: '#8a8a8a', label: 'Offline' },
    }
    readonly STATUS_ORDER: PrinterStatus[] = ['printing', 'ready', 'complete', 'error', 'disconnected']

    get fleetDaemonPrinters() {
        const all = this.$store.state.farm.fleetDaemonPrinters || {}
        return Object.fromEntries(Object.entries(all).filter(([hostname]) => !this.isOvenHostname(hostname)))
    }

    get totalPrinterCount(): number {
        return Object.keys(this.fleetDaemonPrinters).length
    }

    getPrinterStatus(printer: any): PrinterStatus {
        return getPrinterStatusUtil(printer, this.$store.state.farm.fleetDaemonConnected)
    }

    get totalStatusList() {
        const counts: Record<PrinterStatus, number> = { printing: 0, ready: 0, complete: 0, error: 0, disconnected: 0 }
        Object.values(this.fleetDaemonPrinters).forEach((printer: any) => {
            counts[this.getPrinterStatus(printer)]++
        })
        return this.STATUS_ORDER.map((k) => ({ key: k, label: this.STATUS_META[k].label, color: this.STATUS_META[k].color, count: counts[k] }))
    }
}
</script>

<style scoped>
/* Header + total status */
.fleet-title-row {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
}
.fleet-title {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
}
.fleet-total {
    font-size: 13px;
    opacity: 0.75;
    font-weight: 600;
    padding-left: 14px;
    border-left: 1px solid rgba(255, 255, 255, 0.15);
}

/* Status counters */
.status-counters {
    display: flex;
    gap: 15px;
    flex-wrap: wrap;
    align-items: center;
}
.status-counter {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 500;
}
.status-counter--total {
    font-weight: 700;
    padding-right: 12px;
    border-right: 1px solid rgba(128, 128, 128, 0.4);
}
.status-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    display: inline-block;
}
.status-dot.square {
    border-radius: 2px;
}
</style>
