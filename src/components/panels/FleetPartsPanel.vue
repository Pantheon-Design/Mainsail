<template>
    <v-card flat>
        <v-card-title class="d-flex align-center">
            <span>Parts</span>
            <v-spacer />
            <v-btn small color="primary" outlined @click="enterAddPartMode" class="mr-2" title="Add Part Mode">
                <v-icon small left>{{ mdiPackageVariantClosed }}</v-icon>
                Add Part
            </v-btn>
            <v-btn small color="primary" outlined @click="enterQcMode" class="mr-2" title="QC Mode">
                <v-icon small left>{{ mdiQrcodeScan }}</v-icon>
                QC Mode
            </v-btn>
            <v-btn small :color="devMode ? 'orange' : 'grey'" :outlined="!devMode" @click="toggleDevMode" class="mr-2" title="Toggle dev mode">
                <v-icon small left>{{ mdiBug }}</v-icon>
                Dev
            </v-btn>
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
                        :label="col.text"
                        :input-value="visibleColumns.includes(col.value)"
                        dense
                        hide-details
                        class="mt-0 ml-1"
                        @change="toggleColumn(col.value)"
                    />
                </v-card>
            </v-menu>
        </v-card-title>

        <!-- Filters -->
        <v-card-text class="py-1">
            <v-row dense>
                <v-col cols="12" sm="4">
                    <v-text-field
                        ref="qrSearchInput"
                        v-model="filterQrCode"
                        :label="appliedQrCode ? '' : 'QR Code Search'"
                        dense
                        outlined
                        hide-details
                        :prepend-inner-icon="mdiQrcodeScan"
                        @keydown.enter="applyQrCodeFilter"
                    >
                        <template #prepend-inner v-if="appliedQrCode">
                            <v-chip small close color="primary" class="mr-1" @click:close="clearQrFilter">
                                {{ appliedQrCode }}
                            </v-chip>
                        </template>
                    </v-text-field>
                </v-col>
                <v-col cols="12" sm="3">
                    <v-combobox
                        v-model="filterPrinter"
                        :items="printerOptions"
                        label="Printer"
                        clearable
                        dense
                        outlined
                        hide-details
                        :search-input.sync="printerSearch"
                        @change="applyFilters"
                    />
                </v-col>
                <v-col cols="12" sm="3">
                    <v-select
                        v-model="filterQcStatus"
                        :items="qcFilterOptions"
                        label="QC Status"
                        clearable
                        dense
                        outlined
                        hide-details
                        @change="applyFilters"
                    />
                </v-col>
                <v-col cols="12" sm="2">
                    <v-text-field
                        v-model="filterFilename"
                        label="Filename"
                        dense
                        outlined
                        clearable
                        hide-details
                        @input="applyFiltersDebounced"
                    />
                </v-col>
            </v-row>
        </v-card-text>

        <!-- Table -->
        <v-data-table
            ref="partsTable"
            :headers="computedHeaders"
            :items="filteredRecords"
            :loading="isLoading"
            :items-per-page="50"
            :footer-props="{ 'items-per-page-options': [25, 50, 100, 200] }"
            sort-by="start_time"
            :sort-desc="true"
            dense
            class="fleet-parts-table resizable-table"
            @click:row="openDetail"
        >
            <!-- QR code — click to edit in dev mode -->
            <template #item.qr_code="{ item }">
                <div
                    v-if="editingQrId !== item.id"
                    class="qr-code-cell"
                    :style="{ minWidth: '120px', cursor: devMode ? 'pointer' : 'default' }"
                    :title="devMode ? (item.qr_code || 'Click to edit QR code') : (item.qr_code || '')"
                    @click.stop="devMode && startEditQr(item)"
                >
                    {{ item.qr_code || '—' }}
                </div>
                <v-text-field
                    v-else
                    v-model="editingQrText"
                    dense
                    hide-details
                    autofocus
                    style="max-width: 200px"
                    placeholder="Scan or type QR..."
                    @click.stop
                    @blur="saveQr(item)"
                    @keydown.enter="saveQr(item)"
                    @keydown.escape="cancelEditQr"
                />
            </template>

            <!-- Status chip -->
            <template #item.status="{ item }">
                <v-chip x-small :color="statusColor(item.status)" dark>{{ item.status || 'unknown' }}</v-chip>
            </template>

            <!-- Start time -->
            <template #item.start_time="{ item }">
                {{ formatDate(item.start_time) }}
            </template>

            <!-- QR Linked timestamp -->
            <template #item.qr_linked_at="{ item }">
                {{ item.qr_linked_at ? formatDate(item.qr_linked_at) : '—' }}
            </template>

            <!-- Duration formatted -->
            <template #item.print_duration_secs="{ item }">
                {{ formatDuration(item.print_duration_secs) }}
            </template>

            <!-- QC status — display chip, editable dropdown in dev mode -->
            <template #item.qc_status="{ item }">
                <v-select
                    v-if="devMode"
                    :value="item.qc_status"
                    :items="qcOptions"
                    dense
                    hide-details
                    class="qc-select"
                    style="max-width: 110px"
                    @click.stop
                    @change="saveQC(item, $event)"
                />
                <template v-else>
                    <v-chip v-if="item.qc_status" x-small :color="item.qc_status === 'pass' ? 'success' : item.qc_status === 'fail' ? 'error' : 'warning'" dark>
                        {{ item.qc_status }}
                    </v-chip>
                    <span v-else>—</span>
                </template>
            </template>

            <!-- QC Inspector -->
            <template #item.qc_inspector="{ item }">
                {{ item.qc_inspector || '—' }}
            </template>

            <!-- QC Date -->
            <template #item.qc_date="{ item }">
                {{ item.qc_date ? new Date(item.qc_date).toLocaleString() : '—' }}
            </template>

            <!-- Filament mm → g -->
            <template #item.filament_used_mm="{ item }">
                {{ formatFilament(item.filament_used_mm) }}
            </template>

            <!-- Filament remaining weight -->
            <template #item.filament_remaining_weight="{ item }">
                {{ item.filament_remaining_weight != null ? `${item.filament_remaining_weight.toFixed(1)} g` : '—' }}
            </template>

            <!-- Printer nozzle type -->
            <template #item.printer_nozzle_type="{ item }">
                {{ item.printer_nozzle_type || '—' }}
            </template>

            <!-- Nozzle health as percent bar -->
            <template #item.nozzle_health="{ item }">
                <v-tooltip bottom v-if="item.nozzle_life != null && item.printer_nozzle_start_health != null && item.nozzle_life > 0">
                    <template #activator="{ on, attrs }">
                        <div v-bind="attrs" v-on="on" style="min-width: 80px">
                            <v-progress-linear
                                :value="nozzleHealthPct(item)"
                                :color="nozzleHealthColor(item)"
                                height="16"
                                rounded
                                class="nozzle-bar"
                            >
                                <span class="white--text caption">{{ nozzleHealthPct(item) }}%</span>
                            </v-progress-linear>
                        </div>
                    </template>
                    <span>
                        Remaining: {{ item.printer_nozzle_start_health.toFixed(3) }} kg<br>
                        Total life: {{ item.nozzle_life.toFixed(3) }} kg<br>
                        Used: {{ (item.nozzle_life - item.printer_nozzle_start_health).toFixed(3) }} kg
                    </span>
                </v-tooltip>
                <span v-else>—</span>
            </template>

            <!-- QC note — click to edit -->
            <template #item.qc_note="{ item }">
                <div
                    v-if="editingNoteId !== item.id"
                    class="qc-note-cell"
                    style="min-width: 120px; cursor: pointer"
                    :title="item.qc_note || 'Click to add note'"
                    @click.stop="startEditNote(item)"
                >
                    {{ item.qc_note || '—' }}
                </div>
                <v-text-field
                    v-else
                    v-model="editingNoteText"
                    dense
                    hide-details
                    autofocus
                    style="max-width: 200px"
                    placeholder="Enter note..."
                    @click.stop
                    @blur="saveNote(item)"
                    @keydown.enter="saveNote(item)"
                    @keydown.escape="cancelEditNote"
                />
            </template>

            <!-- Delete part (dev mode) -->
            <template #item.actions="{ item }">
                <v-btn icon x-small color="error" @click.stop="confirmDeletePart(item)" title="Delete part">
                    <v-icon x-small>{{ mdiDelete }}</v-icon>
                </v-btn>
            </template>
        </v-data-table>

        <!-- Load More -->
        <div v-if="hasMore" class="text-center py-2">
            <v-btn small outlined color="primary" :loading="loadingMore" @click="loadMore">
                Load More ({{ localRecords.length }} / {{ localTotal }})
            </v-btn>
        </div>

        <!-- Job Detail Dialog -->
        <v-dialog v-model="detailDialog" max-width="700">
            <v-card v-if="detailJob">
                <v-card-title class="d-flex align-center">
                    Job Detail
                    <v-spacer />
                    <v-btn icon small @click="detailDialog = false">
                        <v-icon small>{{ mdiClose }}</v-icon>
                    </v-btn>
                </v-card-title>
                <v-divider />
                <v-card-text class="pt-3">
                    <!-- Job info -->
                    <span class="text-subtitle-2 font-weight-bold">Job</span>
                    <v-simple-table dense class="mb-4">
                        <tbody>
                            <tr><td class="font-weight-bold" width="160">Printer</td><td>{{ detailJob.printer_hostname }}</td></tr>
                            <tr><td class="font-weight-bold">Model</td><td>{{ detailJob.printer_model || '—' }}</td></tr>
                            <tr><td class="font-weight-bold">Filename</td><td>
                                {{ detailJob.filename || '—' }}
                                <v-btn
                                    v-if="detailJob.gcode_archive_hash && !detailJob.gcode_archive_hash.startsWith('deleted:')"
                                    x-small icon class="ml-1"
                                    title="Download archived gcode"
                                    @click="downloadArchivedGcode(detailJob)"
                                >
                                    <v-icon x-small>{{ mdiDownload }}</v-icon>
                                </v-btn>
                                <v-chip
                                    v-if="detailJob.gcode_archive_hash && detailJob.gcode_archive_hash.startsWith('deleted:')"
                                    x-small color="error" dark class="ml-1"
                                >
                                    file deleted
                                </v-chip>
                            </td></tr>
                            <tr><td class="font-weight-bold">Filament</td><td>{{ detailJob.filament_type || '—' }}</td></tr>
                            <tr><td class="font-weight-bold">Status</td><td>
                                <v-chip x-small :color="statusColor(detailJob.status)" dark>{{ detailJob.status || 'unknown' }}</v-chip>
                            </td></tr>
                            <tr><td class="font-weight-bold">Start</td><td>{{ formatDate(detailJob.start_time) }}</td></tr>
                            <tr><td class="font-weight-bold">End</td><td>{{ detailJob.status === 'in_progress' ? 'In Progress' : formatDate(detailJob.end_time) }}</td></tr>
                            <tr><td class="font-weight-bold">Duration</td><td>{{ formatDuration(detailJob.print_duration_secs) }}</td></tr>
                            <tr><td class="font-weight-bold">Filament Used</td><td>{{ formatFilament(detailJob.filament_used_mm) }}</td></tr>
                            <tr><td class="font-weight-bold">Spool QR</td><td>{{ detailJob.spool_qr_code || '—' }}</td></tr>
                        </tbody>
                    </v-simple-table>

                    <!-- Spool info -->
                    <div v-if="detailSpool" class="mb-4">
                        <span class="text-subtitle-2 font-weight-bold">Spool</span>
                        <v-simple-table dense>
                            <tbody>
                                <tr><td class="font-weight-bold" width="160">Spool ID</td><td>#{{ detailSpool.id }}</td></tr>
                                <tr><td class="font-weight-bold">Vendor</td><td>{{ (detailSpool.filament && detailSpool.filament.vendor && detailSpool.filament.vendor.name) || '—' }}</td></tr>
                                <tr><td class="font-weight-bold">Filament</td><td>{{ (detailSpool.filament && detailSpool.filament.name) || '—' }}</td></tr>
                                <tr><td class="font-weight-bold">Material</td><td>{{ (detailSpool.filament && detailSpool.filament.material) || '—' }}</td></tr>
                                <tr v-if="detailSpool.filament && detailSpool.filament.color_hex"><td class="font-weight-bold">Color</td><td>
                                    <div :style="{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#' + detailSpool.filament.color_hex, border: '1px solid rgba(255,255,255,0.3)', display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }" />
                                    #{{ detailSpool.filament.color_hex }}
                                </td></tr>
                                <tr><td class="font-weight-bold">Initial Weight</td><td>{{ detailSpool.initial_weight != null ? detailSpool.initial_weight.toFixed(0) + ' g' : '—' }}</td></tr>
                                <tr><td class="font-weight-bold">Remaining</td><td>{{ detailSpool.remaining_weight != null ? detailSpool.remaining_weight.toFixed(0) + ' g' : '—' }}</td></tr>
                                <tr><td class="font-weight-bold">Loaded On</td><td>
                                    <v-chip v-if="detailSpool.loaded_on_printer" x-small color="success" dark>{{ detailSpool.loaded_on_printer }}</v-chip>
                                    <span v-else>Not loaded</span>
                                </td></tr>
                                <tr><td class="font-weight-bold">Location</td><td>{{ detailSpool.location || '—' }}</td></tr>
                            </tbody>
                        </v-simple-table>
                    </div>

                    <!-- Parts list -->
                    <div class="d-flex align-center mb-1">
                        <span class="text-subtitle-2 font-weight-bold">Parts ({{ detailParts.length }})</span>
                    </div>
                    <v-progress-linear v-if="detailPartsLoading" indeterminate color="primary" class="mb-2" />
                    <v-simple-table v-else-if="detailParts.length" dense>
                        <thead>
                            <tr>
                                <th>QR Code</th>
                                <th>Linked At</th>
                                <th>QC Status</th>
                                <th>QC Inspector</th>
                                <th>QC Date</th>
                                <th>QC Note</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="part in detailParts" :key="part.id" :class="{ 'primary--text font-weight-bold': detailClickedPart && part.id === detailClickedPart.id }">
                                <td>{{ part.qr_code }}</td>
                                <td>{{ part.qr_linked_at ? new Date(part.qr_linked_at).toLocaleString() : '—' }}</td>
                                <td>
                                    <v-chip v-if="part.qc_status" x-small :color="part.qc_status === 'pass' ? 'success' : part.qc_status === 'fail' ? 'error' : 'warning'" dark>
                                        {{ part.qc_status }}
                                    </v-chip>
                                    <span v-else>—</span>
                                </td>
                                <td>{{ part.qc_inspector || '—' }}</td>
                                <td>{{ part.qc_date ? new Date(part.qc_date).toLocaleString() : '—' }}</td>
                                <td>{{ part.qc_note || '—' }}</td>
                            </tr>
                        </tbody>
                    </v-simple-table>
                    <p v-else class="caption grey--text">No parts linked to this job.</p>
                </v-card-text>
            </v-card>
        </v-dialog>

        <!-- Snackbar -->
        <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3000" bottom>
            {{ snackbarText }}
        </v-snackbar>

        <!-- Delete Part Confirmation -->
        <v-dialog v-model="deleteDialog" max-width="360">
            <v-card>
                <v-card-title class="text-subtitle-1">Delete Part</v-card-title>
                <v-card-text>
                    Are you sure you want to delete part <strong>{{ deleteTarget?.qr_code }}</strong>?
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="deleteDialog = false">Cancel</v-btn>
                    <v-btn color="error" text :loading="deleteLoading" @click="executeDeletePart">Delete</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Add Part Mode Overlay -->
        <v-dialog v-model="addPartMode" fullscreen persistent no-click-animation>
            <v-card class="d-flex flex-column" style="height: 100vh" @click="onAddPartCardClick">
                <!-- Header -->
                <v-card-title class="d-flex align-center py-2">
                    <v-icon left color="primary">{{ mdiPackageVariantClosed }}</v-icon>
                    <span>Add Part Mode</span>
                    <v-spacer />
                    <v-btn icon @click="exitAddPartMode">
                        <v-icon>{{ mdiClose }}</v-icon>
                    </v-btn>
                </v-card-title>

                <!-- Printer banner -->
                <div v-if="addPartSelectedPrinter" class="add-part-printer-banner d-flex align-center px-4 py-2" style="background: var(--v-primary-base); color: white;">
                    <v-icon color="white" class="mr-3" size="28">{{ mdiPrinter3d }}</v-icon>
                    <span class="text-h5 font-weight-bold">{{ addPartSelectedPrinter }}</span>
                    <v-chip v-if="addPartSelectedJob" small class="ml-4" color="white" outlined dark>
                        {{ addPartSelectedJob.filename || addPartSelectedJob.moonraker_job_id }}
                    </v-chip>
                </div>
                <div v-else class="d-flex align-center px-4 py-2" style="background: rgba(255,255,255,0.05);">
                    <v-icon class="mr-3" size="28" color="grey">{{ mdiPrinter3d }}</v-icon>
                    <span class="text-h6 grey--text">No printer selected — scan a printer QR code</span>
                </div>
                <v-divider />

                <!-- Visible scan input -->
                <div class="d-flex align-center px-4 py-2" style="background: rgba(255,255,255,0.03);">
                    <v-text-field
                        ref="addPartScanInput"
                        v-model="addPartScanBuffer"
                        label="Scan or type here"
                        dense
                        outlined
                        hide-details
                        :prepend-inner-icon="mdiQrcodeScan"
                        @keydown.enter="processAddPartScan"
                        @focus="addPartScanFocused = true"
                        @blur="addPartScanFocused = false"
                        autofocus
                        class="flex-grow-1"
                    />
                </div>

                <v-card-text class="d-flex flex-column flex-grow-1 pa-4" style="overflow-y: auto">
                    <!-- Status alert -->
                    <v-alert
                        v-if="addPartStatusMessage"
                        :type="addPartStatusType"
                        dense
                        class="mb-4"
                        dismissible
                        @input="addPartStatusMessage = ''"
                    >
                        {{ addPartStatusMessage }}
                    </v-alert>

                    <v-row class="flex-grow-1" no-gutters>
                        <!-- Left: Active Job Selection -->
                        <v-col cols="12" md="6" class="pr-md-2">
                            <v-card outlined class="fill-height d-flex flex-column">
                                <v-card-title class="subtitle-2 py-2">
                                    {{ addPartSelectedPrinter ? `Jobs — ${addPartSelectedPrinter}` : 'Scan Printer QR to Begin' }}
                                </v-card-title>
                                <v-divider />
                                <v-card-text v-if="!addPartSelectedPrinter" class="d-flex flex-column align-center justify-center flex-grow-1" style="min-height: 200px">
                                    <v-icon size="80" color="grey lighten-1">{{ mdiPrinter3d }}</v-icon>
                                    <p class="text-h6 grey--text mt-4">Scan a printer hostname QR code</p>
                                    <p class="caption grey--text">Printer QR codes end with .local</p>
                                </v-card-text>
                                <v-card-text v-else-if="addPartRecentJobsLoading" class="d-flex align-center justify-center flex-grow-1">
                                    <v-progress-circular indeterminate color="primary" />
                                </v-card-text>
                                <v-card-text v-else-if="addPartRecentJobs.length === 0" class="d-flex flex-column align-center justify-center flex-grow-1">
                                    <p class="grey--text">No completed jobs found for this printer.</p>
                                </v-card-text>
                                <v-list v-else dense class="flex-grow-1 overflow-y-auto pa-0">
                                    <v-list-item
                                        v-for="job in addPartRecentJobs"
                                        :key="job.id"
                                        :class="{ 'primary--text v-list-item--active': addPartSelectedJob && addPartSelectedJob.id === job.id }"
                                        @click="selectAddPartJob(job)"
                                        style="cursor: pointer"
                                    >
                                        <v-list-item-content>
                                            <v-list-item-title>
                                                {{ job.filename || 'Unknown file' }}
                                                <v-chip x-small :color="statusColor(job.status)" dark class="ml-2">
                                                    {{ job.status || 'unknown' }}
                                                </v-chip>
                                                <v-chip x-small class="ml-1" outlined>
                                                    {{ job.parts_count ?? 0 }} parts
                                                </v-chip>
                                            </v-list-item-title>
                                            <v-list-item-subtitle>
                                                {{ job.end_time ? new Date(job.end_time).toLocaleString() : '—' }}
                                                &bull; {{ formatDuration(job.print_duration_secs) }}
                                            </v-list-item-subtitle>
                                        </v-list-item-content>
                                        <v-list-item-action v-if="addPartSelectedJob && addPartSelectedJob.id === job.id">
                                            <v-icon small color="primary">{{ mdiCheckCircle }}</v-icon>
                                        </v-list-item-action>
                                    </v-list-item>
                                </v-list>
                            </v-card>
                        </v-col>

                        <!-- Right: Session Log -->
                        <v-col cols="12" md="6" class="pl-md-2 mt-4 mt-md-0">
                            <v-card outlined class="fill-height d-flex flex-column">
                                <v-card-title class="subtitle-2 py-2">
                                    Session Log ({{ addPartRegisteredParts.length }})
                                </v-card-title>
                                <v-divider />
                                <v-card-text v-if="!addPartSelectedJob" class="d-flex flex-column align-center justify-center flex-grow-1" style="min-height: 200px">
                                    <v-icon size="60" color="grey lighten-1">{{ mdiQrcodeScan }}</v-icon>
                                    <p class="grey--text mt-4">Select a printer and job, then scan part QR codes</p>
                                    <p class="caption grey--text">Part QR codes are numbers only</p>
                                </v-card-text>
                                <template v-else>
                                    <v-card-text v-if="addPartRegisteredParts.length === 0" class="d-flex flex-column align-center justify-center flex-grow-1" style="min-height: 200px">
                                        <v-icon size="60" color="success">{{ mdiQrcodeScan }}</v-icon>
                                        <p class="text-h6 success--text mt-4">Ready — scan part QR codes</p>
                                        <p class="caption grey--text">
                                            Job: {{ addPartSelectedJob.filename || addPartSelectedJob.moonraker_job_id }}
                                        </p>
                                    </v-card-text>
                                    <v-simple-table v-else dense class="flex-grow-1">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>QR Code</th>
                                                <th>Printer</th>
                                                <th>Job</th>
                                                <th>Time</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr v-for="(entry, idx) in addPartRegisteredParts.slice().reverse()" :key="idx">
                                                <td>{{ addPartRegisteredParts.length - idx }}</td>
                                                <td class="font-weight-bold">{{ entry.qr_code }}</td>
                                                <td>{{ entry.hostname }}</td>
                                                <td>{{ entry.filename }}</td>
                                                <td>{{ entry.time }}</td>
                                            </tr>
                                        </tbody>
                                    </v-simple-table>
                                </template>
                            </v-card>
                        </v-col>
                    </v-row>
                </v-card-text>
            </v-card>
        </v-dialog>

        <!-- QC Mode Overlay -->
        <v-dialog v-model="qcMode" fullscreen persistent no-click-animation>
            <v-card class="qc-mode-card d-flex flex-column" :style="{ height: '100vh', backgroundColor: qcFlashVisible ? (qcFlashResult === 'pass' ? '#C8E6C9' : '#FFCDD2') : undefined, transition: 'background-color 0.3s ease' }" @click="onQcCardClick">
                <!-- Header -->
                <v-card-title class="d-flex align-center py-2">
                    <v-icon left color="primary">{{ mdiQrcodeScan }}</v-icon>
                    <span>QC Mode</span>
                    <v-chip v-if="qcInspector" small class="ml-3" color="primary" outlined>
                        Inspector: {{ qcInspector }}
                    </v-chip>
                    <v-spacer />
                    <v-btn icon @click="exitQcMode">
                        <v-icon>{{ mdiClose }}</v-icon>
                    </v-btn>
                </v-card-title>
                <v-divider />

                <!-- Step 1: Inspector Selection -->
                <v-card-text v-if="qcStep === 'inspector'" class="d-flex flex-column align-center pt-12">
                    <v-icon size="64" color="primary" class="mb-4">{{ mdiAccountCheck }}</v-icon>
                    <h2 class="mb-4">Enter Inspector Name</h2>
                    <v-text-field
                        v-model="qcInspector"
                        label="Inspector Name"
                        dense
                        outlined
                        style="max-width: 400px; width: 100%"
                        hide-details
                        autofocus
                        @keydown.enter="confirmInspector"
                    />
                    <div v-if="qcInspectorList.length" class="d-flex flex-wrap mt-2" style="max-width: 400px; gap: 8px">
                        <v-chip
                            v-for="name in qcInspectorList"
                            :key="name"
                            small
                            outlined
                            :color="qcInspector === name ? 'primary' : ''"
                            @click="qcInspector = name"
                            style="cursor: pointer"
                        >
                            {{ name }}
                        </v-chip>
                    </div>
                    <v-btn color="primary" class="mt-4" :disabled="!qcInspector" @click="confirmInspector">
                        Start QC
                    </v-btn>
                </v-card-text>

                <!-- Step 2: Scanning -->
                <v-card-text v-else-if="qcStep === 'scanning'" class="d-flex flex-column flex-grow-1 pa-4" :class="{ 'qc-mobile-scanning': isMobile }">
                    <!-- Desktop: hidden input for barcode scanner -->
                    <input
                        v-if="!isMobile"
                        ref="qcScanInput"
                        v-model="qcScanBuffer"
                        class="qc-hidden-input"
                        @keydown.enter="processScan"
                        autofocus
                        @blur="refocusScanInput"
                    />

                    <v-alert
                        v-if="qcStatusMessage"
                        :type="qcStatusType"
                        dense
                        class="mb-4"
                        dismissible
                        @input="qcStatusMessage = ''"
                    >
                        {{ qcStatusMessage }}
                    </v-alert>

                    <!-- Mobile: Camera capture + manual input -->
                    <div v-if="isMobile" class="d-flex flex-column align-center mb-4" style="width: 100%">
                        <input
                            ref="qcCameraInput"
                            type="file"
                            accept="image/*"
                            capture="environment"
                            class="qc-hidden-input"
                            @change="onCameraCapture"
                        />
                        <v-btn
                            color="primary"
                            :loading="qcCameraProcessing"
                            @click="openCameraCapture"
                            class="mb-3"
                        >
                            <v-icon left>{{ mdiCamera }}</v-icon>
                            Scan with Camera
                        </v-btn>
                        <v-text-field
                            v-model="qcManualCode"
                            label="Or type code manually"
                            dense
                            outlined
                            hide-details
                            style="max-width: 300px; width: 100%"
                            @keydown.enter="submitManualCode"
                        >
                            <template #append>
                                <v-btn icon small :disabled="!qcManualCode.trim()" @click="submitManualCode">
                                    <v-icon small>{{ mdiQrcodeScan }}</v-icon>
                                </v-btn>
                            </template>
                        </v-text-field>
                    </div>

                    <!-- Pass/Fail actions -->
                    <v-card outlined class="d-flex flex-column align-center justify-center pa-4 mb-4">
                        <p class="subtitle-2 mb-4">{{ qcSelectedRecord ? 'Scan or click to set QC result' : 'Select a part first' }}</p>

                        <div class="d-flex justify-space-between mb-6 qc-pass-fail-row" :style="isMobile ? { paddingLeft: '16px', paddingRight: '16px' } : { paddingLeft: '256px', paddingRight: '256px' }" style="width: 100%">
                            <v-card
                                outlined
                                class="pa-4 d-flex flex-column align-center qc-action-card"
                                :class="{ 'qc-action-disabled': !qcSelectedRecord }"
                                @click="qcSelectedRecord && submitQcResult('pass')"
                                style="cursor: pointer"
                            >
                                <img src="/img/icons/qr_code_1.png" alt="PASS" :style="isMobile ? 'width: 80px; height: 80px' : 'width: 120px; height: 120px'" />
                                <v-chip small color="success" dark class="mt-2">PASS</v-chip>
                            </v-card>
                            <v-card
                                outlined
                                class="pa-4 d-flex flex-column align-center qc-action-card"
                                :class="{ 'qc-action-disabled': !qcSelectedRecord }"
                                @click="qcSelectedRecord && submitQcResult('fail')"
                                style="cursor: pointer"
                            >
                                <img src="/img/icons/qr_code_0.png" alt="FAIL" :style="isMobile ? 'width: 80px; height: 80px' : 'width: 120px; height: 120px'" />
                                <v-chip small color="error" dark class="mt-2">FAIL</v-chip>
                            </v-card>
                        </div>

                        <p v-if="!isMobile" class="caption grey--text text-center">
                            Scan <strong>1</strong> for PASS or <strong>0</strong> for FAIL<br/>
                            Or click the buttons above
                        </p>

                        <v-expand-transition>
                            <div v-if="qcNoteVisible" style="width: 100%; max-width: 360px" class="mt-4">
                                <v-divider class="mb-3" />
                                <v-text-field
                                    v-model="qcNoteText"
                                    label="QC Note (optional)"
                                    dense
                                    outlined
                                    hide-details
                                    placeholder="Add a note for this inspection..."
                                    @keydown.enter="saveQcNote"
                                />
                                <v-btn small color="primary" class="mt-2" @click="saveQcNote" :disabled="!qcNoteText.trim()">
                                    Save Note
                                </v-btn>
                            </div>
                        </v-expand-transition>
                    </v-card>

                    <!-- Part info (below) -->
                    <v-card outlined>
                        <v-card-title class="subtitle-2 py-2">
                            {{ qcSelectedRecord ? 'Part Found' : 'Waiting for QR scan...' }}
                        </v-card-title>
                        <v-divider />
                        <v-card-text v-if="qcSelectedRecord" class="pt-3">
                            <v-simple-table dense>
                                <tbody>
                                    <tr><td class="font-weight-bold" width="150">QR Code</td><td>{{ qcSelectedRecord.qr_code }}</td></tr>
                                    <tr><td class="font-weight-bold">Printer</td><td>{{ qcSelectedRecord.printer_hostname }}</td></tr>
                                    <tr><td class="font-weight-bold">Model</td><td>{{ qcSelectedRecord.printer_model || '—' }}</td></tr>
                                    <tr><td class="font-weight-bold">Filename</td><td>
                                        {{ qcSelectedRecord.filename || '—' }}
                                        <v-btn
                                            v-if="qcSelectedRecord.gcode_archive_hash && !qcSelectedRecord.gcode_archive_hash.startsWith('deleted:')"
                                            x-small icon class="ml-1"
                                            title="Download archived gcode"
                                            @click="downloadArchivedGcode(qcSelectedRecord)"
                                        >
                                            <v-icon x-small>{{ mdiDownload }}</v-icon>
                                        </v-btn>
                                        <v-chip
                                            v-if="qcSelectedRecord.gcode_archive_hash && qcSelectedRecord.gcode_archive_hash.startsWith('deleted:')"
                                            x-small color="error" dark class="ml-1"
                                        >
                                            file deleted
                                        </v-chip>
                                    </td></tr>
                                    <tr><td class="font-weight-bold">Filament</td><td>{{ qcSelectedRecord.filament_type || '—' }}</td></tr>
                                    <tr><td class="font-weight-bold">Status</td><td>
                                        <v-chip x-small :color="statusColor(qcSelectedRecord.status)" dark>{{ qcSelectedRecord.status || 'unknown' }}</v-chip>
                                    </td></tr>
                                    <tr><td class="font-weight-bold">Start Time</td><td>{{ formatDate(qcSelectedRecord.start_time) }}</td></tr>
                                    <tr><td class="font-weight-bold">End Time</td><td>{{ qcSelectedRecord.status === 'in_progress' ? 'In Progress' : formatDate(qcSelectedRecord.end_time) }}</td></tr>
                                    <tr><td class="font-weight-bold">Duration</td><td>{{ formatDuration(qcSelectedRecord.print_duration_secs) }}</td></tr>
                                    <tr><td class="font-weight-bold">QC Status</td><td>
                                        <v-chip v-if="qcSelectedRecord.qc_status" x-small :color="qcSelectedRecord.qc_status === 'pass' ? 'success' : qcSelectedRecord.qc_status === 'fail' ? 'error' : 'warning'" dark>
                                            {{ qcSelectedRecord.qc_status }}
                                        </v-chip>
                                        <span v-else>Pending</span>
                                    </td></tr>
                                    <tr><td class="font-weight-bold">QC Inspector</td><td>{{ qcSelectedRecord.qc_inspector || '—' }}</td></tr>
                                    <tr><td class="font-weight-bold">QC Date</td><td>{{ qcSelectedRecord.qc_date ? new Date(qcSelectedRecord.qc_date).toLocaleString() : '—' }}</td></tr>
                                    <tr><td class="font-weight-bold">QC Note</td><td>{{ qcSelectedRecord.qc_note || '—' }}</td></tr>
                                </tbody>
                            </v-simple-table>
                        </v-card-text>
                        <v-card-text v-else class="d-flex flex-column align-center justify-center" style="min-height: 200px">
                            <v-icon size="80" color="grey lighten-1">{{ mdiQrcodeScan }}</v-icon>
                            <p class="text-h6 grey--text mt-4">Scan a part QR code to begin</p>
                        </v-card-text>
                    </v-card>
                </v-card-text>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { FleetHistoryRecord } from '@/store/fleet/history/types'
