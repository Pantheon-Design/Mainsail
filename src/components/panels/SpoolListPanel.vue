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
                @click:clear="qrResult = null; qrError = ''" />
            <v-btn small color="primary" outlined class="mr-2" @click="openAddDialog">
                <v-icon small left>{{ mdiPlus }}</v-icon> Add Spool
            </v-btn>
            <v-btn small color="primary" class="mr-2" @click="enterAddSpoolMode" title="Add Spool Mode (scan QR codes)">
                <v-icon small left>{{ mdiQrcodeScan }}</v-icon> Add Spool Mode
            </v-btn>
            <!-- Dev mode toggle -->
            <v-btn small :color="devMode ? 'orange' : 'grey'" :outlined="!devMode" @click="devMode = !devMode" class="mr-2" title="Toggle dev mode">
                <v-icon small left>{{ mdiBug }}</v-icon>
                Dev
            </v-btn>
            <!-- Column visibility -->
            <v-menu offset-y :close-on-content-click="false" left>
                <template #activator="{ on, attrs }">
                    <v-btn small icon v-bind="attrs" v-on="on" title="Toggle columns">
                        <v-icon small>{{ mdiCog }}</v-icon>
                    </v-btn>
                </template>
                <v-card class="pa-2" style="max-height: 400px; overflow-y: auto">
                    <v-card-subtitle class="pa-1 caption font-weight-bold">Visible Columns</v-card-subtitle>
                    <v-checkbox
                        v-for="col in allHeaders"
                        :key="col.value"
                        :label="col.text || col.value"
                        :input-value="visibleColumns.includes(col.value)"
                        dense
                        hide-details
                        class="mt-0 ml-1"
                        @change="toggleColumn(col.value)"
                    />
                </v-card>
            </v-menu>
        </v-card-title>

        <!-- QR Lookup Result -->
        <v-card-text v-if="qrResult" class="pt-0 pb-2">
            <v-alert type="info" dense dismissible @input="qrResult = null">
                <strong>QR {{ qrResult.qr_code }}</strong> —
                Spool #{{ qrResult.id }},
                {{ qrResult.material }} ({{ qrResult.vendor_name || 'No vendor' }}),
                Remaining: {{ qrResult.remaining_weight != null ? qrResult.remaining_weight.toFixed(0) + ' g' : '—' }},
                Location: {{ qrResult.location || '—' }},
                Loaded on: {{ qrResult.loaded_on_printer || 'None' }}
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
                        clearable dense outlined hide-details />
                </v-col>
                <v-col cols="12" sm="3">
                    <v-text-field
                        v-model="filterLocation"
                        label="Location"
                        clearable dense outlined hide-details />
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
            ref="spoolTable"
            :headers="headers"
            :items="filteredSpools"
            :loading="loading"
            dense
            sort-by="id"
            :sort-desc="true"
            :items-per-page="50"
            :footer-props="{ 'items-per-page-options': [25, 50, 100, 200] }"
            class="spool-table resizable-table"
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
            <template #item.loaded_on_printer="{ item }">
                <v-chip v-if="item.loaded_on_printer" x-small color="success" dark>{{ item.loaded_on_printer }}</v-chip>
                <span v-else>—</span>
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
                <v-btn x-small icon @click.stop="openEditDialog(item)" title="Edit">
                    <v-icon small>{{ mdiPencil }}</v-icon>
                </v-btn>
                <v-btn v-if="!item.archived" x-small icon @click.stop="confirmArchive(item)" title="Archive">
                    <v-icon small>{{ mdiArchive }}</v-icon>
                </v-btn>
            </template>
            <!-- Dev mode actions -->
            <template #item.dev_actions="{ item }">
                <v-btn x-small color="orange" outlined @click.stop="openQrEditDialog(item)" title="Edit QR code" class="mr-1">
                    QR
                </v-btn>
                <v-btn x-small color="error" outlined @click.stop="confirmDestroy(item)" title="Permanently delete">
                    <v-icon x-small>{{ mdiDelete }}</v-icon>
                </v-btn>
            </template>
        </v-data-table>

        <!-- Detail Dialog -->
        <v-dialog v-model="detailDialog" max-width="750">
            <v-card v-if="detailSpool">
                <v-card-title class="d-flex align-center">
                    Spool #{{ detailSpool.id }}
                    <v-spacer />
                    <v-btn icon small @click="detailDialog = false">
                        <v-icon small>{{ mdiClose }}</v-icon>
                    </v-btn>
                </v-card-title>
                <v-divider />
                <v-card-text class="pt-3">
                    <v-simple-table dense class="mb-4">
                        <tbody>
                            <tr><td class="font-weight-bold" width="160">QR Code</td><td>{{ detailSpool.qr_code || '—' }}</td></tr>
                            <tr><td class="font-weight-bold">Filament</td><td>{{ [detailSpool.vendor_name, detailSpool.filament_name].filter(Boolean).join(' — ') }}</td></tr>
                            <tr><td class="font-weight-bold">Material</td><td>{{ detailSpool.material }}</td></tr>
                            <tr><td class="font-weight-bold">Initial Weight</td><td>{{ detailSpool.initial_weight != null ? detailSpool.initial_weight + ' g' : '—' }}</td></tr>
                            <tr><td class="font-weight-bold">Used Weight</td><td>{{ detailSpool.used_weight }} g</td></tr>
                            <tr><td class="font-weight-bold">Remaining</td><td>{{ detailSpool.remaining_weight != null ? detailSpool.remaining_weight + ' g' : '—' }}</td></tr>
                            <tr><td class="font-weight-bold">Location</td><td>{{ detailSpool.location || '—' }}</td></tr>
                            <tr><td class="font-weight-bold">Lot #</td><td>{{ detailSpool.lot_nr || '—' }}</td></tr>
                            <tr><td class="font-weight-bold">Loaded On</td><td>
                                <v-chip v-if="detailSpool.loaded_on_printer" x-small color="success" dark>{{ detailSpool.loaded_on_printer }}</v-chip>
                                <span v-else>Not loaded</span>
                            </td></tr>
                            <tr><td class="font-weight-bold">Last Printer</td><td>{{ detailSpool.last_printer || '—' }}</td></tr>
                            <tr><td class="font-weight-bold">Last Used</td><td>{{ formatDate(detailSpool.last_used) }}</td></tr>
                            <tr><td class="font-weight-bold">Comment</td><td>{{ detailSpool.comment || '—' }}</td></tr>
                        </tbody>
                    </v-simple-table>

                    <v-progress-linear v-if="detailSpoolJobsLoading" indeterminate color="primary" class="mb-2" />
                    <template v-else>
                        <!-- Print jobs that used this spool -->
                        <div class="d-flex align-center mb-1">
                            <span class="text-subtitle-2 font-weight-bold">Print Jobs ({{ detailSpoolJobs.length }})</span>
                        </div>
                        <v-simple-table v-if="detailSpoolJobs.length" dense class="mb-4">
                            <thead>
                                <tr>
                                    <th>Printer</th>
                                    <th>Filename</th>
                                    <th>Status</th>
                                    <th>Start</th>
                                    <th>Spool QR</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="job in detailSpoolJobs" :key="job.id">
                                    <td>{{ job.printer_hostname }}</td>
                                    <td class="text-truncate" style="max-width: 200px">{{ job.filename || '—' }}</td>
                                    <td>
                                        <v-chip x-small :color="job.status === 'completed' ? 'success' : job.status === 'error' ? 'error' : 'grey'" dark>
                                            {{ job.status || '—' }}
                                        </v-chip>
                                    </td>
                                    <td>{{ formatDate(job.start_time) }}</td>
                                    <td>{{ job.spool_qr_code || '—' }}</td>
                                </tr>
                            </tbody>
                        </v-simple-table>
                        <p v-else class="caption grey--text mb-4">No print jobs linked to this spool.</p>

                        <!-- Parts printed with this spool -->
                        <div class="d-flex align-center mb-1">
                            <span class="text-subtitle-2 font-weight-bold">Parts ({{ detailSpoolParts.length }})</span>
                        </div>
                        <v-simple-table v-if="detailSpoolParts.length" dense>
                            <thead>
                                <tr>
                                    <th>Part QR</th>
                                    <th>Printer</th>
                                    <th>Filename</th>
                                    <th>Status</th>
                                    <th>Start</th>
                                    <th>QC</th>
                                    <th>Spool QR</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="part in detailSpoolParts" :key="part.id">
                                    <td>{{ part.qr_code }}</td>
                                    <td>{{ part.printer_hostname }}</td>
                                    <td class="text-truncate" style="max-width: 180px">{{ part.filename || '—' }}</td>
                                    <td>
                                        <v-chip x-small :color="part.status === 'completed' ? 'success' : part.status === 'error' ? 'error' : 'grey'" dark>
                                            {{ part.status || '—' }}
                                        </v-chip>
                                    </td>
                                    <td>{{ formatDate(part.start_time) }}</td>
                                    <td>
                                        <v-chip v-if="part.qc_status" x-small :color="part.qc_status === 'pass' ? 'success' : part.qc_status === 'fail' ? 'error' : 'warning'" dark>
                                            {{ part.qc_status }}
                                        </v-chip>
                                        <span v-else>—</span>
                                    </td>
                                    <td>{{ part.spool_qr_code || '—' }}</td>
                                </tr>
                            </tbody>
                        </v-simple-table>
                        <p v-else class="caption grey--text">No parts linked to this spool.</p>
                    </template>
                </v-card-text>
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

        <!-- QR Edit Dialog (dev mode) -->
        <v-dialog v-model="qrEditDialog" max-width="420" persistent>
            <v-card>
                <v-card-title>Edit QR Code — Spool #{{ qrEditTarget?.id }}</v-card-title>
                <v-card-text>
                    <v-text-field
                        v-model="qrEditValue"
                        label="QR Code"
                        dense outlined
                        hint="Leave empty to clear"
                        autofocus />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="qrEditDialog = false">Cancel</v-btn>
                    <v-btn color="orange" :loading="saving" @click="submitQrEdit">Save</v-btn>
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

        <!-- Destroy Confirmation (dev mode) -->
        <v-dialog v-model="destroyDialog" max-width="400">
            <v-card>
                <v-card-title class="error--text">Permanently Delete Spool</v-card-title>
                <v-card-text>
                    This will <strong>permanently delete</strong> spool <strong>#{{ destroyTarget?.id }}</strong>
                    ({{ destroyTarget?.qr_code || 'no QR' }}). This cannot be undone.
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="destroyDialog = false">Cancel</v-btn>
                    <v-btn color="error" :loading="saving" @click="doDestroy">Delete Forever</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3000" bottom>
            {{ snackbarText }}
        </v-snackbar>

        <!-- Add Spool Mode Fullscreen -->
        <v-dialog v-model="addSpoolMode" fullscreen persistent no-click-animation>
            <v-card class="d-flex flex-column" style="height: 100vh" @click="onAddSpoolCardClick">
                <!-- Header -->
                <v-card-title class="d-flex align-center py-2">
                    <v-icon left color="primary">{{ mdiQrcodeScan }}</v-icon>
                    <span>Add Spool Mode</span>
                    <v-chip v-if="addSpoolReady" small class="ml-3" color="success" outlined>Ready — scan QR to create</v-chip>
                    <v-chip v-else small class="ml-3" color="warning" outlined>Select filament first</v-chip>
                    <v-spacer />
                    <v-btn icon @click="exitAddSpoolMode">
                        <v-icon>{{ mdiClose }}</v-icon>
                    </v-btn>
                </v-card-title>
                <v-divider />

                <v-card-text class="d-flex flex-column flex-grow-1 pa-4" style="overflow-y: auto">
                    <!-- Hidden scan input -->
                    <input
                        ref="addSpoolScanInput"
                        v-model="addSpoolScanBuffer"
                        class="qc-hidden-input"
                        @keydown.enter="processAddSpoolScan"
                        autofocus
                    />

                    <!-- Status alert -->
                    <v-alert
                        v-if="addSpoolStatusMessage"
                        :type="addSpoolStatusType"
                        dense
                        class="mb-4"
                        dismissible
                        @input="addSpoolStatusMessage = ''"
                    >
                        {{ addSpoolStatusMessage }}
                    </v-alert>

                    <!-- Top: Preset form -->
                    <v-card outlined class="mb-4">
                        <v-card-title class="subtitle-2 py-2">Spool Preset</v-card-title>
                        <v-divider />
                        <v-card-text class="pt-3">
                            <v-row dense>
                                <v-col cols="12" sm="6">
                                    <v-select
                                        v-model="addSpoolForm.filament_id"
                                        :items="filamentItems"
                                        label="Filament *"
                                        dense outlined hide-details
                                        :rules="[v => v != null || 'Required']"
                                    />
                                </v-col>
                                <v-col cols="12" sm="6">
                                    <v-text-field v-model="addSpoolForm.location" label="Location" dense outlined hide-details />
                                </v-col>
                            </v-row>
                            <v-row dense>
                                <v-col cols="4">
                                    <v-text-field v-model.number="addSpoolForm.initial_weight" label="Initial (g)" dense outlined hide-details type="number" />
                                </v-col>
                                <v-col cols="4">
                                    <v-text-field v-model.number="addSpoolForm.spool_weight" label="Empty spool (g)" dense outlined hide-details type="number" />
                                </v-col>
                                <v-col cols="4">
                                    <v-text-field v-model="addSpoolForm.lot_nr" label="Lot #" dense outlined hide-details />
                                </v-col>
                            </v-row>
                            <v-row dense>
                                <v-col cols="12">
                                    <v-text-field v-model="addSpoolForm.comment" label="Comment" dense outlined hide-details />
                                </v-col>
                            </v-row>
                            <p class="caption grey--text mt-2 mb-0">
                                Scan a QR code to create a spool with these settings. QR code becomes the spool's QR identifier.
                            </p>
                        </v-card-text>
                    </v-card>

                    <!-- Bottom: Existing spools table (click to prefill) -->
                    <v-card outlined class="flex-grow-1">
                        <v-card-title class="subtitle-2 py-2">
                            Existing Spools
                            <span class="caption grey--text ml-2">(click a row to prefill the form above)</span>
                        </v-card-title>
                        <v-divider />
                        <v-data-table
                            :headers="addSpoolTableHeaders"
                            :items="spools"
                            dense
                            sort-by="id"
                            :sort-desc="true"
                            :items-per-page="25"
                            :footer-props="{ 'items-per-page-options': [25, 50, 100] }"
                            class="spool-table"
                            @click:row="prefillFromSpool"
                        >
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
                            <template #item.remaining_weight="{ item }">
                                {{ item.remaining_weight != null ? item.remaining_weight.toFixed(0) + ' g' : '—' }}
                            </template>
                            <template #item.loaded_on_printer="{ item }">
                                <v-chip v-if="item.loaded_on_printer" x-small color="success" dark>{{ item.loaded_on_printer }}</v-chip>
                                <span v-else>—</span>
                            </template>
                        </v-data-table>
                    </v-card>
                </v-card-text>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { mdiPlus, mdiPencil, mdiArchive, mdiDelete, mdiBug, mdiCog, mdiClose, mdiQrcodeScan } from '@mdi/js'
