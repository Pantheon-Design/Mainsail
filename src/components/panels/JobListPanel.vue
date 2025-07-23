<template>
    <div class="job-list-panel">
        <v-card-text>
            <v-row>
                <v-col class="col-4 d-flex align-center">
                    <v-text-field v-model="search"
                                  :append-icon="mdiMagnify"
                                  label="Search Jobs"
                                  single-line
                                  outlined
                                  clearable
                                  hide-details
                                  dense />
                </v-col>
                <v-col class="col-3 d-flex align-center">
                    <v-select v-model="statusFilter"
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
                        <v-btn title="Delete Selected"
                               color="error"
                               class="px-2 minwidth-0 ml-3"
                               @click="deleteSelectedDialog = true">
                            <v-icon>{{ mdiDelete }}</v-icon>
                        </v-btn>
                    </template>
                    <v-btn color="primary"
                           class="ml-3"
                           @click="openCreateJobDialog">
                        <v-icon left>{{ mdiPlus }}</v-icon>
                        New Job
                    </v-btn>
                    <v-btn :loading="loadings.includes('jobsRefresh')"
                           class="px-2 minwidth-0 ml-3"
                           @click="refreshJobs">
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
        <v-data-table v-model="selectedJobs"
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
                <tr :key="`${index} ${item.name}`"
                    v-longpress:600="(e) => showContextMenu(e, item)"
                    :class="'file-list-cursor user-select-none ' + getJobRowClass(item)"
                    @contextmenu="showContextMenu($event, item)"
                    @click="clickRow(item, $event)">
                    <td class="pr-0">
                        <v-simple-checkbox v-ripple
                                           :value="isSelected"
                                           class="pa-0 mr-0"
                                           @click.stop="select(!isSelected)" />
                    </td>
                    <td class="px-2 text-center" style="width: 120px">
                        <v-menu offset-y>
                            <template #activator="{ on, attrs }">
                                <v-tooltip top>
                                    <template #activator="{ on: tooltipOn, attrs: tooltipAttrs }">
                                        <v-chip :color="getStatusColor(item.status)"
                                                :text-color="getStatusTextColor(item.status)"
                                                small
                                                label
                                                style="cursor: pointer;"
                                                v-bind="{ ...attrs, ...tooltipAttrs }"
                                                v-on="{ ...on, ...tooltipOn }"
                                                @click.stop>
                                            <v-icon left small>{{ getStatusIcon(item.status) }}</v-icon>
                                            {{ formatStatusDisplay(item.status) }}
                                            <v-icon right x-small>{{ mdiChevronDown }}</v-icon>
                                        </v-chip>
                                    </template>
                                    <span>Click to change status: {{ item.status.replace('_', ' ') }}</span>
                                </v-tooltip>
                            </template>
                            <v-list dense>
                                <v-list-item v-if="item.status === 'pending'"
                                             @click="updateJobStatusFromTable(item, 'in_progress')">
                                    <v-list-item-icon>
                                        <v-icon small color="blue">{{ mdiPlay }}</v-icon>
                                    </v-list-item-icon>
                                    <v-list-item-content>
                                        <v-list-item-title>Start Job</v-list-item-title>
                                    </v-list-item-content>
                                </v-list-item>

                                <v-list-item v-if="item.status === 'in_progress'"
                                             @click="updateJobStatusFromTable(item, 'complete')">
                                    <v-list-item-icon>
                                        <v-icon small color="green">{{ mdiCheck }}</v-icon>
                                    </v-list-item-icon>
                                    <v-list-item-content>
                                        <v-list-item-title>Mark Complete</v-list-item-title>
                                    </v-list-item-content>
                                </v-list-item>

                                <v-list-item v-if="['pending', 'in_progress'].includes(item.status)"
                                             @click="updateJobStatusFromTable(item, 'cancelled')">
                                    <v-list-item-icon>
                                        <v-icon small color="red">{{ mdiCancel }}</v-icon>
                                    </v-list-item-icon>
                                    <v-list-item-content>
                                        <v-list-item-title>Cancel Job</v-list-item-title>
                                    </v-list-item-content>
                                </v-list-item>

                                <!-- Options to revert status -->
                                <v-divider v-if="item.status !== 'pending'" />

                                <v-list-item v-if="item.status === 'in_progress'"
                                             @click="updateJobStatusFromTable(item, 'pending')">
                                    <v-list-item-icon>
                                        <v-icon small color="orange">{{ mdiAlertOutline }}</v-icon>
                                    </v-list-item-icon>
                                    <v-list-item-content>
                                        <v-list-item-title>Back to Pending</v-list-item-title>
                                    </v-list-item-content>
                                </v-list-item>

                                <v-list-item v-if="item.status === 'complete'"
                                             @click="updateJobStatusFromTable(item, 'in_progress')">
                                    <v-list-item-icon>
                                        <v-icon small color="blue">{{ mdiProgressClock }}</v-icon>
                                    </v-list-item-icon>
                                    <v-list-item-content>
                                        <v-list-item-title>Reopen Job</v-list-item-title>
                                    </v-list-item-content>
                                </v-list-item>

                                <v-list-item v-if="item.status === 'cancelled'"
                                             @click="updateJobStatusFromTable(item, 'pending')">
                                    <v-list-item-icon>
                                        <v-icon small color="orange">{{ mdiAlertOutline }}</v-icon>
                                    </v-list-item-icon>
                                    <v-list-item-content>
                                        <v-list-item-title>Restore Job</v-list-item-title>
                                    </v-list-item-content>
                                </v-list-item>
                            </v-list>
                        </v-menu>
                    </td>
                    <td class="">{{ item.name }}</td>
                    <td class="">{{ getCustomerName(item.customer_id) }}</td>
                    <td class="text-center">{{ item.job_type }}</td>
                    <td class="text-center">
                        <v-chip :color="getPriorityColor(item.priority)"
                                text-color="white"
                                x-small>
                            {{ getPriorityDisplay(item.priority) }}
                        </v-chip>
                    </td>
                    <td class="">{{ item.operator_name || '--' }}</td>
                    <td class="" :class="getDueDateClass(item.due_date)">
                        {{ formatDateTime(item.due_date) || '--' }}
                    </td>
                    <td class="">{{ formatDateTime(item.created_at) }}</td>
                    <td class="">{{ truncateText(item.description, 50) || '--' }}</td>
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
                <v-list-item @click="updateJobStatus(contextMenu.item, 'in_progress')"
                             v-if="contextMenu.item.status === 'pending'">
                    <v-icon class="mr-1">{{ mdiPlay }}</v-icon>
                    Start Job
                </v-list-item>
                <v-list-item @click="updateJobStatus(contextMenu.item, 'complete')"
                             v-if="contextMenu.item.status === 'in_progress'">
                    <v-icon class="mr-1">{{ mdiCheck }}</v-icon>
                    Mark Complete
                </v-list-item>
                <v-list-item @click="updateJobStatus(contextMenu.item, 'cancelled')"
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
        <job-details-dialog :key="detailsDialog.item?.id || 'no-job'"
                            :value="detailsDialog.show"
                            @input="onJobDetailsToggle"
                            :job="detailsDialog.item"
                            :gcode-files="jobGcodes"
                            :all-job-runs="allJobRuns"
                            :loading-gcodes="detailsDialog.loadingGcodes"
                            :loading-runs="detailsDialog.loadingRuns"
                            @close="onJobDetailsClose"
                            @refresh="onJobDetailsRefresh"
                            @update-status="onJobDetailsUpdateStatus"
                            @edit-job="onJobDetailsEditJob"
                            @add-gcode="onJobDetailsAddGcode"
                            @edit-gcode="onJobDetailsEditGcode"
                            @delete-gcode="onJobDetailsDeleteGcode"
                            @view-gcode-runs="onJobDetailsViewGcodeRuns" />

        <!-- Create/Edit Job Dialog -->
        <v-dialog v-model="createJobDialog.show"
                  :max-width="900"
                  persistent
                  @keydown.esc="closeCreateJobDialog">
            <panel :title="createJobDialog.isEdit ? 'Edit Job' : 'Create New Job'"
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
                            <!-- Left Column - Job Details -->
                            <v-col cols="6">
                                <h3 class="mb-3">Job Details</h3>
                                <v-divider class="mb-4" />

                                <v-text-field v-model="createJobDialog.form.name"
                                              label="Job Name"
                                              :rules="[v => !!v || 'Job name is required']"
                                              outlined
                                              dense
                                              required />

                                <v-select v-model="createJobDialog.form.customer_id"
                                          :items="customerDropdownOptions"
                                          item-text="name"
                                          item-value="id"
                                          label="Customer"
                                          :rules="[v => !!v || 'Customer is required']"
                                          outlined
                                          dense
                                          required
                                          @change="handleCustomerSelection">
                                    <template v-slot:prepend-item>
                                        <v-list-item @click="openAddCustomerFromJob">
                                            <v-list-item-icon>
                                                <v-icon color="success">{{ mdiAccountPlus }}</v-icon>
                                            </v-list-item-icon>
                                            <v-list-item-content>
                                                <v-list-item-title class="success--text">Add New Customer...</v-list-item-title>
                                            </v-list-item-content>
                                        </v-list-item>
                                        <v-divider></v-divider>
                                    </template>
                                </v-select>

                                <v-row>
                                    <v-col cols="6">
                                        <v-select v-model="createJobDialog.form.job_type"
                                                  :items="jobTypeOptions"
                                                  label="Job Type"
                                                  :rules="[v => !!v || 'Job type is required']"
                                                  outlined
                                                  dense
                                                  required />
                                    </v-col>
                                    <v-col cols="6">
                                        <v-select v-model="createJobDialog.form.priority"
                                                  :items="priorityOptions"
                                                  item-text="text"
                                                  item-value="value"
                                                  label="Priority"
                                                  outlined
                                                  dense />
                                    </v-col>
                                </v-row>

                                <v-text-field v-model="createJobDialog.form.operator_name"
                                              label="Operator"
                                              outlined
                                              dense />

                                <v-textarea v-model="createJobDialog.form.description"
                                            label="Description"
                                            outlined
                                            dense
                                            rows="3" />

                                <v-menu v-model="dueDateMenu"
                                        :close-on-content-click="false"
                                        :nudge-right="40"
                                        transition="scale-transition"
                                        offset-y
                                        min-width="auto">
                                    <template v-slot:activator="{ on, attrs }">
                                        <v-text-field v-model="createJobDialog.form.due_date"
                                                      label="Due Date"
                                                      :prepend-icon="mdiCalendar"
                                                      :rules="[v => !!v || 'Due date is required']"
                                                      readonly
                                                      outlined
                                                      dense
                                                      clearable
                                                      required
                                                      v-bind="attrs"
                                                      v-on="on" />
                                    </template>
                                    <v-date-picker v-model="createJobDialog.form.due_date"
                                                   @input="dueDateMenu = false" />
                                </v-menu>
                            </v-col>

                            <!-- Right Column - GCode Files -->
                            <v-col cols="6" v-if="!createJobDialog.isEdit">
                                <div class="d-flex justify-space-between align-center mb-3">
                                    <h3>GCode Files</h3>
                                    <div class="text-caption text--secondary">
                                        {{ createJobDialog.batchGcodes.length }} file(s) selected
                                    </div>
                                </div>
                                <v-divider class="mb-4" />

                                <!-- File Selection Tabs -->
                                <v-tabs v-model="createJobDialog.activeTab" class="mb-4">
                                    <v-tab>Upload Files</v-tab>
                                    <v-tab>Browse Existing</v-tab>
                                </v-tabs>

                                <v-tabs-items v-model="createJobDialog.activeTab">
                                    <!-- Upload Tab -->
                                    <v-tab-item>
                                        <div class="batch-gcode-upload-zone pa-4 mb-4">
                                            <div v-if="!createJobDialog.batchUploading && createJobDialog.batchGcodes.length === 0" class="text-center">
                                                <v-icon size="48" color="primary" class="mb-2">{{ mdiCloudUpload }}</v-icon>
                                                <div class="text-body-1 mb-3">Upload GCode files for this job</div>
                                                <v-btn color="primary"
                                                       large
                                                       @click="$refs.batchFileInput.click()">
                                                    <v-icon left>{{ mdiFileUpload }}</v-icon>
                                                    Choose Files
                                                </v-btn>
                                                <input ref="batchFileInput"
                                                       type="file"
                                                       accept=".gcode,.g,.gco"
                                                       multiple
                                                       style="display: none"
                                                       @change="onBatchFileSelect" />
                                                <div class="text-caption text--secondary mt-3">
                                                    Supported: .gcode, .g, .gco files<br>
                                                    Auto-parses printer model and filament from filename
                                                </div>
                                            </div>

                                            <!-- Upload Progress -->
                                            <div v-if="createJobDialog.batchUploading" class="text-center">
                                                <v-icon size="48" color="primary" class="mb-2">{{ mdiCloudUpload }}</v-icon>
                                                <div class="text-body-1 mb-2">Uploading files...</div>
                                                <v-progress-linear v-model="createJobDialog.batchUploadProgress"
                                                                   height="8"
                                                                   rounded
                                                                   color="primary"
                                                                   class="mb-2" />
                                                <div class="text-caption">{{ Math.round(createJobDialog.batchUploadProgress) }}%</div>
                                            </div>

                                            <!-- Add More Files Button -->
                                            <div v-if="!createJobDialog.batchUploading && createJobDialog.batchGcodes.length > 0" class="text-center">
                                                <v-btn color="primary"
                                                       outlined
                                                       @click="$refs.batchFileInput.click()">
                                                    <v-icon left>{{ mdiPlus }}</v-icon>
                                                    Add More Files
                                                </v-btn>
                                            </div>
                                        </div>
                                    </v-tab-item>

                                    <!-- Browse Tab -->
                                    <v-tab-item>
                                        <div class="pa-4">
                                            <gcode-file-browser selection-mode="multiple"
                                                                @files-selected="onBrowseFilesSelected" />
                                        </div>
                                    </v-tab-item>
                                </v-tabs-items>

                                <!-- GCode Files List (shown regardless of tab) -->
                                <div v-if="createJobDialog.batchGcodes.length > 0" class="batch-gcode-list">
                                    <div class="d-flex justify-space-between align-center mb-2">
                                        <div class="text-subtitle-2">Selected Files</div>
                                        <v-btn small
                                               text
                                               color="error"
                                               @click="clearAllBatchFiles">
                                            <v-icon small left>{{ mdiDelete }}</v-icon>
                                            Clear All
                                        </v-btn>
                                    </div>

                                    <div class="batch-gcode-items-container" style="max-height: 300px; overflow-y: auto;">
                                        <div v-for="(gcode, index) in createJobDialog.batchGcodes"
                                             :key="index"
                                             class="batch-gcode-item pa-3 mb-2"
                                             style="border: 1px solid #e0e0e0; border-radius: 8px; background-color: rgba(0,0,0,0.05);">
                                            <!-- File header -->
                                            <div class="d-flex justify-space-between align-center mb-2">
                                                <div class="font-weight-bold text--primary" style="font-size: 14px;">
                                                    {{ gcode.gcode_filename }}
                                                </div>
                                                <v-btn icon
                                                       x-small
                                                       color="error"
                                                       @click="removeBatchGcodeFile(index)"
                                                       title="Remove file">
                                                    <v-icon x-small>{{ mdiClose }}</v-icon>
                                                </v-btn>
                                            </div>

                                            <!-- Editable fields -->
                                            <v-row dense>
                                                <v-col cols="6">
                                                    <v-text-field v-model.number="gcode.required_runs"
                                                                  label="Required Runs"
                                                                  type="number"
                                                                  :rules="[v => v > 0 || 'Must be > 0']"
                                                                  outlined
                                                                  dense
                                                                  hide-details="auto" />
                                                </v-col>
                                                <v-col cols="6">
                                                    <v-select v-model="gcode.preferred_printer"
                                                              :items="printerOptions"
                                                              label="Printer"
                                                              outlined
                                                              dense
                                                              hide-details="auto" />
                                                </v-col>
                                                <v-col cols="12">
                                                    <v-text-field v-model="gcode.filament_type"
                                                                  label="Filament Type"
                                                                  :rules="[v => !!v || 'Filament type is required']"
                                                                  outlined
                                                                  dense
                                                                  required
                                                                  hide-details="auto" />
                                                </v-col>
                                            </v-row>

                                            <!-- Auto-parsed info chips -->
                                            <div class="mt-2">
                                                <v-chip x-small color="blue" text-color="white" class="mr-1">
                                                    {{ gcode.filament_type || 'Unknown' }}
                                                </v-chip>
                                                <v-chip x-small color="orange" text-color="white" class="mr-1">
                                                    {{ gcode.required_runs }} runs
                                                </v-chip>
                                                <v-chip x-small color="green" text-color="white">
                                                    {{ gcode.preferred_printer || 'Any' }}
                                                </v-chip>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </v-col>
                        </v-row>
                    </v-form>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn color="" text @click="closeCreateJobDialog">Cancel</v-btn>
                    <v-btn color="primary"
                           :loading="createJobDialog.loading"
                           :disabled="!createJobDialog.valid"
                           @click="saveJob">
                        {{ createJobDialog.isEdit ? 'Update' : 'Create' }}
                        <span v-if="!createJobDialog.isEdit && createJobDialog.batchGcodes.length > 0">
                            (+ {{ createJobDialog.batchGcodes.length }} GCode files)
                        </span>
                    </v-btn>
                </v-card-actions>
            </panel>
        </v-dialog>

        <!-- Add GCode Dialog -->
        <v-dialog v-model="addGcodeDialog.show"
                  :max-width="600"
                  persistent
                  @keydown.esc="closeAddGcodeDialog">
            <panel :title="addGcodeDialog.isEdit ? 'Edit GCode File' : 'Add GCode File'"
                   :icon="addGcodeDialog.isEdit ? mdiPencil : mdiCodeBraces"
                   card-class="add-gcode-dialog"
                   :margin-bottom="false">
                <template #buttons>
                    <v-btn icon tile @click="closeAddGcodeDialog">
                        <v-icon>{{ mdiCloseThick }}</v-icon>
                    </v-btn>
                </template>
                <v-card-text>
                    <!-- File Upload Section -->
                    <div class="mb-4">
                        <div class="text-subtitle-2 mb-2">
                            {{ addGcodeDialog.isEdit ? 'Replace GCode File (Optional)' : 'Select GCode File' }}
                        </div>

                        <!-- File Selection Tabs -->
                        <v-tabs v-model="addGcodeDialog.activeTab" class="mb-4">
                            <v-tab>Upload File</v-tab>
                            <v-tab>Browse Existing</v-tab>
                        </v-tabs>

                        <v-tabs-items v-model="addGcodeDialog.activeTab">
                            <!-- Upload Tab -->
                            <v-tab-item>
                                <div class="gcode-upload-zone pa-4">
                                    <!-- Upload Area -->
                                    <div v-if="!addGcodeDialog.uploading && !addGcodeDialog.uploadedFile" class="text-center">
                                        <v-icon size="48" color="primary" class="mb-2">{{ mdiCloudUpload }}</v-icon>
                                        <div class="text-body-1 mb-3">
                                            {{ addGcodeDialog.isEdit ? 'Upload a new file to replace the existing one' : 'Choose a GCode file to upload' }}
                                        </div>
                                        <v-btn color="primary"
                                               large
                                               @click="$refs.fileInput.click()">
                                            <v-icon left>{{ mdiFileUpload }}</v-icon>
                                            Choose File
                                        </v-btn>
                                        <input ref="fileInput"
                                               type="file"
                                               accept=".gcode,.g,.gco"
                                               style="display: none"
                                               @change="onFileSelect" />
                                        <div class="text-caption text--secondary mt-3">
                                            {{ addGcodeDialog.isEdit ? 'Leave empty to keep the current file' : 'Supported formats: .gcode, .g, .gco' }}
                                        </div>
                                    </div>

                                    <!-- Upload Progress -->
                                    <div v-if="addGcodeDialog.uploading" class="text-center">
                                        <v-icon size="48" color="primary" class="mb-2">{{ mdiCloudUpload }}</v-icon>
                                        <div class="text-body-1 mb-2">Uploading {{ addGcodeDialog.uploadingFileName }}...</div>
                                        <v-progress-linear v-model="addGcodeDialog.uploadProgress"
                                                           height="8"
                                                           rounded
                                                           color="primary"
                                                           class="mb-2" />
                                        <div class="text-caption">{{ Math.round(addGcodeDialog.uploadProgress) }}%</div>
                                    </div>

                                    <!-- Upload Success -->
                                    <div v-if="addGcodeDialog.uploadedFile" class="d-flex align-center">
                                        <v-icon color="success" class="mr-2">{{ mdiCheckCircle }}</v-icon>
                                        <div class="flex-grow-1">
                                            <div class="text-body-1">{{ addGcodeDialog.uploadedFile.name }}</div>
                                            <div class="text-caption text--secondary">{{ formatFileSize(addGcodeDialog.uploadedFile.size) }}</div>
                                        </div>
                                        <v-btn icon small @click="clearUploadedFile">
                                            <v-icon>{{ mdiClose }}</v-icon>
                                        </v-btn>
                                    </div>
                                </div>
                            </v-tab-item>

                            <!-- Browse Tab -->
                            <v-tab-item>
                                <div class="pa-4">
                                    <gcode-file-browser selection-mode="multiple"
                                                        @files-selected="onBrowseFileSelected" />
                                </div>
                            </v-tab-item>
                        </v-tabs-items>
                    </div>

                    <!-- Form Fields -->
                    <v-form ref="gcodeForm" v-model="addGcodeDialog.valid">
                        <v-row>
                            <v-col cols="12">
                                <v-text-field v-model="addGcodeDialog.form.gcode_filename"
                                              label="GCode Filename"
                                              :rules="[v => !!v || 'Filename is required']"
                                              outlined
                                              dense
                                              required
                                              :readonly="!!addGcodeDialog.uploadedFile"
                                              :hint="addGcodeDialog.uploadedFile ? 'Auto-filled from uploaded file' : (addGcodeDialog.isEdit ? 'Edit filename or upload new file to replace' : 'Or enter filename manually')"
                                              persistent-hint />
                            </v-col>
                            <v-col cols="6">
                                <v-text-field v-model.number="addGcodeDialog.form.required_runs"
                                              label="Required Runs"
                                              type="number"
                                              :rules="[v => v > 0 || 'Must be greater than 0']"
                                              outlined
                                              dense
                                              required />
                            </v-col>
                            <v-col cols="6">
                                <v-select v-model="addGcodeDialog.form.preferred_printer"
                                          :items="printerOptions"
                                          label="Preferred Printer"
                                          :rules="[v => !!v || 'Printer preference is required']"
                                          outlined
                                          dense
                                          required />
                            </v-col>
                            <v-col cols="12">
                                <v-text-field v-model="addGcodeDialog.form.filament_type"
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
                    <v-btn color="primary"
                           :loading="addGcodeDialog.loading"
                           :disabled="!addGcodeDialog.valid || addGcodeDialog.uploading"
                           @click="saveGcode">
                        {{ addGcodeDialog.isEdit ? 'Update' : 'Add' }} GCode
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

        <!-- GCode Runs Dialog -->
        <v-dialog v-model="gcodeRunsDialog.show"
                  :max-width="1200"
                  persistent
                  @keydown.esc="closeGcodeRunsDialog">
            <panel :title="`Print Runs: ${gcodeRunsDialog.gcodeFile?.gcode_filename || ''}`"
                   :icon="mdiPlay"
                   card-class="gcode-runs-dialog"
                   :margin-bottom="false">
                <template #buttons>
                    <v-btn icon tile @click="closeGcodeRunsDialog">
                        <v-icon>{{ mdiCloseThick }}</v-icon>
                    </v-btn>
                </template>
                <v-card-text class="px-0">
                    <div class="px-6 pb-3">
                        <v-row>
                            <v-col cols="8">
                                <div class="text-h6 mb-2">{{ gcodeRunsDialog.gcodeFile?.gcode_filename }}</div>
                                <div class="d-flex align-center">
                                    <v-chip small color="blue" text-color="white" class="mr-2">
                                        {{ gcodeRunsDialog.gcodeFile?.filament_type }}
                                    </v-chip>
                                    <v-chip small color="orange" text-color="white" class="mr-2">
                                        {{ gcodeRunsDialog.gcodeFile?.required_runs }} required
                                    </v-chip>
                                    <v-chip small color="green" text-color="white">
                                        {{ gcodeRunsDialog.gcodeFile?.preferred_printer }}
                                    </v-chip>
                                </div>
                            </v-col>
                            <v-col cols="4" class="d-flex justify-end align-center">
                                <v-btn color="success"
                                       @click="openCreateRunDialog">
                                    <v-icon left>{{ mdiPlus }}</v-icon>
                                    Add Run
                                </v-btn>
                                <v-btn :loading="gcodeRunsDialog.loading"
                                       class="ml-2"
                                       @click="refreshGcodeRuns">
                                    <v-icon>{{ mdiRefresh }}</v-icon>
                                </v-btn>
                            </v-col>
                        </v-row>
                    </div>
                    <v-divider />
                    <overlay-scrollbars style="height: 500px">
                        <v-data-table :items="gcodeRuns"
                                      :headers="gcodeRunHeaders"
                                      :items-per-page="25"
                                      :loading="gcodeRunsDialog.loading"
                                      class="gcode-runs-table"
                                      item-key="id"
                                      :sort-by="['started_at']"
                                      :sort-desc="[true]">

                            <template v-slot:item.status="{ item }">
                                <v-menu offset-y>
                                    <template #activator="{ on, attrs }">
                                        <v-chip :color="getRunStatusColor(item.status)"
                                                :text-color="getRunStatusTextColor(item.status)"
                                                small
                                                style="cursor: pointer;"
                                                v-bind="attrs"
                                                v-on="on">
                                            <v-icon left x-small>{{ getRunStatusIcon(item.status) }}</v-icon>
                                            {{ item.status.replace('_', ' ') }}
                                            <v-icon right x-small>{{ mdiChevronDown }}</v-icon>
                                        </v-chip>
                                    </template>
                                    <v-list dense>
                                        <v-list-item @click="updateRunStatus(item, 'in_progress')">
                                            <v-list-item-icon>
                                                <v-icon small color="blue">{{ mdiProgressClock }}</v-icon>
                                            </v-list-item-icon>
                                            <v-list-item-content>
                                                <v-list-item-title>In Progress</v-list-item-title>
                                            </v-list-item-content>
                                        </v-list-item>
                                        <v-list-item @click="updateRunStatus(item, 'success')">
                                            <v-list-item-icon>
                                                <v-icon small color="green">{{ mdiCheck }}</v-icon>
                                            </v-list-item-icon>
                                            <v-list-item-content>
                                                <v-list-item-title>Success</v-list-item-title>
                                            </v-list-item-content>
                                        </v-list-item>
                                        <v-list-item @click="updateRunStatus(item, 'fail')">
                                            <v-list-item-icon>
                                                <v-icon small color="red">{{ mdiAlertOutline }}</v-icon>
                                            </v-list-item-icon>
                                            <v-list-item-content>
                                                <v-list-item-title>Failed</v-list-item-title>
                                            </v-list-item-content>
                                        </v-list-item>
                                        <v-list-item @click="updateRunStatus(item, 'cancelled')">
                                            <v-list-item-icon>
                                                <v-icon small color="grey">{{ mdiCancel }}</v-icon>
                                            </v-list-item-icon>
                                            <v-list-item-content>
                                                <v-list-item-title>Cancelled</v-list-item-title>
                                            </v-list-item-content>
                                        </v-list-item>
                                    </v-list>
                                </v-menu>
                            </template>

                            <template v-slot:item.qc="{ item }">
                                <v-menu offset-y>
                                    <template #activator="{ on, attrs }">
                                        <v-chip :color="getQCColor(item.qc)"
                                                :text-color="getQCTextColor(item.qc)"
                                                small
                                                style="cursor: pointer;"
                                                v-bind="attrs"
                                                v-on="on">
                                            <v-icon left x-small>{{ getQCIcon(item.qc) }}</v-icon>
                                            {{ getQCDisplay(item.qc) }}
                                            <v-icon right x-small>{{ mdiChevronDown }}</v-icon>
                                        </v-chip>
                                    </template>
                                    <v-list dense>
                                        <v-list-item @click="updateRunQC(item, 'pass')">
                                            <v-list-item-icon>
                                                <v-icon small color="green">{{ mdiCheckboxMarkedCircleOutline }}</v-icon>
                                            </v-list-item-icon>
                                            <v-list-item-content>
                                                <v-list-item-title>Pass</v-list-item-title>
                                            </v-list-item-content>
                                        </v-list-item>
                                        <v-list-item @click="updateRunQC(item, 'fail')">
                                            <v-list-item-icon>
                                                <v-icon small color="red">{{ mdiCloseCircleOutline }}</v-icon>
                                            </v-list-item-icon>
                                            <v-list-item-content>
                                                <v-list-item-title>Fail</v-list-item-title>
                                            </v-list-item-content>
                                        </v-list-item>
                                        <v-list-item @click="updateRunQC(item, null)">
                                            <v-list-item-icon>
                                                <v-icon small color="grey">{{ mdiHelpCircleOutline }}</v-icon>
                                            </v-list-item-icon>
                                            <v-list-item-content>
                                                <v-list-item-title>Not Set</v-list-item-title>
                                            </v-list-item-content>
                                        </v-list-item>
                                    </v-list>
                                </v-menu>
                            </template>

                            <template v-slot:item.started_at="{ item }">
                                {{ formatDateTime(item.started_at) }}
                            </template>

                            <template v-slot:item.completed_at="{ item }">
                                {{ item.completed_at ? formatDateTime(item.completed_at) : '--' }}
                            </template>

                            <template v-slot:item.actions="{ item }">
                                <v-btn icon small @click="editRun(item)">
                                    <v-icon small>{{ mdiPencil }}</v-icon>
                                </v-btn>
                                <v-btn icon small color="error" @click="deleteRun(item)">
                                    <v-icon small>{{ mdiDelete }}</v-icon>
                                </v-btn>
                            </template>

                            <template slot="no-data">
                                <div class="text-center pa-4">
                                    <div class="text--secondary mb-2">No print runs found</div>
                                    <v-btn color="primary" @click="openCreateRunDialog">
                                        <v-icon left>{{ mdiPlus }}</v-icon>
                                        Add First Run
                                    </v-btn>
                                </div>
                            </template>
                        </v-data-table>
                    </overlay-scrollbars>
                </v-card-text>
            </panel>
        </v-dialog>

        <!-- Create/Edit Run Dialog -->
        <v-dialog v-model="createRunDialog.show"
                  :max-width="600"
                  persistent
                  @keydown.esc="closeCreateRunDialog">
            <panel :title="createRunDialog.isEdit ? 'Edit Print Run' : 'Add Print Run'"
                   :icon="createRunDialog.isEdit ? mdiPencil : mdiPlus"
                   card-class="create-run-dialog"
                   :margin-bottom="false">
                <template #buttons>
                    <v-btn icon tile @click="closeCreateRunDialog">
                        <v-icon>{{ mdiCloseThick }}</v-icon>
                    </v-btn>
                </template>
                <v-card-text>
                    <v-form ref="runForm" v-model="createRunDialog.valid">
                        <v-row>

                            <v-col cols="12">
                                <v-select v-model="createRunDialog.form.printer_hostname"
                                          :items="sortedPrinterOptions"
                                          item-text="text"
                                          item-value="value"
                                          label="Select Printer"
                                          :rules="[v => !!v || 'Printer selection is required']"
                                          outlined
                                          dense
                                          required
                                          :hint="getPrinterSelectionHint()"
                                          persistent-hint>
                                    <template v-slot:item="{ item }">
                                        <v-list-item-content>
                                            <v-list-item-title>
                                                <div class="d-flex align-center">
                                                    <span :class="{ 'text--disabled': item.disabled }">
                                                        {{ item.printer.socket?.hostname || 'Unknown' }}
                                                    </span>

                                                    <!-- Status Chip -->
                                                    <v-chip :color="getPrinterChipColor(item.printer)"
                                                            :text-color="getPrinterChipTextColor(item.printer)"
                                                            x-small
                                                            class="ml-2">
                                                        {{ getPrinterDisplayStatus(item.printer) }}
                                                    </v-chip>

                                                    <!-- Model Chip -->
                                                    <v-chip color="blue-grey"
                                                            text-color="white"
                                                            x-small
                                                            class="ml-1">
                                                        {{ getPrinterModel(item.printer.socket?.hostname) || 'Unknown' }}
                                                    </v-chip>

                                                    <!-- Filament Warning Icon -->
                                                    <v-icon v-if="item.hasFilamentMismatch"
                                                            color="orange"
                                                            small
                                                            class="ml-2"
                                                            :title="`Filament mismatch: GCode needs ${item.requiredFilament}, printer has ${item.printerFilament}`">
                                                        mdi-alert-outline
                                                    </v-icon>
                                                </div>
                                            </v-list-item-title>
                                            <v-list-item-subtitle>
                                                <div class="d-flex align-center">
                                                    <span v-if="item.printerFilament">
                                                        Current: {{ item.printerFilament }}
                                                    </span>
                                                    <span v-else class="text--disabled">
                                                        No filament detected
                                                    </span>

                                                    <!-- Filament Mismatch Warning -->
                                                    <v-chip v-if="item.hasFilamentMismatch"
                                                            color="orange"
                                                            text-color="white"
                                                            x-small
                                                            class="ml-2">
                                                        <v-icon left x-small>mdi-alert</v-icon>
                                                        Needs {{ item.requiredFilament }}
                                                    </v-chip>

                                                    <!-- Perfect Match Indicator -->
                                                    <v-chip v-else-if="item.requiredFilament && item.printerFilament &&
                                          item.requiredFilament.toLowerCase() === item.printerFilament.toLowerCase()"
                                                            color="green"
                                                            text-color="white"
                                                            x-small
                                                            class="ml-2">
                                                        <v-icon left x-small>mdi-check</v-icon>
                                                        Perfect Match
                                                    </v-chip>
                                                </div>
                                            </v-list-item-subtitle>
                                        </v-list-item-content>
                                        <v-list-item-action v-if="item.disabled">
                                            <v-icon small color="grey">mdi-lock</v-icon>
                                        </v-list-item-action>
                                    </template>

                                    <template v-slot:selection="{ item }">
                                        <div class="d-flex align-center">
                                            <span>{{ item.printer.socket?.hostname || 'Unknown' }}</span>

                                            <!-- Status Chip -->
                                            <v-chip :color="getPrinterChipColor(item.printer)"
                                                    :text-color="getPrinterChipTextColor(item.printer)"
                                                    x-small
                                                    class="ml-2">
                                                {{ getPrinterDisplayStatus(item.printer) }}
                                            </v-chip>

                                            <!-- Filament Warning in Selection -->
                                            <v-icon v-if="item.hasFilamentMismatch"
                                                    color="orange"
                                                    small
                                                    class="ml-1"
                                                    :title="`Filament mismatch: needs ${item.requiredFilament}`">
                                                mdi-alert-outline
                                            </v-icon>
                                        </div>
                                    </template>

                                    <template v-slot:prepend-item>
                                        <v-list-item class="px-3 py-2" style="background-color: rgba(0,0,0,0.05);">
                                            <v-list-item-content>
                                                <v-list-item-subtitle class="text-caption">
                                                    <strong>GCode Requirements:</strong>
                                                    {{ currentGcodeFile?.preferred_printer || 'Any' }} printer,
                                                    {{ currentGcodeFile?.filament_type || 'No filament specified' }}
                                                </v-list-item-subtitle>
                                                <v-list-item-subtitle class="text-caption mt-1">
                                                    Showing {{ sortedPrinterOptions.length }} compatible printer(s)
                                                </v-list-item-subtitle>
                                            </v-list-item-content>
                                        </v-list-item>
                                        <v-divider></v-divider>
                                    </template>
                                </v-select>

                                <!-- Filament Mismatch Warning Alert -->
                                <v-alert v-if="getSelectedPrinterMismatch()"
                                         type="warning"
                                         outlined
                                         dense
                                         class="mt-2 mb-0">
                                    <div class="d-flex align-center">
                                        <v-icon left small>mdi-alert-outline</v-icon>
                                        <div>
                                            <strong>Filament Mismatch:</strong>
                                            This GCode file requires <strong>{{ currentGcodeFile?.filament_type }}</strong>,
                                            but the selected printer currently has <strong>{{ getSelectedPrinterFilament() }}</strong> loaded.
                                            <br>
                                            <span class="text-caption">Please verify filament compatibility or change filament before printing.</span>
                                        </div>
                                    </div>
                                </v-alert>
                            </v-col>
                            <v-col cols="6" v-if="createRunDialog.isEdit">
                                <v-select v-model="createRunDialog.form.status"
                                          :items="runStatusOptions"
                                          label="Status"
                                          outlined
                                          dense />
                            </v-col>
                            <v-col :cols="createRunDialog.isEdit ? 6 : 12" v-if="createRunDialog.isEdit">
                                <v-select v-model="createRunDialog.form.qc"
                                          :items="qcOptions"
                                          label="Quality Control"
                                          outlined
                                          dense />
                            </v-col>
                            <v-col cols="12">
                                <v-text-field v-model="createRunDialog.form.moonraker_job_id"
                                              label="Moonraker Job ID (Optional)"
                                              outlined
                                              dense />
                            </v-col>
                            <v-col cols="12">
                                <v-textarea v-model="createRunDialog.form.notes"
                                            label="Notes (Optional)"
                                            outlined
                                            dense
                                            rows="3" />
                            </v-col>
                        </v-row>
                    </v-form>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="closeCreateRunDialog">Cancel</v-btn>
                    <v-btn color="primary"
                           :loading="createRunDialog.loading"
                           :disabled="!createRunDialog.valid"
                           @click="saveRun">
                        {{ createRunDialog.isEdit ? 'Update' : 'Add' }}
                    </v-btn>
                </v-card-actions>
            </panel>
        </v-dialog>

        <!-- Quick Add Customer Dialog (for job creation workflow) -->
        <v-dialog v-model="quickAddCustomerDialog.show"
                  :max-width="400"
                  persistent
                  @keydown.esc="closeQuickAddCustomerDialog">
            <panel title="Add New Customer"
                   :icon="mdiAccountPlus"
                   card-class="quick-add-customer-dialog"
                   :margin-bottom="false">
                <template #buttons>
                    <v-btn icon tile @click="closeQuickAddCustomerDialog">
                        <v-icon>{{ mdiCloseThick }}</v-icon>
                    </v-btn>
                </template>
                <v-card-text>
                    <p class="text-caption text--secondary mb-3">
                        Quickly add a customer to continue creating your job.
                    </p>
                    <v-form ref="quickCustomerForm" v-model="quickAddCustomerDialog.valid">
                        <v-row>
                            <v-col cols="12">
                                <v-text-field v-model="quickAddCustomerDialog.form.name"
                                              label="Customer Name"
                                              :rules="[v => !!v || 'Customer name is required']"
                                              outlined
                                              dense
                                              required
                                              autofocus />
                            </v-col>
                            <v-col cols="12">
                                <v-textarea v-model="quickAddCustomerDialog.form.notes"
                                            label="Notes (Optional)"
                                            outlined
                                            dense
                                            rows="2" />
                            </v-col>
                        </v-row>
                    </v-form>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn color="" text @click="closeQuickAddCustomerDialog">Cancel</v-btn>
                    <v-btn color="success"
                           :loading="quickAddCustomerDialog.loading"
                           :disabled="!quickAddCustomerDialog.valid"
                           @click="saveQuickCustomer">
                        Add Customer
                    </v-btn>
                </v-card-actions>
            </panel>
        </v-dialog>
    </div>
