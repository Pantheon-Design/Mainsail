<template>
    <v-card flat>
        <v-card-title class="d-flex align-center">
            <span>Filaments</span>
            <v-spacer />
            <v-btn small color="primary" outlined @click="openAddDialog">
                <v-icon small left>{{ mdiPlus }}</v-icon> Add Filament
            </v-btn>
        </v-card-title>

        <!-- Filters -->
        <v-card-text class="py-1">
            <v-row dense>
                <v-col cols="12" sm="4">
                    <v-select
                        v-model="filterVendor"
                        :items="vendorOptions"
                        label="Vendor"
                        clearable dense outlined
                        @change="applyFilters" />
                </v-col>
                <v-col cols="12" sm="4">
                    <v-select
                        v-model="filterMaterial"
                        :items="materialOptions"
                        label="Material"
                        clearable dense outlined
                        @change="applyFilters" />
                </v-col>
            </v-row>
        </v-card-text>

        <v-data-table
            :headers="headers"
            :items="filteredFilaments"
            :loading="loading"
            dense
            sort-by="id"
            :sort-desc="true"
            class="filament-table">
            <template #item.color_hex="{ item }">
                <div v-if="item.color_hex"
                    :style="{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#' + item.color_hex, border: '1px solid rgba(255,255,255,0.3)', display: 'inline-block' }" />
                <span v-else>—</span>
            </template>
            <template #item.vendor_name="{ item }">
                {{ item.vendor_name || '—' }}
            </template>
            <template #item.weight="{ item }">
                {{ item.weight != null ? item.weight + ' g' : '—' }}
            </template>
            <template #item.density="{ item }">
                {{ item.density }} g/cm³
            </template>
            <template #item.diameter="{ item }">
                {{ item.diameter }} mm
            </template>
            <template #item.registered="{ item }">
                {{ formatDate(item.registered) }}
            </template>
            <template #item.actions="{ item }">
                <v-btn x-small icon @click.stop="openEditDialog(item)">
                    <v-icon small>{{ mdiPencil }}</v-icon>
                </v-btn>
                <v-btn x-small icon @click.stop="confirmDelete(item)">
                    <v-icon small>{{ mdiDelete }}</v-icon>
                </v-btn>
            </template>
        </v-data-table>

        <!-- Add/Edit Dialog -->
        <v-dialog v-model="editDialog" max-width="550" persistent>
            <v-card>
                <v-card-title>{{ editingFilament ? 'Edit Filament' : 'Add Filament' }}</v-card-title>
                <v-card-text>
                    <v-select
                        v-model="form.vendor_id"
                        :items="vendorItems"
                        label="Vendor"
                        clearable dense outlined />
                    <v-text-field v-model="form.name" label="Name" dense outlined />
                    <v-text-field v-model="form.material" label="Material" dense outlined
                        :rules="[v => !!v || 'Required']"
                        hint="e.g. PA-CF, PETG-CF, TPU, PLA" />
                    <v-row dense>
                        <v-col cols="6">
                            <v-text-field v-model.number="form.density" label="Density (g/cm³)" dense outlined type="number" step="0.01"
                                :rules="[v => v > 0 || 'Required']" />
                        </v-col>
                        <v-col cols="6">
                            <v-text-field v-model.number="form.diameter" label="Diameter (mm)" dense outlined type="number" step="0.05" />
                        </v-col>
                    </v-row>
                    <v-row dense>
                        <v-col cols="6">
                            <v-text-field v-model.number="form.weight" label="Net weight (g)" dense outlined type="number" />
                        </v-col>
                        <v-col cols="6">
                            <v-text-field v-model.number="form.spool_weight" label="Empty spool weight (g)" dense outlined type="number" />
                        </v-col>
                    </v-row>
                    <v-row dense>
                        <v-col cols="4">
                            <v-text-field v-model="form.color_hex" label="Color hex" dense outlined
                                hint="RRGGBB, no #" />
                        </v-col>
                        <v-col cols="4">
                            <v-text-field v-model.number="form.settings_extruder_temp" label="Nozzle temp" dense outlined type="number" suffix="°C" />
                        </v-col>
                        <v-col cols="4">
                            <v-text-field v-model.number="form.settings_bed_temp" label="Bed temp" dense outlined type="number" suffix="°C" />
                        </v-col>
                    </v-row>
                    <v-text-field v-model="form.comment" label="Comment" dense outlined />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="editDialog = false">Cancel</v-btn>
                    <v-btn color="primary" :loading="saving" :disabled="!form.material || !form.density" @click="save">Save</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Delete Confirmation -->
        <v-dialog v-model="deleteDialog" max-width="400">
            <v-card>
                <v-card-title>Delete Filament</v-card-title>
                <v-card-text>
                    Delete <strong>{{ deleteTarget?.name || deleteTarget?.material }}</strong>?
                    This will fail if spools reference this filament.
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="deleteDialog = false">Cancel</v-btn>
                    <v-btn color="error" :loading="saving" @click="doDelete">Delete</v-btn>
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
import { mdiPlus, mdiPencil, mdiDelete } from '@mdi/js'
import { FleetFilament, FleetVendor } from '@/store/fleet/spools/types'