import { FleetSpool, FleetFilament, FleetVendor } from '@/store/fleet/spools/types'
import { fleetDaemonEvents } from '@/plugins/fleetDaemonClient'

@Component
export default class SpoolListPanel extends Vue {
    mdiPlus = mdiPlus
    mdiPencil = mdiPencil
    mdiArchive = mdiArchive
    mdiDelete = mdiDelete
    mdiBug = mdiBug
    mdiCog = mdiCog
    mdiClose = mdiClose
    mdiQrcodeScan = mdiQrcodeScan

    devMode = false

    // Add Spool Mode state
    addSpoolMode = false
    addSpoolScanBuffer = ''
    addSpoolStatusMessage = ''
    addSpoolStatusType: 'success' | 'error' | 'warning' | 'info' = 'info'
    addSpoolSaving = false
    addSpoolForm = this.emptyAddSpoolForm()

    readonly addSpoolTableHeaders = [
        { text: 'ID', value: 'id', sortable: true },
        { text: '', value: 'color_hex', sortable: false },
        { text: 'QR Code', value: 'qr_code', sortable: true },
        { text: 'Filament', value: 'filament_label', sortable: false },
        { text: 'Material', value: 'material', sortable: true },
        { text: 'Initial', value: 'initial_weight', sortable: true },
        { text: 'Remaining', value: 'remaining_weight', sortable: true },
        { text: 'Location', value: 'location', sortable: true },
        { text: 'Loaded On', value: 'loaded_on_printer', sortable: true },
    ]

