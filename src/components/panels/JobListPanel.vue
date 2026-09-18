<template>
    <v-card flat>
        <v-card-title class="d-flex align-center flex-wrap">
            <span>Jobs</span>
            <v-spacer />
            <v-text-field
                v-model="search"
                :append-icon="mdiMagnify"
                label="Search"
                single-line
                dense
                outlined
                hide-details
                clearable
                class="mr-3"
                style="max-width: 220px" />
            <v-switch v-model="includeClosed" label="Show closed" dense hide-details class="mr-3 mt-0" @change="reload" />
            <v-btn small color="primary" outlined @click="openCreate">
                <v-icon small left>{{ mdiPlus }}</v-icon> New job
            </v-btn>
        </v-card-title>

        <v-data-table
            :headers="headers"
            :items="jobs"
            :loading="loading"
            :search="search"
            dense
            class="job-table file-list-cursor"
            @click:row="openDetails($event.id)">
            <template #item.customer_name="{ item }">{{ item.customer_name || '—' }}</template>
            <template #item.priority="{ item }">
                <v-chip x-small outlined :color="priorityColor(item.priority)">{{ item.priority }}</v-chip>
            </template>
            <template #item.status="{ item }">
                <v-chip x-small :color="statusColor(item.status)" text-color="white">{{ item.status.replace('_', ' ') }}</v-chip>
            </template>
            <template #item.due_date="{ item }">
                <span :class="dueClass(item)">{{ formatDate(item.due_date) }}</span>
            </template>
            <template #item.progress="{ item }">
                <div class="d-flex align-center">
                    <v-progress-linear
                        :value="item.qty_total ? (100 * item.qty_done) / item.qty_total : 0"
                        :buffer-value="item.qty_total ? (100 * (item.qty_done + item.qty_active)) / item.qty_total : 0"
                        height="8"
                        rounded
                        color="green"
                        class="mr-2"
                        style="min-width: 80px" />
                    <span class="text-caption text-no-wrap">
                        {{ item.qty_done }}/{{ item.qty_total }}
                        <span v-if="item.qty_active" class="blue--text">(+{{ item.qty_active }})</span>
                        <span v-if="item.qty_failed" class="error--text">✕{{ item.qty_failed }}</span>
                        <v-tooltip v-if="item.qty_qc_failed" bottom>
                            <template #activator="{ on }">
                                <span class="error--text font-weight-medium" v-on="on">
                                    <v-icon x-small color="error">{{ mdiAlertCircle }}</v-icon>
                                    QC {{ item.qty_qc_failed }} ({{ qcRate(item) }}%)
                                </span>
                            </template>
                            <span>
                                {{ item.qty_qc_failed }} of {{ item.qty_qc_passed + item.qty_qc_failed }} QC-checked runs failed.
                                They still count as complete; check the parts in Fleet History.
                            </span>
                        </v-tooltip>
                    </span>
                </div>
            </template>
            <template #item.actions="{ item }">
                <v-menu offset-y>
                    <template #activator="{ on }">
                        <v-btn x-small icon v-on="on" @click.stop>
                            <v-icon small>{{ mdiDotsVertical }}</v-icon>
                        </v-btn>
                    </template>
                    <v-list dense>
                        <v-list-item @click="openDetails(item.id)"><v-list-item-title>Details</v-list-item-title></v-list-item>
                        <v-list-item @click="openEdit(item.id)"><v-list-item-title>Edit</v-list-item-title></v-list-item>
                        <v-list-item v-if="item.status === 'pending' || item.status === 'in_progress'" @click="setStatus(item, 'on_hold')">
                            <v-list-item-title>Hold</v-list-item-title>
                        </v-list-item>
                        <v-list-item v-if="item.status === 'on_hold' || item.status === 'cancelled' || item.status === 'complete'" @click="setStatus(item, 'pending')">
                            <v-list-item-title>Resume / reopen</v-list-item-title>
                        </v-list-item>
                        <v-list-item v-if="item.status !== 'cancelled' && item.status !== 'complete'" @click="setStatus(item, 'cancelled')">
                            <v-list-item-title>Cancel job</v-list-item-title>
                        </v-list-item>
                        <v-list-item @click="confirmDelete(item)"><v-list-item-title class="error--text">Delete</v-list-item-title></v-list-item>
                    </v-list>
                </v-menu>
            </template>
        </v-data-table>

        <job-form-dialog v-model="formDialog" :job="editingJob" @saved="onSaved" />
        <job-details-dialog v-model="detailsDialog" @edit="openEditFromDetails" />

        <v-dialog v-model="deleteDialog" max-width="420">
            <v-card>
                <v-card-title>Delete job</v-card-title>
                <v-card-text>Delete <strong>{{ deleteTarget?.name }}</strong> and all its items and runs? History records are kept.</v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="deleteDialog = false">Cancel</v-btn>
                    <v-btn color="error" :loading="saving" @click="doDelete">Delete</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="4000" bottom>{{ snackbarText }}</v-snackbar>
    </v-card>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { mdiAlertCircle, mdiDotsVertical, mdiMagnify, mdiPlus } from '@mdi/js'
