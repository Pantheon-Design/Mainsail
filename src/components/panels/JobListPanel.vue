<template>
    <div>
        <panel
            :icon="mdiBriefcaseOutline"
            title="Job Management"
            card-class="job-list-panel">
            <v-card-text>
                <v-row>
                    <v-col class="col-4 d-flex align-center">
                        <v-text-field
                            v-model="search"
                            :append-icon="mdiMagnify"
                            label="Search Jobs"
                            single-line
                            outlined
                            clearable
                            hide-details
                            dense />
                    </v-col>
                    <v-col class="col-3 d-flex align-center">
                        <v-select
                            v-model="statusFilter"
                            :items="statusOptions"
                            label="Filter by Status"
                            outlined
                            dense
                            clearable
                            hide-details
                            multiple
                            chips
                            small-chips />
                    </v-col>
                    <v-col class="col-5 d-flex align-center justify-end">
                        <template v-if="selectedJobs.length">
                            <v-btn
                                title="Delete Selected"
                                color="error"
                                class="px-2 minwidth-0 ml-3"
                                @click="deleteSelectedDialog = true">
                                <v-icon>{{ mdiDelete }}</v-icon>
                            </v-btn>
                        </template>
                        <v-btn
                            color="success"
                            class="ml-3"
                            @click="openCreateCustomerDialog">
                            <v-icon left>{{ mdiAccountPlus }}</v-icon>
                            Customer
                        </v-btn>
                        <v-btn
                            color="primary"
                            class="ml-3"
                            @click="openCreateJobDialog">
                            <v-icon left>{{ mdiPlus }}</v-icon>
                            New Job
                        </v-btn>
                        <v-btn
                            :loading="loadings.includes('jobsRefresh')"
                            class="px-2 minwidth-0 ml-3"
                            @click="refreshJobs">
                            <v-icon>{{ mdiRefresh }}</v-icon>
                        </v-btn>
                        <v-menu :offset-y="true" :close-on-content-click="false">
                            <template #activator="{ on, attrs }">
                                <v-btn class="px-2 minwidth-0 ml-3" v-bind="attrs" v-on="on">
                                    <v-icon>{{ mdiCog }}</v-icon>
                                </v-btn>
                            </template>
                            <v-list>
                                <v-list-item v-for="header of configHeaders" :key="header.value" class="minHeight36">
                                    <v-checkbox
                                        v-model="header.visible"
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
            <v-data-table
                v-model="selectedJobs"
                :items="filteredJobs"
                class="job-list-table"
                :headers="filteredHeaders"
                :options="options"
                :custom-sort="sortJobs"
                :sort-by.sync="sortBy"
                :sort-desc.sync="sortDesc"
                :items-per-page.sync="countPerPage"
                :footer-props="{
                    itemsPerPageText: 'Jobs',
                    itemsPerPageAllText: 'All Jobs',
                    itemsPerPageOptions: [10, 25, 50, 100, -1],
                }"
                item-key="id"
                :search="search"
                :custom-filter="advancedSearch"
                mobile-breakpoint="0"
                show-select>
                <template slot="no-data">
                    <div class="text-center">No jobs found</div>
                </template>

                <template #item="{ index, item, isSelected, select }">
                    <tr
                        :key="`${index} ${item.name}`"
                        v-longpress:600="(e) => showContextMenu(e, item)"
                        :class="'file-list-cursor user-select-none ' + getJobRowClass(item)"
                        @contextmenu="showContextMenu($event, item)"
                        @click="clickRow(item)">
                        <td class="pr-0">
                            <v-simple-checkbox
                                v-ripple
                                :value="isSelected"
                                class="pa-0 mr-0"
                                @click.stop="select(!isSelected)" />
                        </td>
                        <td class="px-2 text-center" style="width: 120px">
                            <v-tooltip top>
                                <template #activator="{ on, attrs }">
                                    <v-chip
                                        :color="getStatusColor(item.status)"
                                        :text-color="getStatusTextColor(item.status)"
                                        small
                                        label
                                        v-bind="attrs"
                                        v-on="on">
                                        <v-icon left small>{{ getStatusIcon(item.status) }}</v-icon>
                                        {{ formatStatusDisplay(item.status) }}
                                    </v-chip>
                                </template>
                                <span>{{ item.status.replace('_', ' ') }}</span>
                            </v-tooltip>
                        </td>
                        <td class="">{{ item.name }}</td>
                        <td class="">{{ getCustomerName(item.customer_id) }}</td>
                        <td class="text-center">
                            <v-chip
                                :color="item.job_type === 'production' ? 'orange' : 'blue'"
                                text-color="white"
                                x-small
                                label>
                                {{ item.job_type }}
                            </v-chip>
                        </td>
                        <td class="text-center">
                            <v-chip
                                :color="getPriorityColor(item.priority)"
                                text-color="white"
                                x-small>
                                {{ item.priority }}
                            </v-chip>
                        </td>
                        <td class="">{{ item.operator_name || '--' }}</td>
                        <td class="" :class="getDueDateClass(item.due_date)">
                            {{ formatDateTime(item.due_date) || '--' }}
                        </td>
                        <td class="">{{ formatDateTime(item.created_at) }}</td>
                        <td class="">{{ truncateText(item.description, 50) || '--' }}</td>
                        <td class="text-center">
                            <v-btn
                                icon
                                small
                                color="primary"
                                @click.stop="viewJobDetails(item)">
                                <v-icon small>{{ mdiEye }}</v-icon>
                            </v-btn>
                        </td>
                    </tr>
                </template>
            </v-data-table>
        </panel>

        <!-- Context Menu -->
        <v-menu v-model="contextMenu.shown" :position-x="contextMenu.x" :position-y="contextMenu.y" absolute offset-y>
            <v-list>
                <v-list-item @click="viewJobDetails(contextMenu.item)">
                    <v-icon class="mr-1">{{ mdiEye }}</v-icon>
                    View Details
                </v-list-item>
                <v-list-item @click="editJob(contextMenu.item)">
                    <v-icon class="mr-1">{{ mdiPencil }}</v-icon>
                    Edit Job
                </v-list-item>
                <v-divider />
                <v-list-item 
                    @click="updateJobStatus(contextMenu.item, 'in_progress')" 
                    v-if="contextMenu.item.status === 'pending'">
                    <v-icon class="mr-1">{{ mdiPlay }}</v-icon>
                    Start Job
                </v-list-item>
                <v-list-item 
                    @click="updateJobStatus(contextMenu.item, 'complete')" 
                    v-if="contextMenu.item.status === 'in_progress'">
                    <v-icon class="mr-1">{{ mdiCheck }}</v-icon>
                    Mark Complete
                </v-list-item>
                <v-list-item 
                    @click="updateJobStatus(contextMenu.item, 'cancelled')" 
                    v-if="['pending', 'in_progress'].includes(contextMenu.item.status)">
                    <v-icon class="mr-1">{{ mdiCancel }}</v-icon>
                    Cancel Job
                </v-list-item>
                <v-divider />
                <v-list-item class="red--text" @click="deleteDialog = true">
                    <v-icon class="mr-1" color="error">{{ mdiDelete }}</v-icon>
                    Delete Job
                </v-list-item>
            </v-list>
        </v-menu>

        <!-- Job Details Dialog -->
        <v-dialog
            v-model="detailsDialog.show"
            :max-width="1000"
            persistent
            @keydown.esc="detailsDialog.show = false">
            <panel
                title="Job Details"
                :icon="mdiBriefcaseOutline"
                card-class="job-details-dialog"
                :margin-bottom="false">
                <template #buttons>
                    <v-btn icon tile @click="detailsDialog.show = false">
                        <v-icon>{{ mdiCloseThick }}</v-icon>
                    </v-btn>
                </template>
                <v-card-text class="px-0">
                    <overlay-scrollbars style="height: 600px" class="px-6">
                        <v-row v-if="detailsDialog.item">
                            <v-col cols="6">
                                <h3>Job Information</h3>
                                <v-divider class="mb-3" />
                                <v-row>
                                    <v-col cols="4"><strong>Name:</strong></v-col>
                                    <v-col cols="8">{{ detailsDialog.item.name }}</v-col>
                                </v-row>
                                <v-row>
                                    <v-col cols="4"><strong>Customer:</strong></v-col>
                                    <v-col cols="8">{{ getCustomerName(detailsDialog.item.customer_id) }}</v-col>
                                </v-row>
                                <v-row>
                                    <v-col cols="4"><strong>Type:</strong></v-col>
                                    <v-col cols="8">
                                        <v-chip
                                            :color="detailsDialog.item.job_type === 'production' ? 'orange' : 'blue'"
                                            text-color="white"
                                            small>
                                            {{ detailsDialog.item.job_type }}
                                        </v-chip>
                                    </v-col>
                                </v-row>
                                <v-row>
                                    <v-col cols="4"><strong>Priority:</strong></v-col>
                                    <v-col cols="8">
                                        <v-chip
                                            :color="getPriorityColor(detailsDialog.item.priority)"
                                            text-color="white"
                                            small>
                                            {{ detailsDialog.item.priority }}
                                        </v-chip>
                                    </v-col>
                                </v-row>
                                <v-row>
                                    <v-col cols="4"><strong>Status:</strong></v-col>
                                    <v-col cols="8">
                                        <v-chip
                                            :color="getStatusColor(detailsDialog.item.status)"
                                            :text-color="getStatusTextColor(detailsDialog.item.status)"
                                            small>
                                            <v-icon left small>{{ getStatusIcon(detailsDialog.item.status) }}</v-icon>
                                            {{ detailsDialog.item.status }}
                                        </v-chip>
                                    </v-col>
                                </v-row>
                                <v-row>
                                    <v-col cols="4"><strong>Operator:</strong></v-col>
                                    <v-col cols="8">{{ detailsDialog.item.operator_name || '--' }}</v-col>
                                </v-row>
                                <v-row>
                                    <v-col cols="4"><strong>Due Date:</strong></v-col>
                                    <v-col cols="8" :class="getDueDateClass(detailsDialog.item.due_date)">
                                        {{ formatDateTime(detailsDialog.item.due_date) || '--' }}
                                    </v-col>
                                </v-row>
                                <v-row>
                                    <v-col cols="4"><strong>Created:</strong></v-col>
                                    <v-col cols="8">{{ formatDateTime(detailsDialog.item.created_at) }}</v-col>
                                </v-row>
                                <v-row v-if="detailsDialog.item.description">
                                    <v-col cols="12">
                                        <strong>Description:</strong><br>
                                        {{ detailsDialog.item.description }}
                                    </v-col>
                                </v-row>
                            </v-col>
                            <v-col cols="6">
                                <div class="d-flex justify-space-between align-center mb-3">
                                    <h3>GCode Files</h3>
                                    <v-btn
                                        color="primary"
                                        small
                                        @click="openAddGcodeDialog">
                                        <v-icon left small>{{ mdiPlus }}</v-icon>
                                        Add GCode
                                    </v-btn>
                                </div>
                                <v-divider class="mb-3" />
                                <div v-if="jobGcodes.length === 0" class="text-center text--secondary">
                                    No GCode files added yet
                                </div>
                                <v-list v-else dense>
                                    <v-list-item v-for="gcode in jobGcodes" :key="gcode.id" class="px-0">
                                        <v-list-item-content>
                                            <v-list-item-title class="font-weight-bold">
                                                {{ gcode.gcode_filename }}
                                            </v-list-item-title>
                                            <v-list-item-subtitle>
                                                <v-chip x-small color="blue" text-color="white" class="mr-1">
                                                    {{ gcode.filament_type }}
                                                </v-chip>
                                                <v-chip x-small color="orange" text-color="white" class="mr-1">
                                                    {{ gcode.required_runs }} runs
                                                </v-chip>
                                                <v-chip x-small color="green" text-color="white">
                                                    {{ gcode.preferred_printer }}
                                                </v-chip>
                                            </v-list-item-subtitle>
                                        </v-list-item-content>
                                        <v-list-item-action>
                                            <v-btn icon small @click="viewGcodeRuns(gcode)">
                                                <v-icon small>{{ mdiPlay }}</v-icon>
                                            </v-btn>
                                        </v-list-item-action>
                                    </v-list-item>
                                </v-list>
                            </v-col>
                        </v-row>
                    </overlay-scrollbars>
                </v-card-text>
            </panel>
        </v-dialog>

        <!-- Create/Edit Job Dialog -->
        <v-dialog
            v-model="createJobDialog.show"
            :max-width="700"
            persistent
            @keydown.esc="closeCreateJobDialog">
            <panel
                :title="createJobDialog.isEdit ? 'Edit Job' : 'Create New Job'"
                :icon="createJobDialog.isEdit ? mdiPencil : mdiPlus"
                card-class="create-job-dialog"
                :margin-bottom="false">
                <template #buttons>
                    <v-btn icon tile @click="closeCreateJobDialog">
                        <v-icon>{{ mdiCloseThick }}</v-icon>
                    </v-btn>
                </template>
                <v-card-text>
                    <v-form ref="jobForm" v-model="createJobDialog.valid">
                        <v-row>
                            <v-col cols="12">
                                <v-text-field
                                    v-model="createJobDialog.form.name"
                                    label="Job Name"
                                    :rules="[v => !!v || 'Job name is required']"
                                    outlined
                                    dense
                                    required />
                            </v-col>
                            <v-col cols="12">
                                <v-select
                                    v-model="createJobDialog.form.customer_id"
                                    :items="customerOptions"
                                    item-text="name"
                                    item-value="id"
                                    label="Customer"
                                    :rules="[v => !!v || 'Customer is required']"
                                    outlined
                                    dense
                                    required />
                            </v-col>
                            <v-col cols="6">
                                <v-select
                                    v-model="createJobDialog.form.job_type"
                                    :items="jobTypeOptions"
                                    label="Job Type"
                                    :rules="[v => !!v || 'Job type is required']"
                                    outlined
                                    dense
                                    required />
                            </v-col>
                            <v-col cols="6">
                                <v-text-field
                                    v-model.number="createJobDialog.form.priority"
                                    label="Priority"
                                    type="number"
                                    outlined
                                    dense />
                            </v-col>
                            <v-col cols="12">
                                <v-text-field
                                    v-model="createJobDialog.form.operator_name"
                                    label="Operator"
                                    outlined
                                    dense />
                            </v-col>
                            <v-col cols="12">
                                <v-textarea
                                    v-model="createJobDialog.form.description"
                                    label="Description"
                                    outlined
                                    dense
                                    rows="3" />
                            </v-col>
                            <v-col cols="12">
                                <v-menu
                                    v-model="dueDateMenu"
                                    :close-on-content-click="false"
                                    :nudge-right="40"
                                    transition="scale-transition"
                                    offset-y
                                    min-width="auto">
                                    <template v-slot:activator="{ on, attrs }">
                                        <v-text-field
                                            v-model="createJobDialog.form.due_date"
                                            label="Due Date"
                                            :prepend-icon="mdiCalendar"
                                            readonly
                                            outlined
                                            dense
                                            clearable
                                            v-bind="attrs"
                                            v-on="on" />
                                    </template>
                                    <v-date-picker
                                        v-model="createJobDialog.form.due_date"
                                        @input="dueDateMenu = false" />
                                </v-menu>
                            </v-col>
                        </v-row>
                    </v-form>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn color="" text @click="closeCreateJobDialog">Cancel</v-btn>
                    <v-btn 
                        color="primary" 
                        :loading="createJobDialog.loading"
                        :disabled="!createJobDialog.valid"
                        @click="saveJob">
                        {{ createJobDialog.isEdit ? 'Update' : 'Create' }}
                    </v-btn>
                </v-card-actions>
            </panel>
        </v-dialog>

        <!-- Create Customer Dialog -->
        <v-dialog
            v-model="createCustomerDialog.show"
            :max-width="500"
            persistent
            @keydown.esc="closeCreateCustomerDialog">
            <panel
                title="Create Customer"
                :icon="mdiAccountPlus"
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
                                <v-text-field
                                    v-model="createCustomerDialog.form.name"
                                    label="Customer Name"
                                    :rules="[v => !!v || 'Customer name is required']"
                                    outlined
                                    dense
                                    required />
                            </v-col>
                            <v-col cols="12">
                                <v-textarea
                                    v-model="createCustomerDialog.form.notes"
                                    label="Notes"
                                    outlined
                                    dense
                                    rows="3" />
                            </v-col>
                        </v-row>
                    </v-form>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn color="" text @click="closeCreateCustomerDialog">Cancel</v-btn>
                    <v-btn 
                        color="success" 
                        :loading="createCustomerDialog.loading"
                        :disabled="!createCustomerDialog.valid"
                        @click="saveCustomer">
                        Create
                    </v-btn>
                </v-card-actions>
            </panel>
        </v-dialog>

        <!-- Add GCode Dialog -->
        <v-dialog
            v-model="addGcodeDialog.show"
            :max-width="500"
            persistent
            @keydown.esc="closeAddGcodeDialog">
            <panel
                title="Add GCode File"
                :icon="mdiCodeBraces"
                card-class="add-gcode-dialog"
                :margin-bottom="false">
                <template #buttons>
                    <v-btn icon tile @click="closeAddGcodeDialog">
                        <v-icon>{{ mdiCloseThick }}</v-icon>
                    </v-btn>
                </template>
                <v-card-text>
                    <v-form ref="gcodeForm" v-model="addGcodeDialog.valid">
                        <v-row>
                            <v-col cols="12">
                                <v-text-field
                                    v-model="addGcodeDialog.form.gcode_filename"
                                    label="GCode Filename"
                                    :rules="[v => !!v || 'Filename is required']"
                                    outlined
                                    dense
                                    required />
                            </v-col>
                            <v-col cols="6">
                                <v-text-field
                                    v-model.number="addGcodeDialog.form.required_runs"
                                    label="Required Runs"
                                    type="number"
                                    :rules="[v => v > 0 || 'Must be greater than 0']"
                                    outlined
                                    dense
                                    required />
                            </v-col>
                            <v-col cols="6">
                                <v-select
                                    v-model="addGcodeDialog.form.preferred_printer"
                                    :items="printerOptions"
                                    label="Preferred Printer"
                                    :rules="[v => !!v || 'Printer preference is required']"
                                    outlined
                                    dense
                                    required />
                            </v-col>
                            <v-col cols="12">
                                <v-text-field
                                    v-model="addGcodeDialog.form.filament_type"
                                    label="Filament Type (e.g., PLA, PETG, ABS)"
                                    :rules="[v => !!v || 'Filament type is required']"
                                    outlined
                                    dense
                                    required />
                            </v-col>
                        </v-row>
                    </v-form>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn color="" text @click="closeAddGcodeDialog">Cancel</v-btn>
                    <v-btn 
                        color="primary" 
                        :loading="addGcodeDialog.loading"
                        :disabled="!addGcodeDialog.valid"
                        @click="saveGcode">
                        Add GCode
                    </v-btn>
                </v-card-actions>
            </panel>
        </v-dialog>

        <!-- Delete Confirmation Dialogs -->
        <v-dialog v-model="deleteDialog" max-width="400">
            <panel title="Delete Job" card-class="delete-job-dialog" :margin-bottom="false">
                <template #buttons>
                    <v-btn icon tile @click="deleteDialog = false">
                        <v-icon>{{ mdiCloseThick }}</v-icon>
                    </v-btn>
                </template>
                <v-card-text>
                    <p class="mb-0">Are you sure you want to delete this job?</p>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn color="" text @click="deleteDialog = false">Cancel</v-btn>
                    <v-btn color="error" text @click="deleteJob">Delete</v-btn>
                </v-card-actions>
            </panel>
        </v-dialog>

        <v-dialog v-model="deleteSelectedDialog" max-width="400">
            <panel title="Delete Jobs" card-class="delete-selected-dialog" :margin-bottom="false">
                <template #buttons>
                    <v-btn icon tile @click="deleteSelectedDialog = false">
                        <v-icon>{{ mdiCloseThick }}</v-icon>
                    </v-btn>
                </template>
                <v-card-text>
                    <p class="mb-0">Are you sure you want to delete {{ selectedJobs.length }} job(s)?</p>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn color="" text @click="deleteSelectedDialog = false">Cancel</v-btn>
                    <v-btn color="error" text @click="deleteSelectedJobs">Delete</v-btn>
                </v-card-actions>
            </panel>
        </v-dialog>
    </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import Panel from '@/components/ui/Panel.vue'
