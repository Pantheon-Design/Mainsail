<template>
    <div class="dash-status">
        <div class="dash-status__item dash-status__item--total">
            <span class="dash-status__num">{{ totalPrinterCount }}</span>
            <span class="dash-status__label">{{ $t('FleetDashboard.Printers') }}</span>
        </div>
        <div v-for="s in statusList" :key="s.key" class="dash-status__item" :title="s.label">
            <span class="dash-status__num" :style="{ color: s.color }">{{ s.count }}</span>
            <span class="dash-status__label">
                <span
                    class="dash-status__dot"
                    :class="{ square: s.key === 'error' || s.key === 'printing' }"
                    :style="{ backgroundColor: s.color }"></span>
                {{ s.label }}
            </span>
        </div>
        <div
            class="dash-status__item dash-status__item--sep"
            :title="`${workerCount} of ${totalPrinterCount} printers are enabled as fleet workers`">
            <span class="dash-status__num orange--text">{{ workerCount }}</span>
            <span class="dash-status__label">
                <v-icon small color="orange">{{ mdiHammer }}</v-icon>
                {{ $t('FleetDashboard.Workers') }}
            </span>
        </div>
        <div v-if="ovenCount" class="dash-status__item" :title="ovenLegendTitle">
            <span class="dash-status__num">{{ ovenCount }}</span>
            <span class="dash-status__label">
                <span class="dash-status__dot oven" :style="{ borderColor: OVEN_LEGEND.color }"></span>
                {{ $t('FleetDashboard.Ovens') }}
            </span>
        </div>
        <div v-if="!connected" class="dash-status__item dash-status__item--offline">
            <v-icon small color="error">{{ mdiLanDisconnect }}</v-icon>
            <span class="dash-status__label error--text">{{ $t('FleetDashboard.DaemonOffline') }}</span>
        </div>
        <!-- reduced motion switch: per browser, for slow screens such as TVs -->
        <div class="dash-status__item dash-status__item--motion" :class="{ 'ml-auto': connected }">
            <v-btn
                icon
                :color="reducedMotion ? 'primary' : undefined"
                :title="$t(reducedMotion ? 'FleetDashboard.ReducedMotionOn' : 'FleetDashboard.ReducedMotionOff')"
                @click="$emit('toggle-reduced-motion')">
                <v-icon>{{ reducedMotion ? mdiMotionPauseOutline : mdiMotionPlayOutline }}</v-icon>
            </v-btn>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Mixins, Prop, Watch } from 'vue-property-decorator'
import { mdiHammer, mdiLanDisconnect, mdiMotionPauseOutline, mdiMotionPlayOutline } from '@mdi/js'
import BaseMixin from '@/components/mixins/base'
import { hostKey } from '@/plugins/hostKey'
import { FleetWorker } from '@/store/fleet/jobs/types'
import {
    emptyStatusCounts,
    getPrinterStatus,
    PrinterStatus,
    STATUS_META,
    STATUS_ORDER,
} from '@/components/panels/farmPrinterStatus'
import { enabledWorkerHostnames } from '@/components/panels/fleetWorkerAttention'
import { getOvenStatus, OVEN_LEGEND, OVEN_STATUS_META, OvenStatus } from '@/components/panels/farmOvenStatus'
import { OvenFrame } from '@/store/farm/types'

/** Fleet-wide totals for the dashboard (same figures as the Fleet Map page header). */
@Component
export default class DashboardStatusBar extends Mixins(BaseMixin) {
    @Prop({ type: Array, default: () => [] }) readonly workers!: FleetWorker[]
    /** Reduced-motion state shown on the switch; the page owns it and handles `toggle-reduced-motion`. */
    @Prop({ type: Boolean, default: false }) readonly reducedMotion!: boolean

    mdiHammer = mdiHammer
    mdiLanDisconnect = mdiLanDisconnect
    mdiMotionPauseOutline = mdiMotionPauseOutline
    mdiMotionPlayOutline = mdiMotionPlayOutline
    readonly OVEN_LEGEND = OVEN_LEGEND

    get connected(): boolean {
        return !!this.$store.state.farm.fleetDaemonConnected
    }

    isNonPrinterHostname(hostname: string): boolean {
        return this.$store.getters['gui/remoteprinters/getDeviceType'](hostname) !== 'printer'
    }

