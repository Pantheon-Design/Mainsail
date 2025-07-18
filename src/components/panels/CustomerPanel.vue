<template>
    <div>
        <div class="customer-list-panel">
                <v-card-text>
                    <v-row>
                        <v-col class="col-4 d-flex align-center">
                            <v-text-field v-model="search"
                                          :append-icon="mdiMagnify"
                                          label="Search Customers"
                                          single-line
                                          outlined
                                          clearable
                                          hide-details
                                          dense />
                        </v-col>
                        <v-col class="col-8 d-flex align-center justify-end">
                            <template v-if="selectedCustomers.length">
                                <v-btn title="Delete Selected"
                                       color="error"
                                       class="px-2 minwidth-0 ml-3"
                                       @click="deleteSelectedDialog = true">
                                    <v-icon>{{ mdiDelete }}</v-icon>
                                </v-btn>
                            </template>
                            <v-btn color="success"
                                   class="ml-3"
                                   @click="openCreateCustomerDialog">
                                <v-icon left>{{ mdiAccountPlus }}</v-icon>
                                New Customer
                            </v-btn>
                            <v-btn :loading="loadings.includes('customersRefresh')"
                                   class="px-2 minwidth-0 ml-3"
                                   @click="refreshCustomers">
                                <v-icon>{{ mdiRefresh }}</v-icon>
                            </v-btn>
                            <v-menu :offset-y="true" :close-on-content-click="false">
                                <!--
                        <template #activator="{ on, attrs }">
                            <v-btn class="px-2 minwidth-0 ml-3" v-bind="attrs" v-on="on">
                                <v-icon>{{ mdiCog }}</v-icon>
                            </v-btn>
                        </template>
                        -->
                                <v-list>
                                    <v-list-item v-for="header of configHeaders" :key="header.value" class="minHeight36">
                                        <v-checkbox v-model="header.visible"
                                                    class="mt-0"
                                                    hide-details
                                                    :label="header.text"
                                                    @change="changeColumnVisible(header.value)" />
                                    </v-list-item>
                                </v-list>
                            </v-menu>
                        </v-col>
                    </v-row>
                </v-card-text>
                <v-divider class="mb-3" />
                <v-data-table v-model="selectedCustomers"
                              :items="customers"
                              class="customer-list-table"
                              :headers="filteredHeaders"
                              :options="options"
                              :custom-sort="sortCustomers"
                              :sort-by.sync="sortBy"
                              :sort-desc.sync="sortDesc"
                              :items-per-page.sync="countPerPage"
                              :footer-props="{
                    itemsPerPageText: 'Customers',
                    itemsPerPageAllText: 'All Customers',
                    itemsPerPageOptions: [10, 25, 50, 100, -1],
                }"
                              item-key="id"
                              :search="search"
                              :custom-filter="advancedSearch"
                              mobile-breakpoint="0"
                              show-select>
                    <template slot="no-data">
                        <div class="text-center">No customers found</div>
                    </template>

                    <template #item="{ index, item, isSelected, select }">
                        <tr :key="`${index} ${item.name}`"
                            v-longpress:600="(e) => showContextMenu(e, item)"
                            class="file-list-cursor user-select-none"
                            @contextmenu="showContextMenu($event, item)"
                            @click="clickRow(item, $event)">
                            <td class="pr-0">
                                <v-simple-checkbox v-ripple
                                                   :value="isSelected"
                                                   class="pa-0 mr-0"
                                                   @click.stop="select(!isSelected)" />
                            </td>
                            <td class="font-weight-bold">{{ item.name }}</td>
                            <td class="">{{ item.notes || '--' }}</td>
                            <td class="">{{ getJobCount(item.id) }}</td>
                            <td class="">{{ formatDateTime(item.created_at) }}</td>
                            <td class="">{{ formatDateTime(item.updated_at) }}</td>
                            <td class="text-center">
                                <v-btn icon
                                       small
                                       color="primary"
                                       @click.stop="openActionsMenu($event, item)">
                                    <v-icon small>{{ mdiDotsVertical }}</v-icon>
                                </v-btn>
                            </td>
                        </tr>
                    </template>
                </v-data-table>
        </div>

        <!-- Context Menu -->
        <v-menu v-model="contextMenu.shown" :position-x="contextMenu.x" :position-y="contextMenu.y" absolute offset-y>
            <v-list>
                <v-list-item @click="viewCustomerDetails(contextMenu.item)">
                    <v-icon class="mr-1">{{ mdiEye }}</v-icon>
                    View Details
                </v-list-item>
                <v-list-item @click="editCustomer(contextMenu.item)">
                    <v-icon class="mr-1">{{ mdiPencil }}</v-icon>
                    Edit Customer
                </v-list-item>
                <v-divider />
                <v-list-item class="red--text" @click="deleteDialog = true">
                    <v-icon class="mr-1" color="error">{{ mdiDelete }}</v-icon>
                    Delete Customer
                </v-list-item>
            </v-list>
        </v-menu>

        <!-- Customer Details Dialog -->
        <v-dialog v-model="detailsDialog.show"
                  :max-width="800"
                  persistent
                  @keydown.esc="detailsDialog.show = false">
            <panel title="Customer Details"
                   :icon="mdiAccountMultiple"
                   card-class="customer-details-dialog"
                   :margin-bottom="false">
                <template #buttons>
                    <v-btn icon tile @click="detailsDialog.show = false">
                        <v-icon>{{ mdiCloseThick }}</v-icon>
                    </v-btn>
                </template>
                <v-card-text class="px-0">
                    <overlay-scrollbars style="height: 500px" class="px-6">
                        <v-row v-if="detailsDialog.item">
                            <v-col cols="6">
                                <div class="d-flex justify-space-between align-center mb-3">
                                    <h3>Customer Information</h3>
                                    <v-btn color="primary"
                                           small
                                           @click="editCustomerFromDetails">
                                        <v-icon left small>{{ mdiPencil }}</v-icon>
                                        Edit Customer
                                    </v-btn>
                                </div>
                                <v-divider class="mb-3" />
                                <v-row>
                                    <v-col cols="4"><strong>Name:</strong></v-col>
                                    <v-col cols="8">{{ detailsDialog.item.name }}</v-col>
                                </v-row>
                                <v-row>
                                    <v-col cols="4"><strong>Notes:</strong></v-col>
                                    <v-col cols="8">{{ detailsDialog.item.notes || '--' }}</v-col>
                                </v-row>
                                <v-row>
                                    <v-col cols="4"><strong>Created:</strong></v-col>
                                    <v-col cols="8">{{ formatDateTime(detailsDialog.item.created_at) }}</v-col>
                                </v-row>
                                <v-row>
                                    <v-col cols="4"><strong>Updated:</strong></v-col>
                                    <v-col cols="8">{{ formatDateTime(detailsDialog.item.updated_at) }}</v-col>
                                </v-row>
                            </v-col>
                            <v-col cols="6">
                                <div class="d-flex justify-space-between align-center mb-3">
                                    <h3>Associated Jobs ({{ customerJobs.length }})</h3>
                                </div>
                                <v-divider class="mb-3" />
                                <div v-if="customerJobs.length === 0" class="text-center text--secondary">
                                    No jobs for this customer yet
                                </div>
                                <div v-else>
                                    <div v-for="job in customerJobs" :key="job.id" class="job-item mb-3 pa-3" style="border: 1px solid #e0e0e0; border-radius: 8px;">
                                        <div class="d-flex justify-space-between align-center mb-2">
                                            <div class="font-weight-bold">{{ job.name }}</div>
                                            <v-chip :color="getJobStatusColor(job.status)"
                                                    text-color="white"
                                                    x-small>
                                                {{ job.status.replace('_', ' ') }}
                                            </v-chip>
                                        </div>
                                        <div class="text-caption text--secondary">
                                            {{ job.job_type }} • {{ job.priority }} priority
                                            <span v-if="job.due_date"> • Due: {{ formatDate(job.due_date) }}</span>
                                        </div>
                                    </div>
                                </div>
                            </v-col>
                        </v-row>
                    </overlay-scrollbars>
                </v-card-text>
            </panel>
        </v-dialog>

        <!-- Create/Edit Customer Dialog -->
        <v-dialog v-model="createCustomerDialog.show"
                  :max-width="500"
                  persistent
                  @keydown.esc="closeCreateCustomerDialog">
            <panel :title="createCustomerDialog.isEdit ? 'Edit Customer' : 'Create New Customer'"
                   :icon="createCustomerDialog.isEdit ? mdiPencil : mdiAccountPlus"
                   card-class="create-customer-dialog"
                   :margin-bottom="false">
                <template #buttons>
                    <v-btn icon tile @click="closeCreateCustomerDialog">
                        <v-icon>{{ mdiCloseThick }}</v-icon>
                    </v-btn>
                </template>
                <v-card-text>
                    <v-form ref="customerForm" v-model="createCustomerDialog.valid">
                        <v-row>
                            <v-col cols="12">
                                <v-text-field v-model="createCustomerDialog.form.name"
                                              label="Customer Name"
                                              :rules="[v => !!v || 'Customer name is required']"
                                              outlined
                                              dense
                                              required />
                            </v-col>
                            <v-col cols="12">
                                <v-textarea v-model="createCustomerDialog.form.notes"
                                            label="Notes"
                                            outlined
                                            dense
                                            rows="4" />
                            </v-col>
                        </v-row>
                    </v-form>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn color="" text @click="closeCreateCustomerDialog">Cancel</v-btn>
                    <v-btn color="success"
                           :loading="createCustomerDialog.loading"
                           :disabled="!createCustomerDialog.valid"
                           @click="saveCustomer">
                        {{ createCustomerDialog.isEdit ? 'Update' : 'Create' }}
                    </v-btn>
                </v-card-actions>
            </panel>
        </v-dialog>

        <!-- Delete Confirmation Dialogs -->
        <v-dialog v-model="deleteDialog" max-width="400">
            <panel title="Delete Customer" card-class="delete-customer-dialog" :margin-bottom="false">
                <template #buttons>
                    <v-btn icon tile @click="deleteDialog = false">
                        <v-icon>{{ mdiCloseThick }}</v-icon>
                    </v-btn>
                </template>
                <v-card-text>
                    <p class="mb-2">Are you sure you want to delete this customer?</p>
                    <div v-if="getJobCount(contextMenu.item.id) > 0" class="red--text text-caption">
                        <strong>Warning:</strong> This customer has {{ getJobCount(contextMenu.item.id) }} associated job(s).
                        Can not perform the delete action.
                    </div>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn color="" text @click="deleteDialog = false">Cancel</v-btn>
                    <v-btn color="error"
                           text
                           :disabled="getJobCount(contextMenu.item.id) > 0"
                           @click="deleteCustomer">
                        Delete
                    </v-btn>                </v-card-actions>
            </panel>
        </v-dialog>

        <v-dialog v-model="deleteSelectedDialog" max-width="400">
            <panel title="Delete Customers" card-class="delete-selected-dialog" :margin-bottom="false">
                <template #buttons>
                    <v-btn icon tile @click="deleteSelectedDialog = false">
                        <v-icon>{{ mdiCloseThick }}</v-icon>
                    </v-btn>
                </template>
                <v-card-text>
                    <p class="mb-0">Are you sure you want to delete {{ selectedCustomers.length }} customer(s)?</p>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn color="" text @click="deleteSelectedDialog = false">Cancel</v-btn>
                    <v-btn color="error" text @click="deleteSelectedCustomers">Delete</v-btn>
                </v-card-actions>
            </panel>
        </v-dialog>
    </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import Panel from '@/components/ui/Panel.vue'