import JobFormDialog from '@/components/dialogs/JobFormDialog.vue'
import JobDetailsDialog from '@/components/dialogs/JobDetailsDialog.vue'
import { FleetJob, FleetJobDetail } from '@/store/fleet/jobs/types'

@Component({ components: { JobFormDialog, JobDetailsDialog } })
export default class JobListPanel extends Vue {
    mdiAlertCircle = mdiAlertCircle
    mdiDotsVertical = mdiDotsVertical
    mdiMagnify = mdiMagnify
    mdiPlus = mdiPlus

    search = ''
    includeClosed = false
    formDialog = false
    detailsDialog = false
    deleteDialog = false
    saving = false
    editingJob: FleetJobDetail | null = null
    deleteTarget: FleetJob | null = null

    snackbar = false
    snackbarText = ''
    snackbarColor = 'success'

    headers = [
        { text: 'Job', value: 'name' },
        { text: 'Customer', value: 'customer_name' },
        { text: 'Priority', value: 'priority', width: 90 },
        { text: 'Status', value: 'status', width: 110 },
        { text: 'Due', value: 'due_date', width: 110 },
        { text: 'Progress', value: 'progress', sortable: false, width: 200 },
        { text: '', value: 'actions', sortable: false, width: 50 },
    ]

    get jobs(): FleetJob[] {
        return this.$store.getters['fleet/jobs/getJobs']
    }

    get loading(): boolean {
        return this.$store.getters['fleet/jobs/isLoading']
    }

    reload() {
        this.$store.dispatch('fleet/jobs/loadJobs', { includeClosed: this.includeClosed }).catch((e: Error) => {
            this.toast(e.message, 'error')
        })
    }

    openCreate() {
        this.editingJob = null
        this.formDialog = true
    }

    async openDetails(id: number) {
        this.detailsDialog = true
        try {
            await this.$store.dispatch('fleet/jobs/loadJob', id)
        } catch (e: any) {
            this.detailsDialog = false
            this.toast(e?.message ?? String(e), 'error')
        }
    }

    async openEdit(id: number) {
        try {
            this.editingJob = await this.$store.dispatch('fleet/jobs/loadJob', id)
            this.formDialog = true
        } catch (e: any) {
            this.toast(e?.message ?? String(e), 'error')
        }
    }

    openEditFromDetails(detail: FleetJobDetail) {
        this.editingJob = detail
        this.formDialog = true
    }

    async onSaved(id: number) {
        this.toast(this.editingJob ? 'Job saved' : 'Job created', 'success')
        this.reload()
        if (this.detailsDialog) await this.$store.dispatch('fleet/jobs/loadJob', id).catch(() => {})
    }

    async setStatus(job: FleetJob, status: string) {
        try {
            await this.$store.dispatch('fleet/jobs/setJobStatus', { id: job.id, status })
            this.reload()
        } catch (e: any) {
            this.toast(e?.message ?? String(e), 'error')
        }
    }

    confirmDelete(job: FleetJob) {
        this.deleteTarget = job
        this.deleteDialog = true
    }

    async doDelete() {
        if (!this.deleteTarget) return
        this.saving = true
        try {
            await this.$store.dispatch('fleet/jobs/deleteJob', this.deleteTarget.id)
            this.toast('Job deleted', 'success')
            this.deleteDialog = false
        } catch (e: any) {
            this.toast(e?.message ?? String(e), 'error')
        } finally {
            this.saving = false
        }
    }

    /** QC fail rate over QC-checked completed runs, in percent. */
    qcRate(job: FleetJob): number {
        const checked = (job.qty_qc_passed || 0) + (job.qty_qc_failed || 0)
        return checked ? Math.round((100 * (job.qty_qc_failed || 0)) / checked) : 0
    }

    priorityColor(p: string) {
        return { high: 'red', medium: 'orange', low: 'grey' }[p] ?? 'grey'
    }

    statusColor(s: string) {
        return { pending: 'grey', in_progress: 'blue', on_hold: 'orange', complete: 'green', cancelled: 'red' }[s] ?? 'grey'
    }

    dueClass(job: FleetJob) {
        if (!job.due_date || job.status === 'complete' || job.status === 'cancelled') return ''
        const ms = new Date(job.due_date).getTime() - Date.now()
        if (ms < 0) return 'error--text font-weight-bold'
        if (ms < 86400000) return 'orange--text font-weight-bold'
        return ''
    }

    formatDate(iso: string | null) {
        return iso ? new Date(iso).toLocaleDateString() : '—'
    }

    toast(text: string, color: string) {
        this.snackbarText = text
        this.snackbarColor = color
        this.snackbar = true
    }
}
</script>

<style scoped>
.file-list-cursor >>> tbody tr {
    cursor: pointer;
}
</style>