import { caseInsensitiveSort } from '@/plugins/helpers'
import {
    mdiBriefcaseOutline,
    mdiMagnify,
    mdiDelete,
    mdiPlus,
    mdiRefresh,
    mdiCog,
    mdiEye,
    mdiPencil,
    mdiPlay,
    mdiCheck,
    mdiCancel,
    mdiCloseThick,
    mdiCalendar,
    mdiCodeBraces,
    mdiAccountPlus,
    mdiProgressClock,
    mdiCheckboxMarkedCircleOutline,
    mdiCloseCircleOutline,
    mdiAlertOutline,
} from '@mdi/js'

interface FleetJob {
    id: string
    customer_id: string
    name: string
    operator_name?: string
    description?: string
    job_type: string
    priority: number
    status: string
    ready_to_ship: boolean
    shipped: boolean
    fulfilled_date?: string
    due_date?: string
    finished_date?: string
    created_at: string
    updated_at: string
}

interface FleetCustomer {
    id: string
    name: string
    notes?: string
    created_at: string
    updated_at: string
}

interface FleetJobGcode {
    id: string
    job_id: string
    gcode_filename: string
    required_runs: number
    preferred_printer: string
    filament_type: string
    created_at: string
}

@Component({
    components: { Panel },
})
export default class JobListPanel extends Mixins(BaseMixin) {
    mdiBriefcaseOutline = mdiBriefcaseOutline
    mdiMagnify = mdiMagnify
    mdiDelete = mdiDelete
    mdiPlus = mdiPlus
    mdiRefresh = mdiRefresh
    mdiCog = mdiCog
    mdiEye = mdiEye
    mdiPencil = mdiPencil
    mdiPlay = mdiPlay
    mdiCheck = mdiCheck
    mdiCancel = mdiCancel
    mdiCloseThick = mdiCloseThick
    mdiCalendar = mdiCalendar
    mdiCodeBraces = mdiCodeBraces
    mdiAccountPlus = mdiAccountPlus
    mdiProgressClock = mdiProgressClock
    mdiCheckboxMarkedCircleOutline = mdiCheckboxMarkedCircleOutline
    mdiCloseCircleOutline = mdiCloseCircleOutline
    mdiAlertOutline = mdiAlertOutline