import {
    mdiAccountMultiple,
    mdiMagnify,
    mdiDelete,
    mdiRefresh,
    mdiCog,
    mdiEye,
    mdiPencil,
    mdiCloseThick,
    mdiAccountPlus,
    mdiDotsVertical,
} from '@mdi/js'

interface FleetCustomer {
    id: string
    name: string
    notes?: string
    created_at: string
    updated_at: string
}

interface FleetJob {
    id: string
    customer_id: string
    name: string
    job_type: string
    priority: string
    status: string
    due_date?: string
    created_at: string
}

@Component({
    components: { Panel },
})
export default class CustomerPanel extends Mixins(BaseMixin) {
    mdiAccountMultiple = mdiAccountMultiple
    mdiMagnify = mdiMagnify
    mdiDelete = mdiDelete
    mdiRefresh = mdiRefresh
    mdiCog = mdiCog
    mdiEye = mdiEye
    mdiPencil = mdiPencil
    mdiCloseThick = mdiCloseThick
    mdiAccountPlus = mdiAccountPlus
    mdiDotsVertical = mdiDotsVertical

    private search = ''
    private sortBy = 'name'
    private sortDesc = false
    private options = {}

    private selectedCustomers: FleetCustomer[] = []
    private customerJobs: FleetJob[] = []

