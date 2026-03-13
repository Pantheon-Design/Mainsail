<template>
    <v-card flat>
        <v-card-title class="d-flex align-center">
            <span>Spools</span>
            <v-spacer />
            <!-- QR Lookup -->
            <v-text-field
                v-model="qrSearch"
                label="QR Lookup"
                dense outlined hide-details
                class="mr-2"
                style="max-width: 200px"
                clearable
                @keydown.enter="lookupQr"
                @click:clear="qrResult = null" />
            <v-btn small color="primary" outlined class="mr-2" @click="openAddDialog">
                <v-icon small left>{{ mdiPlus }}</v-icon> Add Spool
            </v-btn>
        </v-card-title>

        <!-- QR Lookup Result -->
        <v-card-text v-if="qrResult" class="pt-0 pb-2">
            <v-alert type="info" dense dismissible @input="qrResult = null">
                <strong>QR {{ qrResult.qr_code }}</strong> —
                Spool #{{ qrResult.id }},
                {{ qrResult.material }} ({{ qrResult.vendor_name || 'No vendor' }}),
                Remaining: {{ qrResult.remaining_weight != null ? qrResult.remaining_weight.toFixed(0) + ' g' : '—' }},
                Location: {{ qrResult.location || '—' }}
            </v-alert>
        </v-card-text>
        <v-card-text v-if="qrError" class="pt-0 pb-2">
            <v-alert type="error" dense dismissible @input="qrError = ''">{{ qrError }}</v-alert>
        </v-card-text>

        <!-- Filters -->
        <v-card-text class="py-1">
            <v-row dense>
                <v-col cols="12" sm="3">
                    <v-select
                        v-model="filterMaterial"
                        :items="materialOptions"
                        label="Material"
                        clearable dense outlined />
                </v-col>
                <v-col cols="12" sm="3">
                    <v-text-field
                        v-model="filterLocation"
                        label="Location"
                        clearable dense outlined />
                </v-col>
                <v-col cols="12" sm="3">
                    <v-checkbox
                        v-model="showArchived"
                        label="Show archived"
                        dense hide-details
                        class="mt-1"
                        @change="reloadSpools" />
                </v-col>
            </v-row>
        </v-card-text>

        <v-data-table
            :headers="headers"
            :items="filteredSpools"
            :loading="loading"
            dense
            sort-by="id"
            :sort-desc="true"
            :items-per-page="50"
            :footer-props="{ 'items-per-page-options': [25, 50, 100, 200] }"
            class="spool-table"
            @click:row="openDetailDialog">
            <template #item.color_hex="{ item }">
                <div v-if="item.color_hex"
                    :style="{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#' + item.color_hex, border: '1px solid rgba(255,255,255,0.3)', display: 'inline-block' }" />
                <span v-else>—</span>
            </template>
            <template #item.filament_label="{ item }">
                {{ [item.vendor_name, item.filament_name].filter(Boolean).join(' — ') || item.material }}
            </template>
            <template #item.initial_weight="{ item }">
                {{ item.initial_weight != null ? item.initial_weight.toFixed(0) + ' g' : '—' }}
            </template>
            <template #item.used_weight="{ item }">
                {{ item.used_weight.toFixed(0) }} g
            </template>
            <template #item.remaining_weight="{ item }">
                <span :class="remainingClass(item)">
                    {{ item.remaining_weight != null ? item.remaining_weight.toFixed(0) + ' g' : '—' }}
                </span>
            </template>
            <template #item.last_used="{ item }">
                {{ formatDate(item.last_used) }}
            </template>
            <template #item.registered="{ item }">
                {{ formatDate(item.registered) }}
            </template>
            <template #item.archived="{ item }">
                <v-chip v-if="item.archived" x-small color="grey">archived</v-chip>
            </template>
            <template #item.actions="{ item }">
                <v-btn x-small icon @click.stop="openEditDialog(item)">
                    <v-icon small>{{ mdiPencil }}</v-icon>
                </v-btn>
                <v-btn v-if="!item.archived" x-small icon @click.stop="confirmArchive(item)">
                    <v-icon small>{{ mdiArchive }}</v-icon>
                </v-btn>
            </template>
        </v-data-table>

        <!-- Detail Dialog -->
        <v-dialog v-model="detailDialog" max-width="500">
            <v-card v-if="detailSpool">
                <v-card-title>Spool #{{ detailSpool.id }}</v-card-title>
                <v-card-text>
                    <v-simple-table dense>
                        <tbody>
                            <tr><td class="font-weight-bold">QR Code</td><td>{{ detailSpool.qr_code || '—' }}</td></tr>
                            <tr><td class="font-weight-bold">Filament</td><td>{{ [detailSpool.vendor_name, detailSpool.filament_name].filter(Boolean).join(' — ') }}</td></tr>
                            <tr><td class="font-weight-bold">Material</td><td>{{ detailSpool.material }}</td></tr>
                            <tr><td class="font-weight-bold">Initial Weight</td><td>{{ detailSpool.initial_weight != null ? detailSpool.initial_weight + ' g' : '—' }}</td></tr>
                            <tr><td class="font-weight-bold">Used Weight</td><td>{{ detailSpool.used_weight }} g</td></tr>
                            <tr><td class="font-weight-bold">Remaining</td><td>{{ detailSpool.remaining_weight != null ? detailSpool.remaining_weight + ' g' : '—' }}</td></tr>
                            <tr><td class="font-weight-bold">Location</td><td>{{ detailSpool.location || '—' }}</td></tr>
                            <tr><td class="font-weight-bold">Lot #</td><td>{{ detailSpool.lot_nr || '—' }}</td></tr>
                            <tr><td class="font-weight-bold">Last Printer</td><td>{{ detailSpool.last_printer || '—' }}</td></tr>
                            <tr><td class="font-weight-bold">Last Used</td><td>{{ formatDate(detailSpool.last_used) }}</td></tr>
                            <tr><td class="font-weight-bold">Comment</td><td>{{ detailSpool.comment || '—' }}</td></tr>
                        </tbody>
                    </v-simple-table>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="detailDialog = false">Close</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Add/Edit Dialog -->
        <v-dialog v-model="editDialog" max-width="550" persistent>
            <v-card>
                <v-card-title>{{ editingSpool ? 'Edit Spool' : 'Add Spool' }}</v-card-title>
                <v-card-text>
                    <v-select
                        v-model="form.filament_id"
                        :items="filamentItems"
                        label="Filament"
                        dense outlined
                        :rules="[v => v != null || 'Required']" />
                    <v-text-field v-model="form.qr_code" label="QR Code" dense outlined
                        hint="Type or scan with USB scanner" />
                    <v-row dense>
                        <v-col cols="4">
                            <v-text-field v-model.number="form.initial_weight" label="Initial (g)" dense outlined type="number" />
                        </v-col>
                        <v-col cols="4">
                            <v-text-field v-model.number="form.used_weight" label="Used (g)" dense outlined type="number" />
                        </v-col>
                        <v-col cols="4">
                            <v-text-field v-model.number="form.spool_weight" label="Empty spool (g)" dense outlined type="number" />
                        </v-col>
                    </v-row>
                    <v-text-field v-model="form.location" label="Location" dense outlined />
                    <v-text-field v-model="form.lot_nr" label="Lot Number" dense outlined />
                    <v-text-field v-model="form.comment" label="Comment" dense outlined />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="editDialog = false">Cancel</v-btn>
                    <v-btn color="primary" :loading="saving" :disabled="form.filament_id == null" @click="save">Save</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Archive Confirmation -->
        <v-dialog v-model="archiveDialog" max-width="400">
            <v-card>
                <v-card-title>Archive Spool</v-card-title>
                <v-card-text>
                    Archive spool <strong>#{{ archiveTarget?.id }}</strong>
                    ({{ archiveTarget?.qr_code || 'no QR' }})?
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="archiveDialog = false">Cancel</v-btn>
                    <v-btn color="warning" :loading="saving" @click="doArchive">Archive</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3000" bottom>
            {{ snackbarText }}
        </v-snackbar>
    </v-card>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { mdiPlus, mdiPencil, mdiArchive } from '@mdi/js'