import { mdiCog, mdiQrcodeScan, mdiBug, mdiClose, mdiAccountCheck, mdiDelete, mdiCamera, mdiDownload, mdiPackageVariantClosed, mdiPrinter3d, mdiCheckCircle, mdiAlertCircle } from '@mdi/js'
import axios from 'axios'

@Component
export default class FleetPartsPanel extends Vue {
    mdiCog = mdiCog
    mdiQrcodeScan = mdiQrcodeScan
    mdiBug = mdiBug
    mdiClose = mdiClose
    mdiAccountCheck = mdiAccountCheck
    mdiDelete = mdiDelete
    mdiCamera = mdiCamera
    mdiDownload = mdiDownload
    mdiPackageVariantClosed = mdiPackageVariantClosed
    mdiPrinter3d = mdiPrinter3d
    mdiCheckCircle = mdiCheckCircle
    mdiAlertCircle = mdiAlertCircle

    // Filters
    filterQrCode = ''
    appliedQrCode = ''
    filterPrinter = ''
    printerSearch = ''
    filterQcStatus = ''
    filterFilename = ''
    debounceTimer: ReturnType<typeof setTimeout> | null = null

    // Local results — parts panel fetches independently to avoid sharing state with Jobs panel
    localRecords: FleetHistoryRecord[] = []
    localLoading = false