    private contextMenu = {
        shown: false,
        x: 0,
        y: 0,
        item: {} as FleetCustomer,
    }

    private detailsDialog = {
        show: false,
        item: null as FleetCustomer | null,
    }

    private createCustomerDialog = {
        show: false,
        isEdit: false,
        valid: false,
        loading: false,
        form: {
            id: '',
            name: '',
            notes: '',
        }
    }

    private deleteDialog = false
    private deleteSelectedDialog = false

    get customers() {
        return this.$store.state.fleet?.jobs?.customers ?? []
    }

    get jobs() {
        return this.$store.state.fleet?.jobs?.jobs ?? []
    }

    get headers() {
        const headers = [
            { text: 'Customer Name', value: 'name', align: 'left', configable: false, visible: true, sortable: true },
            { text: 'Notes', value: 'notes', align: 'left', configable: true, visible: true, sortable: true },
            { text: 'Jobs Count', value: 'jobs_count', align: 'left', configable: true, visible: true, sortable: false },
            { text: 'Created', value: 'created_at', align: 'left', configable: true, visible: true, sortable: true },
            { text: 'Updated', value: 'updated_at', align: 'left', configable: true, visible: true, sortable: true },
            { text: 'Actions', value: 'actions', align: 'center', configable: false, visible: true, sortable: false },
        ]

        headers.forEach((header) => {
            if (header.visible && this.hideColumns.includes(header.value)) {
                header.visible = false
            } else if (!header.visible && !this.hideColumns.includes(header.value)) {
                header.visible = true
            }
        })

        return headers
    }