import { FleetSpool, FleetFilament, FleetVendor } from '@/store/fleet/spools/types'

@Component
export default class SpoolListPanel extends Vue {
    mdiPlus = mdiPlus
    mdiPencil = mdiPencil
    mdiArchive = mdiArchive

    editDialog = false
    detailDialog = false
    archiveDialog = false
    saving = false
    editingSpool: FleetSpool | null = null
    detailSpool: FleetSpool | null = null
    archiveTarget: FleetSpool | null = null

    filterMaterial: string | null = null
    filterLocation: string | null = null
    showArchived = false

    qrSearch = ''
    qrResult: FleetSpool | null = null
    qrError = ''

    form: any = this.emptyForm()

    snackbar = false
    snackbarText = ''
    snackbarColor = 'success'

    headers = [
        { text: 'ID', value: 'id', width: 60 },
        { text: '', value: 'color_hex', width: 40, sortable: false },
        { text: 'QR Code', value: 'qr_code', width: 120 },
        { text: 'Filament', value: 'filament_label' },
        { text: 'Material', value: 'material', width: 100 },
        { text: 'Initial', value: 'initial_weight', width: 90 },
        { text: 'Used', value: 'used_weight', width: 80 },
        { text: 'Remaining', value: 'remaining_weight', width: 100 },
        { text: 'Location', value: 'location', width: 100 },
        { text: 'Last Printer', value: 'last_printer', width: 120 },
        { text: 'Last Used', value: 'last_used', width: 110 },
        { text: '', value: 'archived', width: 80, sortable: false },
        { text: 'Actions', value: 'actions', sortable: false, width: 80 },
    ]