</template>



<script lang="ts">
import { Component, Mixins, Watch } from 'vue-property-decorator'
import { Component, Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import Panel from '@/components/ui/Panel.vue'
import { caseInsensitiveSort } from '@/plugins/helpers'
import GcodeFileBrowser from '@/components/GcodeFileBrowser.vue'
import JobDetailsDialog from '@/components/dialogs/JobDetailsDialog.vue'

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
    mdiDotsVertical,
    mdiChevronDown,
    mdiHelpCircleOutline,
    mdiInformationOutline,
    mdiCloudUpload,
    mdiFileUpload,
    mdiCheckCircle,
    mdiClose,

} from '@mdi/js'

interface FleetJob {
    id: string
    customer_id: string
    name: string
    operator_name?: string
    description?: string
    job_type: string
    priority: string
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

interface FleetJobGcodeRun {
    id: string
    job_gcode_id: string
    printer_hostname: string
    started_at: string
    completed_at?: string
    status: string
    moonraker_job_id?: string
    notes?: string
    qc?: string | null
}

@Component({
    components: {
        Panel,
        GcodeFileBrowser,
        JobDetailsDialog,
    },
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
    mdiDotsVertical = mdiDotsVertical
    mdiChevronDown = mdiChevronDown
    mdiHelpCircleOutline = mdiHelpCircleOutline
    mdiInformationOutline = mdiInformationOutline
    mdiCloudUpload = mdiCloudUpload
    mdiFileUpload = mdiFileUpload
    mdiCheckCircle = mdiCheckCircle
    mdiClose = mdiClose

    private search = ''
    private sortBy = 'created_at'
    private sortDesc = true
    private options = {}
    private statusFilter = []
    private dueDateMenu = false

    private selectedJobs: FleetJob[] = []
    private jobGcodes: FleetJobGcode[] = []
    private gcodeRuns: FleetJobGcodeRun[] = []
    private allJobRuns: { [gcodeId: string]: FleetJobGcodeRun[] } = {}
    private cacheCleanupTimeout: number | null = null

    private gcodeRunsDialog = {
        show: false,
        loading: false,
        gcodeFile: null as FleetJobGcode | null,
    }

    private createRunDialog = {
        show: false,
        isEdit: false,
        valid: false,
        loading: false,
        form: {
            id: '',
            printer_hostname: '',
            status: 'in_progress',
            moonraker_job_id: '',
            notes: '',
            qc: null as string | null,
        }
    }

    private contextMenu = {
        shown: false,
        x: 0,
        y: 0,
        item: {} as FleetJob,
    }

    private detailsDialog = {
        show: false,
        item: null as FleetJob | null,
        loadingGcodes: false,
        loadingRuns: false,
    }

    private createJobDialog = {
        show: false,
        isEdit: false,
        valid: false,
        loading: false,
        batchGcodes: [] as BatchGcodeFile[],
        batchUploading: false,
        batchUploadProgress: 0,
        activeTab: 0,
        form: {
            id: '',
            name: '',
            customer_id: '',
            job_type: 'sample',
            priority: 'low',
            operator_name: '',
            description: '',
            due_date: '',
        }
    }

    private addGcodeDialog = {
        show: false,
        valid: false,
        loading: false,
        isEdit: false,
        uploading: false,
        uploadProgress: 0,
        uploadingFileName: '',
        uploadedFile: null as File | null,
        currentGcodeId: '',
        activeTab: 0,
        form: {
            gcode_filename: '',
            required_runs: 1,
            preferred_printer: 'any',
            filament_type: '',
        }
    }

    private deleteDialog = false
    private deleteSelectedDialog = false

    private quickAddCustomerDialog = {
        show: false,
        valid: false,
        loading: false,
        form: {
            name: '',
            notes: '',
        }
    }

    private runStatisticsCache: { [gcodeId: string]: any } = {}

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

    get priorityOptions() {
        return [
            { text: 'Low', value: 'low' },
            { text: 'Medium', value: 'medium' },
            { text: 'High', value: 'high' },
        ]
    }

    get printerOptions() {
        return [
            { text: 'Any Printer', value: 'any' },
            { text: 'HS3', value: 'HS3' },
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

    get gcodeRunHeaders() {
        return [
            { text: 'Printer', value: 'printer_hostname', align: 'left' },
            { text: 'Status', value: 'status', align: 'center', sortable: false },
            { text: 'QC', value: 'qc', align: 'center', sortable: false },
            { text: 'Started', value: 'started_at', align: 'left' },
            { text: 'Completed', value: 'completed_at', align: 'left' },
            { text: 'Moonraker ID', value: 'moonraker_job_id', align: 'left' },
            { text: 'Notes', value: 'notes', align: 'left' },
            { text: 'Actions', value: 'actions', align: 'center', sortable: false },
        ]
    }

    get runStatusOptions() {
        return [
            { text: 'In Progress', value: 'in_progress' },
            { text: 'Success', value: 'success' },
            { text: 'Failed', value: 'fail' },
            { text: 'Cancelled', value: 'cancelled' },
        ]
    }

    get qcOptions() {
        return [
            { text: 'Not Set', value: null },
            { text: 'Pass', value: 'pass' },
            { text: 'Fail', value: 'fail' },
        ]
    }

    get customerDropdownOptions() {
        // Return customers with the "Add New Customer" option
        return this.customers.map(customer => ({
            id: customer.id,
            name: customer.name
        }))
    }

    get fleetDaemonPrinters() {
        return this.$store.state.farm.fleetDaemonPrinters || {}
    }

    get sortedPrinterOptions() {
        const printers = Object.values(this.fleetDaemonPrinters)
        const requiredPrinterModel = this.currentGcodeFile?.preferred_printer
        const requiredFilament = this.currentGcodeFile?.filament_type
    
        // Filter printers by model compatibility first
        const compatiblePrinters = printers.filter((printer: any) => {
            const hostname = printer.socket?.hostname || ''
            const printerModel = this.getPrinterModel(hostname)
        
            // If GCode specifies 'any', all printers are compatible
            if (requiredPrinterModel === 'any') {
                return true
            }
        
            // If GCode specifies a specific model, only show matching printers
            if (requiredPrinterModel === 'HS-Pro') {
                return printerModel === 'HS-Pro'
            }
        
            if (requiredPrinterModel === 'HS3') {
                return printerModel === 'HS-3' || printerModel === 'HS3'
            }
        
            // Default: show all if we can't determine requirements
            return true
        })
    
        // Sort compatible printers by status priority
        const sortedPrinters = compatiblePrinters.sort((a: any, b: any) => {
            const statusA = this.getPrinterStatusPriority(a)
            const statusB = this.getPrinterStatusPriority(b)
        
            // First sort by status priority, then by hostname alphabetically
            if (statusA !== statusB) {
                return statusA - statusB
            }
            return (a.socket?.hostname || '').localeCompare(b.socket?.hostname || '')
        })
    
        return sortedPrinters.map((printer: any) => {
            const hostname = printer.socket?.hostname || 'Unknown'
            const status = this.getPrinterDisplayStatus(printer)
            const isConnected = printer.socket?.isConnected && printer.fleet_to_printer_ws !== false
            const printerFilament = printer.toolhead?.filament_type
            const hasFilamentMismatch = requiredFilament && printerFilament && 
                                       requiredFilament.toLowerCase() !== printerFilament.toLowerCase()
        
            return {
                text: `${hostname} - ${status}`,
                value: hostname,
                disabled: !isConnected || this.isPrinterBusy(printer),
                printer: printer,
                hasFilamentMismatch: hasFilamentMismatch,
                requiredFilament: requiredFilament,
                printerFilament: printerFilament
            }
        })
    }

    getPrinterModel(hostname: string): 'HS-3' | 'HS-Pro' | null {
        const remotePrinters = this.$store.state.gui?.remoteprinters?.printers || {}
        for (const printer of Object.values(remotePrinters)) {
            if ((printer as any).hostname === hostname) {
                return (printer as any).printerModel ?? null
            }
        }
        return null
    }

    get currentGcodeFile() {
        return this.gcodeRunsDialog.gcodeFile
    }
    async mounted() {
        await this.refreshJobs()
        await this.loadCustomers()
        this.$root.$on('fullscreen-files-uploaded', this.handleFullscreenUpload)
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

    handleCustomerSelection(customerId: string) {
        // This handles regular customer selection
        // The "Add New Customer" option is handled by the @click in the template
    }

    openAddCustomerFromJob() {
        // Open the quick add customer dialog
        this.quickAddCustomerDialog.show = true
    }

    async saveQuickCustomer() {
        if (!this.quickAddCustomerDialog.valid) return

        this.quickAddCustomerDialog.loading = true
        try {
            const newCustomer = await this.$store.dispatch('fleet/jobs/createCustomer', this.quickAddCustomerDialog.form)
            this.$toast.success('Customer added successfully')
        
            // Reload customers to update the dropdown
            await this.loadCustomers()
        
            // Auto-select the newly created customer in the job form
            this.createJobDialog.form.customer_id = newCustomer.id
        
            // Close the quick add dialog
            this.closeQuickAddCustomerDialog()
        
        } catch (error) {
            console.error('Failed to create customer:', error)
            this.$toast.error('Failed to create customer')
        } finally {
            this.quickAddCustomerDialog.loading = false
        }
    }
    
    closeQuickAddCustomerDialog() {
        this.quickAddCustomerDialog.show = false
        this.quickAddCustomerDialog.form = {
            name: '',
            notes: '',
        }
    
        // Reset form validation
        if (this.$refs.quickCustomerForm) {
            (this.$refs.quickCustomerForm as any).resetValidation()
        }
    }

    async loadJobGcodesAndRuns(jobId: string) {
        // OPTIMIZATION: Don't reload if already loading
        if (this.detailsDialog.loadingGcodes || this.detailsDialog.loadingRuns) {
            return
        }

        try {
            this.detailsDialog.loadingGcodes = true
        
            // Load gcode files
            this.jobGcodes = await this.$store.dispatch('fleet/jobs/loadJobGcodes', jobId)
            this.detailsDialog.loadingGcodes = false
        
            // OPTIMIZATION: Early return if no gcode files to avoid unnecessary API calls
            if (!this.jobGcodes || this.jobGcodes.length === 0) {
                this.allJobRuns = {}
                return
            }
        
            // Load runs only if we have gcode files
            this.detailsDialog.loadingRuns = true
            await this.loadAllJobRuns()
            this.detailsDialog.loadingRuns = false
        
        } catch (error) {
            console.error('Failed to load job gcodes and runs:', error)
            this.detailsDialog.loadingGcodes = false
            this.detailsDialog.loadingRuns = false
            this.$toast.error('Failed to load job details')
        }
    }

    async loadAllJobRuns() {
        if (!this.jobGcodes || this.jobGcodes.length === 0) {
            this.allJobRuns = {}
            return
        }

        // OPTIMIZATION: Clear cache before loading new data
        this.runStatisticsCache = {}

        try {
            // OPTIMIZATION: Load runs in parallel with better error isolation
            const runPromises = this.jobGcodes.map(async (gcode) => {
                try {
                    const runs = await this.$store.dispatch('fleet/jobs/loadJobGcodeRuns', gcode.id)
                    return { gcodeId: gcode.id, runs: runs || [], error: null }
                } catch (error) {
                    console.warn(`Failed to load runs for gcode ${gcode.gcode_filename}:`, error)
                    return { gcodeId: gcode.id, runs: [], error: error.message }
                }
            })

            const results = await Promise.all(runPromises)
        
            // OPTIMIZATION: Build new object once instead of multiple Vue.set calls
            const newAllJobRuns = {}
            results.forEach(({ gcodeId, runs, error }) => {
                newAllJobRuns[gcodeId] = runs
                if (error) {
                    console.warn(`Error loading runs for ${gcodeId}: ${error}`)
                }
            })
        
            // Single reactive update
            this.allJobRuns = newAllJobRuns

        } catch (error) {
            console.error('Failed to load job runs:', error)
            this.allJobRuns = {}
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

    getPriorityColor(priority: string) {
        switch (priority) {
            case 'high':
                return 'red'
            case 'medium':
                return 'orange'
            case 'low':
                return 'blue'
            default:
                return 'grey'
        }
    }

    getPriorityDisplay(priority: string) {
        switch (priority) {
            case 'high':
                return 'High'
            case 'medium':
                return 'Medium'
            case 'low':
                return 'Low'
            default:
                return 'Unknown'
        }
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

    clickRow(item: FleetJob, event?: Event) {
        // Don't open details if the click was on an interactive element
        if (event && event.target) {
            const target = event.target as HTMLElement
            const isInteractiveElement = target.closest('.v-chip') || 
                                       target.closest('.v-btn') || 
                                       target.closest('.v-menu') ||
                                       target.closest('input[type="checkbox"]')
    
            if (isInteractiveElement) {
                return
            }
        }

        // Show loading toast for slow connections
        const loadingToast = setTimeout(() => {
            this.$toast.info('Loading job details...', { timeout: 2000 })
        }, 500)

        this.viewJobDetails(item).then(() => {
            clearTimeout(loadingToast)
        })
    }

    async viewJobDetails(item: FleetJob) {
        // Clear previous data immediately to show loading state
        this.jobGcodes = []
        this.allJobRuns = {}
        this.runStatisticsCache = {}

        this.detailsDialog.item = item
        this.detailsDialog.show = true

        // Load data asynchronously without blocking UI
        this.loadJobGcodesAndRuns(item.id).catch(error => {
            console.error('Failed to load job details:', error)
            this.$toast.error('Failed to load some job details')
        })
    }

    showContextMenu(e: any, item: FleetJob) {
        if (!this.contextMenu.shown) {
            e?.preventDefault()
        
            // Better positioning logic for both right-click and button click
            let x, y
        
            if (e.type === 'click') {
                // Button click - position relative to the button
                const rect = e.target.getBoundingClientRect()
                x = rect.left + rect.width / 2
                y = rect.bottom + 5
            } else {
                // Right-click - use mouse coordinates
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
            due_date: item.due_date ? item.due_date.split('T')[0] : '', // Convert ISO datetime to YYYY-MM-DD
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

    openAddGcodeDialog() {
        this.addGcodeDialog.show = true
        this.addGcodeDialog.isEdit = false
    }

    // Replace your existing saveJob method with this updated version:
    async saveJob() {
        if (!this.createJobDialog.valid) return
        this.createJobDialog.loading = true
        try {
            const formData = { ...this.createJobDialog.form }
            if (formData.due_date) {
                formData.due_date = new Date(formData.due_date).toISOString()
            }
            let savedJob = null
            if (this.createJobDialog.isEdit) {
                const jobId = formData.id
                delete formData.id
    
                savedJob = await this.$store.dispatch('fleet/jobs/updateJob', { 
                    jobId: jobId, 
                    jobData: formData 
                })
                this.$toast.success('Job updated successfully')
            } else {
                delete formData.id
    
                // Create the job
                savedJob = await this.$store.dispatch('fleet/jobs/createJob', formData)
                this.$toast.success('Job created successfully')
            
                // STORE BATCH DATA BEFORE CLOSING DIALOG
                const batchGcodesToCreate = [...this.createJobDialog.batchGcodes]
            
                // Close dialog immediately after job creation
                this.closeCreateJobDialog()
            
                // Do GCode creation and refresh in background
                if (batchGcodesToCreate.length > 0) {
                    console.log('🔧 Creating batch GCodes:', batchGcodesToCreate)
                    this.createBatchGcodeFilesInBackground(savedJob.id, batchGcodesToCreate)
                } else {
                    console.log('❌ No batch GCodes to create')
                    // Still refresh jobs list, but in background
                    this.refreshJobsInBackground()
                }
        
                return // Exit early for new jobs
            }
            // Only for edits - wait for everything to complete
            if (this.detailsDialog.show && this.detailsDialog.item && 
                this.detailsDialog.item.id === savedJob?.id) {
                await this.loadJobGcodesAndRuns(this.detailsDialog.item.id)
            }
    
            await this.refreshJobs()
            this.closeCreateJobDialog()
    
        } catch (error) {
            console.error('Failed to save job:', error)
            this.$toast.error(`Failed to ${this.createJobDialog.isEdit ? 'update' : 'create'} job`)
        } finally {
            this.createJobDialog.loading = false
        }
    }

    openActionsMenu(event: Event, item: FleetJob) {
        // Prevent the row click event
        event.stopPropagation()
    
        // Use the same showContextMenu method but with the button click coordinates
        this.showContextMenu(event, item)
    }

    async updateJobStatusFromTable(item: FleetJob, status: string) {
        try {
            await this.updateJobStatus(item, status)
        
            // If the details dialog is open and showing the same job, update it too
            if (this.detailsDialog.show && this.detailsDialog.item && this.detailsDialog.item.id === item.id) {
                this.detailsDialog.item = {
                    ...this.detailsDialog.item,
                    status: status,
                    updated_at: new Date().toISOString()
                }
            }
        
            // Refresh the job list to ensure consistency
            await this.refreshJobs()
        
        } catch (error) {
            console.error('Failed to update job status from table:', error)
            this.$toast.error('Failed to update job status')
        }
    }

    async saveGcode() {
        if (!this.addGcodeDialog.valid || !this.detailsDialog.item) return

        this.addGcodeDialog.loading = true
        try {
            if (this.addGcodeDialog.isEdit) {
                // Update existing gcode
                await this.$store.dispatch('fleet/jobs/updateJobGcode', {
                    gcodeId: this.addGcodeDialog.currentGcodeId,
                    gcode: this.addGcodeDialog.form
                })
                this.$toast.success('GCode file updated successfully')
            } else {
                // Create new gcode
                await this.$store.dispatch('fleet/jobs/createJobGcode', {
                    jobId: this.detailsDialog.item.id,
                    gcode: this.addGcodeDialog.form
                })
                this.$toast.success('GCode file added successfully')
            }
        
            await this.loadJobGcodesAndRuns(this.detailsDialog.item.id)
            this.closeAddGcodeDialog()
        } catch (error) {
            console.error('Failed to save gcode:', error)
            this.$toast.error(`Failed to ${this.addGcodeDialog.isEdit ? 'update' : 'add'} GCode file`)
        } finally {
            this.addGcodeDialog.loading = false
        }
    }

    async viewGcodeRuns(gcode: FleetJobGcode) {
        this.gcodeRunsDialog.gcodeFile = gcode
        this.gcodeRunsDialog.show = true
        await this.refreshGcodeRuns()
    }

    async refreshGcodeRuns() {
        if (!this.gcodeRunsDialog.gcodeFile || this.gcodeRunsDialog.loading) return

        this.gcodeRunsDialog.loading = true
        try {
            const runs = await this.$store.dispatch('fleet/jobs/loadJobGcodeRuns', this.gcodeRunsDialog.gcodeFile.id)
            this.gcodeRuns = runs || []
        
            // OPTIMIZATION: Update allJobRuns efficiently
            this.allJobRuns = {
                ...this.allJobRuns,
                [this.gcodeRunsDialog.gcodeFile.id]: runs || []
            }
        
            // OPTIMIZATION: Clear cache for this specific gcode
            this.clearRunStatisticsCache(this.gcodeRunsDialog.gcodeFile.id)
        
        } catch (error) {
            console.error('Failed to load gcode runs:', error)
            this.$toast.error('Failed to load print runs')
        } finally {
            this.gcodeRunsDialog.loading = false
        }
    }

    // HELPER METHOD - Clear specific cache entries
    clearRunStatisticsCache(gcodeId?: string) {
        if (gcodeId) {
            // Clear cache entries for specific gcode
            Object.keys(this.runStatisticsCache).forEach(key => {
                if (key.startsWith(`${gcodeId}-`)) {
                    delete this.runStatisticsCache[key]
                }
            })
        } else {
            // Clear all cache
            this.runStatisticsCache = {}
        }
    }
    closeGcodeRunsDialog() {
        this.gcodeRunsDialog.show = false
        this.gcodeRunsDialog.gcodeFile = null
        this.gcodeRuns = []
    }

    editRun(run: FleetJobGcodeRun) {
        this.createRunDialog.isEdit = true
        this.createRunDialog.form = {
            id: run.id,
            printer_hostname: run.printer_hostname,
            status: run.status,
            moonraker_job_id: run.moonraker_job_id || '',
            notes: run.notes || '',
            qc: run.qc,
        }
        this.createRunDialog.show = true
    }

    async saveRun() {
        if (!this.createRunDialog.valid || !this.gcodeRunsDialog.gcodeFile) return

        this.createRunDialog.loading = true
        try {
            const formData = { ...this.createRunDialog.form }
        
            if (this.createRunDialog.isEdit) {
                const runId = formData.id
                delete formData.id
            
                await this.$store.dispatch('fleet/jobs/updateJobGcodeRun', {
                    runId: runId,
                    updateData: formData
                })
                this.$toast.success('Print run updated successfully')
            } else {
                delete formData.id
                delete formData.status
                delete formData.qc
            
                await this.$store.dispatch('fleet/jobs/createJobGcodeRun', {
                    jobGcodeId: this.gcodeRunsDialog.gcodeFile.id,
                    run: formData
                })
                this.$toast.success('Print run added successfully')
            }
        
            // Refresh the runs data which will also update progress bars
            await this.refreshGcodeRuns()
            this.closeCreateRunDialog()
        
        } catch (error) {
            console.error('Failed to save run:', error)
            this.$toast.error(`Failed to ${this.createRunDialog.isEdit ? 'update' : 'add'} print run`)
        } finally {
            this.createRunDialog.loading = false
        }
    }

    closeCreateRunDialog() {
        this.createRunDialog.show = false
        this.createRunDialog.isEdit = false
        this.createRunDialog.form = {
            id: '',
            printer_hostname: '',
            status: 'in_progress',
            moonraker_job_id: '',
            notes: '',
            qc: null,
        }
    }

    async updateRunStatus(run: FleetJobGcodeRun, status: string) {
        try {
            await this.$store.dispatch('fleet/jobs/updateJobGcodeRun', {
                runId: run.id,
                updateData: { status }
            })
            this.$toast.success(`Run status updated to ${status.replace('_', ' ')}`)
        
            // OPTIMIZATION: Update local data instead of full refresh
            this.updateLocalRunData(run.id, { status })
        
        } catch (error) {
            console.error('Failed to update run status:', error)
            this.$toast.error('Failed to update run status')
        }
    }

    async updateRunQC(run: FleetJobGcodeRun, qc: string | null) {
        try {
            await this.$store.dispatch('fleet/jobs/updateJobGcodeRunQC', {
                runId: run.id,
                qc: qc
            })
            this.$toast.success(`QC updated to ${qc || 'not set'}`)
        
            // OPTIMIZATION: Update local data instead of full refresh
            this.updateLocalRunData(run.id, { qc })
        
        } catch (error) {
            console.error('Failed to update run QC:', error)
            this.$toast.error('Failed to update QC')
        }
    }

    // HELPER METHOD - Update local run data efficiently
    updateLocalRunData(runId: string, updates: Partial<FleetJobGcodeRun>) {
        // Update gcodeRuns array if viewing runs dialog
        if (this.gcodeRuns && this.gcodeRuns.length > 0) {
            const runIndex = this.gcodeRuns.findIndex(r => r.id === runId)
            if (runIndex !== -1) {
                this.gcodeRuns[runIndex] = { ...this.gcodeRuns[runIndex], ...updates }
            }
        }
    
        // Update allJobRuns data
        Object.keys(this.allJobRuns).forEach(gcodeId => {
            const runs = this.allJobRuns[gcodeId]
            const runIndex = runs.findIndex(r => r.id === runId)
            if (runIndex !== -1) {
                runs[runIndex] = { ...runs[runIndex], ...updates }
                // Clear cache for this gcode since data changed
                this.clearRunStatisticsCache(gcodeId)
            }
        })
    }

    async deleteRun(run: FleetJobGcodeRun) {
        if (!confirm(`Are you sure you want to delete this print run from ${run.printer_hostname}?`)) {
            return
        }

        try {
            // Optimistically remove from local state
            const runIndex = this.gcodeRuns.findIndex(r => r.id === run.id)
            if (runIndex >= 0) {
                this.gcodeRuns.splice(runIndex, 1)
            }

            // Update allJobRuns data
            Object.keys(this.allJobRuns).forEach(gcodeId => {
                const runs = this.allJobRuns[gcodeId]
                const runIndex = runs.findIndex(r => r.id === run.id)
                if (runIndex >= 0) {
                    runs.splice(runIndex, 1)
                    this.clearRunStatisticsCache(gcodeId)
                }
            })

            // Delete from backend
            await this.$store.dispatch('fleet/jobs/deleteJobGcodeRun', run.id)
            this.$toast.success('Print run deleted successfully')

        } catch (error) {
            console.error('Failed to delete run:', error)
            this.$toast.error('Failed to delete print run')
        
            // Restore on error
            await this.refreshGcodeRuns()
        }
    }

    // Helper methods for status/QC display

    getRunStatusColor(status: string) {
        const colors = {
            in_progress: 'blue',
            success: 'green',
            fail: 'red',
            cancelled: 'grey',
        }
        return colors[status] || 'grey'
    }

    getRunStatusTextColor(status: string) {
        return 'white'
    }

    getRunStatusIcon(status: string) {
        switch (status) {
            case 'in_progress':
                return this.mdiProgressClock
            case 'success':
                return this.mdiCheck
            case 'fail':
                return this.mdiAlertOutline
            case 'cancelled':
                return this.mdiCancel
            default:
                return this.mdiHelpCircleOutline
        }
    }

    getQCColor(qc: string | null) {
        switch (qc) {
            case 'pass':
                return 'green'
            case 'fail':
                return 'red'
            default:
                return 'grey'
        }
    }

    getQCTextColor(qc: string | null) {
        return 'white'
    }

    getQCIcon(qc: string | null) {
        switch (qc) {
            case 'pass':
                return this.mdiCheckboxMarkedCircleOutline
            case 'fail':
                return this.mdiCloseCircleOutline
            default:
                return this.mdiHelpCircleOutline
        }
    }

    getQCDisplay(qc: string | null) {
        switch (qc) {
            case 'pass':
                return 'Pass'
            case 'fail':
                return 'Fail'
            default:
                return 'Not Set'
        }
    }

    getRunStatistics(gcode: FleetJobGcode) {
        const cacheKey = `${gcode.id}-${gcode.required_runs}`
    
        // OPTIMIZATION: Use better cache key that includes runs data hash
        const runs = this.allJobRuns[gcode.id] || []
        const runsHash = runs.length ? runs.map(r => `${r.id}-${r.status}-${r.qc}`).join(',') : 'empty'
        const fullCacheKey = `${cacheKey}-${runsHash}`
    
        if (this.runStatisticsCache[fullCacheKey] && !this.detailsDialog.loadingRuns) {
            return this.runStatisticsCache[fullCacheKey]
        }

        const requiredRuns = gcode.required_runs || 0

        if (!runs || runs.length === 0) {
            const emptyStats = {
                requiredRuns,
                inProgress: 0,
                completedNoQC: 0,
                passedQC: 0,
                totalFailed: 0,
                technicalFailures: 0,
                qcFailures: 0,
                goodRuns: 0,
                remainingNeeded: requiredRuns,
                totalRuns: 0,
                percentages: {
                    remaining: 100,
                    inProgress: 0,
                    completed: 0,
                    passed: 0,
                }
            }
            this.runStatisticsCache[fullCacheKey] = emptyStats
            return emptyStats
        }

        // OPTIMIZATION: Calculate all stats in one pass
        let inProgress = 0, completedNoQC = 0, passedQC = 0, technicalFailures = 0, qcFailures = 0

        runs.forEach(run => {
            if (run.status === 'in_progress') {
                inProgress++
            } else if (run.status === 'success') {
                if (!run.qc || run.qc === null) {
                    completedNoQC++
                } else if (run.qc === 'pass') {
                    passedQC++
                } else if (run.qc === 'fail') {
                    qcFailures++
                }
            } else if (run.status === 'fail' || run.status === 'cancelled') {
                technicalFailures++
            }
        })

        const totalFailed = technicalFailures + qcFailures
        const goodRuns = inProgress + completedNoQC + passedQC
        const remainingNeeded = Math.max(0, requiredRuns - goodRuns)
        const total = Math.max(requiredRuns, goodRuns)
        const safeTotal = total > 0 ? total : 1

        const stats = {
            requiredRuns,
            inProgress,
            completedNoQC,
            passedQC,
            totalFailed,
            technicalFailures,
            qcFailures,
            goodRuns,
            remainingNeeded,
            totalRuns: runs.length,
            percentages: {
                remaining: Math.max(0, (remainingNeeded / safeTotal) * 100),
                inProgress: (inProgress / safeTotal) * 100,
                completed: (completedNoQC / safeTotal) * 100,
                passed: (passedQC / safeTotal) * 100,
            }
        }

        this.runStatisticsCache[fullCacheKey] = stats
        return stats
    }

    closeCreateJobDialog() {
        this.createJobDialog.show = false
        this.createJobDialog.isEdit = false
        this.createJobDialog.loading = false
    
        // Store batch data before clearing for background processing
        const batchGcodes = [...this.createJobDialog.batchGcodes]
    
        // Clear all state
        this.createJobDialog.batchGcodes = []
        this.createJobDialog.batchUploading = false
        this.createJobDialog.batchUploadProgress = 0
    
        this.createJobDialog.form = {
            id: '',
            name: '',
            customer_id: '',
            job_type: 'sample',
            priority: 'low',
            operator_name: '',
            description: '',
            due_date: '',
        }
    
        // Reset form validation
        if (this.$refs.jobForm) {
            (this.$refs.jobForm as any).resetValidation()
        }
    
        console.log('✅ Create job dialog closed immediately')
    }

    getHighPriorityJobsCount(state): number {
        return state.jobs.filter((job: FleetJob) => job.priority === 'high').length
    }

    getMediumPriorityJobsCount(state): number {
        return state.jobs.filter((job: FleetJob) => job.priority === 'medium').length
    }

    getLowPriorityJobsCount(state): number {
        return state.jobs.filter((job: FleetJob) => job.priority === 'low').length
    }

    closeAddGcodeDialog() {
        this.addGcodeDialog.show = false
        this.addGcodeDialog.isEdit = false
        this.addGcodeDialog.uploading = false
        this.addGcodeDialog.uploadProgress = 0
        this.addGcodeDialog.uploadingFileName = ''
        this.addGcodeDialog.uploadedFile = null
        this.addGcodeDialog.currentGcodeId = ''
        this.addGcodeDialog.form = {
            gcode_filename: '',
            required_runs: 1,
            preferred_printer: 'any',
            filament_type: '',
        }
    }

    async deleteJob() {
        const jobToDelete = this.contextMenu.item
    
        try {
            // Optimistically remove from jobs list
            const jobIndex = this.jobs.findIndex(j => j.id === jobToDelete.id)
            if (jobIndex >= 0) {
                this.$store.commit('fleet/jobs/removeJob', jobToDelete.id) // You'll need this mutation
            }

            // Close any open dialogs for this job
            if (this.detailsDialog.show && this.detailsDialog.item?.id === jobToDelete.id) {
                this.detailsDialog.show = false
            }

            // Delete from backend
            await this.$store.dispatch('fleet/jobs/deleteJob', jobToDelete.id)
            this.$toast.success('Job deleted successfully')
            this.deleteDialog = false

        } catch (error) {
            console.error('Failed to delete job:', error)
            this.$toast.error('Failed to delete job')
        
            // Restore on error by refreshing
            await this.refreshJobs()
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

    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    async onFileSelect(e: Event) {
        const target = e.target as HTMLInputElement
        const files = target.files
        if (files && files.length > 0) {
            await this.handleFileUpload(files[0])
        }
    }

    async handleFileUpload(file: File) {
        // Validate file type
        const validExtensions = ['.gcode', '.g', '.gco']
        const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    
        if (!validExtensions.includes(fileExtension)) {
            this.$toast.error('Please select a valid GCode file (.gcode, .g, .gco)')
            return
        }

        // Start upload
        this.addGcodeDialog.uploading = true
        this.addGcodeDialog.uploadProgress = 0
        this.addGcodeDialog.uploadingFileName = file.name

        // Simulate progress for user feedback
        const progressInterval = setInterval(() => {
            if (this.addGcodeDialog.uploadProgress < 90) {
                this.addGcodeDialog.uploadProgress += Math.random() * 20
            }
        }, 200)

        try {
            // Use the files store action to upload
            const uploadedFilename = await this.$store.dispatch('files/uploadFile', {
                file: file,
                path: '', // Upload to root of gcodes directory
                root: 'gcodes'
            })

            clearInterval(progressInterval)
            this.addGcodeDialog.uploadProgress = 100

            if (uploadedFilename) {
                // Success - store the file info and auto-fill filename
                this.addGcodeDialog.uploadedFile = file
                this.addGcodeDialog.form.gcode_filename = uploadedFilename
                this.$toast.success(`File uploaded successfully: ${uploadedFilename}`)

                const filenameLower = uploadedFilename.toLowerCase()

                // Set printer model
                this.addGcodeDialog.form.preferred_printer = filenameLower.includes('hs-pro') ? 'HS-Pro' : 'HS3'

                // Set filament type
                if (filenameLower.includes('pa-cf')) {
                    this.addGcodeDialog.form.filament_type = 'PA-CF'
                } else if (filenameLower.includes('petg-cf')) {
                    this.addGcodeDialog.form.filament_type = 'PETG-CF'
                } else if (filenameLower.includes('pa-gf')) {
                    this.addGcodeDialog.form.filament_type = 'PA-GF'
                }
            } else {
                throw new Error('Upload failed')
            }
        } catch (error) {
            clearInterval(progressInterval)
            console.error('Upload failed:', error)
            this.$toast.error('Failed to upload file')
        } finally {
            this.addGcodeDialog.uploading = false
            this.addGcodeDialog.uploadProgress = 0
            this.addGcodeDialog.uploadingFileName = ''
        }
    }

    clearUploadedFile() {
        this.addGcodeDialog.uploadedFile = null
        this.addGcodeDialog.form.gcode_filename = ''
    }

    editGcodeFile(gcode: FleetJobGcode) {
        this.addGcodeDialog.isEdit = true
        this.addGcodeDialog.currentGcodeId = gcode.id
        this.addGcodeDialog.form = {
            gcode_filename: gcode.gcode_filename,
            required_runs: gcode.required_runs,
            preferred_printer: gcode.preferred_printer,
            filament_type: gcode.filament_type,
        }
        this.addGcodeDialog.show = true
    }

    async deleteGcodeFile(gcode: FleetJobGcode) {
        // Check if there are runs associated
        const stats = this.getRunStatistics(gcode)
        if (stats.totalRuns > 0) {
            this.$toast.error(`Cannot delete GCode file. It has ${stats.totalRuns} associated print runs.`)
            return
        }

        if (!confirm(`Are you sure you want to delete "${gcode.gcode_filename}"?`)) {
            return
        }

        try {
            // Optimistically remove from local state first
            const gcodeIndex = this.jobGcodes.findIndex(g => g.id === gcode.id)
            if (gcodeIndex >= 0) {
                this.jobGcodes.splice(gcodeIndex, 1)
            }

            // Clear cache for this gcode
            this.clearRunStatisticsCache(gcode.id)

            // Delete from backend
            await this.$store.dispatch('fleet/jobs/deleteJobGcode', gcode.id)
            this.$toast.success('GCode file deleted successfully')

        } catch (error) {
            console.error('Failed to delete gcode file:', error)
            this.$toast.error('Failed to delete GCode file')
        
            // Restore on error by reloading
            if (this.detailsDialog.item) {
                await this.loadJobGcodesAndRuns(this.detailsDialog.item.id)
            }
        }
    }

    getPrinterStatusPriority(printer: any): number {
        const fleetDisconnected = printer.fleet_to_printer_ws === false
        const isConnected = printer.socket?.isConnected
        const state = printer.print_stats?.state
    
        // Disconnected printers get lower priority
        if (fleetDisconnected || !isConnected) {
            return 4 // Disconnected
        }
    
        // Webhook shutdown
        if (printer.webhooks?.state === 'shutdown') {
            return 5 // Error state
        }
    
        // Sort by print state
        switch (state) {
            case 'standby':
            case 'ready':
                return 1 // Best - ready to print
            case 'complete':
                return 2 // Good - just finished
            case 'printing':
                return 3 // Busy - currently printing
            case 'paused':
            case 'error':
            case 'cancelled':
                return 5 // Problems
            default:
                return 4 // Unknown state
        }
    }

    getPrinterDisplayStatus(printer: any): string {
        const fleetDisconnected = printer.fleet_to_printer_ws === false
        const isConnected = printer.socket?.isConnected
        const state = printer.print_stats?.state
    
        if (fleetDisconnected || !isConnected) {
            return 'Disconnected'
        }
    
        if (printer.webhooks?.state === 'shutdown') {
            return 'Shutdown'
        }
    
        switch (state) {
            case 'standby':
                return 'Ready'
            case 'ready':
                return 'Ready'
            case 'printing':
                return 'Printing'
            case 'complete':
                return 'Complete'
            case 'paused':
                return 'Paused'
            case 'error':
                return 'Error'
            case 'cancelled':
                return 'Cancelled'
            default:
                return state || 'Unknown'
        }
    }

    isPrinterBusy(printer: any): boolean {
        const state = printer.print_stats?.state
        return state === 'printing'
    }

    // Update the existing openCreateRunDialog method:
    openCreateRunDialog() {
        this.createRunDialog.isEdit = false
        this.createRunDialog.show = true
    
        // Auto-select the first available printer if any
        const availablePrinters = this.sortedPrinterOptions.filter(p => !p.disabled)
        if (availablePrinters.length > 0) {
            this.createRunDialog.form.printer_hostname = availablePrinters[0].value
        }
    }

    getPrinterChipColor(printer: any): string {
        const fleetDisconnected = printer.fleet_to_printer_ws === false
        const isConnected = printer.socket?.isConnected
        const state = printer.print_stats?.state
    
        if (fleetDisconnected || !isConnected) {
            return 'grey'
        }
    
        if (printer.webhooks?.state === 'shutdown') {
            return 'red'
        }
    
        switch (state) {
            case 'standby':
            case 'ready':
                return 'green'
            case 'printing':
                return 'blue'
            case 'complete':
                return 'teal'
            case 'paused':
                return 'orange'
            case 'error':
            case 'cancelled':
                return 'red'
            default:
                return 'grey'
        }
    }

    getPrinterChipTextColor(printer: any): string {
        return 'white'
    }

    // Optional: Add a method to get additional printer info for tooltips
    getPrinterInfo(printer: any): string {
        const info = []
    
        if (printer.toolhead?.filament_type) {
            info.push(`Filament: ${printer.toolhead.filament_type}`)
        }
    
        if (printer.current_file?.filename) {
            info.push(`Current File: ${printer.current_file.filename}`)
        }
    
        if (printer.print_stats?.state === 'printing' && printer.virtual_sdcard?.progress) {
            const progress = Math.round(printer.virtual_sdcard.progress * 100)
            info.push(`Progress: ${progress}%`)
        }
    
        return info.join(' • ')
    }

    getPrinterSelectionHint(): string {
        const gcodeFile = this.currentGcodeFile
        if (!gcodeFile) {
            return 'Choose an available printer'
        }
    
        const hints = []
    
        // Model requirement
        if (gcodeFile.preferred_printer && gcodeFile.preferred_printer !== 'any') {
            hints.push(`${gcodeFile.preferred_printer} printers only`)
        }
    
        // Available count
        const availableCount = this.sortedPrinterOptions.filter(p => !p.disabled).length
        hints.push(`${availableCount} available`)
    
        // Filament info
        if (gcodeFile.filament_type) {
            hints.push(`requires ${gcodeFile.filament_type}`)
        }
    
        return hints.join(' • ')
    }

    // Check if selected printer has filament mismatch
    getSelectedPrinterMismatch(): boolean {
        const selectedHostname = this.createRunDialog.form.printer_hostname
        if (!selectedHostname || !this.currentGcodeFile?.filament_type) {
            return false
        }
    
        const selectedOption = this.sortedPrinterOptions.find(p => p.value === selectedHostname)
        return selectedOption?.hasFilamentMismatch || false
    }

    // Get selected printer's current filament
    getSelectedPrinterFilament(): string {
        const selectedHostname = this.createRunDialog.form.printer_hostname
        if (!selectedHostname) {
            return 'Unknown'
        }
    
        const selectedOption = this.sortedPrinterOptions.find(p => p.value === selectedHostname)
        return selectedOption?.printerFilament || 'None detected'
    }

    // Handle batch file selection from upload button
    async onBatchFileSelect(e: Event) {
        const target = e.target as HTMLInputElement
        const files = target.files
        if (files && files.length > 0) {
            await this.handleBatchFileUpload([...files])
        }
        // Clear the input so the same files can be selected again
        target.value = ''
    }

    // Handle batch file upload
    async handleBatchFileUpload(files: File[]) {
        // Validate file types
        const validExtensions = ['.gcode', '.g', '.gco']
        const validFiles = files.filter(file => {
            const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
            return validExtensions.includes(fileExtension)
        })

        if (validFiles.length !== files.length) {
            this.$toast.error(`${files.length - validFiles.length} files skipped (invalid format)`)
        }

        if (validFiles.length === 0) {
            this.$toast.error('No valid GCode files selected')
            return
        }

        // Start batch upload
        this.createJobDialog.batchUploading = true
        this.createJobDialog.batchUploadProgress = 0

        try {
            const successfullyUploadedFiles = []

            // Upload files one by one to better handle errors
            for (let i = 0; i < validFiles.length; i++) {
                const file = validFiles[i]
                try {
                    const uploadedFilename = await this.$store.dispatch('files/uploadFile', {
                        file: file,
                        path: '', // Upload to root of gcodes directory
                        root: 'gcodes'
                    })

                    if (uploadedFilename) {
                        // Only add successfully uploaded files
                        successfullyUploadedFiles.push({
                            name: uploadedFilename,
                            originalFile: file
                        })
                        this.$toast.success(`Uploaded: ${uploadedFilename}`)
                    } else {
                        this.$toast.error(`Failed to upload: ${file.name}`)
                    }

                } catch (error) {
                    console.error(`Failed to upload ${file.name}:`, error)
                    this.$toast.error(`Upload failed: ${file.name}`)
                }

                // Update progress
                this.createJobDialog.batchUploadProgress = ((i + 1) / validFiles.length) * 100
            }

            // Only process successfully uploaded files
            if (successfullyUploadedFiles.length > 0) {
                const filesToProcess = successfullyUploadedFiles.map(result => {
                    // Create a proper File object with the uploaded filename
                    const mockFile = new File([''], result.name, { type: 'text/plain' })
                    return mockFile
                })
            
                this.processBatchGcodeFiles(filesToProcess)
                this.$toast.success(`Successfully processed ${successfullyUploadedFiles.length} GCode files`)
            }

            // Report overall results
            const failedCount = validFiles.length - successfullyUploadedFiles.length
            if (failedCount > 0) {
                this.$toast.error(`${failedCount} files failed to upload`)
            }

        } catch (error) {
            console.error('Batch upload failed:', error)
            this.$toast.error('Batch upload failed')
        } finally {
            this.createJobDialog.batchUploading = false
            this.createJobDialog.batchUploadProgress = 0
        }
    }

    // Process batch GCode files (from drag/drop or manual selection)
    processBatchGcodeFiles(files: FileList) {
        console.log('🔧 Processing batch GCode files:', files.length)

        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const parsed = this.parseGcodeFilename(file.name)

            const batchFile = {
                gcode_filename: file.name,
                required_runs: parsed.required_runs,
                preferred_printer: parsed.preferred_printer,
                filament_type: parsed.filament_type, // This might be empty and needs user input
                originalFile: file
            }

            this.createJobDialog.batchGcodes.push(batchFile)
        }

        // Show a warning if any files have empty filament types
        const emptyFilamentFiles = this.createJobDialog.batchGcodes.filter(f => !f.filament_type.trim())
        if (emptyFilamentFiles.length > 0) {
            this.$toast.warning(`${emptyFilamentFiles.length} file(s) need filament type specified`)
        }

        this.$toast.success(`Added ${files.length} files. Please review and fill in any missing information.`)
    }

    // Remove a file from batch GCode list
    removeBatchGcodeFile(index: number) {
        this.createJobDialog.batchGcodes.splice(index, 1)
    }

    // Clear all batch files
    clearAllBatchFiles() {
        this.createJobDialog.batchGcodes = []
    }

    // Create batch GCode files after job creation
    async createBatchGcodeFiles(jobId: string) {
        if (this.createJobDialog.batchGcodes.length === 0) {
            console.log('No batch GCode files to create')
            return
        }

        console.log(`Creating ${this.createJobDialog.batchGcodes.length} GCode files for job ${jobId}:`, this.createJobDialog.batchGcodes)
        this.$toast.info(`Creating ${this.createJobDialog.batchGcodes.length} GCode files...`)
    
        let successCount = 0
        let failCount = 0

        for (const gcodeFile of this.createJobDialog.batchGcodes) {
            try {
                console.log(`Creating GCode file: ${gcodeFile.gcode_filename}`, gcodeFile)
            
                const result = await this.$store.dispatch('fleet/jobs/createJobGcode', {
                    jobId: jobId,
                    gcode: {
                        gcode_filename: gcodeFile.gcode_filename,
                        required_runs: gcodeFile.required_runs,
                        preferred_printer: gcodeFile.preferred_printer,
                        filament_type: gcodeFile.filament_type
                    }
                })
            
                console.log(`Successfully created GCode file: ${gcodeFile.gcode_filename}`, result)
                successCount++
            
            } catch (error) {
                console.error(`Failed to create GCode file ${gcodeFile.gcode_filename}:`, error)
                this.$toast.error(`Failed to create GCode file: ${gcodeFile.gcode_filename}`)
                failCount++
            }
        }

        // Report results
        if (successCount > 0) {
            this.$toast.success(`Successfully created ${successCount} GCode files`)
        }
        if (failCount > 0) {
            this.$toast.error(`Failed to create ${failCount} GCode files`)
        }

        console.log(`Batch GCode creation completed: ${successCount} success, ${failCount} failed`)
    }

    // Parse filename to extract printer model and filament type
    parseGcodeFilename(filename: string) {
        const filenameLower = filename.toLowerCase()
    
        // Determine printer model
        let preferred_printer = 'any'
        if (filenameLower.includes('hs-pro') || filenameLower.includes('hspro')) {
            preferred_printer = 'HS-Pro'
        } else if (filenameLower.includes('hs3') || filenameLower.includes('hs-3')) {
            preferred_printer = 'HS3'
        }

        // Determine filament type
        let filament_type = ''
        if (filenameLower.includes('pa-cf') || filenameLower.includes('pacf')) {
            filament_type = 'PA-CF'
        } else if (filenameLower.includes('petg-cf') || filenameLower.includes('petgcf')) {
            filament_type = 'PETG-CF'
        } else if (filenameLower.includes('pa-gf') || filenameLower.includes('pagf')) {
            filament_type = 'PA-GF'
        } else if (filenameLower.includes('petg')) {
            filament_type = 'PETG'
        } else if (filenameLower.includes('pla')) {
            filament_type = 'PLA'
        } else if (filenameLower.includes('abs')) {
            filament_type = 'ABS'
        } else if (filenameLower.includes('tpu')) {
            filament_type = 'TPU'
        }

        // Default required runs based on job type or filename
        let required_runs = 1
        const quantityMatch = filename.match(/(?:x|qty|quantity|runs?)[_\s]*(\d+)/i)
        if (quantityMatch) {
            required_runs = parseInt(quantityMatch[1])
        }

        return {
            preferred_printer,
            filament_type,
            required_runs
        }
    }

    handleFullscreenUpload(uploadedFiles: any[]) {
        console.log('🎯 handleFullscreenUpload called with files:', uploadedFiles)
        console.log('🎯 createJobDialog.show:', this.createJobDialog.show)
        console.log('🎯 createJobDialog.isEdit:', this.createJobDialog.isEdit)

        // Only handle if create job dialog is open and not in edit mode
        if (!this.createJobDialog.show || this.createJobDialog.isEdit) {
            console.log('❌ Dialog not open or in edit mode, skipping')
            return
        }

        // Filter for GCode files based on extension only
        const gcodeFiles = uploadedFiles.filter(file => {
            const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
            return ['.gcode', '.g', '.gco'].includes(ext)
        })

        console.log('✅ Found gcode files:', gcodeFiles)

        if (gcodeFiles.length > 0) {
            // Convert to File objects for processing
            const filesToProcess = gcodeFiles.map(fileInfo => {
                return new File([''], fileInfo.name, { type: 'text/plain' })
            })
        
            console.log('🔧 Processing files:', filesToProcess)
            this.processBatchGcodeFiles(filesToProcess)
            this.$toast.success(`Added ${gcodeFiles.length} GCode files to job creation`)
        } else {
            console.log('❌ No gcode files found in upload')
        }
    }

    async createBatchGcodeFilesInBackground(jobId: string, batchGcodes: any[]) {
        if (batchGcodes.length === 0) return

        this.$toast.info(`Creating ${batchGcodes.length} GCode files...`, { timeout: 2000 })

        try {
            // Prepare batch data with validation
            const gcodeFiles = batchGcodes.map((gcodeFile, index) => {
                console.log(`🔍 Processing file ${index + 1}:`, gcodeFile)

                // Ensure all required fields are present and valid
                const processedFile = {
                    gcode_filename: String(gcodeFile.gcode_filename || '').trim(),
                    required_runs: Number(gcodeFile.required_runs) || 1,
                    preferred_printer: String(gcodeFile.preferred_printer || 'any').trim(),
                    filament_type: String(gcodeFile.filament_type || '').trim()
                }

                console.log(`✅ Processed file ${index + 1}:`, processedFile)

                // Validate required fields
                if (!processedFile.gcode_filename) {
                    throw new Error(`File ${index + 1}: Missing filename`)
                }
                if (!processedFile.filament_type) {
                    throw new Error(`File ${index + 1}: Missing filament type`)
                }
                if (processedFile.required_runs <= 0) {
                    throw new Error(`File ${index + 1}: Invalid required runs`)
                }
                if (!['HS-Pro', 'HS3', 'any'].includes(processedFile.preferred_printer)) {
                    throw new Error(`File ${index + 1}: Invalid printer preference`)
                }

                return processedFile
            })

            console.log('🔧 Final batch data:', { jobId, gcodeFiles })

            // Single batch API call
            const result = await this.$store.dispatch('fleet/jobs/createJobGcodesBatch', {
                jobId: jobId,
                gcodeFiles: gcodeFiles
            })

            console.log('✅ Batch creation result:', result)

            // Handle results
            if (result.created_count > 0) {
                this.$toast.success(`✅ Successfully created ${result.created_count} GCode files`)
            }

            if (result.failed_count > 0) {
                this.$toast.error(`❌ Failed to create ${result.failed_count} GCode files`)
                result.errors.forEach(error => {
                    console.error('GCode creation error:', error)
                })
            }

        } catch (error) {
            console.error('❌ Batch GCode creation failed:', error)
            console.error('❌ Error response:', error.response?.data)
            this.$toast.error('Batch GCode creation failed: ' + (error.response?.data?.detail || error.message))
        } finally {
            await this.refreshJobsInBackground()
        }
    }

    async refreshJobsInBackground() {
        try {
            await this.refreshJobs()
            console.log('✅ Jobs list refreshed in background')
        } catch (error) {
            console.error('Background refresh failed:', error)
            this.$toast.error('Failed to refresh jobs list')
        }
    }


    onBrowseFileSelected(files: any[]) {
        if (files.length === 1) {
            // Single file - auto-fill the form
            const file = files[0]
            const parsed = this.parseGcodeFilename(file.filename)

            this.addGcodeDialog.form = {
                gcode_filename: file.filename,
                required_runs: parsed.required_runs,
                preferred_printer: parsed.preferred_printer,
                filament_type: parsed.filament_type,
            }

            this.$toast.success(`Selected file: ${file.filename}`)
        } else if (files.length > 1) {
            // Multiple files - add them to batch and close this dialog
            const processedFiles = files.map(file => {
                const parsed = this.parseGcodeFilename(file.filename)
                return {
                    gcode_filename: file.filename,
                    required_runs: parsed.required_runs,
                    preferred_printer: parsed.preferred_printer,
                    filament_type: parsed.filament_type,
                    originalFile: null
                }
            })

            // Add to the current job's batch gcodes (if create job dialog is open)
            if (this.createJobDialog.show) {
                processedFiles.forEach(newFile => {
                    const existingIndex = this.createJobDialog.batchGcodes.findIndex(
                        existing => existing.gcode_filename === newFile.gcode_filename
                    )

                    if (existingIndex >= 0) {
                        this.createJobDialog.batchGcodes.splice(existingIndex, 1, newFile)
                    } else {
                        this.createJobDialog.batchGcodes.push(newFile)
                    }
                })
            }

            this.$toast.success(`Added ${files.length} files to batch`)
            this.closeAddGcodeDialog()
        }
    }

    onBrowseFilesSelected(files: any[]) {
        // Process selected files for batch creation
        const processedFiles = files.map(file => {
            const parsed = this.parseGcodeFilename(file.filename)
            return {
                gcode_filename: file.filename,
                required_runs: parsed.required_runs,
                preferred_printer: parsed.preferred_printer,
                filament_type: parsed.filament_type,
                originalFile: null // Since these are existing files
            }
        })

        // Add to batch (or replace existing)
        this.createJobDialog.batchGcodes = [
            ...this.createJobDialog.batchGcodes,
            ...processedFiles
        ]

        this.$toast.success(`Added ${files.length} file(s) to job creation`)
    }

    onJobDetailsClose() {
        this.detailsDialog.show = false

        // Clear data immediately instead of using setTimeout
        this.detailsDialog.item = null
        this.jobGcodes = []
        this.allJobRuns = {}
        this.detailsDialog.loadingGcodes = false
        this.detailsDialog.loadingRuns = false
        this.runStatisticsCache = {} // Also clear the cache
    }

    async onJobDetailsRefresh() {
        if (!this.detailsDialog.item) return

        this.$toast.info('Refreshing job details...')
        await this.loadJobGcodesAndRuns(this.detailsDialog.item.id)
        this.$toast.success('Job details refreshed')
    }

    async onJobDetailsUpdateStatus(status: string) {
        if (!this.detailsDialog.item) return

        try {
            await this.updateJobStatus(this.detailsDialog.item, status)

            // Update the item in the details dialog to reflect the change immediately
            this.detailsDialog.item = {
                ...this.detailsDialog.item,
                status: status,
                updated_at: new Date().toISOString()
            }

            // Also refresh the job list to ensure consistency
            await this.refreshJobs()

        } catch (error) {
            console.error('Failed to update job status from details:', error)
            this.$toast.error('Failed to update job status')
        }
    }

    onJobDetailsEditJob(job: FleetJob) {
        this.editJob(job)
        this.detailsDialog.show = false // Close the details dialog
    }

    onJobDetailsAddGcode(job: FleetJob) {
        this.openAddGcodeDialog()
    }

    onJobDetailsEditGcode(gcode: FleetJobGcode) {
        this.editGcodeFile(gcode)
    }

    async onJobDetailsDeleteGcode(gcode: FleetJobGcode) {
        await this.deleteGcodeFile(gcode)
    }

    onJobDetailsViewGcodeRuns(gcode: FleetJobGcode) {
        this.viewGcodeRuns(gcode)
    }

    onJobDetailsToggle(visible: boolean) {
        if (!visible) {
            this.onJobDetailsClose()
        } else {
            this.detailsDialog.show = visible
        }
    }

    @Watch('allJobRuns', { deep: true })
    onAllJobRunsChanged() {
        // OPTIMIZATION: Debounce cache clearing to avoid excessive computation
        if (this.cacheCleanupTimeout) {
            clearTimeout(this.cacheCleanupTimeout)
        }
        this.cacheCleanupTimeout = setTimeout(() => {
            this.runStatisticsCache = {}
        }, 100)
    }

    beforeDestroy() {
        this.$root.$off('fullscreen-files-uploaded', this.handleFullscreenUpload)

        if (this.cacheCleanupTimeout) {
            clearTimeout(this.cacheCleanupTimeout)
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

.breathing-blue {
    background: linear-gradient(90deg, #1976d2 0%, #2196f3 25%, #64b5f6 50%, #2196f3 75%, #1976d2 100% );
    background-size: 200% 100%;
    animation: roll 2s linear infinite;
    position: relative;
    overflow: hidden;
}

@keyframes roll {
    0% {
        background-position: 200% 0;
    }

    100% {
        background-position: -200% 0;
    }
}

/* Progress bar styling */
.gcode-progress-bar {
    transition: all 0.3s ease;
}

.progress-segment {
    transition: width 0.3s ease;
}

.gcode-file-item {
    transition: box-shadow 0.2s ease;
}

    .gcode-file-item:hover {
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

/* Failure bar styling */
.failure-bar {
    transition: all 0.3s ease;
}

    .failure-bar:hover {
        transform: scale(1.05);
    }

/* Statistics text styling */
.gcode-progress-stats {
    font-family: 'Roboto Mono', monospace;
}

/* Legend styling */
.legend-item {
    display: flex;
    align-items: center;
}

.legend-color {
    width: 16px;
    height: 12px;
    border-radius: 2px;
    margin-right: 8px;
    display: inline-block;
}

/* GCode Upload Zone Styles */
.gcode-upload-zone {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    background-color: #fafafa;
    transition: all 0.3s ease;
}

/* Dark theme support */
.theme--dark .gcode-upload-zone {
    border-color: #424242;
    background-color: #303030;
}

.gcode-skeleton {
    opacity: 0.7;
    animation: pulse 1.5s ease-in-out infinite alternate;
}

@keyframes pulse {
    0% {
        opacity: 0.6;
    }

    100% {
        opacity: 1;
    }
}

/* Smooth transitions for data loading */
.gcode-file-item {
    transition: all 0.3s ease;
}

    .gcode-file-item.loading {
        opacity: 0.5;
        pointer-events: none;
    }

/* Loading overlay for progress sections */
.progress-loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    border-radius: inherit;
}

.theme--dark .progress-loading-overlay {
    background: rgba(0, 0, 0, 0.8);
}

/* Enhanced gcode file item with better loading states */
.gcode-file-item-container {
    position: relative;
    overflow: hidden;
}

/* Shimmer effect for loading */
.loading-shimmer {
    background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.2) 50%, rgba(255, 255, 255, 0) 100%);
    background-size: 200px 100%;
    animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
    0% {
        background-position: -200px 0;
    }

    100% {
        background-position: calc(200px + 100%) 0;
    }
}

.theme--dark .loading-shimmer {
    background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0) 100%);
}

/* Button loading states */
.v-btn.loading {
    pointer-events: none;
    opacity: 0.6;
}

/* Dialog loading overlay */
.dialog-loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.9);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 10;
}

.theme--dark .dialog-loading-overlay {
    background: rgba(33, 33, 33, 0.9);
}

.v-tabs {
    border-bottom: 1px solid #e0e0e0;
}

.v-tab {
    text-transform: none !important;
}

</style>
