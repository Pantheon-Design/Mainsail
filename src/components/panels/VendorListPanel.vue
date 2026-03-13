<template>
    <v-card flat>
        <v-card-title class="d-flex align-center">
            <span>Vendors</span>
            <v-spacer />
            <v-btn small color="primary" outlined @click="openAddDialog">
                <v-icon small left>{{ mdiPlus }}</v-icon> Add Vendor
            </v-btn>
        </v-card-title>

        <v-data-table
            :headers="headers"
            :items="vendors"
            :loading="loading"
            dense
            sort-by="name"
            class="vendor-table">
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
        <v-dialog v-model="editDialog" max-width="450" persistent>
            <v-card>
                <v-card-title>{{ editingVendor ? 'Edit Vendor' : 'Add Vendor' }}</v-card-title>
                <v-card-text>
                    <v-text-field v-model="form.name" label="Vendor Name" dense outlined :rules="[v => !!v || 'Required']" />
                    <v-text-field v-model="form.comment" label="Comment (optional)" dense outlined />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="editDialog = false">Cancel</v-btn>
                    <v-btn color="primary" :loading="saving" :disabled="!form.name" @click="save">Save</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Delete Confirmation -->
        <v-dialog v-model="deleteDialog" max-width="400">
            <v-card>
                <v-card-title>Delete Vendor</v-card-title>
                <v-card-text>
                    Delete <strong>{{ deleteTarget?.name }}</strong>? Filaments from this vendor will be unlinked.
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
import { FleetVendor } from '@/store/fleet/spools/types'

@Component
export default class VendorListPanel extends Vue {
    mdiPlus = mdiPlus
    mdiPencil = mdiPencil
    mdiDelete = mdiDelete

    editDialog = false
    deleteDialog = false
    saving = false
    editingVendor: FleetVendor | null = null
    deleteTarget: FleetVendor | null = null

    form = { name: '', comment: '' }

    snackbar = false
    snackbarText = ''
    snackbarColor = 'success'

    headers = [
        { text: 'ID', value: 'id', width: 70 },
        { text: 'Name', value: 'name' },
        { text: 'Comment', value: 'comment' },
        { text: 'Registered', value: 'registered', width: 160 },
        { text: 'Actions', value: 'actions', sortable: false, width: 100 },
    ]

    get vendors(): FleetVendor[] {
        return this.$store.getters['fleet/spools/getVendors']
    }

    get loading(): boolean {
        return this.$store.getters['fleet/spools/isLoading']
    }

    formatDate(iso: string): string {
        if (!iso) return '—'
        return new Date(iso).toLocaleDateString()
    }

    openAddDialog() {
        this.editingVendor = null
        this.form = { name: '', comment: '' }
        this.editDialog = true
    }

    openEditDialog(vendor: FleetVendor) {
        this.editingVendor = vendor
        this.form = { name: vendor.name, comment: vendor.comment || '' }
        this.editDialog = true
    }

    async save() {
        this.saving = true
        try {
            if (this.editingVendor) {
                await this.$store.dispatch('fleet/spools/updateVendor', {
                    id: this.editingVendor.id,
                    name: this.form.name,
                    comment: this.form.comment || null,
                })
                this.showSnackbar('Vendor updated', 'success')
            } else {
                await this.$store.dispatch('fleet/spools/createVendor', {
                    name: this.form.name,
                    comment: this.form.comment || null,
                })
                this.showSnackbar('Vendor created', 'success')
            }
            this.editDialog = false
        } catch (err: any) {
            const msg = err?.response?.data?.detail || 'Failed to save'
            this.showSnackbar(msg, 'error')
        } finally {
            this.saving = false
        }
    }

    confirmDelete(vendor: FleetVendor) {
        this.deleteTarget = vendor
        this.deleteDialog = true
    }

    async doDelete() {
        if (!this.deleteTarget) return
        this.saving = true
        try {
            await this.$store.dispatch('fleet/spools/deleteVendor', this.deleteTarget.id)
            this.showSnackbar('Vendor deleted', 'success')
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
