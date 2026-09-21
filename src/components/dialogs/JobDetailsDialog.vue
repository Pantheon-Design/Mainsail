<template>
    <v-dialog :value="value" max-width="1100" scrollable @input="$emit('input', $event)">
        <v-card v-if="detail">
            <v-card-title class="d-flex align-center">
                <span class="mr-3">{{ detail.job.name }}</span>
                <v-chip small :color="detail.job.hold_reason ? 'error' : statusColor(detail.job.status)" text-color="white" class="mr-2">
                    <v-icon v-if="detail.job.hold_reason" x-small left>{{ mdiAlertCircle }}</v-icon>
                    {{ detail.job.hold_reason ? 'paused' : statusLabel(detail.job.status) }}
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

                <!-- Scheduler-initiated hold: nothing is dispatched until an operator resumes. -->
                <v-alert v-if="detail.job.hold_reason" type="error" text class="mb-3">
                    <div class="font-weight-medium mb-1">
                        Paused by the scheduler{{ detail.job.auto_held_at ? ' on ' + formatDateTime(detail.job.auto_held_at) : '' }}
                    </div>
                    <div class="mb-2">{{ detail.job.hold_reason }}</div>
                    <div class="text-caption mb-2">
                        No new runs are sent for this job. Fix the gcode file / fleet storage or the printer
                        (or disable that worker on the Workers tab), then resume. Runs that failed before the
                        hold are listed below.
                    </div>
                    <v-btn small outlined color="error" :loading="resuming" @click="resume">
                        <v-icon small left>{{ mdiPlay }}</v-icon> Resume job
                    </v-btn>
                </v-alert>

                <v-row dense class="mb-2">
                    <v-col cols="6" md="3"><div class="text-caption text--secondary">Customer</div>{{ detail.job.customer_name || '—' }}</v-col>
                    <v-col cols="6" md="2"><div class="text-caption text--secondary">Type</div>{{ detail.job.job_type }}</v-col>
                    <v-col cols="6" md="2"><div class="text-caption text--secondary">Operator</div>{{ detail.job.operator_name || '—' }}</v-col>
                    <v-col cols="6" md="2"><div class="text-caption text--secondary">Due</div><span :class="dueClass(detail.job)">{{ formatDate(detail.job.due_date) }}</span></v-col>
                    <v-col cols="6" md="3"><div class="text-caption text--secondary">Created / Finished</div>{{ formatDateTime(detail.job.created_at) }} / {{ formatDateTime(detail.job.finished_at) }}</v-col>
                    <v-col cols="12">
                        <div class="text-caption text--secondary">Each copy consists of</div>
                        <span v-if="detail.items.length === 0" class="text--secondary">no items yet</span>
                        <template v-else>
                            <v-chip v-for="item in detail.items" :key="'copy-' + item.id" x-small class="mr-1 mb-1" :title="item.gcode_filename">
                                {{ baseName(item.gcode_filename) }} ×{{ item.quantity }}
                            </v-chip>
                            <span class="text-caption ml-1">
                                = {{ runsPerCopy }} run{{ runsPerCopy === 1 ? '' : 's' }} per copy · {{ detail.job.quantity }}
                                {{ detail.job.quantity === 1 ? 'copy' : 'copies' }} · {{ totalRuns }} runs total
                            </span>
                        </template>
                    </v-col>
                    <v-col v-if="detail.job.description" cols="12"><div class="text-caption text--secondary">Description</div>{{ detail.job.description }}</v-col>
                </v-row>

                <div class="text-subtitle-1 mb-1">Items</div>
                <v-card v-for="item in detail.items" :key="item.id" outlined class="mb-2 pa-2">
                    <div class="d-flex align-center flex-wrap">
                        <v-icon small class="mr-1">{{ mdiFile }}</v-icon>
                        <span class="font-weight-medium mr-3">{{ item.gcode_filename }}</span>
                        <v-chip x-small class="mr-1">{{ item.printer_model || 'any printer' }}</v-chip>
                        <v-chip x-small class="mr-1">{{ item.filament_type || 'any filament' }}</v-chip>
                        <v-chip x-small class="mr-1">{{ item.nozzle_diameter ? item.nozzle_diameter + ' mm nozzle' : 'any nozzle' }}</v-chip>
                        <v-chip v-if="item.filament_grams" x-small class="mr-1">{{ item.filament_grams }} g</v-chip>
                        <v-spacer />
                        <span class="text-caption">
                            {{ item.success_count }} / {{ item.total_runs }} done
                            <span v-if="item.active_count"> · {{ item.active_count }} printing</span>
                            <span v-if="stats(item).totalFailed" class="error--text"> · {{ stats(item).totalFailed }} failed</span>
                            <span v-if="stats(item).qcFailed" class="error--text font-weight-medium">
                                · <v-icon x-small color="error">{{ mdiAlertCircle }}</v-icon>
                                {{ stats(item).qcFailed }} QC fail ({{ qcRatePct(item) }}% of {{ stats(item).qcPassed + stats(item).qcFailed }} checked)
                            </span>
                            <span v-if="item.remaining"> · {{ item.remaining }} remaining</span>
                        </span>
                    </div>
                    <div class="run-bar mt-2" :title="barTitle(item)">
                        <div class="seg seg-passed" :style="{ width: stats(item).percentages.passed + '%' }" />
                        <div class="seg seg-success" :style="{ width: stats(item).percentages.success + '%' }" />
                        <div class="seg seg-qcfail" :style="{ width: stats(item).percentages.qcFailed + '%' }" />
                        <div class="seg seg-active" :style="{ width: stats(item).percentages.active + '%' }" />
                        <div class="seg seg-remaining" :style="{ width: stats(item).percentages.remaining + '%' }" />
                    </div>
                </v-card>

                <div class="text-subtitle-1 mt-3 mb-1">
                    Runs
                    <span class="text-caption text--secondary ml-2">click a run for its Fleet History record</span>
                </div>
                <v-data-table
                    :headers="runHeaders"
                    :items="detail.runs"
                    dense
                    disable-pagination
                    hide-default-footer
                    sort-by="dispatched_at"
                    sort-desc
                    class="run-table"
                    @click:row="openRun">
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
                    <template #item.error="{ item }">
                        <span v-if="item.error" class="error--text font-weight-medium">
                            <v-icon x-small color="error">{{ mdiAlertCircle }}</v-icon> {{ item.error }}
                        </span>
                        <span v-else-if="item.status === 'success' && !item.history_id" class="orange--text">no history record</span>
                        <span v-else class="text--secondary">—</span>
                    </template>
                </v-data-table>

                <!-- Run -> Fleet History record (same view as Fleet History > Jobs) -->
                <fleet-history-record-dialog v-model="recordDialog" :record="recordForRun" title="Run · Fleet History record">
                    <template #top>
                        <v-alert v-if="selectedRun" dense text :type="selectedRun.status === 'success' ? 'success' : selectedRun.status === 'failed' ? 'error' : 'info'" class="mb-3">
                            Run #{{ selectedRun.id }} · {{ selectedRun.status }} · {{ selectedRun.source }} ·
                            dispatched {{ formatDateTime(selectedRun.dispatched_at) }}
                            <span v-if="selectedRun.error"> · {{ selectedRun.error }}</span>
                            <span v-if="selectedRun.notes"> · {{ selectedRun.notes }}</span>
                        </v-alert>
                    </template>
                </fleet-history-record-dialog>

                <!-- Run without a matching record -->
                <v-dialog v-model="noRecordDialog" max-width="520">
                    <v-card v-if="selectedRun">
                        <v-card-title class="d-flex align-center">
                            <v-icon color="error" class="mr-2">{{ mdiAlertCircle }}</v-icon>
                            No record matches this run
                            <v-spacer />
                            <v-btn icon small @click="noRecordDialog = false"><v-icon small>{{ mdiClose }}</v-icon></v-btn>
                        </v-card-title>
                        <v-divider />
                        <v-card-text class="pt-3">
                            <p>
                                No Fleet History record was found for this run on <strong>{{ selectedRun.printer_hostname }}</strong>.
                                The printer never reported a print for it, so nothing was made.
                            </p>
                            <v-simple-table dense>
                                <tbody>
                                    <tr><td class="font-weight-bold" width="140">Status</td><td>
                                        <v-chip x-small :color="runColor(selectedRun.status)" text-color="white">{{ selectedRun.status }}</v-chip>
                                        <v-chip x-small outlined class="ml-1">{{ selectedRun.source }}</v-chip>
                                    </td></tr>
                                    <tr><td class="font-weight-bold">Reason</td><td class="error--text font-weight-medium">{{ selectedRun.error || 'no reason recorded' }}</td></tr>
                                    <tr><td class="font-weight-bold">File</td><td>{{ selectedRun.printer_filename }}</td></tr>
                                    <tr><td class="font-weight-bold">Dispatched</td><td>{{ formatDateTime(selectedRun.dispatched_at) }}</td></tr>
                                    <tr><td class="font-weight-bold">Started</td><td>{{ formatDateTime(selectedRun.started_at) }}</td></tr>
                                    <tr><td class="font-weight-bold">Closed</td><td>{{ formatDateTime(selectedRun.completed_at) }}</td></tr>
                                    <tr><td class="font-weight-bold">Moonraker job</td><td>{{ selectedRun.moonraker_job_id || '— (none)' }}</td></tr>
                                    <tr v-if="selectedRun.notes"><td class="font-weight-bold">Notes</td><td>{{ selectedRun.notes }}</td></tr>
                                </tbody>
                            </v-simple-table>
                            <p v-if="recordLookupError" class="caption error--text mt-2">Lookup failed: {{ recordLookupError }}</p>
                        </v-card-text>
                    </v-card>
                </v-dialog>
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
import { mdiAlertCircle, mdiChevronDown, mdiClose, mdiFile, mdiHandBackRight, mdiPencil, mdiPlay } from '@mdi/js'
import { FleetJob, FleetJobDetail, FleetJobItem, FleetJobRun } from '@/store/fleet/jobs/types'
import { computeRunStats } from '@/store/fleet/jobs/runStats'
import { FleetHistoryRecord } from '@/store/fleet/history/types'
import FleetHistoryRecordDialog from '@/components/dialogs/FleetHistoryRecordDialog.vue'