    private search = ''
    private sortBy = 'created_at'
    private sortDesc = true
    private options = {}
    private statusFilter = []
    private dueDateMenu = false

    private selectedJobs: FleetJob[] = []
    private jobGcodes: FleetJobGcode[] = []

    private contextMenu = {
        shown: false,
        x: 0,
        y: 0,
        item: {} as FleetJob,
    }

    private detailsDialog = {
        show: false,
        item: null as FleetJob | null,
    }

    private createJobDialog = {
        show: false,
        isEdit: false,
        valid: false,
        loading: false,
        form: {
            id: '',
            name: '',
            customer_id: '',
            job_type: 'sample',
            priority: 0,
            operator_name: '',
            description: '',
            due_date: '',
        }
    }

    private createCustomerDialog = {
        show: false,
        valid: false,
        loading: false,
        form: {
            name: '',
            notes: '',
        }
    }

    private addGcodeDialog = {
        show: false,
        valid: false,
        loading: false,
        form: {
            gcode_filename: '',
            required_runs: 1,
            preferred_printer: 'any',
            filament_type: '',
        }
    }

    private deleteDialog = false
    private deleteSelectedDialog = false

    get jobs() {
        return this.$store.state.fleet?.jobs?.jobs ?? []
    }

    get customers() {
        return this.$store.state.fleet?.jobs?.customers ?? []
    }

