<template>
    <v-dialog :value="value" max-width="1100" scrollable @input="$emit('input', $event)">
        <v-card v-if="detail">
            <v-card-title class="d-flex align-center">
                <span class="mr-3">{{ detail.job.name }}</span>
                <v-chip small :color="statusColor(detail.job.status)" text-color="white" class="mr-2">
                    {{ statusLabel(detail.job.status) }}
                </v-chip>
                <v-chip small outlined :color="priorityColor(detail.job.priority)">{{ detail.job.priority }}</v-chip>
                <v-spacer />
                <v-btn small text @click="$emit('edit', detail)"><v-icon small left>{{ mdiPencil }}</v-icon> Edit</v-btn>
                <v-menu offset-y>
                    <template #activator="{ on }">
                        <v-btn small text v-on="on">Status <v-icon small right>{{ mdiChevronDown }}</v-icon></v-btn>
                    </template>
                    <v-list dense>
                        <v-list-item v-for="s in statusTransitions" :key="s.value" @click="setStatus(s.value)">
                            <v-list-item-title>{{ s.text }}</v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-menu>
                <v-btn icon @click="$emit('input', false)"><v-icon>{{ mdiClose }}</v-icon></v-btn>
            </v-card-title>

            <v-card-text>
                <v-alert v-if="error" type="error" dense dismissible class="mb-3" @input="error = ''">{{ error }}</v-alert>

                <v-row dense class="mb-2">
                    <v-col cols="6" md="3"><div class="text-caption text--secondary">Customer</div>{{ detail.job.customer_name || '—' }}</v-col>
                    <v-col cols="6" md="2"><div class="text-caption text--secondary">Type</div>{{ detail.job.job_type }}</v-col>
                    <v-col cols="6" md="2"><div class="text-caption text--secondary">Operator</div>{{ detail.job.operator_name || '—' }}</v-col>
                    <v-col cols="6" md="2"><div class="text-caption text--secondary">Due</div><span :class="dueClass(detail.job)">{{ formatDate(detail.job.due_date) }}</span></v-col>
                    <v-col cols="6" md="3"><div class="text-caption text--secondary">Created / Finished</div>{{ formatDateTime(detail.job.created_at) }} / {{ formatDateTime(detail.job.finished_at) }}</v-col>
                    <v-col v-if="detail.job.description" cols="12"><div class="text-caption text--secondary">Description</div>{{ detail.job.description }}</v-col>
                </v-row>

                <div class="text-subtitle-1 mb-1">Items</div>
                <v-card v-for="item in detail.items" :key="item.id" outlined class="mb-2 pa-2">
                    <div class="d-flex align-center flex-wrap">
                        <v-icon small class="mr-1">{{ mdiFile }}</v-icon>
                        <span class="font-weight-medium mr-3">{{ item.gcode_filename }}</span>
                        <v-chip x-small class="mr-1">{{ item.printer_model || 'any printer' }}</v-chip>
                        <v-chip x-small class="mr-1">{{ item.filament_type || 'any filament' }}</v-chip>
                        <v-chip v-if="item.filament_grams" x-small class="mr-1">{{ item.filament_grams }} g</v-chip>
                        <v-spacer />
                        <span class="text-caption">
                            {{ item.success_count }} / {{ item.quantity }} done
                            <span v-if="item.active_count"> · {{ item.active_count }} printing</span>
                            <span v-if="stats(item).totalFailed" class="error--text"> · {{ stats(item).totalFailed }} failed</span>
                            <span v-if="item.remaining"> · {{ item.remaining }} remaining</span>
                        </span>
                    </div>
                    <div class="run-bar mt-2" :title="barTitle(item)">
                        <div class="seg seg-passed" :style="{ width: stats(item).percentages.passed + '%' }" />
                        <div class="seg seg-success" :style="{ width: stats(item).percentages.success + '%' }" />
                        <div class="seg seg-active" :style="{ width: stats(item).percentages.active + '%' }" />
                        <div class="seg seg-remaining" :style="{ width: stats(item).percentages.remaining + '%' }" />
                    </div>
                </v-card>

                <div class="text-subtitle-1 mt-3 mb-1">Runs</div>
                <v-data-table
                    :headers="runHeaders"
                    :items="detail.runs"
                    dense
                    disable-pagination
                    hide-default-footer
                    sort-by="dispatched_at"
                    sort-desc>
                    <template #item.status="{ item }">
                        <v-chip x-small :color="runColor(item.status)" text-color="white">{{ item.status }}</v-chip>
                    </template>
                    <template #item.source="{ item }">
                        <v-chip x-small outlined :color="item.source === 'manual' ? 'orange' : 'grey'">
                            <v-icon v-if="item.source === 'manual'" x-small left>{{ mdiHandBackRight }}</v-icon>
                            {{ item.source }}
                        </v-chip>
                    </template>
                    <template #item.dispatched_at="{ item }">{{ formatDateTime(item.dispatched_at) }}</template>
                    <template #item.completed_at="{ item }">{{ formatDateTime(item.completed_at) }}</template>
                    <template #item.print_duration_secs="{ item }">{{ formatDuration(item.print_duration_secs) }}</template>
                    <template #item.qc_status="{ item }">
                        <v-chip v-if="item.qc_status" x-small :color="item.qc_status === 'pass' ? 'green' : 'red'" text-color="white">{{ item.qc_status }}</v-chip>
                        <span v-else class="text--secondary">—</span>
                    </template>
                    <template #item.actions="{ item }">
                        <v-btn v-if="isActive(item.status)" x-small outlined color="error" :loading="cancelling === item.id" @click="cancelRun(item)">Cancel</v-btn>
                    </template>
                </v-data-table>
            </v-card-text>
        </v-card>
        <v-card v-else>
            <v-card-text class="text-center pa-6"><v-progress-circular indeterminate /></v-card-text>
        </v-card>
    </v-dialog>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { Prop } from 'vue-property-decorator'
