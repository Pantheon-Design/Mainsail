<template>
    <div class="printer-tooltip">
        <template v-if="printer">
            <p>{{ printer.socket.hostname }}: {{ printer.print_stats?.state || 'Unknown' }}</p>
            <p v-if="showWorker">
                Fleet worker: {{ isWorker ? 'yes' : 'no' }}
                <span v-if="toggleHint">(click to toggle)</span>
            </p>
            <p v-if="showWorker && needsAttention" class="attention-reason">
                <strong>Needs attention:</strong>
                {{ attentionReason || 'see the Workers list' }}
            </p>
            <p>IsConnected: {{ printer.socket.isConnected }}</p>
            <p>Filament: {{ printer.toolhead?.filament_type || 'N/A' }}</p>
            <p>Nozzle: {{ printer.toolhead?.nozzle_size || 'N/A' }}</p>
            <p>Remaining: {{ remainingG !== null ? Math.round(remainingG) + 'g' : 'N/A' }}</p>
            <p>CurrentFile: {{ printer.current_file?.filename || 'None' }}</p>
            <p>Progress: {{ printPercent }}%</p>
            <p v-if="printer.webhooks?.state_message" class="webhook-message">
                <strong>Webhook:</strong>
                <br />
                {{ printer.webhooks.state_message }}
            </p>
        </template>
        <p v-else>{{ hostname }}: {{ offlineText }}</p>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import { computeRemainingFilamentG, getPrinterPrintPercent } from '@/components/panels/farmPrinterStatus'

/**
 * Hover card with a printer's live fleet_daemon state. Shared by the Fleet Map markers and
 * the Fleet Timeline lane headers so both show the same details.
 */
@Component
export default class FarmPrinterTooltip extends Vue {
    /** fleet_daemon frame (`farm.fleetDaemonPrinters[hostname]`), or null when the printer is not reporting. */
    @Prop({ type: Object, default: null }) readonly printer!: any | null
    /** Shown with `offlineText` when there is no frame. */
    @Prop({ type: String, default: '' }) readonly hostname!: string
    @Prop({ type: String, default: 'no live data' }) readonly offlineText!: string
    /** Show the "Fleet worker" / "Needs attention" lines. */
    @Prop({ type: Boolean, default: false }) readonly showWorker!: boolean
    @Prop({ type: Boolean, default: false }) readonly isWorker!: boolean
    @Prop({ type: Boolean, default: false }) readonly needsAttention!: boolean
    @Prop({ type: String, default: null }) readonly attentionReason!: string | null
    /** Append "(click to toggle)" to the worker line (Workers map). */
    @Prop({ type: Boolean, default: false }) readonly toggleHint!: boolean

    get remainingG(): number | null {
        return this.printer ? computeRemainingFilamentG(this.printer) : null
    }

    get printPercent(): number {
        return getPrinterPrintPercent(this.printer)
    }
}
</script>

<style scoped>
.printer-tooltip {
    background-color: rgba(0, 0, 0, 0.78);
    color: #fff;
    padding: 6px 10px;
    border-radius: 4px;
    white-space: nowrap;
    z-index: 10;
    font-size: 12px;
    line-height: 1.45;
    pointer-events: none;
}
.printer-tooltip p {
    margin: 0;
}
.printer-tooltip .attention-reason {
    color: #ff8a80;
    white-space: normal;
    max-width: 300px;
}
.printer-tooltip .webhook-message {
    white-space: pre-wrap;
    max-width: 300px;
}
</style>
