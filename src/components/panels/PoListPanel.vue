<template>
    <v-card flat>
        <v-card-title class="d-flex align-center flex-wrap">
            <span>Purchase Orders</span>
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
            <v-btn small outlined color="primary" class="mr-2" @click="manualDialog = true">
                <v-icon small left>{{ mdiPlus }}</v-icon>
                New PO (manual)
            </v-btn>
            <v-btn small color="primary" @click="uploadDialog = true">
                <v-icon small left>{{ mdiUpload }}</v-icon>
                Upload PO (PDF)
            </v-btn>
        </v-card-title>

        <v-data-table
            :headers="headers"
            :items="rows"
            :loading="loading"
            :search="search"
            dense
            class="po-table"
            @click:row="openDetails($event.id)">
            <template #item.po_number="{ item }">
                <span class="font-weight-medium">{{ item.po_number || '(no number)' }}</span>
            </template>
            <template #item.customer_name="{ item }">
                {{ item.customer_name || item.buyer_name || '—' }}
                <div v-if="item.customer_name && item.buyer_name && item.buyer_name !== item.customer_name" class="text-caption text--secondary">
                    {{ item.buyer_name }}
                </div>
            </template>
            <template #item.status="{ item }">
                <v-chip x-small :color="statusColor(item.status)" text-color="white">{{ item.status }}</v-chip>
                <v-chip v-if="item.fulfilled" x-small color="green" outlined class="ml-1">fulfilled</v-chip>
            </template>
            <template #item.due_date="{ item }">
                <span :class="dueClass(item)">{{ formatDate(item.due_date) }}</span>
            </template>
            <template #item.progress="{ item }">
                <div class="d-flex align-center">
                    <v-progress-linear
                        :value="100 * (item.progress || 0)"
                        height="8"
                        rounded
                        :color="item.fulfilled ? 'green' : 'light-green'"
                        class="mr-2"
                        style="min-width: 80px" />
                    <span class="text-caption text-no-wrap">
                        {{ item.units_complete }}/{{ item.units_required }} units
                        <span class="text--secondary">· {{ item.parts_good }}/{{ item.parts_required }} parts</span>
                    </span>
                </div>
            </template>
            <template #item.active_jobs="{ item }">
                <span v-if="item.jobs_count">{{ item.active_jobs }} / {{ item.jobs_count }}</span>
                <span v-else class="text--secondary">—</span>
            </template>
            <template #item.warnings="{ item }">
                <v-tooltip v-if="item.warnings > 0" bottom>
                    <template #activator="{ on }">
                        <v-chip x-small :color="warnColor" text-color="white" v-on="on">
                            <v-icon x-small left>{{ mdiAlertOutline }}</v-icon>
                            {{ item.warnings }}
                        </v-chip>
                    </template>
                    <span>{{ item.warnings }} unlinked part / item / gcode warning(s)</span>
                </v-tooltip>
            </template>
        </v-data-table>

        <po-upload-dialog v-model="uploadDialog" @created="onUploaded" />
        <po-edit-dialog
            v-model="editDialog"
            :po-id="editPoId"
            :initial="editInitial"
            @create-job="openCreateJob"
            @link-job="openLinkJob"
            @deleted="onDeleted" />
        <po-details-dialog
            v-model="detailsDialog"
            @edit="openEdit($event.po.id)"
            @create-job="openCreateJob"
            @link-job="openLinkJob"
            @deleted="onDeleted" />
        <job-form-dialog v-model="jobFormDialog" :po="jobFormPo" @saved="onJobCreated" />
        <po-job-link-dialog v-model="linkDialog" :po="linkPo" @saved="onJobLinked" />

        <!-- Manual PO: number first, everything else in the edit dialog -->
        <v-dialog v-model="manualDialog" max-width="420">
            <v-card>
                <v-card-title>New purchase order</v-card-title>
                <v-card-text>
                    <v-alert v-if="manualError" type="error" dense class="mb-3">{{ manualError }}</v-alert>
                    <v-text-field
                        v-model="manualNumber"
                        label="PO number"
                        dense
                        outlined
                        autofocus
                        hint="you can fill in everything else on the next screen"
                        persistent-hint
                        @keyup.enter="createManual" />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="manualDialog = false">Cancel</v-btn>
                    <v-btn color="primary" :loading="manualSaving" @click="createManual">Create draft</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="4000" bottom>{{ snackbarText }}</v-snackbar>
    </v-card>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { Watch } from 'vue-property-decorator'
import { mdiAlertOutline, mdiMagnify, mdiPlus, mdiUpload } from '@mdi/js'
import PoUploadDialog from '@/components/dialogs/PoUploadDialog.vue'
import PoEditDialog from '@/components/dialogs/PoEditDialog.vue'
import PoDetailsDialog from '@/components/dialogs/PoDetailsDialog.vue'
import PoJobLinkDialog from '@/components/dialogs/PoJobLinkDialog.vue'
import JobFormDialog from '@/components/dialogs/JobFormDialog.vue'
import { FleetPoDetail, FleetPoListRow } from '@/store/fleet/purchaseOrders/types'
import { PO_WARN_COLOR, poStatusColor } from '@/components/po/poFormat'

@Component({ components: { PoUploadDialog, PoEditDialog, PoDetailsDialog, PoJobLinkDialog, JobFormDialog } })
export default class PoListPanel extends Vue {
    mdiAlertOutline = mdiAlertOutline
    mdiMagnify = mdiMagnify
    mdiPlus = mdiPlus
    mdiUpload = mdiUpload
    warnColor = PO_WARN_COLOR
    statusColor = poStatusColor