    // Inline editing
    editingQrId: string | null = null
    editingQrText = ''
    editingNoteId: string | null = null
    editingNoteText = ''

    // Snackbar
    snackbar = false
    snackbarText = ''
    snackbarColor = 'success'

    // Job Detail dialog
    detailDialog = false
    detailJob: FleetHistoryRecord | null = null
    detailClickedPart: FleetHistoryRecord | null = null
    detailParts: FleetHistoryRecord[] = []
    detailPartsLoading = false
    detailSpool: any = null

    // Delete part
    deleteDialog = false
    deleteTarget: FleetHistoryRecord | null = null
    deleteLoading = false

    // Column visibility & resize
    readonly STORAGE_KEY = 'fleet_parts_visible_columns'
    readonly WIDTHS_KEY = 'fleet_parts_column_widths'
    readonly HIDE_THRESHOLD = 36
    visibleColumns: string[] = []
    columnWidths: Record<string, number> = {}
    resizingCol = ''
    resizeStartX = 0
    resizeStartW = 0
    private _onMouseMove: ((e: MouseEvent) => void) | null = null
    private _onMouseUp: ((e: MouseEvent) => void) | null = null

    // QC Mode state
    qcMode = false
    qcStep: 'inspector' | 'scanning' = 'inspector'
    qcInspector = ''
    qcInspectorList: string[] = []
    qcInspectorsLoading = false
    qcScanBuffer = ''
    qcSelectedRecord: FleetHistoryRecord | null = null
    qcStatusMessage = ''
    qcStatusType: 'success' | 'error' | 'info' | 'warning' = 'info'
    qcFlashVisible = false
    qcFlashResult: 'pass' | 'fail' = 'pass'
    qcFlashTimer: ReturnType<typeof setTimeout> | null = null
    qcNoteVisible = false
    qcNoteText = ''