    get spools(): FleetSpool[] {
        return this.$store.getters['fleet/spools/getSpools']
    }

    get filaments(): FleetFilament[] {
        return this.$store.getters['fleet/spools/getFilaments']
    }

    get vendors(): FleetVendor[] {
        return this.$store.getters['fleet/spools/getVendors']
    }

    get loading(): boolean {
        return this.$store.getters['fleet/spools/isLoading']
    }

    get materialOptions(): string[] {
        return this.$store.getters['fleet/spools/getMaterials']
    }

    get filamentItems() {
        return this.filaments.map((f) => {
            const vendor = f.vendor_name || ''
            const name = f.name || ''
            const label = [vendor, name, `(${f.material})`].filter(Boolean).join(' — ')
            return { text: `#${f.id} ${label}`, value: f.id }
        })
    }

    get filteredSpools(): FleetSpool[] {
        return this.spools.filter((s) => {
            if (this.filterMaterial && s.material !== this.filterMaterial) return false
            if (this.filterLocation && !(s.location || '').toLowerCase().includes(this.filterLocation.toLowerCase())) return false
            return true
        })
    }

    emptyForm() {
        return {
            filament_id: null as number | null,
            qr_code: '',
            initial_weight: null as number | null,
            used_weight: 0,
            spool_weight: null as number | null,
            location: '',
            lot_nr: '',
            comment: '',
        }
    }

    formatDate(iso: string | null): string {
        if (!iso) return '—'
        return new Date(iso).toLocaleDateString()
    }

    remainingClass(item: FleetSpool): string {
        if (item.remaining_weight == null || item.initial_weight == null) return ''
        const pct = item.remaining_weight / item.initial_weight
        if (pct <= 0.1) return 'red--text font-weight-bold'
        if (pct <= 0.25) return 'orange--text'
        return ''
    }

    reloadSpools() {
        const filters: any = {}
        if (this.showArchived) filters.archived = true
        this.$store.dispatch('fleet/spools/loadSpools', filters)
    }

    async lookupQr() {
        const qr = (this.qrSearch || '').trim()
        if (!qr) return
        this.qrResult = null
        this.qrError = ''
        try {
            const spool = await this.$store.dispatch('fleet/spools/lookupByQr', qr)
            this.qrResult = spool
        } catch (err: any) {
            if (err?.response?.status === 404) {
                this.qrError = `No spool found for QR code "${qr}"`
            } else {
                this.qrError = err?.response?.data?.detail || 'Lookup failed'
            }
        }
    }

    openDetailDialog(spool: FleetSpool) {
        this.detailSpool = spool
        this.detailDialog = true
    }

    openAddDialog() {
        this.editingSpool = null
        this.form = this.emptyForm()
        this.editDialog = true
    }

    openEditDialog(spool: FleetSpool) {
        this.editingSpool = spool
        this.form = {
            filament_id: spool.filament_id,
            qr_code: spool.qr_code || '',
            initial_weight: spool.initial_weight,
            used_weight: spool.used_weight,
            spool_weight: spool.spool_weight,
            location: spool.location || '',
            lot_nr: spool.lot_nr || '',
            comment: spool.comment || '',
        }
        this.editDialog = true
    }

    async save() {
        this.saving = true
        try {
            const payload: any = { ...this.form }
            // Clean empty strings to null
            for (const key of ['qr_code', 'location', 'lot_nr', 'comment']) {
                if (payload[key] === '') payload[key] = null
            }

            if (this.editingSpool) {
                payload.id = this.editingSpool.id
                await this.$store.dispatch('fleet/spools/updateSpool', payload)
                this.showSnackbar('Spool updated', 'success')
            } else {
                await this.$store.dispatch('fleet/spools/createSpool', payload)
                this.showSnackbar('Spool created', 'success')
            }
            // Reload to get joined data
            this.reloadSpools()
            this.editDialog = false
        } catch (err: any) {
            const msg = err?.response?.data?.detail || 'Failed to save'
            this.showSnackbar(msg, 'error')
        } finally {
            this.saving = false
        }
    }

    confirmArchive(spool: FleetSpool) {
        this.archiveTarget = spool
        this.archiveDialog = true
    }

    async doArchive() {
        if (!this.archiveTarget) return
        this.saving = true
        try {
            await this.$store.dispatch('fleet/spools/archiveSpool', this.archiveTarget.id)
            this.showSnackbar('Spool archived', 'success')
            this.archiveDialog = false
        } catch (err: any) {
            const msg = err?.response?.data?.detail || 'Failed to archive'
            this.showSnackbar(msg, 'error')
        } finally {
            this.saving = false
        }
    }

    showSnackbar(text: string, color: string) {
        this.snackbarText = text
        this.snackbarColor = color
        this.snackbar = true
    }
}
</script>

<style scoped>
.spool-table tbody tr {
    cursor: pointer;
}
</style>