@Component({ components: { FleetHistoryRecordDialog } })
export default class JobDetailsDialog extends Vue {
    mdiAlertCircle = mdiAlertCircle
    mdiChevronDown = mdiChevronDown
    mdiClose = mdiClose
    mdiFile = mdiFile
    mdiHandBackRight = mdiHandBackRight
    mdiPencil = mdiPencil
    mdiPlay = mdiPlay

    @Prop({ type: Boolean, default: false }) value!: boolean

    error = ''
    resuming = false

    // Run -> record lookup
    selectedRun: FleetJobRun | null = null
    recordForRun: FleetHistoryRecord | null = null
    recordDialog = false
    noRecordDialog = false
    recordLookupError = ''

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
    ]

    get detail(): FleetJobDetail | null {
        return this.$store.getters['fleet/jobs/getCurrentJob']
    }

    get statusTransitions() {
        const s = this.detail?.job.status
        const t: Array<{ text: string; value: string }> = []
        if (s === 'pending' || s === 'in_progress') t.push({ text: 'Put on hold', value: 'on_hold' })
        if (s === 'on_hold') t.push({ text: 'Resume', value: 'pending' })
        if (s === 'cancelled' || s === 'complete') t.push({ text: 'Reopen (pending)', value: 'pending' })
        if (s !== 'cancelled' && s !== 'complete') t.push({ text: 'Cancel job', value: 'cancelled' })
        if (s === 'in_progress' || s === 'pending') t.push({ text: 'Mark complete', value: 'complete' })
        return t
    }

    get runsPerCopy(): number {
        return (this.detail?.items ?? []).reduce((n, i) => n + (Number(i.quantity) || 0), 0)
    }

    get totalRuns(): number {
        return this.runsPerCopy * (this.detail?.job.quantity ?? 1)
    }

    baseName(path: string): string {
        return path.split('/').pop() ?? path
    }

    stats(item: FleetJobItem) {
        // Progress is over the total runs (runs per copy × copies).
        return computeRunStats({ ...item, quantity: item.total_runs ?? item.quantity })
    }

    barTitle(item: FleetJobItem) {
        const s = this.stats(item)
        return `${s.qcPassed} QC passed · ${s.successNoQc} done (unchecked) · ${s.qcFailed} QC failed · ${s.active} printing · ${s.remaining} remaining · ${s.totalFailed} failed`
    }

    qcRatePct(item: FleetJobItem): number {
        const r = this.stats(item).qcFailRate
        return r == null ? 0 : Math.round(r * 100)
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

    /** Row click: show the matching Fleet History record, or say that none exists. */
    async openRun(run: FleetJobRun) {
        this.selectedRun = run
        this.recordForRun = null
        this.recordLookupError = ''
        if (!run.moonraker_job_id) {
            this.noRecordDialog = true
            return
        }
        try {
            const rec: FleetHistoryRecord | null = await this.$store.dispatch('fleet/history/fetchRecord', {
                printer_hostname: run.printer_hostname,
                moonraker_job_id: run.moonraker_job_id,
            })
            if (rec) {
                this.recordForRun = rec
                this.recordDialog = true
            } else {
                this.noRecordDialog = true
            }
        } catch (e: any) {
            this.recordLookupError = e?.message ?? String(e)
            this.noRecordDialog = true
        }
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

    /** Clears the scheduler hold (hold_reason) and lets dispatch pick the job up again. */
    async resume() {
        this.resuming = true
        try {
            await this.setStatus('pending')
        } finally {
            this.resuming = false
        }
    }
}
</script>

<style scoped>
.run-table >>> tbody tr {
    cursor: pointer;
}
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
.seg-qcfail {
    background: repeating-linear-gradient(45deg, #e53935 0 4px, #b71c1c 4px 8px);
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
