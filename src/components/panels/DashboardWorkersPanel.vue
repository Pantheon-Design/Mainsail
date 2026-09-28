<template>
    <div class="dash-workers">
        <!-- 1. attention: the one number an operator must see first -->
        <div
            class="dash-workers__attention"
            :class="{ 'dash-workers__attention--active': attentionHostnames.length > 0 }"
            :title="attentionTitle">
            <v-icon :size="30" :color="attentionHostnames.length ? 'white' : 'grey'">{{ mdiExclamationThick }}</v-icon>
            <span class="dash-workers__attention-num">{{ attentionHostnames.length }}</span>
            <span class="dash-workers__attention-text">
                {{
                    attentionHostnames.length === 1
                        ? $t('FleetDashboard.NeedsAttention')
                        : $t('FleetDashboard.NeedAttention')
                }}
                <span v-if="attentionHostnames.length" class="dash-workers__attention-hosts">
                    {{ attentionHostnames.map(shortName).join(', ') }}
                </span>
            </span>
        </div>

        <!-- 2. worker status summary -->
        <div class="dash-workers__row">
            <span class="dash-workers__row-title">
                <v-icon x-small color="orange">{{ mdiHammer }}</v-icon>
                {{ enabledCount }} {{ $t('FleetDashboard.Workers') }}
            </span>
            <span v-for="s in workerStatusList" :key="s.key" class="dash-workers__status" :title="s.label">
                <span
                    class="dash-workers__dot"
                    :class="{ square: s.key === 'error' || s.key === 'printing' }"
                    :style="{ backgroundColor: s.color }"></span>
                {{ s.label }}
                <strong>{{ s.count }}</strong>
            </span>
        </div>

        <!-- 3. finish forecast: bands + cumulative, worker vs other printers -->
        <div class="dash-workers__row-title mt-2">
            {{ $t('FleetDashboard.Finishing') }}
            <span class="text--secondary font-weight-regular">
                · {{ buckets.total.workers + buckets.total.others }} {{ $t('FleetDashboard.PrintingNow') }}
            </span>
        </div>
        <table class="dash-workers__table">
            <thead>
                <tr>
                    <th class="text-left">{{ $t('FleetDashboard.Band') }}</th>
                    <th :title="$t('FleetDashboard.WorkerColHint')">{{ $t('FleetDashboard.WorkerCol') }}</th>
                    <th :title="$t('FleetDashboard.OtherColHint')">{{ $t('FleetDashboard.OtherCol') }}</th>
                    <th>{{ $t('FleetDashboard.Total') }}</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="b in buckets.bands" :key="'band-' + b.label">
                    <td class="text-left">{{ b.label }}</td>
                    <td>{{ b.workers }}</td>
                    <td>{{ b.others }}</td>
                    <td class="font-weight-bold">{{ b.workers + b.others }}</td>
                </tr>
                <tr v-for="w in buckets.within" :key="'within-' + w.hours" class="dash-workers__within">
                    <td class="text-left">{{ $t('FleetDashboard.Within', { hours: w.hours }) }}</td>
                    <td>{{ w.workers }}</td>
                    <td>{{ w.others }}</td>
                    <td class="font-weight-bold">{{ w.workers + w.others }}</td>
                </tr>
                <tr
                    v-if="buckets.unknown.workers + buckets.unknown.others"
                    class="dash-workers__unknown"
                    :title="$t('FleetDashboard.UnknownHint')">
                    <td class="text-left">{{ $t('FleetDashboard.Unknown') }}</td>
                    <td>{{ buckets.unknown.workers }}</td>
                    <td>{{ buckets.unknown.others }}</td>
                    <td class="font-weight-bold">{{ buckets.unknown.workers + buckets.unknown.others }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script lang="ts">
import { Component, Mixins, Prop } from 'vue-property-decorator'
import { mdiExclamationThick, mdiHammer } from '@mdi/js'
import BaseMixin from '@/components/mixins/base'
import { hostKey } from '@/plugins/hostKey'
import { FleetWorker } from '@/store/fleet/jobs/types'
import {
    countPrinterStatuses,
    getPrinterStatus,
    STATUS_META,
    STATUS_ORDER,
} from '@/components/panels/farmPrinterStatus'
import {
    attentionChipTitle,
    attentionWorkerHostnames,
    attentionWorkerReasons,
    enabledWorkerHostnames,
} from '@/components/panels/fleetWorkerAttention'
import { bucketFinishes, FinishBuckets, FinishEntry, remainingSecs } from '@/store/fleet/forecast'

/**
 * Workers section of the fleet dashboard: attention count first, then the
 * enabled workers by status, then how many printing printers finish within the
 * configured hour marks (bands + cumulative), split fleet worker / other.
 */
@Component
export default class DashboardWorkersPanel extends Mixins(BaseMixin) {
    @Prop({ type: Array, default: () => [] }) readonly workers!: FleetWorker[]
    @Prop({ type: Array, default: () => [1, 2] }) readonly intervalsHours!: number[]

    mdiExclamationThick = mdiExclamationThick
    mdiHammer = mdiHammer

    get connected(): boolean {
        return !!this.$store.state.farm.fleetDaemonConnected
    }

    /** fleet_daemon frames keyed by hostKey so worker rows match regardless of `.local` / case. */
    get framesByKey(): Map<string, any> {
        const out = new Map<string, any>()
        Object.entries(this.$store.state.farm.fleetDaemonPrinters || {}).forEach(([h, frame]) =>
            out.set(hostKey(h), frame)
        )
        return out
    }

    get enabledHostnames(): string[] {
        return enabledWorkerHostnames(this.workers)
    }

    get enabledCount(): number {
        const keys = new Set(this.enabledHostnames.map(hostKey))
        let n = 0
        this.framesByKey.forEach((_frame, key) => {
            if (keys.has(key)) n++
        })
        return n
    }

    get attentionHostnames(): string[] {
        return attentionWorkerHostnames(this.workers)
    }

    get attentionTitle(): string {
        return attentionChipTitle(this.attentionHostnames, attentionWorkerReasons(this.workers))
    }

    shortName(hostname: string): string {
        return hostname.replace(/\.local$/i, '')
    }

    get workerStatusList() {
        const keys = new Set(this.enabledHostnames.map(hostKey))
        const frames: any[] = []
        this.framesByKey.forEach((frame, key) => {
            if (keys.has(key)) frames.push(frame)
        })
        const counts = countPrinterStatuses(frames, this.connected)
        return STATUS_ORDER.map((k) => ({
            key: k,
            label: STATUS_META[k].label,
            color: STATUS_META[k].color,
            count: counts[k],
        }))
    }

    /** Every printer that is printing right now (worker or not), with its remaining time. */
    get printingEntries(): FinishEntry[] {
        return this.workers
            .filter((w) => {
                const frame = this.framesByKey.get(hostKey(w.printer_hostname))
                if (frame) return getPrinterStatus(frame, this.connected) === 'printing'
                return w.connected && w.print_state === 'printing'
            })
            .map((w) => ({
                remaining: remainingSecs({
                    estimated_time: w.estimated_time,
                    print_duration: w.print_duration,
                    progress: w.progress,
                    filename: w.filename,
                }),
                isWorker: w.enabled,
            }))
    }

    get buckets(): FinishBuckets {
        return bucketFinishes(this.printingEntries, this.intervalsHours)
    }
}
</script>

<style scoped>
.dash-workers {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(128, 128, 128, 0.25);
    border-radius: 6px;
    padding: 8px 12px 10px;
}
.dash-workers__attention {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid rgba(128, 128, 128, 0.4);
    margin-bottom: 8px;
}
/* Flashes in the second half of the 2.4s cycle; the page background (Dashboard.vue,
   html.fleet-attention #content) flashes in the first half, so they take turns. */
.dash-workers__attention--active {
    background: #b71c1c;
    border-color: #b71c1c;
    color: #fff;
    animation: dash-attention-banner 2.4s ease-in-out infinite;
}
@keyframes dash-attention-banner {
    0%,
    50%,
    100% {
        background-color: #b71c1c;
        border-color: #b71c1c;
        box-shadow: 0 0 0 0 rgba(255, 82, 82, 0);
    }
    75% {
        background-color: #ff5252;
        border-color: #ff5252;
        box-shadow: 0 0 18px 4px rgba(255, 82, 82, 0.75);
    }
}
.dash-workers__attention-num {
    font-size: 34px;
    font-weight: 900;
    line-height: 1;
    font-variant-numeric: tabular-nums;
}
.dash-workers__attention-text {
    display: flex;
    flex-direction: column;
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.dash-workers__attention-hosts {
    font-size: 11px;
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
    opacity: 0.9;
}
.dash-workers__row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 12px;
    font-size: 12px;
}
.dash-workers__row-title {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.dash-workers__status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.dash-workers__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
}
.dash-workers__dot.square {
    border-radius: 2px;
}
.dash-workers__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    margin-top: 4px;
    font-variant-numeric: tabular-nums;
}
.dash-workers__table th {
    font-weight: 600;
    opacity: 0.7;
    padding: 2px 6px;
    text-align: right;
    border-bottom: 1px solid rgba(128, 128, 128, 0.3);
}
.dash-workers__table td {
    padding: 2px 6px;
    text-align: right;
}
.dash-workers__within td {
    border-top: 1px dashed rgba(128, 128, 128, 0.3);
    opacity: 0.85;
    font-style: italic;
}
.dash-workers__within + .dash-workers__within td {
    border-top: none;
}
.dash-workers__unknown td {
    opacity: 0.6;
}
</style>
