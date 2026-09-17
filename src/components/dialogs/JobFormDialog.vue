<template>
    <v-dialog :value="value" max-width="1000" persistent scrollable @input="$emit('input', $event)">
        <v-card>
            <v-card-title>{{ isEdit ? 'Edit Job' : 'New Job' }}</v-card-title>
            <v-card-text>
                <v-alert v-if="error" type="error" dense class="mb-3">{{ error }}</v-alert>
                <v-row>
                    <!-- Job fields -->
                    <v-col cols="12" md="5">
                        <v-text-field v-model="form.name" label="Job name *" dense outlined :rules="[(v) => !!v || 'Required']" />
                        <div class="d-flex align-start">
                            <v-select
                                v-model="form.customer_id"
                                :items="customerOptions"
                                label="Customer"
                                dense
                                outlined
                                clearable
                                class="flex-grow-1" />
                            <v-btn icon class="ml-1" title="Add customer" @click="quickAdd.show = !quickAdd.show">
                                <v-icon>{{ mdiAccountPlus }}</v-icon>
                            </v-btn>
                        </div>
                        <div v-if="quickAdd.show" class="d-flex align-center mb-3">
                            <v-text-field v-model="quickAdd.name" label="New customer name" dense outlined hide-details class="mr-2" />
                            <v-btn small color="primary" :loading="quickAdd.saving" :disabled="!quickAdd.name" @click="saveQuickCustomer">Add</v-btn>
                        </div>
                        <v-row dense>
                            <v-col cols="6">
                                <v-select v-model="form.job_type" :items="jobTypeOptions" label="Type" dense outlined />
                            </v-col>
                            <v-col cols="6">
                                <v-select v-model="form.priority" :items="priorityOptions" label="Priority" dense outlined />
                            </v-col>
                        </v-row>
                        <v-text-field v-model="form.operator_name" label="Operator" dense outlined />
                        <v-menu v-model="dueMenu" :close-on-content-click="false" offset-y min-width="290">
                            <template #activator="{ on, attrs }">
                                <v-text-field
                                    v-model="form.due_date"
                                    label="Due date"
                                    dense
                                    outlined
                                    readonly
                                    clearable
                                    :prepend-inner-icon="mdiCalendar"
                                    v-bind="attrs"
                                    v-on="on" />
                            </template>
                            <v-date-picker v-model="form.due_date" @input="dueMenu = false" />
                        </v-menu>
                        <v-textarea v-model="form.description" label="Description" dense outlined rows="3" />
                    </v-col>

                    <!-- Items -->
                    <v-col cols="12" md="7">
                        <div class="d-flex align-center mb-2">
                            <span class="text-subtitle-1">G-code files</span>
                            <v-spacer />
                            <v-btn small outlined color="primary" @click="pickerDialog = true">
                                <v-icon small left>{{ mdiFilePlus }}</v-icon> Add files
                            </v-btn>
                        </div>
                        <div v-if="items.length === 0" class="text--secondary text-caption mb-3">
                            No files yet. Add files from the fleet library; printer model, filament and grams are read from the gcode.
                        </div>
                        <v-card v-for="(it, idx) in items" :key="it.key" outlined class="mb-2 pa-2">
                            <div class="d-flex align-center mb-1">
                                <v-icon small class="mr-1">{{ mdiFile }}</v-icon>
                                <span class="text-truncate flex-grow-1" :title="it.gcode_filename">{{ it.gcode_filename }}</span>
                                <v-chip v-if="it.metaLoading" x-small class="ml-1">reading…</v-chip>
                                <v-btn x-small icon :loading="it.saving" title="Remove" @click="removeItem(idx)">
                                    <v-icon small>{{ mdiDelete }}</v-icon>
                                </v-btn>
                            </div>
                            <v-row dense>
                                <v-col cols="3">
                                    <v-text-field v-model.number="it.quantity" type="number" min="1" label="Qty" dense outlined hide-details />
                                </v-col>
                                <v-col cols="3">
                                    <v-select v-model="it.printer_model" :items="modelOptions" label="Printer" dense outlined hide-details />
                                </v-col>
                                <v-col cols="3">
                                    <v-combobox v-model="it.filament_type" :items="filamentSuggestions" label="Filament" dense outlined hide-details />
                                </v-col>
                                <v-col cols="3">
                                    <v-text-field v-model.number="it.filament_grams" type="number" min="0" label="Grams" dense outlined hide-details />
                                </v-col>
                            </v-row>
                        </v-card>
                    </v-col>
                </v-row>
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn text @click="close">Cancel</v-btn>
                <v-btn color="primary" :loading="saving" :disabled="!form.name" @click="save">
                    {{ isEdit ? 'Save' : 'Create job' }}
                </v-btn>
            </v-card-actions>
        </v-card>

        <v-dialog v-model="pickerDialog" max-width="700">
            <v-card>
                <v-card-title>Fleet library</v-card-title>
                <v-card-text>
                    <fleet-gcode-picker v-if="pickerDialog" selection-mode="multiple" @files-selected="onFilesSelected" />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="pickerDialog = false">Close</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-dialog>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { Prop, Watch } from 'vue-property-decorator'