    editDialog = false
    detailDialog = false
    detailSpoolJobs: any[] = []
    detailSpoolParts: any[] = []
    detailSpoolJobsLoading = false
    archiveDialog = false
    destroyDialog = false
    qrEditDialog = false
    saving = false
    editingSpool: FleetSpool | null = null
    detailSpool: FleetSpool | null = null
    archiveTarget: FleetSpool | null = null
    destroyTarget: FleetSpool | null = null
    qrEditTarget: FleetSpool | null = null
    qrEditValue = ''

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

    // Column visibility
    readonly STORAGE_KEY = 'fleet_spool_visible_columns'
    readonly WIDTHS_KEY = 'fleet_spool_column_widths'
    readonly HIDE_THRESHOLD = 36
    visibleColumns: string[] = []
    columnWidths: Record<string, number> = {}
    resizingCol = ''
    resizeStartX = 0
    resizeStartW = 0
    private _onMouseMove: ((e: MouseEvent) => void) | null = null
    private _onMouseUp: ((e: MouseEvent) => void) | null = null

    readonly baseHeaders = [
        { text: 'ID', value: 'id', sortable: true },
        { text: '', value: 'color_hex', sortable: false },
        { text: 'QR Code', value: 'qr_code', sortable: true },
        { text: 'Filament', value: 'filament_label', sortable: false },
        { text: 'Material', value: 'material', sortable: true },
        { text: 'Initial', value: 'initial_weight', sortable: true },
        { text: 'Used', value: 'used_weight', sortable: true },
        { text: 'Remaining', value: 'remaining_weight', sortable: true },
        { text: 'Location', value: 'location', sortable: true },
        { text: 'Loaded On', value: 'loaded_on_printer', sortable: true },
        { text: 'Last Printer', value: 'last_printer', sortable: true },
        { text: 'Last Used', value: 'last_used', sortable: true },
        { text: '', value: 'archived', sortable: false },
        { text: 'Actions', value: 'actions', sortable: false },
    ]

