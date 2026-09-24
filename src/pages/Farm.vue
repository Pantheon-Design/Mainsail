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
                    <!-- Same "N need attention" chip as the Jobs -> Workers card title -->
                    <span
                        class="status-counter status-counter--attention"
                        :class="{ 'status-counter--attention-active': attentionHostnames.length > 0 }"
                        :title="attentionTitle">
                        <v-icon x-small :color="attentionHostnames.length ? 'white' : undefined">{{ mdiExclamationThick }}</v-icon>
                        {{ attentionHostnames.length }} need{{ attentionHostnames.length === 1 ? 's' : '' }} attention
                    </span>
                    <span v-for="s in totalStatusList" :key="'total-' + s.key" class="status-counter">
                        <span class="status-dot" :class="{ square: s.key === 'error' || s.key === 'printing' }"
                              :style="{ backgroundColor: s.color }"></span>
                        {{ s.label }} {{ s.count }}
                    </span>
                    <!-- Ovens: separate count, never mixed into the printer statuses above -->
                    <span
                        v-if="totalOvenCount"
                        class="status-counter status-counter--oven"
                        :title="ovenLegendTitle">
                        <span class="status-dot oven" :style="{ borderColor: OVEN_LEGEND.color }"></span>
                        {{ OVEN_LEGEND.label }}{{ totalOvenCount === 1 ? '' : 's' }} {{ totalOvenCount }}<span v-if="ovenSpoolTotals"> · {{ ovenSpoolTotals }}</span>
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
import { mdiExclamationThick, mdiHammer } from '@mdi/js'
import BaseMixin from '@/components/mixins/base'
import FarmMapSection from '@/components/panels/FarmMapSection.vue'
import { FleetWorker } from '@/store/fleet/jobs/types'
import { fleetDaemonEvents } from '@/plugins/fleetDaemonClient'
import {
    enabledWorkerHostnames,
    attentionWorkerHostnames,
    attentionWorkerReasons,
    attentionChipTitle,
} from '@/components/panels/fleetWorkerAttention'
import {
    getPrinterStatus as getPrinterStatusUtil,
    PrinterStatus,
} from '@/components/panels/farmPrinterStatus'
import {
    getOvenStatus,
    ovenMaxSpools,
    ovenSpoolCount,
    OvenStatus,
    OVEN_LEGEND,
    OVEN_STATUS_META,
} from '@/components/panels/farmOvenStatus'
import { OvenFrame } from '@/store/farm/types'

@Component({
    components: {
        FarmMapSection,
    },
})
export default class PageFarm extends Mixins(BaseMixin) {
    mdiHammer = mdiHammer
    mdiExclamationThick = mdiExclamationThick

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

    /** Chip hover: one `host: reason` line per blocked worker, else what the chip means. */
    get attentionTitle(): string {
        return attentionChipTitle(this.attentionHostnames, this.attentionReasons)
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
    // Oven legend entry (shared with FarmMapSection through farmOvenStatus.ts)
    readonly OVEN_LEGEND = OVEN_LEGEND

    // ---- Ovens: roster entries with deviceType === 'oven' (both floors), status from farm.fleetDaemonOvens ----
    get ovenHostnames(): string[] {
        const roster = this.$store.state.gui?.remoteprinters?.printers || {}
        const seen = new Set<string>()
        const out: string[] = []
        Object.values(roster).forEach((e: any) => {
            if (e?.deviceType !== 'oven' || !e.hostname) return
            const key = e.hostname.toLowerCase()
            if (seen.has(key)) return
            seen.add(key)
            out.push(e.hostname)
        })
        return out
    }

    get totalOvenCount(): number {
        return this.ovenHostnames.length
    }

    ovenFrame(hostname: string): OvenFrame | null {
        const ovens: Record<string, OvenFrame> = this.$store.state.farm.fleetDaemonOvens || {}
        const key = hostname.toLowerCase()
        for (const [h, frame] of Object.entries(ovens)) {
            if (h.toLowerCase() === key) return frame
        }
        return null
    }

    get ovenLegendTitle(): string {
        const c: Record<OvenStatus, number> = { drying: 0, ready: 0, empty: 0, error: 0, disconnected: 0 }
        this.ovenHostnames.forEach((h) => {
            c[getOvenStatus(this.ovenFrame(h), this.$store.state.farm.fleetDaemonConnected)]++
        })
        return (Object.keys(c) as OvenStatus[])
            .filter((k) => c[k] > 0)
            .map((k) => `${OVEN_STATUS_META[k].label} ${c[k]}`)
            .join(' · ')
    }

    /** Legend suffix `5/24 spools` across all ovens (max only when every oven's capacity is known). */
    get ovenSpoolTotals(): string {
        let spools = 0
        let max = 0
        let allMaxKnown = true
        let anyFrame = false
        this.ovenHostnames.forEach((h) => {
            const frame = this.ovenFrame(h)
            if (frame) {
                anyFrame = true
                spools += ovenSpoolCount(frame)
            }
            const rosterMax = this.$store.getters['gui/remoteprinters/getMaxSpools'](h) as number | null
            const m = ovenMaxSpools(frame, rosterMax)
            if (m === null) allMaxKnown = false
            else max += m
        })
        if (!anyFrame) return ''
        return allMaxKnown ? `${spools}/${max} spools` : `${spools} spools`
    }

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
/* Oven legend dot: hollow rounded square with a thick border, like the map marker */
.status-dot.oven {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    background: rgba(30, 27, 22, 0.9);
    border: 2px solid;
    box-sizing: border-box;
}
.status-counter--oven {
    padding-left: 12px;
    border-left: 1px solid rgba(128, 128, 128, 0.4);
}
/* "N need attention" chip: mirrors the chip in the Jobs -> Workers card title */
.status-counter--attention {
    padding: 1px 8px;
    border-radius: 11px;
    border: 1px solid rgba(128, 128, 128, 0.5);
    line-height: 18px;
}
.status-counter--attention-active {
    background: #d32f2f;
    border-color: #d32f2f;
    color: #fff;
    font-weight: 700;
}
</style>