    get customerOptions() {
        return this.customers
    }

    get headers() {
        const headers = [
            { text: 'Status', value: 'status', align: 'left', configable: false, visible: true, sortable: true },
            { text: 'Job Name', value: 'name', align: 'left', configable: false, visible: true, sortable: true },
            { text: 'Customer', value: 'customer_id', align: 'left', configable: true, visible: true, sortable: true },
            { text: 'Type', value: 'job_type', align: 'center', configable: true, visible: true, sortable: true },
            { text: 'Priority', value: 'priority', align: 'center', configable: true, visible: true, sortable: true },
            { text: 'Operator', value: 'operator_name', align: 'left', configable: true, visible: true, sortable: true },
            { text: 'Due Date', value: 'due_date', align: 'left', configable: true, visible: true, sortable: true },
            { text: 'Created', value: 'created_at', align: 'left', configable: true, visible: true, sortable: true },
            { text: 'Description', value: 'description', align: 'left', configable: true, visible: true, sortable: false },
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

    get filteredJobs() {
        if (this.statusFilter.length === 0) return this.jobs
        return this.jobs.filter((job: FleetJob) => this.statusFilter.includes(job.status))
    }

    get statusOptions() {
        return [
            { text: 'Pending', value: 'pending' },
            { text: 'In Progress', value: 'in_progress' },
            { text: 'Complete', value: 'complete' },
            { text: 'Cancelled', value: 'cancelled' },
        ]
    }

    get jobTypeOptions() {
        return [
            { text: 'Sample', value: 'sample' },
            { text: 'Production', value: 'production' },
        ]
    }

    get printerOptions() {
        return [
            { text: 'Any Printer', value: 'any' },
            { text: 'HS-Pro Only', value: 'HS-Pro' },
        ]
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
        await this.refreshJobs()
        await this.loadCustomers()
    }

    async refreshJobs() {
        this.$store.dispatch('socket/addLoading', { name: 'jobsRefresh' })
        try {
            await this.$store.dispatch('fleet/jobs/loadJobs')
        } catch (error) {
            console.error('Failed to load jobs:', error)
            this.$toast.error('Failed to load jobs')
        } finally {
            this.$store.dispatch('socket/removeLoading', { name: 'jobsRefresh' })
        }
    }

    async loadCustomers() {
        try {
            await this.$store.dispatch('fleet/jobs/loadCustomers')
        } catch (error) {
            console.error('Failed to load customers:', error)
        }
    }

    async loadJobGcodes(jobId: string) {
        try {
            this.jobGcodes = await this.$store.dispatch('fleet/jobs/loadJobGcodes', jobId)
        } catch (error) {
            console.error('Failed to load job gcodes:', error)
        }
    }

    getCustomerName(customerId: string) {
        const customer = this.customers.find((c: FleetCustomer) => c.id === customerId)
        return customer ? customer.name : 'Unknown Customer'
    }

    getStatusColor(status: string) {
        const colors = {
            pending: 'orange',
            in_progress: 'blue',
            complete: 'green',
            cancelled: 'red',
        }
        return colors[status] || 'grey'
    }

    getStatusTextColor(status: string) {
        return 'white'
    }

    getStatusIcon(status: string) {
        switch (status) {
            case 'pending':
                return this.mdiAlertOutline
            case 'in_progress':
                return this.mdiProgressClock
            case 'complete':
                return this.mdiCheckboxMarkedCircleOutline
            case 'cancelled':
                return this.mdiCloseCircleOutline
            default:
                return this.mdiAlertOutline
        }
    }

    getPriorityColor(priority: number) {
        if (priority >= 5) return 'red'
        if (priority >= 3) return 'orange'
        if (priority >= 1) return 'blue'
        return 'grey'
    }

    getJobRowClass(item: FleetJob) {
        if (item.status === 'cancelled') return 'text--disabled'
        if (item.due_date && new Date(item.due_date) < new Date()) return 'red--text'
        return ''
    }

    getDueDateClass(dueDate: string) {
        if (!dueDate) return ''
        const due = new Date(dueDate)
        const now = new Date()
        const diffTime = due.getTime() - now.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        if (diffDays < 0) return 'red--text font-weight-bold'
        if (diffDays <= 1) return 'orange--text font-weight-bold'
        if (diffDays <= 3) return 'amber--text'
        return ''
    }

    formatDateTime(dateString: string) {
        if (!dateString) return null
        return new Date(dateString).toLocaleString()
    }

    formatStatusDisplay(status: string) {
        return status.replace('_', ' ')
    }

    truncateText(text: string, length: number) {
        if (!text) return ''
        return text.length > length ? text.substring(0, length) + '...' : text
    }

    clickRow(item: FleetJob) {
        this.viewJobDetails(item)
    }

    async viewJobDetails(item: FleetJob) {
        this.detailsDialog.item = item
        this.detailsDialog.show = true
        await this.loadJobGcodes(item.id)
    }

    showContextMenu(e: any, item: FleetJob) {
        if (!this.contextMenu.shown) {
            e?.preventDefault()
            this.contextMenu.shown = true
            this.contextMenu.x = e?.clientX || e?.pageX || window.screenX / 2
            this.contextMenu.y = e?.clientY || e?.pageY || window.screenY / 2
            this.contextMenu.item = item
            this.$nextTick(() => {
                this.contextMenu.shown = true
            })
        }
    }

    editJob(item: FleetJob) {
        this.createJobDialog.isEdit = true
        this.createJobDialog.form = {
            id: item.id,
            name: item.name,
            customer_id: item.customer_id,
            job_type: item.job_type,
            priority: item.priority,
            operator_name: item.operator_name || '',
            description: item.description || '',
            due_date: item.due_date ? item.due_date.split('T')[0] : '',
        }
        this.createJobDialog.show = true
    }

    async updateJobStatus(item: FleetJob, status: string) {
        try {
            await this.$store.dispatch('fleet/jobs/updateJobStatus', { jobId: item.id, status })
            this.$toast.success(`Job status updated to ${status.replace('_', ' ')}`)
            await this.refreshJobs()
        } catch (error) {
            console.error('Failed to update job status:', error)
            this.$toast.error('Failed to update job status')
        }
    }

    openCreateJobDialog() {
        this.createJobDialog.isEdit = false
        this.createJobDialog.show = true
    }

    openCreateCustomerDialog() {
        this.createCustomerDialog.show = true
    }

    openAddGcodeDialog() {
        this.addGcodeDialog.show = true
    }

    async saveJob() {
        if (!this.createJobDialog.valid) return

        this.createJobDialog.loading = true
        try {
            const formData = { ...this.createJobDialog.form }
            if (formData.due_date) {
                formData.due_date = new Date(formData.due_date).toISOString()
            }
            delete formData.id

            if (this.createJobDialog.isEdit) {
                this.$toast.info('Edit functionality not yet implemented')
            } else {
                await this.$store.dispatch('fleet/jobs/createJob', formData)
                this.$toast.success('Job created successfully')
                await this.refreshJobs()
                this.closeCreateJobDialog()
            }
        } catch (error) {
            console.error('Failed to save job:', error)
            this.$toast.error('Failed to save job')
        } finally {
            this.createJobDialog.loading = false
        }
    }

    async saveCustomer() {
        if (!this.createCustomerDialog.valid) return

        this.createCustomerDialog.loading = true
        try {
            await this.$store.dispatch('fleet/jobs/createCustomer', this.createCustomerDialog.form)
            this.$toast.success('Customer created successfully')
            await this.loadCustomers()
            this.closeCreateCustomerDialog()
        } catch (error) {
            console.error('Failed to create customer:', error)
            this.$toast.error('Failed to create customer')
        } finally {
            this.createCustomerDialog.loading = false
        }
    }

    async saveGcode() {
        if (!this.addGcodeDialog.valid || !this.detailsDialog.item) return

        this.addGcodeDialog.loading = true
        try {
            await this.$store.dispatch('fleet/jobs/createJobGcode', {
                jobId: this.detailsDialog.item.id,
                gcode: this.addGcodeDialog.form
            })
            this.$toast.success('GCode file added successfully')
            await this.loadJobGcodes(this.detailsDialog.item.id)
            this.closeAddGcodeDialog()
        } catch (error) {
            console.error('Failed to add gcode:', error)
            this.$toast.error('Failed to add GCode file')
        } finally {
            this.addGcodeDialog.loading = false
        }
    }

    closeCreateJobDialog() {
        this.createJobDialog.show = false
        this.createJobDialog.isEdit = false
        this.createJobDialog.form = {
            id: '',
            name: '',
            customer_id: '',
            job_type: 'sample',
            priority: 0,
            operator_name: '',
            description: '',
            due_date: '',
        }
    }

    closeCreateCustomerDialog() {
        this.createCustomerDialog.show = false
        this.createCustomerDialog.form = {
            name: '',
            notes: '',
        }
    }

    closeAddGcodeDialog() {
        this.addGcodeDialog.show = false
        this.addGcodeDialog.form = {
            gcode_filename: '',
            required_runs: 1,
            preferred_printer: 'any',
            filament_type: '',
        }
    }

    viewGcodeRuns(gcode: FleetJobGcode) {
        this.$toast.info('GCode runs view will be implemented in phase 2')
    }

    async deleteJob() {
        try {
            await this.$store.dispatch('fleet/jobs/deleteJob', this.contextMenu.item.id)
            this.$toast.success('Job deleted successfully')
            await this.refreshJobs()
            this.deleteDialog = false
        } catch (error) {
            console.error('Failed to delete job:', error)
            this.$toast.error('Failed to delete job')
        }
    }

    async deleteSelectedJobs() {
        this.$toast.info('Batch delete will be implemented in phase 2')
        this.deleteSelectedDialog = false
    }

    sortJobs(items: any[], sortBy: string[], sortDesc: boolean[]) {
        const sortByClean = sortBy.length ? sortBy[0] : 'created_at'
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
::v-deep .job-list-table th {
    white-space: nowrap;
}

::v-deep .job-list-table th.text-start {
    padding-right: 0 !important;
}
</style>