import { mdiAccountPlus, mdiCalendar, mdiDelete, mdiFile, mdiFilePlus } from '@mdi/js'
import FleetGcodePicker from '@/components/FleetGcodePicker.vue'
import {
    FleetCustomer,
    FleetJobDetail,
    FleetJobItem,
    FleetGcodeMeta,
    FLEET_PRINTER_MODELS,
    JobCreatePayload,
    JobItemCreatePayload,
    ItemPrinterModelChoice,
} from '@/store/fleet/jobs/types'
import { parseGcodeFilename } from '@/store/fleet/jobs/gcodeFilename'

interface ItemRow {
    key: string
    id: number | null
    gcode_filename: string
    quantity: number
    printer_model: ItemPrinterModelChoice
    filament_type: string | null
    filament_grams: number | null
    metaLoading: boolean
    saving: boolean
    /** JSON of the payload as last persisted (edit mode); used to detect changes on Save. */
    persisted: string | null
}

let rowSeq = 0

@Component({ components: { FleetGcodePicker } })
export default class JobFormDialog extends Vue {
    mdiAccountPlus = mdiAccountPlus
    mdiCalendar = mdiCalendar
    mdiDelete = mdiDelete
    mdiFile = mdiFile
    mdiFilePlus = mdiFilePlus

    @Prop({ type: Boolean, default: false }) value!: boolean
    /** When set, the dialog edits this job (items are saved per row). */
    @Prop({ type: Object, default: null }) job!: FleetJobDetail | null

    form = this.emptyForm()
    items: ItemRow[] = []
    quickAdd = { show: false, name: '', saving: false }
    dueMenu = false
    pickerDialog = false
    saving = false
    error = ''

    jobTypeOptions = [
        { text: 'Production', value: 'production' },
        { text: 'Sample', value: 'sample' },
    ]
    priorityOptions = [
        { text: 'Low', value: 'low' },
        { text: 'Medium', value: 'medium' },
        { text: 'High', value: 'high' },
    ]
    modelOptions = [{ text: 'Any printer', value: 'any' }, ...FLEET_PRINTER_MODELS.map((m) => ({ text: m, value: m }))]
    filamentSuggestions = ['PETG-CF', 'PA-CF', 'PA-GF', 'PETG', 'PLA', 'ABS', 'TPU']

    get isEdit() {
        return !!this.job
    }

    get customerOptions() {
        return (this.$store.getters['fleet/customers/getCustomers'] as FleetCustomer[]).map((c) => ({
            text: c.name,
            value: c.id,
        }))
    }

    emptyForm() {
        return {
            name: '',
            customer_id: null as number | null,
            job_type: 'production',
            priority: 'medium',
            operator_name: '',
            description: '',
            due_date: '' as string | null,
        }
    }

    @Watch('value')
    onOpen(open: boolean) {
        if (!open) return
        this.error = ''
        this.quickAdd = { show: false, name: '', saving: false }
        if (this.job) {
            const j = this.job.job
            this.form = {
                name: j.name,
                customer_id: j.customer_id,
                job_type: j.job_type,
                priority: j.priority,
                operator_name: j.operator_name ?? '',
                description: j.description ?? '',
                due_date: j.due_date ? j.due_date.slice(0, 10) : '',
            }
            this.items = this.job.items.map((i) => {
                const row = this.rowFromItem(i)
                row.persisted = JSON.stringify(this.itemPayload(row))
                return row
            })
        } else {
            this.form = this.emptyForm()
            this.items = []
        }
    }

    rowFromItem(i: FleetJobItem): ItemRow {
        return {
            key: `item-${i.id}`,
            id: i.id,
            gcode_filename: i.gcode_filename,
            quantity: i.quantity,
            printer_model: i.printer_model ?? 'any',
            filament_type: i.filament_type,
            filament_grams: i.filament_grams,
            metaLoading: false,
            saving: false,
            persisted: null,
        }
    }

    async onFilesSelected(paths: string[]) {
        this.pickerDialog = false
        for (const p of paths) {
            if (this.items.some((it) => it.gcode_filename === p)) continue
            const row: ItemRow = {
                key: `new-${++rowSeq}`,
                id: null,
                gcode_filename: p,
                quantity: 1,
                printer_model: 'any',
                filament_type: null,
                filament_grams: null,
                metaLoading: true,
                saving: false,
                persisted: null,
            }
            this.items.push(row)
            this.prefillRow(row)
        }
    }

    /** Gcode footer metadata first, filename hints only for still-empty fields. */
    async prefillRow(row: ItemRow) {
        try {
            const meta: FleetGcodeMeta = await this.$store.dispatch('fleet/jobs/fetchGcodeMeta', row.gcode_filename)
            if (meta.printer_model) row.printer_model = meta.printer_model
            if (meta.filament_type) row.filament_type = meta.filament_type
            if (meta.filament_used_g != null) row.filament_grams = Math.round(meta.filament_used_g * 10) / 10
        } catch (e) {
            // metadata is optional; fall through to filename hints
        } finally {
            row.metaLoading = false
        }
        const hint = parseGcodeFilename(row.gcode_filename)
        if ((row.printer_model === 'any' || !row.printer_model) && hint.printer_model) row.printer_model = hint.printer_model
        if (!row.filament_type && hint.filament_type) row.filament_type = hint.filament_type
        if (hint.quantity && row.quantity === 1) row.quantity = hint.quantity
        if (this.isEdit && this.job && row.id === null) {
            // In edit mode a newly picked file is created on the job right away.
            await this.createItemOnJob(row)
        }
    }