    readonly devHeaders = [
        { text: 'Dev', value: 'dev_actions', sortable: false },
    ]

    // --- Lifecycle ---

    created() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY)
            if (saved) {
                const parsed = JSON.parse(saved) as string[]
                if (Array.isArray(parsed) && parsed.length > 0) {
                    this.visibleColumns = parsed
                }
            }
        } catch { /* ignore */ }
        if (!this.visibleColumns.length) {
            this.visibleColumns = this.allHeaders.map((h) => h.value)
        }
        try {
            const w = localStorage.getItem(this.WIDTHS_KEY)
            if (w) this.columnWidths = JSON.parse(w)
        } catch { /* ignore */ }
    }

    mounted() {
        this.$nextTick(() => this.attachResizeHandles())
        fleetDaemonEvents.$on('spool_updated', this.onSpoolUpdated)
    }

    updated() {
        this.$nextTick(() => this.attachResizeHandles())
    }

    beforeDestroy() {
        fleetDaemonEvents.$off('spool_updated', this.onSpoolUpdated)
        this.cleanupResizeListeners()
    }

    onSpoolUpdated() {
        this.reloadSpools()
    }

    // --- Computed ---

    get allHeaders() {
        return this.devMode ? [...this.baseHeaders, ...this.devHeaders] : this.baseHeaders
    }

    get devColumnValues(): string[] {
        return this.devHeaders.map((h) => h.value)
    }

    get headers() {
        return this.allHeaders
            .filter((h) => this.visibleColumns.includes(h.value) || this.devColumnValues.includes(h.value))
            .map((h) => {
                const w = this.columnWidths[h.value]
                return w ? { ...h, width: `${w}px` } : h
            })
    }

    get spools(): FleetSpool[] {
        return this.$store.getters['fleet/spools/getSpools']
    }

    get filaments(): FleetFilament[] {
        return this.$store.getters['fleet/spools/getFilaments']
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

    // --- Column visibility ---

    toggleColumn(value: string) {
        const idx = this.visibleColumns.indexOf(value)
        if (idx >= 0) {
            if (this.visibleColumns.length <= 1) return
            this.visibleColumns.splice(idx, 1)
        } else {
            this.visibleColumns.push(value)
        }
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.visibleColumns))
    }

    // --- Column resize ---

    attachResizeHandles() {
        const table = (this.$refs.spoolTable as any)?.$el as HTMLElement | undefined
        if (!table) return
        const ths = table.querySelectorAll('thead th')
        ths.forEach((th, idx) => {
            const el = th as HTMLElement
            if (el.querySelector('.col-resize-handle')) return
            el.style.position = 'relative'
            const handle = document.createElement('div')
            handle.className = 'col-resize-handle'
            handle.addEventListener('mousedown', (e) => {
                const header = this.headers[idx]
                if (!header) return
                e.preventDefault()
                e.stopPropagation()
                this.resizingCol = header.value
                this.resizeStartX = e.clientX
                this.resizeStartW = el.offsetWidth
                this._onMouseMove = (ev: MouseEvent) => this.onResizeMove(ev, el)
                this._onMouseUp = (ev: MouseEvent) => this.onResizeEnd(ev, el)
                document.addEventListener('mousemove', this._onMouseMove)
                document.addEventListener('mouseup', this._onMouseUp)
                document.body.style.cursor = 'col-resize'
                document.body.style.userSelect = 'none'
            })
            el.appendChild(handle)
        })
    }

    onResizeMove(e: MouseEvent, th: HTMLElement) {
        const delta = e.clientX - this.resizeStartX
        const newW = Math.max(20, this.resizeStartW + delta)
        th.style.width = newW + 'px'
        th.style.minWidth = newW + 'px'
    }

    onResizeEnd(e: MouseEvent, _th: HTMLElement) {
        this.cleanupResizeListeners()
        const delta = e.clientX - this.resizeStartX
        const newW = Math.max(20, this.resizeStartW + delta)

        if (newW < this.HIDE_THRESHOLD) {
            this.toggleColumn(this.resizingCol)
            delete this.columnWidths[this.resizingCol]
            localStorage.setItem(this.WIDTHS_KEY, JSON.stringify(this.columnWidths))
            const col = this.allHeaders.find((h) => h.value === this.resizingCol)
            if (col?.text) this.showSnackbar(`"${col.text}" column hidden`, 'info')
        } else {
            this.$set(this.columnWidths, this.resizingCol, newW)
            localStorage.setItem(this.WIDTHS_KEY, JSON.stringify(this.columnWidths))
        }
        this.resizingCol = ''
    }

    cleanupResizeListeners() {
        if (this._onMouseMove) document.removeEventListener('mousemove', this._onMouseMove)
        if (this._onMouseUp) document.removeEventListener('mouseup', this._onMouseUp)
        this._onMouseMove = null
        this._onMouseUp = null
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
    }

    // --- Helpers ---

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

    showSnackbar(text: string, color: string) {
        this.snackbarText = text
        this.snackbarColor = color
        this.snackbar = true
    }

    // --- QR Lookup ---

    async lookupQr() {
        const qr = (this.qrSearch || '').trim()
        if (!qr) return
        this.qrResult = null
        this.qrError = ''
        try {
            const spool = await this.$store.dispatch('fleet/spools/lookupByQr', qr)
            this.qrResult = spool
        } catch (err: any) {
            this.qrError = err?.message || 'Lookup failed'
        }
    }

    // --- Detail ---

    openDetailDialog(spool: FleetSpool) {
        this.detailSpool = spool
        this.detailSpoolJobs = []
        this.detailSpoolParts = []
        this.detailSpoolJobsLoading = false
        this.detailDialog = true

        // Fetch jobs/parts that used this spool
        if (spool.qr_code) {
            this.detailSpoolJobsLoading = true
            const baseUrl = this.$store.getters['gui/fleetDaemonUrl'] ?? 'http://pantheonfleet.local:8090'
            import('axios').then(({ default: axios }) => {
                axios.get(`${baseUrl}/history`, {
                    params: { spool_qr_code: spool.qr_code, limit: 500 }
                })
                    .then((resp: any) => {
                        const all = resp.data.records ?? []
                        this.detailSpoolJobs = all.filter((r: any) => r.qr_code == null)
                        this.detailSpoolParts = all.filter((r: any) => r.qr_code != null)
                    })
                    .catch(() => {
                        this.detailSpoolJobs = []
                        this.detailSpoolParts = []
                    })
                    .finally(() => { this.detailSpoolJobsLoading = false })
            })
        }
    }

    // --- Add / Edit ---

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
            this.reloadSpools()
            this.editDialog = false
        } catch (err: any) {
            this.showSnackbar(err?.message || 'Failed to save', 'error')
        } finally {
            this.saving = false
        }
    }

    // --- QR Edit (dev mode) ---

    openQrEditDialog(spool: FleetSpool) {
        this.qrEditTarget = spool
        this.qrEditValue = spool.qr_code || ''
        this.qrEditDialog = true
    }

    async submitQrEdit() {
        if (!this.qrEditTarget) return
        this.saving = true
        try {
            await this.$store.dispatch('fleet/spools/updateSpool', {
                id: this.qrEditTarget.id,
                qr_code: this.qrEditValue.trim() || null,
            })
            this.showSnackbar('QR code updated', 'success')
            this.reloadSpools()
            this.qrEditDialog = false
        } catch (err: any) {
            this.showSnackbar(err?.message || 'Failed to update QR code', 'error')
        } finally {
            this.saving = false
        }
    }

    // --- Archive ---

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
            this.showSnackbar(err?.message || 'Failed to archive', 'error')
        } finally {
            this.saving = false
        }
    }

    // --- Add Spool Mode ---

    get addSpoolReady(): boolean {
        return this.addSpoolForm.filament_id != null
    }

    emptyAddSpoolForm() {
        return {
            filament_id: null as number | null,
            initial_weight: null as number | null,
            spool_weight: null as number | null,
            location: '',
            lot_nr: '',
            comment: '',
        }
    }

    enterAddSpoolMode() {
        this.addSpoolMode = true
        this.addSpoolForm = this.emptyAddSpoolForm()
        this.addSpoolScanBuffer = ''
        this.addSpoolStatusMessage = ''
        this.$nextTick(() => {
            const input = this.$refs.addSpoolScanInput as HTMLInputElement | undefined
            if (input) input.focus()
        })
    }

    exitAddSpoolMode() {
        this.addSpoolMode = false
        this.addSpoolScanBuffer = ''
        this.addSpoolStatusMessage = ''
        this.reloadSpools()
    }

    onAddSpoolCardClick(event: MouseEvent) {
        const target = event.target as HTMLElement
        // Don't steal focus from form inputs, selects, buttons, or table rows
        if (target.closest('input, textarea, select, button, .v-input, .v-select, .v-btn, .v-data-table, .v-menu')) return
        const input = this.$refs.addSpoolScanInput as HTMLInputElement | undefined
        if (input) input.focus()
    }

    prefillFromSpool(spool: FleetSpool) {
        this.addSpoolForm.filament_id = spool.filament_id
        this.addSpoolForm.initial_weight = spool.initial_weight
        this.addSpoolForm.spool_weight = spool.spool_weight
        this.addSpoolForm.location = spool.location || ''
        this.addSpoolForm.lot_nr = spool.lot_nr || ''
        this.addSpoolForm.comment = spool.comment || ''
        this.addSpoolStatusMessage = `Preset filled from spool #${spool.id} (${spool.material})`
        this.addSpoolStatusType = 'info'
        // Re-focus scan input
        this.$nextTick(() => {
            const input = this.$refs.addSpoolScanInput as HTMLInputElement | undefined
            if (input) input.focus()
        })
    }

    async processAddSpoolScan() {
        const qrCode = (this.addSpoolScanBuffer || '').trim()
        this.addSpoolScanBuffer = ''
        if (!qrCode) return

        if (!this.addSpoolReady) {
            this.addSpoolStatusMessage = 'Select a filament first before scanning'
            this.addSpoolStatusType = 'warning'
            return
        }

        if (this.addSpoolSaving) return
        this.addSpoolSaving = true

        try {
            const toNum = (v: any) => (v === '' || v === null || v === undefined || Number.isNaN(v)) ? null : Number(v)
            const payload: any = {
                filament_id: this.addSpoolForm.filament_id,
                qr_code: qrCode,
                initial_weight: toNum(this.addSpoolForm.initial_weight),
                used_weight: 0,
                spool_weight: toNum(this.addSpoolForm.spool_weight),
                location: this.addSpoolForm.location || null,
                lot_nr: this.addSpoolForm.lot_nr || null,
                comment: this.addSpoolForm.comment || null,
            }
            await this.$store.dispatch('fleet/spools/createSpool', payload)
            this.addSpoolStatusMessage = `Spool created with QR: ${qrCode}`
            this.addSpoolStatusType = 'success'
            this.reloadSpools()
        } catch (err: any) {
            this.addSpoolStatusMessage = err?.message || 'Failed to create spool'
            this.addSpoolStatusType = 'error'
        } finally {
            this.addSpoolSaving = false
            this.$nextTick(() => {
                const input = this.$refs.addSpoolScanInput as HTMLInputElement | undefined
                if (input) input.focus()
            })
        }
    }

    // --- Destroy (dev mode) ---

    confirmDestroy(spool: FleetSpool) {
        this.destroyTarget = spool
        this.destroyDialog = true
    }

    async doDestroy() {
        if (!this.destroyTarget) return
        this.saving = true
        try {
            await this.$store.dispatch('fleet/spools/destroySpool', this.destroyTarget.id)
            this.showSnackbar('Spool permanently deleted', 'success')
            this.destroyDialog = false
        } catch (err: any) {
            this.showSnackbar(err?.message || 'Failed to delete', 'error')
        } finally {
            this.saving = false
        }
    }
}
</script>

<style scoped>
.spool-table tbody tr {
    cursor: pointer;
}
</style>

<style>
.resizable-table table {
    table-layout: fixed;
}
.resizable-table thead th {
    position: relative !important;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-right: 1px solid rgba(255, 255, 255, 0.12) !important;
}
.resizable-table td {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-right: 1px solid rgba(255, 255, 255, 0.06) !important;
}
.resizable-table .col-resize-handle {
    position: absolute !important;
    right: -3px;
    top: 0;
    bottom: 0;
    width: 7px;
    cursor: col-resize !important;
    z-index: 10;
}
.resizable-table .col-resize-handle:hover,
.resizable-table .col-resize-handle:active {
    background: rgba(33, 150, 243, 0.5);
}
</style>
