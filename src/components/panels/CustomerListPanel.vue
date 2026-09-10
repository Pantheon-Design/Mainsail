<template>
    <v-card flat>
        <v-card-title class="d-flex align-center">
            <span>Customers</span>
            <v-spacer />
            <v-btn small color="primary" outlined @click="openAdd">
                <v-icon small left>{{ mdiPlus }}</v-icon> Add customer
            </v-btn>
        </v-card-title>

        <v-data-table :headers="headers" :items="customers" :loading="loading" dense sort-by="name">
            <template #item.contact="{ item }">{{ item.contact || '—' }}</template>
            <template #item.notes="{ item }">{{ item.notes || '—' }}</template>
            <template #item.updated_at="{ item }">{{ formatDate(item.updated_at) }}</template>
            <template #item.actions="{ item }">
                <v-btn x-small icon @click.stop="openEdit(item)"><v-icon small>{{ mdiPencil }}</v-icon></v-btn>
                <v-btn x-small icon @click.stop="confirmDelete(item)"><v-icon small>{{ mdiDelete }}</v-icon></v-btn>
            </template>
        </v-data-table>

        <v-dialog v-model="editDialog" max-width="480" persistent>
            <v-card>
                <v-card-title>{{ editing ? 'Edit customer' : 'Add customer' }}</v-card-title>
                <v-card-text>
                    <v-text-field v-model="form.name" label="Name *" dense outlined :rules="[(v) => !!v || 'Required']" />
                    <v-text-field v-model="form.contact" label="Contact (email / phone)" dense outlined />
                    <v-textarea v-model="form.notes" label="Notes" dense outlined rows="3" />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="editDialog = false">Cancel</v-btn>
                    <v-btn color="primary" :loading="saving" :disabled="!form.name" @click="save">Save</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="deleteDialog" max-width="420">
            <v-card>
                <v-card-title>Delete customer</v-card-title>
                <v-card-text>
                    Delete <strong>{{ deleteTarget?.name }}</strong>?
                    <span v-if="deleteTarget && deleteTarget.job_count > 0">
                        This customer has {{ deleteTarget.job_count }} job(s); they will be kept without a customer.
                    </span>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="deleteDialog = false">Cancel</v-btn>
                    <v-btn color="error" :loading="saving" @click="doDelete">Delete</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3000" bottom>{{ snackbarText }}</v-snackbar>
    </v-card>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { mdiDelete, mdiPencil, mdiPlus } from '@mdi/js'
import { FleetCustomer } from '@/store/fleet/jobs/types'

@Component
export default class CustomerListPanel extends Vue {
    mdiDelete = mdiDelete
    mdiPencil = mdiPencil
    mdiPlus = mdiPlus

    editDialog = false
    deleteDialog = false
    saving = false
    editing: FleetCustomer | null = null
    deleteTarget: FleetCustomer | null = null
    form = { name: '', contact: '', notes: '' }

    snackbar = false
    snackbarText = ''
    snackbarColor = 'success'

    headers = [
        { text: 'Name', value: 'name' },
        { text: 'Contact', value: 'contact' },
        { text: 'Jobs', value: 'job_count', width: 80 },
        { text: 'Notes', value: 'notes' },
        { text: 'Updated', value: 'updated_at', width: 130 },
        { text: '', value: 'actions', sortable: false, width: 90 },
    ]

    get customers(): FleetCustomer[] {
        return this.$store.getters['fleet/customers/getCustomers']
    }

    get loading(): boolean {
        return this.$store.getters['fleet/customers/isLoading']
    }

    formatDate(iso: string | null) {
        return iso ? new Date(iso).toLocaleDateString() : '—'
    }

    openAdd() {
        this.editing = null
        this.form = { name: '', contact: '', notes: '' }
        this.editDialog = true
    }

    openEdit(c: FleetCustomer) {
        this.editing = c
        this.form = { name: c.name, contact: c.contact ?? '', notes: c.notes ?? '' }
        this.editDialog = true
    }

    async save() {
        this.saving = true
        try {
            const payload = { name: this.form.name.trim(), contact: this.form.contact || null, notes: this.form.notes || null }
            if (this.editing) {
                await this.$store.dispatch('fleet/customers/updateCustomer', { id: this.editing.id, ...payload })
                this.toast('Customer updated', 'success')
            } else {
                await this.$store.dispatch('fleet/customers/createCustomer', payload)
                this.toast('Customer created', 'success')
            }
            this.editDialog = false
        } catch (e: any) {
            this.toast(e?.message ?? 'Failed to save', 'error')
        } finally {
            this.saving = false
        }
    }

    confirmDelete(c: FleetCustomer) {
        this.deleteTarget = c
        this.deleteDialog = true
    }

    async doDelete() {
        if (!this.deleteTarget) return
        this.saving = true
        try {
            await this.$store.dispatch('fleet/customers/deleteCustomer', {
                id: this.deleteTarget.id,
                force: this.deleteTarget.job_count > 0,
            })
            this.toast('Customer deleted', 'success')
            this.deleteDialog = false
            this.$store.dispatch('fleet/jobs/loadJobs').catch(() => {})
        } catch (e: any) {
            this.toast(e?.message ?? 'Failed to delete', 'error')
        } finally {
            this.saving = false
        }
    }

    toast(text: string, color: string) {
        this.snackbarText = text
        this.snackbarColor = color
        this.snackbar = true
    }
}
</script>