    /** Figures on screen. Replaced by onFrameState only when one of them changes. */
    counts: Record<PrinterStatus, number> = emptyStatusCounts()
    totalPrinterCount = 0
    /** Daemon printers currently enabled as workers (same figure as the Workers map header). */
    workerCount = 0

    /**
     * Totals derived from the daemon frames, plus their signature. The daemon re-sends a frame
     * on any field change (filament used, timestamps, …); the template reads the data fields
     * above, which the watcher only replaces when the signature differs, so such frames cost
     * no render here.
     */
    get frameState(): { sig: string; counts: Record<PrinterStatus, number>; total: number; workers: number } {
        const all: Record<string, any> = this.$store.state.farm.fleetDaemonPrinters || {}
        const enabled = new Set(enabledWorkerHostnames(this.workers).map(hostKey))
        const counts = emptyStatusCounts()
        let total = 0
        let workers = 0
        for (const [hostname, frame] of Object.entries(all)) {
            if (this.isNonPrinterHostname(hostname)) continue
            total++
            counts[getPrinterStatus(frame, this.connected)]++
            if (enabled.has(hostKey(hostname))) workers++
        }
        const sig = [total, workers, ...STATUS_ORDER.map((k) => counts[k])].join(',')
        return { sig, counts, total, workers }
    }

    @Watch('frameState.sig', { immediate: true })
    onFrameState() {
        const s = this.frameState
        this.counts = s.counts
        this.totalPrinterCount = s.total
        this.workerCount = s.workers
    }

    get statusList() {
        return STATUS_ORDER.map((k) => ({
            key: k,
            label: STATUS_META[k].label,
            color: STATUS_META[k].color,
            count: this.counts[k],
        }))
    }

    get ovenHostnames(): string[] {
        const roster = this.$store.state.gui?.remoteprinters?.printers || {}
        const seen = new Set<string>()
        const out: string[] = []
        Object.values(roster).forEach((e: any) => {
            if (e?.deviceType !== 'oven' || !e.hostname) return
            const key = hostKey(e.hostname)
            if (seen.has(key)) return
            seen.add(key)
            out.push(e.hostname)
        })
        return out
    }

    get ovenCount(): number {
        return this.ovenHostnames.length
    }

    ovenFrame(hostname: string): OvenFrame | null {
        const ovens: Record<string, OvenFrame> = this.$store.state.farm.fleetDaemonOvens || {}
        const key = hostKey(hostname)
        for (const [h, frame] of Object.entries(ovens)) {
            if (hostKey(h) === key) return frame
        }
        return null
    }

    get ovenLegendTitle(): string {
        const c: Record<OvenStatus, number> = { drying: 0, ready: 0, empty: 0, error: 0, disconnected: 0 }
        this.ovenHostnames.forEach((h) => {
            c[getOvenStatus(this.ovenFrame(h), this.connected)]++
        })
        return (Object.keys(c) as OvenStatus[])
            .filter((k) => c[k] > 0)
            .map((k) => `${OVEN_STATUS_META[k].label} ${c[k]}`)
            .join(' · ')
    }
}
</script>

<style scoped>
.dash-status {
    display: flex;
    align-items: stretch;
    flex-wrap: wrap;
    gap: 6px 18px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(128, 128, 128, 0.25);
    border-radius: 6px;
}
.dash-status__item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    line-height: 1.1;
}
.dash-status__item--total {
    padding-right: 18px;
    border-right: 1px solid rgba(128, 128, 128, 0.4);
}
.dash-status__item--sep {
    padding-left: 18px;
    border-left: 1px solid rgba(128, 128, 128, 0.4);
}
.dash-status__item--offline {
    flex-direction: row;
    gap: 6px;
    margin-left: auto;
}
.dash-status__item--motion {
    justify-content: center;
}
.dash-status__num {
    font-size: 25px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
}
.dash-status__label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 22px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.8;
}
.dash-status__dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    display: inline-block;
}
.dash-status__dot.square {
    border-radius: 2px;
}
.dash-status__dot.oven {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    background: rgba(30, 27, 22, 0.9);
    border: 2px solid;
    box-sizing: border-box;
}
</style>
