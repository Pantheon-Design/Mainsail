<template>
    <div>
        <!-- Title + TOTAL fleet status -->
        <div class="fleet-header mb-4">
            <div class="fleet-title-row">
                <h2 class="fleet-title">Fleet Map</h2>
                <span class="fleet-total">{{ totalPrinterCount }} total</span>
                <div class="status-counters">
                    <span v-for="s in totalStatusList" :key="'total-' + s.key" class="status-counter">
                        <span class="status-dot" :class="{ square: s.key === 'error' || s.key === 'printing' }"
                              :style="{ backgroundColor: s.color }"></span>
                        {{ s.label }} {{ s.count }}
                    </span>
                </div>
            </div>
        </div>

        <!-- Print Farm map -->
        <farm-map-section location="farm" name="Print Farm" class="mb-8" />

        <!-- Ground Floor map -->
        <farm-map-section location="ground" name="Ground Floor" />
    </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import FarmMapSection from '@/components/panels/FarmMapSection.vue'
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
        return this.$store.state.farm.fleetDaemonPrinters || {}
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