    search = ''
    includeClosed = false

    uploadDialog = false
    editDialog = false
    editPoId = 0
    editInitial: FleetPoDetail | null = null
    detailsDialog = false
    jobFormDialog = false
    jobFormPo: FleetPoDetail | null = null
    linkDialog = false
    linkPo: FleetPoDetail | null = null

    manualDialog = false
    manualNumber = ''
    manualSaving = false
    manualError = ''

    snackbar = false
    snackbarText = ''
    snackbarColor = 'success'

    headers = [
        { text: 'PO #', value: 'po_number' },
        { text: 'Customer', value: 'customer_name' },
        { text: 'Status', value: 'status', width: 150 },
        { text: 'Due', value: 'due_date', width: 110 },
        { text: 'Items', value: 'items_count', width: 70 },
        { text: 'Progress', value: 'progress', width: 300 },
        { text: 'Active jobs', value: 'active_jobs', width: 100 },
        { text: '', value: 'warnings', sortable: false, width: 60 },
    ]

    get rows(): FleetPoListRow[] {
        return this.$store.getters['fleet/purchaseOrders/getList']
    }

    get loading(): boolean {
        return this.$store.getters['fleet/purchaseOrders/isLoading']
    }

    @Watch('manualDialog')
    onManualOpen(open: boolean) {
        if (!open) return
        this.manualNumber = ''
        this.manualError = ''
    }

    @Watch('detailsDialog')
    onDetailsClosed(open: boolean) {
        if (!open && !this.editDialog) this.$store.commit('fleet/purchaseOrders/setCurrent', null)
    }

    reload() {
        this.$store
            .dispatch('fleet/purchaseOrders/loadList', { include_closed: this.includeClosed })
            .catch((e: Error) => this.toast(e.message, 'error'))
    }

    async openDetails(id: number) {
        this.detailsDialog = true
        try {
            const current: FleetPoDetail | null = this.$store.getters['fleet/purchaseOrders/getCurrent']
            if (current && current.po.id !== id) this.$store.commit('fleet/purchaseOrders/setCurrent', null)
            await this.$store.dispatch('fleet/purchaseOrders/loadPo', id)
        } catch (e: any) {
            this.detailsDialog = false
            this.toast(e?.message ?? String(e), 'error')
        }
    }

    openEdit(id: number, initial: FleetPoDetail | null = null) {
        this.editPoId = id
        this.editInitial = initial
        this.editDialog = true
    }

    onUploaded(detail: FleetPoDetail) {
        this.reload()
        if (detail.extraction_error) this.toast('PDF stored; fill in the PO manually', 'warning')
        this.openEdit(detail.po.id, detail)
    }

    async createManual() {
        this.manualSaving = true
        this.manualError = ''
        try {
            const detail: FleetPoDetail = await this.$store.dispatch('fleet/purchaseOrders/createPo', {
                po_number: this.manualNumber.trim() || null,
            })
            this.manualDialog = false
            this.reload()
            this.openEdit(detail.po.id, detail)
        } catch (e: any) {
            this.manualError = e?.message ?? String(e)
        } finally {
            this.manualSaving = false
        }
    }

    /** Fresh PO detail (unscheduled counts) before the job form / link dialog opens. */
    async freshPo(detail: FleetPoDetail): Promise<FleetPoDetail> {
        try {
            return await this.$store.dispatch('fleet/purchaseOrders/fetchPo', detail.po.id)
        } catch {
            return detail
        }
    }

    async openCreateJob(detail: FleetPoDetail) {
        this.$store.dispatch('fleet/customers/loadCustomers').catch(() => {})
        this.jobFormPo = await this.freshPo(detail)
        this.jobFormDialog = true
    }

    async openLinkJob(detail: FleetPoDetail) {
        this.linkPo = await this.freshPo(detail)
        this.linkDialog = true
    }

    async onJobCreated() {
        this.toast('Job created for the PO', 'success')
        await this.afterJobChange(this.jobFormPo)
    }

    async onJobLinked() {
        this.toast('Job linked', 'success')
        await this.afterJobChange(this.linkPo)
    }

    async afterJobChange(po: FleetPoDetail | null) {
        this.reload()
        if (!po) return
        // Show the PO's Jobs/fulfillment so the operator sees the result.
        if (!this.detailsDialog) await this.openDetails(po.po.id)
        else this.$store.dispatch('fleet/purchaseOrders/loadPo', po.po.id).catch(() => {})
    }

    onDeleted() {
        this.toast('Draft deleted', 'success')
        this.reload()
    }

    dueClass(row: FleetPoListRow) {
        if (!row.due_date || row.fulfilled || row.status === 'closed' || row.status === 'cancelled') return ''
        const ms = new Date(`${row.due_date.slice(0, 10)}T23:59:59`).getTime() - Date.now()
        if (ms < 0) return 'error--text font-weight-bold'
        if (ms < 3 * 86400000) return 'orange--text font-weight-bold'
        return ''
    }

    formatDate(d: string | null) {
        if (!d) return '—'
        const v = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d)
        return isNaN(v.getTime()) ? d : v.toLocaleDateString()
    }

    toast(text: string, color: string) {
        this.snackbarText = text
        this.snackbarColor = color
        this.snackbar = true
    }
}
</script>

<style scoped>
.po-table >>> tbody tr {
    cursor: pointer;
}
</style>