import { mdiChevronDown, mdiClose, mdiFile, mdiHandBackRight, mdiPencil } from '@mdi/js'
import { FleetJob, FleetJobDetail, FleetJobItem, FleetJobRun, ACTIVE_RUN_STATUSES } from '@/store/fleet/jobs/types'
import { computeRunStats } from '@/store/fleet/jobs/runStats'

@Component
export default class JobDetailsDialog extends Vue {
    mdiChevronDown = mdiChevronDown
    mdiClose = mdiClose
    mdiFile = mdiFile
    mdiHandBackRight = mdiHandBackRight
    mdiPencil = mdiPencil

    @Prop({ type: Boolean, default: false }) value!: boolean

    error = ''
    cancelling: number | null = null

    runHeaders = [
        { text: 'Printer', value: 'printer_hostname' },
        { text: 'File', value: 'gcode_filename' },
        { text: 'Status', value: 'status', width: 100 },
        { text: 'Source', value: 'source', width: 90 },
        { text: 'Dispatched', value: 'dispatched_at', width: 150 },
        { text: 'Completed', value: 'completed_at', width: 150 },
        { text: 'Duration', value: 'print_duration_secs', width: 90 },
        { text: 'QC', value: 'qc_status', width: 70 },
        { text: 'Error', value: 'error' },
        { text: '', value: 'actions', sortable: false, width: 90 },
    ]

    get detail(): FleetJobDetail | null {
        return this.$store.getters['fleet/jobs/getCurrentJob']
    }

    get statusTransitions() {
        const s = this.detail?.job.status
        const t: Array<{ text: string; value: string }> = []
        if (s === 'pending' || s === 'in_progress') t.push({ text: 'Put on hold', value: 'on_hold' })
        if (s === 'on_hold' || s === 'cancelled' || s === 'complete') t.push({ text: 'Reopen (pending)', value: 'pending' })
        if (s !== 'cancelled' && s !== 'complete') t.push({ text: 'Cancel job', value: 'cancelled' })
        if (s === 'in_progress' || s === 'pending') t.push({ text: 'Mark complete', value: 'complete' })
        return t
    }

    stats(item: FleetJobItem) {
        return computeRunStats(item)
    }

    barTitle(item: FleetJobItem) {
        const s = this.stats(item)
        return `${s.qcPassed} QC passed · ${s.successNoQc} done · ${s.active} printing · ${s.remaining} remaining · ${s.totalFailed} failed`
    }

    isActive(status: string) {
        return (ACTIVE_RUN_STATUSES as string[]).includes(status)
    }

    statusColor(s: string) {
        return { pending: 'grey', in_progress: 'blue', on_hold: 'orange', complete: 'green', cancelled: 'red' }[s] ?? 'grey'
    }

    statusLabel(s: string) {
        return s.replace('_', ' ')
    }

    priorityColor(p: string) {
        return { high: 'red', medium: 'orange', low: 'grey' }[p] ?? 'grey'
    }

    runColor(s: string) {
        return {
            queued: 'grey',
            uploading: 'blue-grey',
            starting: 'blue-grey',
            printing: 'blue',
            success: 'green',
            failed: 'red',
            cancelled: 'orange',
        }[s] ?? 'grey'
    }

    dueClass(job: FleetJob) {
        if (!job.due_date || job.status === 'complete' || job.status === 'cancelled') return ''
        return new Date(job.due_date).getTime() < Date.now() ? 'error--text font-weight-bold' : ''
    }

    formatDate(iso: string | null) {
        return iso ? new Date(iso).toLocaleDateString() : '—'
    }

    formatDateTime(iso: string | null) {
        return iso ? new Date(iso).toLocaleString() : '—'
    }

    formatDuration(secs: number | null) {
        if (secs == null) return '—'
        const h = Math.floor(secs / 3600)
        const m = Math.floor((secs % 3600) / 60)
        return h ? `${h}h ${m}m` : `${m}m`
    }

    async setStatus(status: string) {
        if (!this.detail) return
        this.error = ''
        try {
            await this.$store.dispatch('fleet/jobs/setJobStatus', { id: this.detail.job.id, status })
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        }
    }

    async cancelRun(run: FleetJobRun) {
        if (!this.detail) return
        if (run.status === 'printing' && !confirm(`Abort the print on ${run.printer_hostname}?`)) return
        this.cancelling = run.id
        this.error = ''
        try {
            await this.$store.dispatch('fleet/jobs/cancelRun', { runId: run.id, cancel_print: true })
            await this.$store.dispatch('fleet/jobs/loadJob', this.detail.job.id)
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        } finally {
            this.cancelling = null
        }
    }
}
</script>

<style scoped>
.run-bar {
    display: flex;
    height: 10px;
    border-radius: 5px;
    overflow: hidden;
    background: rgba(128, 128, 128, 0.25);
}
.seg {
    height: 100%;
    transition: width 0.4s;
}
.seg-passed {
    background: #43a047;
}
.seg-success {
    background: #1e88e5;
}
.seg-active {
    background: #64b5f6;
    animation: breathe 1.6s ease-in-out infinite;
}
.seg-remaining {
    background: transparent;
}
@keyframes breathe {
    0%,
    100% {
        opacity: 1;
    }
    50% {
        opacity: 0.45;
    }
}
</style>