    // Mobile camera scanning
    qcCameraProcessing = false
    qcManualCode = ''

    // Add Part Mode state
    addPartMode = false
    addPartScanBuffer = ''
    addPartSelectedPrinter = ''
    addPartRecentJobs: FleetHistoryRecord[] = []
    addPartSelectedJob: FleetHistoryRecord | null = null
    addPartRecentJobsLoading = false
    addPartStatusMessage = ''
    addPartStatusType: 'success' | 'error' | 'info' | 'warning' = 'info'
    addPartRegisteredParts: Array<{ qr_code: string; hostname: string; filename: string; time: string }> = []
    addPartScanFocused = false

    readonly baseHeaders = [
        { text: 'QR Code', value: 'qr_code', sortable: true },
        { text: 'Printer', value: 'printer_hostname', sortable: true },
        { text: 'Model', value: 'printer_model', sortable: true },
        { text: 'Filename', value: 'filename', sortable: true },
        { text: 'Filament', value: 'filament_type', sortable: true },
        { text: 'Status', value: 'status', sortable: true },
        { text: 'Start', value: 'start_time', sortable: true },
        { text: 'Duration', value: 'print_duration_secs', sortable: true },
        { text: 'Filament Used', value: 'filament_used_mm', sortable: true },
        { text: 'Remaining Wt', value: 'filament_remaining_weight', sortable: true },
        { text: 'Nozzle Type', value: 'printer_nozzle_type', sortable: true },
        { text: 'Nozzle Health', value: 'nozzle_health', sortable: false },
        { text: 'Linked At', value: 'qr_linked_at', sortable: true },
        { text: 'QC', value: 'qc_status', sortable: false },
        { text: 'QC Inspector', value: 'qc_inspector', sortable: true },
        { text: 'QC Date', value: 'qc_date', sortable: true },
        { text: 'QC Note', value: 'qc_note', sortable: false },
    ]