    itemPayload(row: ItemRow): JobItemCreatePayload {
        return {
            gcode_filename: row.gcode_filename,
            quantity: Math.max(1, Number(row.quantity) || 1),
            printer_model: row.printer_model ?? 'any',
            filament_type: row.filament_type ? String(row.filament_type).trim() : null,
            filament_grams: row.filament_grams != null && row.filament_grams > 0 ? Number(row.filament_grams) : null,
        }
    }

    async createItemOnJob(row: ItemRow) {
        if (!this.job) return
        row.saving = true
        try {
            const item: FleetJobItem = await this.$store.dispatch('fleet/jobs/addItem', {
                jobId: this.job.job.id,
                ...this.itemPayload(row),
            })
            row.id = item.id
            row.key = `item-${item.id}`
            row.persisted = JSON.stringify(this.itemPayload(row))
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        } finally {
            row.saving = false
        }
    }

    /** Persist one existing row (edit mode). Throws on failure. */
    async saveItem(row: ItemRow) {
        if (!this.job || row.id === null) return
        row.saving = true
        try {
            const payload = this.itemPayload(row)
            await this.$store.dispatch('fleet/jobs/updateItem', {
                jobId: this.job.job.id,
                itemId: row.id,
                ...payload,
            })
            row.persisted = JSON.stringify(payload)
        } finally {
            row.saving = false
        }
    }

    /** Rows whose quantity / model / filament / grams differ from what the daemon has. */
    changedRows(): ItemRow[] {
        return this.items.filter((r) => r.id !== null && r.persisted !== JSON.stringify(this.itemPayload(r)))
    }

    async removeItem(idx: number) {
        const row = this.items[idx]
        if (this.isEdit && this.job && row.id !== null) {
            row.saving = true
            this.error = ''
            try {
                await this.$store.dispatch('fleet/jobs/deleteItem', { jobId: this.job.job.id, itemId: row.id })
            } catch (e: any) {
                if (e?.status === 409 && confirm(`${e.message}\n\nDelete anyway?`)) {
                    try {
                        await this.$store.dispatch('fleet/jobs/deleteItem', {
                            jobId: this.job.job.id,
                            itemId: row.id,
                            force: true,
                        })
                    } catch (e2: any) {
                        this.error = e2?.message ?? String(e2)
                        row.saving = false
                        return
                    }
                } else {
                    this.error = e?.message ?? String(e)
                    row.saving = false
                    return
                }
            }
        }
        this.items.splice(idx, 1)
    }

    async saveQuickCustomer() {
        this.quickAdd.saving = true
        try {
            const c: FleetCustomer = await this.$store.dispatch('fleet/customers/createCustomer', {
                name: this.quickAdd.name.trim(),
            })
            this.form.customer_id = c.id
            this.quickAdd = { show: false, name: '', saving: false }
        } catch (e: any) {
            this.error = e?.message ?? String(e)
            this.quickAdd.saving = false
        }
    }

    dueDateIso(): string | null {
        if (!this.form.due_date) return null
        // Date picker gives YYYY-MM-DD; send end of that day in local time.
        const d = new Date(`${this.form.due_date}T23:59:59`)
        return isNaN(d.getTime()) ? null : d.toISOString()
    }

    async save() {
        this.saving = true
        this.error = ''
        try {
            if (this.job) {
                await this.$store.dispatch('fleet/jobs/updateJob', {
                    id: this.job.job.id,
                    name: this.form.name.trim(),
                    customer_id: this.form.customer_id ?? 0,
                    job_type: this.form.job_type,
                    priority: this.form.priority,
                    operator_name: this.form.operator_name || '',
                    description: this.form.description || '',
                    due_date: this.dueDateIso() ?? '',
                })
                // Item edits (quantity, model, filament, grams) are saved here too.
                for (const row of this.changedRows()) {
                    await this.saveItem(row)
                }
                this.$emit('saved', this.job.job.id)
            } else {
                const payload: JobCreatePayload = {
                    customer_id: this.form.customer_id,
                    name: this.form.name.trim(),
                    description: this.form.description || null,
                    operator_name: this.form.operator_name || null,
                    job_type: this.form.job_type as any,
                    priority: this.form.priority as any,
                    due_date: this.dueDateIso(),
                    items: this.items.map((r) => this.itemPayload(r)),
                }
                const detail: FleetJobDetail = await this.$store.dispatch('fleet/jobs/createJob', payload)
                this.$emit('saved', detail.job.id)
            }
            this.close()
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        } finally {
            this.saving = false
        }
    }

    close() {
        this.$emit('input', false)
    }
}
</script>