@Component
export default class FilamentListPanel extends Vue {
    mdiPlus = mdiPlus
    mdiPencil = mdiPencil
    mdiDelete = mdiDelete

    editDialog = false
    deleteDialog = false
    saving = false
    editingFilament: FleetFilament | null = null
    deleteTarget: FleetFilament | null = null

    filterVendor: number | null = null
    filterMaterial: string | null = null

    form: any = this.emptyForm()

    snackbar = false
    snackbarText = ''
    snackbarColor = 'success'

    headers = [
        { text: 'ID', value: 'id', width: 60 },
        { text: 'Color', value: 'color_hex', width: 60, sortable: false },
        { text: 'Vendor', value: 'vendor_name' },
        { text: 'Name', value: 'name' },
        { text: 'Material', value: 'material' },
        { text: 'Density', value: 'density', width: 110 },
        { text: 'Diameter', value: 'diameter', width: 100 },
        { text: 'Net Weight', value: 'weight', width: 110 },
        { text: 'Registered', value: 'registered', width: 130 },
        { text: 'Actions', value: 'actions', sortable: false, width: 100 },
    ]

    get filaments(): FleetFilament[] {
        return this.$store.getters['fleet/spools/getFilaments']
    }

    get vendors(): FleetVendor[] {
        return this.$store.getters['fleet/spools/getVendors']
    }

    get loading(): boolean {
        return this.$store.getters['fleet/spools/isLoading']
    }

    get vendorOptions() {
        return this.vendors.map((v) => ({ text: v.name, value: v.id }))
    }

    get vendorItems() {
        return [{ text: '(none)', value: null }, ...this.vendorOptions]
    }

    get materialOptions(): string[] {
        return this.$store.getters['fleet/spools/getMaterials']
    }

    get filteredFilaments(): FleetFilament[] {
        return this.filaments.filter((f) => {
            if (this.filterVendor != null && f.vendor_id !== this.filterVendor) return false
            if (this.filterMaterial && f.material !== this.filterMaterial) return false
            return true
        })
    }

    emptyForm() {
        return {
            vendor_id: null as number | null,
            name: '',
            material: '',
            density: 1.24,
            diameter: 1.75,
            weight: null as number | null,
            spool_weight: null as number | null,
            color_hex: '',
            settings_extruder_temp: null as number | null,
            settings_bed_temp: null as number | null,
            comment: '',
        }
    }

    formatDate(iso: string): string {
        if (!iso) return '—'
        return new Date(iso).toLocaleDateString()
    }

    applyFilters() {
        // Client-side filtering via computed — no action needed
    }

    openAddDialog() {
        this.editingFilament = null
        this.form = this.emptyForm()
        this.editDialog = true
    }

    openEditDialog(filament: FleetFilament) {
        this.editingFilament = filament
        this.form = {
            vendor_id: filament.vendor_id,
            name: filament.name || '',
            material: filament.material,
            density: filament.density,
            diameter: filament.diameter,
            weight: filament.weight,
            spool_weight: filament.spool_weight,
            color_hex: filament.color_hex || '',
            settings_extruder_temp: filament.settings_extruder_temp,
            settings_bed_temp: filament.settings_bed_temp,
            comment: filament.comment || '',
        }
        this.editDialog = true
    }

    async save() {
        this.saving = true
        try {
            const payload: any = { ...this.form }
            // Clean empty strings to null
            for (const key of ['name', 'color_hex', 'comment']) {
                if (payload[key] === '') payload[key] = null
            }

            if (this.editingFilament) {
                payload.id = this.editingFilament.id
                await this.$store.dispatch('fleet/spools/updateFilament', payload)
                this.showSnackbar('Filament updated', 'success')
            } else {
                await this.$store.dispatch('fleet/spools/createFilament', payload)
                this.showSnackbar('Filament created', 'success')
            }
            // Reload to get vendor_name join
            await this.$store.dispatch('fleet/spools/loadFilaments')
            this.editDialog = false
        } catch (err: any) {
            const msg = err?.response?.data?.detail || 'Failed to save'
            this.showSnackbar(msg, 'error')
        } finally {
            this.saving = false
        }
    }

    confirmDelete(filament: FleetFilament) {
        this.deleteTarget = filament
        this.deleteDialog = true
    }

    async doDelete() {
        if (!this.deleteTarget) return
        this.saving = true
        try {
            await this.$store.dispatch('fleet/spools/deleteFilament', this.deleteTarget.id)
            this.showSnackbar('Filament deleted', 'success')
            this.deleteDialog = false
        } catch (err: any) {
            const msg = err?.response?.data?.detail || 'Failed to delete'
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