    readonly devHeaders = [
        { text: 'Moonraker Job ID', value: 'moonraker_job_id', sortable: true },
        { text: '', value: 'actions', sortable: false },
    ]

    get allHeaders() {
        return this.devMode ? [...this.baseHeaders, ...this.devHeaders] : this.baseHeaders
    }

    get devColumnValues(): string[] {
        return this.devHeaders.map((h) => h.value)
    }

    get computedHeaders() {
        return this.allHeaders
            .filter((h) => this.visibleColumns.includes(h.value) || this.devColumnValues.includes(h.value))
            .map((h) => {
                const w = this.columnWidths[h.value]
                return w ? { ...h, width: `${w}px` } : h
            })
    }

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
            this.visibleColumns = ['qr_code', 'printer_hostname', 'filename', 'filament_type', 'status', 'start_time', 'qc_status', 'qc_note']
        }
        try {
            const w = localStorage.getItem(this.WIDTHS_KEY)
            if (w) this.columnWidths = JSON.parse(w)
        } catch { /* ignore */ }
    }

    mounted() {
        this.$nextTick(() => this.attachResizeHandles())
        this.applyFilters()
    }

    updated() {
        this.$nextTick(() => this.attachResizeHandles())
    }

    beforeDestroy() {
        this.cleanupResizeListeners()
    }

    get isMobile(): boolean {
        return 'ontouchstart' in window && window.innerWidth < 768
    }

    readonly qcOptions = [
        { text: '—', value: null },
        { text: 'Pass', value: 'pass' },
        { text: 'Fail', value: 'fail' },
        { text: 'Pending', value: 'pending' },
    ]

    readonly qcFilterOptions = ['pass', 'fail', 'pending']

    get devMode(): boolean {
        return this.$store.getters['fleet/history/isDevMode']
    }

    toggleDevMode() {
        this.$store.commit('fleet/history/setDevMode', !this.devMode)
    }

    get isLoading(): boolean {
        return this.localLoading
    }

    /** Only show QR-linked rows (parts) */
    get partRecords(): FleetHistoryRecord[] {
        return this.localRecords
    }

    get printerOptions(): string[] {
        const hostnames = this.partRecords.map((r) => r.printer_hostname).filter(Boolean)
        return [...new Set(hostnames)].sort()
    }

    get filteredRecords(): FleetHistoryRecord[] {
        let data = this.partRecords
        // Client-side partial printer name filter (while typing in combobox — before selection is confirmed)
        const pSearch = (this.printerSearch || '').trim().toLowerCase()
        if (pSearch && pSearch !== (this.filterPrinter || '').toLowerCase()) {
            data = data.filter((r) => r.printer_hostname?.toLowerCase().includes(pSearch))
        }
        // Client-side filters when not in dev mode (server-side in dev mode)
        if (!this.devMode) {
            if (this.filterQcStatus) {
                if (this.filterQcStatus === 'pending') {
                    data = data.filter((r) => !r.qc_status || r.qc_status === 'pending')
                } else {
                    data = data.filter((r) => r.qc_status === this.filterQcStatus)
                }
            }
            if (this.filterFilename) {
                const q = this.filterFilename.toLowerCase()
                data = data.filter((r) => r.filename?.toLowerCase().includes(q))
            }
        }
        return data
    }

    localTotal = 0
    loadingMore = false

    get hasMore(): boolean {
        return this.localRecords.length < this.localTotal
    }

    async applyFilters() {
        const baseUrl = this.$store.getters['gui/fleetDaemonUrl'] ?? 'http://pantheonfleet.local:8090'
        const params = new URLSearchParams()
        if (this.appliedQrCode) params.set('qr_code', this.appliedQrCode)
        if (this.filterPrinter) params.set('printer', this.filterPrinter)
        if (this.devMode && this.filterQcStatus) params.set('qc_status', this.filterQcStatus)
        if (this.devMode && this.filterFilename) params.set('filename', this.filterFilename)
        params.set('has_qr_code', 'true')
        params.set('limit', '200')
        this.localLoading = true
        try {
            const response = await axios.get(`${baseUrl}/history?${params}`)
            this.localRecords = response.data.records ?? response.data
            this.localTotal = response.data.total ?? this.localRecords.length
        } catch {
            this.localRecords = []
            this.localTotal = 0
        } finally {
            this.localLoading = false
        }
    }

    async loadMore() {
        const baseUrl = this.$store.getters['gui/fleetDaemonUrl'] ?? 'http://pantheonfleet.local:8090'
        const params = new URLSearchParams()
        if (this.appliedQrCode) params.set('qr_code', this.appliedQrCode)
        if (this.filterPrinter) params.set('printer', this.filterPrinter)
        if (this.devMode && this.filterQcStatus) params.set('qc_status', this.filterQcStatus)
        if (this.devMode && this.filterFilename) params.set('filename', this.filterFilename)
        params.set('has_qr_code', 'true')
        params.set('limit', '200')
        params.set('offset', String(this.localRecords.length))
        this.loadingMore = true
        try {
            const response = await axios.get(`${baseUrl}/history?${params}`)
            const records: FleetHistoryRecord[] = response.data.records ?? response.data
            const existing = new Set(this.localRecords.map((r) => r.id))
            this.localRecords = [...this.localRecords, ...records.filter((r) => !existing.has(r.id))]
            this.localTotal = response.data.total ?? this.localTotal
        } finally {
            this.loadingMore = false
        }
    }

    applyQrCodeFilter() {
        let qr = (this.filterQrCode || '').trim()
        // Strip #1 or #0 prefix from pass/fail scanners
        if (qr.match(/^#[01]/)) qr = qr.slice(2)
        if (qr) {
            this.appliedQrCode = qr
            this.applyFilters()
        }
        // Clear input for next scan
        this.$nextTick(() => {
            this.filterQrCode = ''
            const input = this.$refs.qrSearchInput as any
            if (input) input.focus()
        })
    }

    clearQrFilter() {
        this.appliedQrCode = ''
        this.filterQrCode = ''
        this.applyFilters()
        this.$nextTick(() => {
            const input = this.$refs.qrSearchInput as any
            if (input) input.focus()
        })
    }

    applyFiltersDebounced() {
        if (this.debounceTimer) clearTimeout(this.debounceTimer)
        this.debounceTimer = setTimeout(() => this.applyFilters(), 400)
    }

    // ---- Inline QR editing (dev mode) ----

    startEditQr(item: FleetHistoryRecord) {
        this.editingQrId = item.id
        this.editingQrText = item.qr_code || ''
    }

    cancelEditQr() {
        this.editingQrId = null
        this.editingQrText = ''
    }

    async saveQr(item: FleetHistoryRecord) {
        const newQr = this.editingQrText.trim()
        this.editingQrId = null
        if (newQr === (item.qr_code || '')) return
        try {
            await this.$store.dispatch('fleet/history/updateQC', { id: item.id, qr_code: newQr || '' })
            this.showSnackbar('QR code saved', 'success')
        } catch (err: any) {
            if (err?.response?.status === 409) {
                this.showSnackbar('QR code already assigned to another record (409 Conflict)', 'error')
            } else {
                this.showSnackbar('Failed to save QR code', 'error')
            }
        }
    }

    // ---- Inline QC editing ----

    async saveQC(item: FleetHistoryRecord, qcStatus: string | null) {
        try {
            await this.$store.dispatch('fleet/history/updateQC', { id: item.id, qc_status: qcStatus ?? '', qc_date: new Date().toISOString().slice(0, 10) })
            this.showSnackbar('QC saved', 'success')
        } catch {
            this.showSnackbar('Failed to save QC', 'error')
        }
    }

    startEditNote(item: FleetHistoryRecord) {
        this.editingNoteId = item.id
        this.editingNoteText = item.qc_note || ''
    }

    cancelEditNote() {
        this.editingNoteId = null
        this.editingNoteText = ''
    }

    async saveNote(item: FleetHistoryRecord) {
        const newNote = this.editingNoteText.trim()
        this.editingNoteId = null
        if (newNote === (item.qc_note || '')) return
        try {
            await this.$store.dispatch('fleet/history/updateQC', { id: item.id, qc_note: newNote || '' })
            this.showSnackbar('Note saved', 'success')
        } catch {
            this.showSnackbar('Failed to save note', 'error')
        }
    }

    showSnackbar(text: string, color: string) {
        this.snackbarText = text
        this.snackbarColor = color
        this.snackbar = true
    }

    // ---- QC Mode ----

    async enterQcMode() {
        this.qcMode = true
        this.qcStep = 'inspector'
        this.qcInspector = ''
        this.qcSelectedRecord = null
        this.qcStatusMessage = ''
        this.qcScanBuffer = ''

        this.qcInspectorsLoading = true
        try {
            this.qcInspectorList = await this.$store.dispatch('fleet/history/fetchInspectors')
        } catch {
            this.qcInspectorList = []
        } finally {
            this.qcInspectorsLoading = false
        }
    }

    exitQcMode() {
        this.qcMode = false
        this.qcStep = 'inspector'
        this.qcSelectedRecord = null
        this.qcScanBuffer = ''
        this.qcStatusMessage = ''
        this.applyFilters()
    }

    confirmInspector() {
        if (!this.qcInspector) return
        this.qcStep = 'scanning'
        this.$nextTick(() => this.refocusScanInput())
    }

    onQcCardClick(e: MouseEvent) {
        // Don't steal focus if clicking on an input/button/textarea
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || tag === 'button') return
        if (this.qcNoteVisible) return
        this.refocusScanInput()
    }

    refocusScanInput() {
        this.$nextTick(() => {
            // Don't steal focus when the QC note field is active
            if (this.qcNoteVisible) return
            const input = this.$refs.qcScanInput as HTMLInputElement | undefined
            if (input && this.qcMode && this.qcStep === 'scanning') {
                input.focus()
            }
        })
    }

    async processScan() {
        const scanned = this.qcScanBuffer.trim()
        this.qcScanBuffer = ''
        if (!scanned) return

        // Check if it's a pass/fail code (plain "1"/"0")
        if (scanned === '1' || scanned === '0') {
            if (!this.qcSelectedRecord) return
            await this.submitQcResult(scanned === '1' ? 'pass' : 'fail')
            return
        }

        // Check for #1 or #0 prefix
        const prefixMatch = scanned.match(/^#([01])(.+)$/)
        if (prefixMatch && (prefixMatch[2] === '0' || prefixMatch[2] === '1')) {
            this.qcStatusMessage = 'Pass/Fail codes should not be scanned with the QC scanner. Use the standard scanner instead.'
            this.qcStatusType = 'warning'
            this.refocusScanInput()
            return
        }
        if (prefixMatch) {
            const qcResult: 'pass' | 'fail' = prefixMatch[1] === '1' ? 'pass' : 'fail'
            const qrCode = prefixMatch[2]

            this.qcStatusMessage = ''
            this.qcNoteVisible = false
            this.qcNoteText = ''
            try {
                const record = await this.$store.dispatch('fleet/history/searchByQrCode', qrCode)
                if (record) {
                    this.qcSelectedRecord = record
                    await this.submitQcResult(qcResult)
                } else {
                    this.qcSelectedRecord = null
                    this.qcStatusMessage = `No part found for QR code: ${qrCode}`
                    this.qcStatusType = 'warning'
                }
            } catch {
                this.qcStatusMessage = `Error searching for QR code: ${qrCode}`
                this.qcStatusType = 'error'
            }
            this.refocusScanInput()
            return
        }

        // Otherwise treat as a part QR code
        this.qcStatusMessage = ''
        this.qcNoteVisible = false
        this.qcNoteText = ''
        try {
            const record = await this.$store.dispatch('fleet/history/searchByQrCode', scanned)
            if (record) {
                this.qcSelectedRecord = record
                this.qcStatusMessage = `Found part: ${record.qr_code} (${record.filename || record.printer_hostname})`
                this.qcStatusType = 'info'
            } else {
                this.qcSelectedRecord = null
                this.qcStatusMessage = `No part found for QR code: ${scanned}`
                this.qcStatusType = 'warning'
            }
        } catch {
            this.qcStatusMessage = `Error searching for QR code: ${scanned}`
            this.qcStatusType = 'error'
        }
        this.refocusScanInput()
    }

    async submitQcResult(result: 'pass' | 'fail') {
        if (!this.qcSelectedRecord) return
        try {
            await this.$store.dispatch('fleet/history/updateQC', {
                id: this.qcSelectedRecord.id,
                qc_status: result,
                qc_inspector: this.qcInspector,
                qc_date: new Date().toISOString().slice(0, 10),
            })
            const updated = await this.$store.dispatch('fleet/history/searchByQrCode', this.qcSelectedRecord.qr_code)
            if (updated) this.qcSelectedRecord = updated

            this.qcStatusMessage = `QC ${result.toUpperCase()} recorded for ${this.qcSelectedRecord?.qr_code}`
            this.qcStatusType = result === 'pass' ? 'success' : 'error'
            this.qcFlashResult = result
            this.qcFlashVisible = true
            if (this.qcFlashTimer) clearTimeout(this.qcFlashTimer)
            this.qcFlashTimer = setTimeout(() => { this.qcFlashVisible = false }, 2000)
            this.qcNoteVisible = true
            this.qcNoteText = ''
        } catch {
            this.qcStatusMessage = 'Failed to update QC status'
            this.qcStatusType = 'error'
        }
        this.refocusScanInput()
    }

    async saveQcNote() {
        const note = this.qcNoteText.trim()
        if (!note || !this.qcSelectedRecord) return
        try {
            await this.$store.dispatch('fleet/history/updateQC', {
                id: this.qcSelectedRecord.id,
                qc_note: note,
            })
            const updated = await this.$store.dispatch('fleet/history/searchByQrCode', this.qcSelectedRecord.qr_code)
            if (updated) this.qcSelectedRecord = updated
            this.showSnackbar('Note saved', 'success')
        } catch {
            this.showSnackbar('Failed to save note', 'error')
        }
        this.qcNoteVisible = false
        this.qcNoteText = ''
        this.refocusScanInput()
    }

    // ---- Add Part Mode ----

    enterAddPartMode() {
        this.addPartMode = true
        this.addPartScanBuffer = ''
        this.addPartSelectedPrinter = ''
        this.addPartRecentJobs = []
        this.addPartSelectedJob = null
        this.addPartStatusMessage = ''
        this.addPartRegisteredParts = []
        this.$nextTick(() => this.refocusAddPartInput())
    }

    exitAddPartMode() {
        this.addPartMode = false
        this.addPartSelectedPrinter = ''
        this.addPartRecentJobs = []
        this.addPartSelectedJob = null
        this.addPartScanBuffer = ''
        this.addPartStatusMessage = ''
        this.addPartRegisteredParts = []
        this.applyFilters()
    }

    refocusAddPartInput() {
        this.$nextTick(() => {
            const field = this.$refs.addPartScanInput as any
            if (field && this.addPartMode) {
                if (field.focus) field.focus()
                else if (field.$el) field.$el.querySelector('input')?.focus()
            }
        })
    }

    onAddPartCardClick(e: MouseEvent) {
        const el = e.target as HTMLElement
        if (el.closest('input, textarea, button, .v-input, .v-btn, .v-list-item')) return
        this.refocusAddPartInput()
    }

    selectAddPartJob(job: FleetHistoryRecord) {
        this.addPartSelectedJob = job
        this.addPartStatusMessage = `Selected job: ${job.filename || job.moonraker_job_id}`
        this.addPartStatusType = 'info'
        this.$nextTick(() => this.refocusAddPartInput())
    }

    async processAddPartScan() {
        const scanned = this.addPartScanBuffer.trim()
        this.addPartScanBuffer = ''
        if (!scanned) return

        // Printer hostname scan (ends with .local)
        if (scanned.endsWith('.local')) {
            this.addPartRecentJobsLoading = true
            this.addPartStatusMessage = ''
            try {
                const jobs = await this.$store.dispatch('fleet/history/fetchRecentJobs', {
                    printer_hostname: scanned,
                    limit: 10,
                })
                if (jobs.length > 0) {
                    this.addPartSelectedPrinter = scanned
                    this.addPartRecentJobs = jobs
                    this.addPartSelectedJob = jobs[0]
                    this.addPartStatusMessage = `Printer: ${scanned} — ${jobs.length} recent job${jobs.length > 1 ? 's' : ''}`
                    this.addPartStatusType = 'success'
                } else {
                    this.addPartSelectedPrinter = ''
                    this.addPartRecentJobs = []
                    this.addPartSelectedJob = null
                    this.addPartStatusMessage = `Scanned ${scanned}, no completed jobs found for this printer`
                    this.addPartStatusType = 'warning'
                }
            } catch {
                this.addPartSelectedPrinter = ''
                this.addPartRecentJobs = []
                this.addPartSelectedJob = null
                this.addPartStatusMessage = `Scanned ${scanned}, not a valid printer`
                this.addPartStatusType = 'error'
            } finally {
                this.addPartRecentJobsLoading = false
            }
            this.refocusAddPartInput()
            return
        }

        // Part QR code scan (numbers only)
        if (/^\d+$/.test(scanned)) {
            if (!this.addPartSelectedJob) {
                this.addPartStatusMessage = 'Scan a printer hostname first before scanning parts'
                this.addPartStatusType = 'warning'
                this.refocusAddPartInput()
                return
            }
            try {
                await this.$store.dispatch('fleet/history/linkQrCode', {
                    printer_hostname: this.addPartSelectedPrinter,
                    moonraker_job_id: this.addPartSelectedJob.moonraker_job_id,
                    qr_code: scanned,
                })
                const jobName = this.addPartSelectedJob.filename || this.addPartSelectedJob.moonraker_job_id
                this.addPartStatusMessage = `Part ${scanned} registered to ${jobName}`
                this.addPartStatusType = 'success'
                this.addPartRegisteredParts.push({
                    qr_code: scanned,
                    hostname: this.addPartSelectedPrinter,
                    filename: jobName,
                    time: new Date().toLocaleTimeString(),
                })
                // Update the parts count on the selected job
                if (this.addPartSelectedJob.parts_count != null) {
                    const updated = { ...this.addPartSelectedJob, parts_count: this.addPartSelectedJob.parts_count + 1 }
                    this.addPartSelectedJob = updated
                    const idx = this.addPartRecentJobs.findIndex((j) => j.id === updated.id)
                    if (idx >= 0) this.$set(this.addPartRecentJobs, idx, updated)
                }
            } catch (err: any) {
                const msg = err?.response?.data?.detail || err?.response?.data?.error || 'Failed to register part'
                this.addPartStatusMessage = `Error: ${msg}`
                this.addPartStatusType = 'error'
            }
            this.refocusAddPartInput()
            return
        }

        // Invalid scan
        this.addPartStatusMessage = `Scanned "${scanned}", not a valid printer (.local) or part QR (numbers only)`
        this.addPartStatusType = 'warning'
        this.refocusAddPartInput()
    }

    // ---- Mobile camera scanning ----

    openCameraCapture() {
        const input = this.$refs.qcCameraInput as HTMLInputElement | undefined
        if (input) {
            input.value = ''
            input.click()
        }
    }

    async submitManualCode() {
        const code = this.qcManualCode.trim()
        if (!code) return
        this.qcManualCode = ''
        this.qcScanBuffer = code
        await this.processScan()
    }

    async onCameraCapture(e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return
        this.qcCameraProcessing = true
        try {
            const { readBarcodesFromImageFile } = await import('zxing-wasm')
            const blob = new Blob([await file.arrayBuffer()], { type: file.type })
            const results = await readBarcodesFromImageFile(blob, {
                formats: ['DataMatrix', 'QRCode'],
                tryHarder: true,
                tryRotate: true,
                tryInvert: true,
                tryDownscale: true,
                maxNumberOfSymbols: 1,
            })
            if (results.length && results[0].text) {
                this.qcScanBuffer = results[0].text
                await this.processScan()
            } else {
                this.qcStatusMessage = 'No code found in photo. Ensure the Data Matrix is clearly visible and well-lit.'
                this.qcStatusType = 'warning'
            }
        } catch {
            this.qcStatusMessage = 'Failed to process photo. Please try again.'
            this.qcStatusType = 'error'
        } finally {
            this.qcCameraProcessing = false
        }
    }

    // ---- Column resize ----

    attachResizeHandles() {
        const table = (this.$refs.partsTable as any)?.$el as HTMLElement | undefined
        if (!table) return
        const ths = table.querySelectorAll('thead th')
        ths.forEach((th, idx) => {
            const el = th as HTMLElement
            if (el.querySelector('.col-resize-handle')) return
            el.style.position = 'relative'
            const handle = document.createElement('div')
            handle.className = 'col-resize-handle'
            handle.addEventListener('mousedown', (e) => {
                const header = this.computedHeaders[idx]
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

    onResizeEnd(e: MouseEvent, th: HTMLElement) {
        this.cleanupResizeListeners()
        const delta = e.clientX - this.resizeStartX
        const newW = Math.max(20, this.resizeStartW + delta)

        // Block the click event that fires after mouseup to prevent sort toggle
        const blockClick = (ev: Event) => { ev.stopPropagation(); ev.preventDefault() }
        th.addEventListener('click', blockClick, { capture: true, once: true })

        if (newW < this.HIDE_THRESHOLD) {
            const col = this.allHeaders.find((h) => h.value === this.resizingCol)
            this.toggleColumn(this.resizingCol)
            delete this.columnWidths[this.resizingCol]
            localStorage.setItem(this.WIDTHS_KEY, JSON.stringify(this.columnWidths))
            if (col) this.showSnackbar(`"${col.text}" column hidden`, 'info')
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

    // ---- Job Detail ----

    async openDetail(item: FleetHistoryRecord) {
        this.detailClickedPart = item
        this.detailJob = null
        this.detailParts = []
        this.detailPartsLoading = true
        this.detailSpool = null
        this.detailDialog = true
        try {
            // Fetch all records for this job (base + parts)
            const baseUrl = this.$store.getters['gui/fleetDaemonUrl'] ?? 'http://pantheonfleet.local:8090'
            const params = new URLSearchParams()
            params.set('printer', item.printer_hostname)
            params.set('moonraker_job_id', item.moonraker_job_id)
            params.set('limit', '500')
            const response = await axios.get(`${baseUrl}/history?${params}`)
            const records: FleetHistoryRecord[] = response.data.records ?? response.data
            // Base job row is the one without a qr_code
            this.detailJob = records.find((r) => r.qr_code == null) ?? item
            this.detailParts = records.filter((r) => r.qr_code != null)

            // Fetch spool info if spool_qr_code is set
            const spoolQr = this.detailJob.spool_qr_code || item.spool_qr_code
            if (spoolQr) {
                try {
                    this.detailSpool = await this.$store.dispatch('fleet/spools/lookupByQr', spoolQr)
                } catch { /* spool may have been deleted */ }
            }
        } catch {
            // Fallback: show the clicked part's info as the job
            this.detailJob = item
            this.detailParts = []
        } finally {
            this.detailPartsLoading = false
        }
    }

    // ---- Delete Part ----

    confirmDeletePart(item: FleetHistoryRecord) {
        this.deleteTarget = item
        this.deleteDialog = true
    }

    async executeDeletePart() {
        if (!this.deleteTarget) return
        this.deleteLoading = true
        try {
            const baseUrl = this.$store.getters['gui/fleetDaemonUrl'] ?? 'http://pantheonfleet.local:8090'
            await axios.delete(`${baseUrl}/history/part/${this.deleteTarget.id}`)
            this.showSnackbar(`Part deleted: ${this.deleteTarget.qr_code}`, 'success')
            this.deleteDialog = false
            this.localRecords = this.localRecords.filter((r) => r.id !== this.deleteTarget!.id)
            this.deleteTarget = null
        } catch (err: any) {
            if (err?.response?.status === 400) {
                this.showSnackbar('Cannot delete a base job record', 'error')
            } else if (err?.response?.status === 404) {
                this.showSnackbar('Part not found', 'error')
            } else {
                this.showSnackbar('Failed to delete part', 'error')
            }
        } finally {
            this.deleteLoading = false
        }
    }

    // ---- Helpers ----

    nozzleHealthPct(item: FleetHistoryRecord): number {
        if (!item.nozzle_life || item.printer_nozzle_start_health == null) return 0
        const pct = (item.printer_nozzle_start_health / item.nozzle_life) * 100
        return Math.round(Math.min(100, Math.max(0, pct)))
    }

    nozzleHealthColor(item: FleetHistoryRecord): string {
        const pct = this.nozzleHealthPct(item)
        if (pct > 60) return 'success'
        if (pct > 30) return 'warning'
        return 'error'
    }

    formatFilament(mm: number | null): string {
        if (!mm) return '—'
        const grams = mm * Math.PI * (1.75 / 2) ** 2 * 1.1 / 1000
        return `${grams.toFixed(1)} g`
    }

    statusColor(status: string | null): string {
        switch (status) {
            case 'completed': return 'success'
            case 'cancelled': return 'grey'
            case 'in_progress': return 'blue'
            case 'error':
            case 'klippy_shutdown':
            case 'klippy_disconnect': return 'error'
            default: return 'grey darken-1'
        }
    }

    formatDuration(secs: number | null): string {
        if (!secs) return '—'
        const h = Math.floor(secs / 3600)
        const m = Math.floor((secs % 3600) / 60)
        return `${h}h ${m.toString().padStart(2, '0')}m`
    }

    formatDate(iso: string | null): string {
        if (!iso) return '—'
        return new Date(iso).toLocaleString()
    }

    get fleetDaemonUrl(): string {
        return this.$store.getters['gui/fleetDaemonUrl'] ?? 'http://pantheonfleet.local:8090'
    }

    downloadArchivedGcode(record: any) {
        if (!record.gcode_archive_hash) return
        const url = `${this.fleetDaemonUrl}/archive/file/${record.gcode_archive_hash}`
        window.open(url)
    }
}
</script>

<style scoped>
.nozzle-bar {
    cursor: default;
}
.fleet-parts-table tbody tr {
    cursor: pointer;
}
.qc-select :deep(.v-input__slot) {
    min-height: 28px !important;
}
.qc-note-cell {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.qr-code-cell {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.qc-hidden-input {
    position: absolute;
    left: -9999px;
    opacity: 0;
    width: 1px;
    height: 1px;
}
.qc-action-card {
    transition: transform 0.15s, box-shadow 0.15s;
}
.qc-action-card:hover:not(.qc-action-disabled) {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.qc-action-disabled {
    opacity: 0.4;
    cursor: not-allowed !important;
}
.qc-mobile-scanning {
    overflow-y: auto;
}
</style>

<style>
.resizable-table table {
    table-layout: fixed;
}
@media (max-width: 600px) {
    .resizable-table table {
        table-layout: auto !important;
    }
    .resizable-table .col-resize-handle {
        display: none;
    }
    .v-data-table__mobile-row__cell {
        max-width: 60vw;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
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