    get configHeaders() {
        return this.headers.filter((header: any) => header.configable === true)
    }

    get filteredHeaders() {
        return this.headers.filter((header: any) => header.visible === true)
    }

    get countPerPage() {
        return this.$store.state.gui.view.history?.countPerPage || 25
    }

    set countPerPage(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'view.history.countPerPage', value: newVal })
    }

    get hideColumns() {
        return this.$store.state.gui.view.history?.hideColumns || []
    }

    set hideColumns(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'view.history.hideColumns', value: newVal })
    }

    get loadings() {
        return this.$store.state.socket?.loadings ?? []
    }

    async mounted() {
        await this.refreshCustomers()
        await this.loadJobs()
    }

    async refreshCustomers() {
        this.$store.dispatch('socket/addLoading', { name: 'customersRefresh' })
        try {
            await this.$store.dispatch('fleet/jobs/loadCustomers')
        } catch (error) {
            console.error('Failed to load customers:', error)
            this.$toast.error('Failed to load customers')
        } finally {
            this.$store.dispatch('socket/removeLoading', { name: 'customersRefresh' })
        }
    }

    async loadJobs() {
        try {
            await this.$store.dispatch('fleet/jobs/loadJobs')
        } catch (error) {
            console.error('Failed to load jobs:', error)
        }
    }

    getJobCount(customerId: string): number {
        return this.jobs.filter((job: FleetJob) => job.customer_id === customerId).length
    }

    getJobStatusColor(status: string) {
        const colors = {
            pending: 'orange',
            in_progress: 'blue',
            complete: 'green',
            cancelled: 'red',
        }
        return colors[status] || 'grey'
    }

    formatDateTime(dateString: string) {
        if (!dateString) return null
        return new Date(dateString).toLocaleString()
    }

    formatDate(dateString: string) {
        if (!dateString) return null
        return new Date(dateString).toLocaleDateString()
    }

    clickRow(item: FleetCustomer, event?: Event) {
        // Don't open details if the click was on an interactive element
        if (event && event.target) {
            const target = event.target as HTMLElement
            const isInteractiveElement = target.closest('.v-btn') ||
                                       target.closest('.v-menu') ||
                                       target.closest('input[type="checkbox"]')

            if (isInteractiveElement) {
                return
            }
        }

        this.viewCustomerDetails(item)
    }

    async viewCustomerDetails(item: FleetCustomer) {
        this.detailsDialog.item = item
        this.detailsDialog.show = true

        // Load jobs for this customer
        this.customerJobs = this.jobs.filter((job: FleetJob) => job.customer_id === item.id)
    }

    showContextMenu(e: any, item: FleetCustomer) {
        if (!this.contextMenu.shown) {
            e?.preventDefault()

            let x, y

            if (e.type === 'click') {
                const rect = e.target.getBoundingClientRect()
                x = rect.left + rect.width / 2
                y = rect.bottom + 5
            } else {
                x = e?.clientX || e?.pageX || window.screenX / 2
                y = e?.clientY || e?.pageY || window.screenY / 2
            }

            this.contextMenu.shown = true
            this.contextMenu.x = x
            this.contextMenu.y = y
            this.contextMenu.item = item

            this.$nextTick(() => {
                this.contextMenu.shown = true
            })
        }
    }

    openActionsMenu(event: Event, item: FleetCustomer) {
        event.stopPropagation()
        this.showContextMenu(event, item)
    }

    editCustomer(item: FleetCustomer) {
        this.createCustomerDialog.isEdit = true
        this.createCustomerDialog.form = {
            id: item.id,
            name: item.name,
            notes: item.notes || '',
        }
        this.createCustomerDialog.show = true
    }

    editCustomerFromDetails() {
        if (this.detailsDialog.item) {
            this.editCustomer(this.detailsDialog.item)
            this.detailsDialog.show = false
        }
    }

    openCreateCustomerDialog() {
        this.createCustomerDialog.isEdit = false
        this.createCustomerDialog.show = true
    }

    async saveCustomer() {
        if (!this.createCustomerDialog.valid) return

        this.createCustomerDialog.loading = true
        try {
            const formData = { ...this.createCustomerDialog.form }

            if (this.createCustomerDialog.isEdit) {
                const customerId = formData.id
                delete formData.id

                await this.$store.dispatch('fleet/jobs/updateCustomer', {
                    customerId: customerId,
                    customerData: formData
                })
                this.$toast.success('Customer updated successfully')
            } else {
                delete formData.id

                await this.$store.dispatch('fleet/jobs/createCustomer', formData)
                this.$toast.success('Customer created successfully')
            }

            await this.refreshCustomers()
            this.closeCreateCustomerDialog()
        } catch (error) {
            console.error('Failed to save customer:', error)
            this.$toast.error(`Failed to ${this.createCustomerDialog.isEdit ? 'update' : 'create'} customer`)
        } finally {
            this.createCustomerDialog.loading = false
        }
    }

    async deleteCustomer() {
        try {
            await this.$store.dispatch('fleet/jobs/deleteCustomer', this.contextMenu.item.id)
            this.$toast.success('Customer deleted successfully')
            await this.refreshCustomers()
            this.deleteDialog = false
        } catch (error) {
            console.error('Failed to delete customer:', error)
            this.$toast.error('Failed to delete customer')
        }
    }

    async deleteSelectedCustomers() {
        this.$toast.info('Batch delete will be implemented in phase 2')
        this.deleteSelectedDialog = false
    }

    closeCreateCustomerDialog() {
        this.createCustomerDialog.show = false
        this.createCustomerDialog.isEdit = false
        this.createCustomerDialog.form = {
            id: '',
            name: '',
            notes: '',
        }
    }

    sortCustomers(items: any[], sortBy: string[], sortDesc: boolean[]) {
        const sortByClean = sortBy.length ? sortBy[0] : 'name'
        const sortDescClean = sortDesc[0]

        if (items !== undefined) {
            items.sort(function (a, b) {
                if (a[sortByClean] === b[sortByClean]) return 0
                if (a[sortByClean] === null || a[sortByClean] === undefined) return -1
                if (b[sortByClean] === null || b[sortByClean] === undefined) return 1

                if (a[sortByClean].constructor === String && b[sortByClean].constructor === String) {
                    return a[sortByClean].localeCompare(b[sortByClean], undefined, { sensivity: 'base' })
                }

                return a[sortByClean] - b[sortByClean]
            })

            if (sortDescClean) items.reverse()
        }

        return items
    }

    advancedSearch(value: string, search: string) {
        return value != null && search != null && value.toString().toLowerCase().indexOf(search.toLowerCase()) !== -1
    }

    changeColumnVisible(name: string) {
        if (this.headers.filter((header) => header.value === name).length) {
            const value = this.headers.filter((header) => header.value === name)[0].visible
            // Implement column visibility toggle if needed
        }
    }
}
</script>

<style scoped>
    ::v-deep .customer-list-table th {
        white-space: nowrap;
    }

        ::v-deep .customer-list-table th.text-start {
            padding-right: 0 !important;
        }

    .job-item {
        transition: box-shadow 0.2s ease;
    }

        .job-item:hover {
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
</style>
