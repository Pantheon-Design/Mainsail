<template>
    <div>
        <panel :title="$t('Files.GCodeFiles')" :icon="mdiFileDocumentMultipleOutline" card-class="gcode-files-panel">
            <v-card-text>
                <v-row>
                    <v-col class="col-12 d-flex align-center">
                        <v-text-field
                            v-model="fleetSearch"
                            :append-icon="mdiMagnify"
                            label="Search Fleet Files"
                            single-line
                            outlined
                            clearable
                            hide-details
                            dense
                            style="max-width: 300px"></v-text-field>
                        <v-spacer></v-spacer>
                        <input
                            ref="fleetFileUpload"
                            type="file"
                            accept=".gcode,.g,.gc"
                            style="display: none"
                            multiple
                            @change="uploadFleetFile" />
                        <v-btn
                            title="Upload to Fleet Storage"
                            class="primary--text px-2 minwidth-0 ml-3"
                            @click="$refs.fleetFileUpload.click()">
                            <v-icon>{{ mdiCloudUploadOutline }}</v-icon>
                        </v-btn>
                        <v-btn
                            title="Create New Folder"
                            class="px-2 minwidth-0 ml-3"
                            @click="fleetMkdirDialog.show = true">
                            <v-icon>{{ mdiFolderPlus }}</v-icon>
                        </v-btn>
                        <v-btn
                            title="Refresh"
                            class="px-2 minwidth-0 ml-3"
                            @click="loadFleetFiles">
                            <v-icon>{{ mdiRefresh }}</v-icon>
                        </v-btn>
                    </v-col>
                </v-row>
            </v-card-text>
            <!-- Path navigation + Disk Usage -->
            <v-card-text class="py-1 d-flex align-center">
                <div>
                    <b class="mr-1">Path:</b>
                    <a class="text-decoration-none" @click="navigateToFleetPath('')">/home/hs3/Fleetdaemon/gcodes</a>
                    <template v-for="(segment, i) in fleetPathSegments">
                        <span :key="'sep-' + i"> / </span>
                        <a :key="'seg-' + i" class="text-decoration-none" @click="navigateToFleetPath(fleetPathUpTo(i))">{{ segment }}</a>
                    </template>
                </div>
                <v-spacer />
                <v-tooltip v-if="fleetDiskUsage" top>
                    <template #activator="{ on, attrs }">
                        <span v-bind="attrs" v-on="on" class="text-no-wrap">
                            <v-icon small class="mr-1">{{ mdiHarddisk }}</v-icon>
                            <b>Free:</b> {{ formatFilesize(fleetDiskUsage.free) }}
                        </span>
                    </template>
                    <span>
                        Used: {{ formatFilesize(fleetDiskUsage.used) }}<br />
                        Free: {{ formatFilesize(fleetDiskUsage.free) }}<br />
                        Total: {{ formatFilesize(fleetDiskUsage.total) }}
                    </span>
                </v-tooltip>
            </v-card-text>
            <v-divider></v-divider>
            <!-- Fleet Files Table -->
            <v-card-text v-if="fleetFilesLoading" class="text-center py-6">
                <v-progress-circular indeterminate color="primary" />
                <div class="mt-2">Loading fleet files...</div>
            </v-card-text>
            <v-data-table
                v-else
                :items="fleetFilesFiltered"
                :headers="fleetHeaders"
                class="files-table"
                :items-per-page="25"
                :footer-props="{
                    itemsPerPageOptions: [10, 25, 50, 100, -1],
                }"
                item-key="filename"
                :sort-desc="true"
                mobile-breakpoint="0"
                :custom-sort="fleetSortItems">
                <template #no-data>
                    <div class="text-center">No fleet files found</div>
                </template>
                <template v-if="fleetCurrentPath !== ''" #body.prepend>
                    <tr class="file-list-cursor" @click="navigateFleetUp">
                        <td class="px-0 text-center" style="width: 32px">
                            <v-icon>{{ mdiFolderUpload }}</v-icon>
                        </td>
                        <td colspan="5">..</td>
                    </tr>
                </template>
                <template #item="{ item }">
                    <tr :class="{ 'file-list-cursor': item.is_directory }" @click="onFleetRowClick(item)">
                        <td class="px-0 text-center" style="width: 32px">
                            <v-icon v-if="item.is_directory">{{ mdiFolder }}</v-icon>
                            <v-icon v-else>{{ mdiFile }}</v-icon>
                        </td>
                        <td>{{ fleetDisplayName(item.filename) }}</td>
                        <td class="text-no-wrap">{{ item.is_directory ? '--' : formatFilesize(item.size) }}</td>
                        <td class="text-no-wrap">{{ item.modified ? new Date(item.modified).toLocaleDateString() : '--' }}</td>
                        <td class="text-center">
                            <template v-if="!item.is_directory">
                                <v-tooltip top>
                                    <template #activator="{ on, attrs }">
                                        <v-chip x-small v-bind="attrs" v-on="on">
                                            {{ (item.cached_on || []).length }} printers
                                        </v-chip>
                                    </template>
                                    <span v-if="(item.cached_on || []).length">{{ item.cached_on.join(', ') }}</span>
                                    <span v-else>Not cached on any printer</span>
                                </v-tooltip>
                            </template>
                        </td>
                        <td class="text-no-wrap">
                            <template v-if="!item.is_directory">
                                <v-btn
                                    x-small
                                    color="primary"
                                    class="mr-1"
                                    title="Send to all printers"
                                    @click.stop="pushFleetFileToAll(item.filename)">
                                    <v-icon x-small class="mr-1">{{ mdiCloudUploadOutline }}</v-icon>
                                    Push
                                </v-btn>
                            </template>
                            <v-btn
                                x-small
                                class="mr-1"
                                title="Move / Rename"
                                @click.stop="openFleetMoveDialog(item)">
                                <v-icon x-small>{{ mdiRenameBox }}</v-icon>
                            </v-btn>
                            <v-btn
                                x-small
                                color="error"
                                title="Delete"
                                @click.stop="fleetDeleteDialog = { show: true, filename: item.filename }">
                                <v-icon x-small>{{ mdiDelete }}</v-icon>
                            </v-btn>
                        </td>
                    </tr>
                </template>
            </v-data-table>
            <!-- Fleet delete confirmation dialog -->
            <v-dialog v-model="fleetDeleteDialog.show" max-width="400">
                <v-card>
                    <v-card-title>Delete Fleet File</v-card-title>
                    <v-card-text>
                        Delete <b>{{ fleetDeleteDialog.filename }}</b> from central storage and all printers?
                    </v-card-text>
                    <v-card-actions>
                        <v-spacer></v-spacer>
                        <v-btn text @click="fleetDeleteDialog.show = false">Cancel</v-btn>
                        <v-btn color="error" text @click="deleteFleetFile">Delete</v-btn>
                    </v-card-actions>
                </v-card>
            </v-dialog>
            <!-- Fleet create directory dialog -->
            <v-dialog v-model="fleetMkdirDialog.show" max-width="400">
                <v-card>
                    <v-card-title>Create Folder</v-card-title>
                    <v-card-text>
                        <v-text-field
                            v-model="fleetMkdirDialog.name"
                            label="Folder name"
                            autofocus
                            @keypress.enter="createFleetDirectory"></v-text-field>
                    </v-card-text>
                    <v-card-actions>
                        <v-spacer></v-spacer>
                        <v-btn text @click="fleetMkdirDialog.show = false">Cancel</v-btn>
                        <v-btn color="primary" text :disabled="!fleetMkdirDialog.name" @click="createFleetDirectory">Create</v-btn>
                    </v-card-actions>
                </v-card>
            </v-dialog>
            <!-- Fleet move/rename dialog -->
            <v-dialog v-model="fleetMoveDialog.show" max-width="500">
                <v-card>
                    <v-card-title>Move / Rename</v-card-title>
                    <v-card-text>
                        <div class="mb-2"><b>From:</b> {{ fleetMoveDialog.source }}</div>
                        <v-text-field
                            v-model="fleetMoveDialog.destination"
                            label="New path"
                            autofocus
                            @keypress.enter="executeFleetMove"></v-text-field>
                    </v-card-text>
                    <v-card-actions>
                        <v-spacer></v-spacer>
                        <v-btn text @click="fleetMoveDialog.show = false">Cancel</v-btn>
                        <v-btn color="primary" text :disabled="!fleetMoveDialog.destination || fleetMoveDialog.destination === fleetMoveDialog.source" @click="executeFleetMove">Move</v-btn>
                    </v-card-actions>
                </v-card>
            </v-dialog>
        </panel>

        <!-- Download Queue Panel -->
        <panel
            :icon="mdiCloudDownloadOutline"
            card-class="download-queue-panel mt-4">
            <template #title>
                Download Queue
                <v-chip x-small class="ml-2" color="primary" v-if="activeDownloadCount > 0">
                    {{ activeDownloadCount }} active
                </v-chip>
            </template>
            <v-card-text class="pa-0">
                <v-data-table
                    :headers="downloadQueueHeaders"
                    :items="downloadQueue"
                    :items-per-page="10"
                    dense
                    hide-default-footer
                    :no-data-text="'No downloads in queue'">
                    <template #[`item.filename`]="{ item }">
                        <span class="text-truncate" style="max-width: 250px; display: inline-block">
                            {{ item.filename.split('/').pop() }}
                        </span>
                    </template>
                    <template #[`item.printer_hostname`]="{ item }">
                        <span class="text-truncate">{{ item.printer_hostname }}</span>
                    </template>
                    <template #[`item.status`]="{ item }">
                        <v-chip x-small :color="downloadStatusColor(item.status)">
                            {{ item.status }}
                        </v-chip>
                    </template>
                    <template #[`item.progress_pct`]="{ item }">
                        <v-progress-linear
                            v-if="item.status === 'downloading'"
                            :value="item.progress_pct"
                            height="16"
                            rounded
                            color="primary">
                            <template #default>
                                <small>{{ Math.round(item.progress_pct) }}%</small>
                            </template>
                        </v-progress-linear>
                        <span v-else-if="item.status === 'completed'">100%</span>
                        <span v-else>--</span>
                    </template>
                    <template #[`item.source`]="{ item }">
                        <v-chip x-small outlined>{{ item.source === 'user' ? 'User' : 'Auto' }}</v-chip>
                    </template>
                    <template #[`item.actions`]="{ item }">
                        <v-btn
                            v-if="item.status === 'pending' || item.status === 'downloading'"
                            x-small
                            color="error"
                            title="Cancel download"
                            @click.stop="cancelQueueDownload(item.id)">
                            <v-icon x-small>{{ mdiClose }}</v-icon>
                        </v-btn>
                        <v-tooltip v-else-if="item.status === 'failed' && item.error_message" top>
                            <template #activator="{ on, attrs }">
                                <v-icon x-small color="error" v-bind="attrs" v-on="on">{{ mdiAlertCircleOutline }}</v-icon>
                            </template>
                            <span>{{ item.error_message }}</span>
                        </v-tooltip>
                    </template>
                </v-data-table>
            </v-card-text>
        </panel>
        <start-print-dialog
            :bool="dialogPrintFile.show"
            :file="dialogPrintFile.item"
            :current-path="currentPath"
            @closeDialog="closeStartPrint" />
        <v-menu v-model="contextMenu.shown" :position-x="contextMenu.x" :position-y="contextMenu.y" absolute offset-y>
            <v-list>
                <v-list-item
                    v-if="!contextMenu.item.isDirectory"
                    :disabled="printerIsPrinting || !klipperReadyForGui || !isGcodeFile(contextMenu.item)"
                    @click="clickRow(contextMenu.item, true)">
                    <v-icon class="mr-1">{{ mdiPlay }}</v-icon>
                    {{ $t('Files.PrintStart') }}
                </v-list-item>
                <v-list-item
                    v-if="!contextMenu.item.isDirectory && moonrakerComponents.includes('job_queue')"
                    :disabled="!isGcodeFile(contextMenu.item)"
                    @click="addToQueue(contextMenu.item)">
                    <v-icon class="mr-1">{{ mdiPlaylistPlus }}</v-icon>
                    {{ $t('Files.AddToQueue') }}
                </v-list-item>
                <v-list-item
                    v-if="!contextMenu.item.isDirectory && moonrakerComponents.includes('job_queue')"
                    :disabled="!isGcodeFile(contextMenu.item)"
                    @click="openAddBatchToQueueDialog(contextMenu.item)">
                    <v-icon class="mr-1">{{ mdiPlaylistPlus }}</v-icon>
                    {{ $t('Files.AddBatchToQueue') }}
                </v-list-item>
                <v-list-item
                    v-if="contextMenu.item.preheat_gcode !== null"
                    :disabled="['error', 'printing', 'paused'].includes(printer_state)"
                    @click="doSend(contextMenu.item.preheat_gcode)">
                    <v-icon class="mr-1">{{ mdiFire }}</v-icon>
                    {{ $t('Files.Preheat') }}
                </v-list-item>
                <v-list-item
                    v-if="!contextMenu.item.isDirectory"
                    :disabled="!isGcodeFile(contextMenu.item)"
                    @click="view3D(contextMenu.item)">
                    <v-icon class="mr-1">{{ mdiVideo3d }}</v-icon>
                    {{ $t('Files.View3D') }}
                </v-list-item>
                <v-list-item
                    v-if="!contextMenu.item.isDirectory"
                    :disabled="!isGcodeFile(contextMenu.item)"
                    @click="scanMeta(contextMenu.item)">
                    <v-icon class="mr-1">{{ mdiMagnify }}</v-icon>
                    {{ $t('Files.ScanMeta') }}
                </v-list-item>
                <v-list-item v-if="!contextMenu.item.isDirectory" @click="downloadFile">
                    <v-icon class="mr-1">{{ mdiCloudDownload }}</v-icon>
                    {{ $t('Files.Download') }}
                </v-list-item>
                <v-list-item v-if="contextMenu.item.isDirectory" @click="renameDirectory(contextMenu.item)">
                    <v-icon class="mr-1">{{ mdiRenameBox }}</v-icon>
                    {{ $t('Files.Rename') }}
                </v-list-item>
                <v-list-item v-if="!contextMenu.item.isDirectory" @click="editFile(contextMenu.item)">
                    <v-icon class="mr-1">{{ mdiFileDocumentEditOutline }}</v-icon>
                    {{ $t('Files.EditFile') }}
                </v-list-item>
                <v-list-item v-if="!contextMenu.item.isDirectory" @click="renameFile(contextMenu.item)">
                    <v-icon class="mr-1">{{ mdiRenameBox }}</v-icon>
                    {{ $t('Files.Rename') }}
                </v-list-item>
                <v-list-item v-if="!contextMenu.item.isDirectory" @click="duplicateFile(contextMenu.item)">
                    <v-icon class="mr-1">{{ mdiContentCopy }}</v-icon>
                    {{ $t('Files.Duplicate') }}
                </v-list-item>
                <v-list-item v-if="!contextMenu.item.isDirectory" class="red--text" @click="deleteDialog = true">
                    <v-icon class="mr-1" color="error">{{ mdiDelete }}</v-icon>
                    {{ $t('Files.Delete') }}
                </v-list-item>
                <v-list-item
                    v-if="contextMenu.item.isDirectory"
                    class="red--text"
                    @click="deleteDirectory(contextMenu.item)">
                    <v-icon class="mr-1" color="error">{{ mdiDelete }}</v-icon>
                    {{ $t('Files.Delete') }}
                </v-list-item>
            </v-list>
        </v-menu>
        <v-dialog v-model="dialogCreateDirectory.show" :max-width="400">
            <panel
                :title="$t('Files.NewDirectory')"
                card-class="gcode-files-new-directory-dialog"
                :margin-bottom="false">
                <template #buttons>
                    <v-btn icon tile @click="dialogCreateDirectory.show = false">
                        <v-icon>{{ mdiCloseThick }}</v-icon>
                    </v-btn>
                </template>
                <v-card-text>
                    <v-text-field
                        ref="inputFieldCreateDirectory"
                        v-model="dialogCreateDirectory.name"
                        :label="$t('Files.Name')"
                        required
                        :rules="nameInputRules"
                        @update:error="(bool) => (isInvalidName = bool)"
                        @keypress.enter="createDirectoryAction"></v-text-field>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="" text @click="dialogCreateDirectory.show = false">{{ $t('Files.Cancel') }}</v-btn>
                    <v-btn :disabled="isInvalidName" color="primary" text @click="createDirectoryAction">
                        {{ $t('Files.Create') }}
                    </v-btn>
                </v-card-actions>
            </panel>
        </v-dialog>
        <v-dialog v-model="dialogRenameFile.show" :max-width="400">
            <panel :title="$t('Files.RenameFile')" card-class="gcode-files-rename-file-dialog" :margin-bottom="false">
                <template #buttons>
                    <v-btn icon tile @click="dialogRenameFile.show = false">
                        <v-icon>{{ mdiCloseThick }}</v-icon>
                    </v-btn>
                </template>
                <v-card-text>
                    <v-text-field
                        ref="inputFieldRenameFile"
                        v-model="dialogRenameFile.newName"
                        :label="$t('Files.Name')"
                        required
                        :rules="nameInputRules"
                        @update:error="(bool) => (isInvalidName = bool)"
                        @keyup.enter="renameFileAction"></v-text-field>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="" text @click="dialogRenameFile.show = false">{{ $t('Files.Cancel') }}</v-btn>
                    <v-btn :disabled="isInvalidName" color="primary" text @click="renameFileAction">
                        {{ $t('Files.Rename') }}
                    </v-btn>
                </v-card-actions>
            </panel>
        </v-dialog>
        <v-dialog v-model="dialogDuplicateFile.show" :max-width="400">
            <panel
                :title="$t('Files.DuplicateFile')"
                card-class="gcode-files-duplicate-file-dialog"
                :margin-bottom="false">
                <template #buttons>
                    <v-btn icon tile @click="dialogDuplicateFile.show = false">
                        <v-icon>{{ mdiCloseThick }}</v-icon>
                    </v-btn>
                </template>
                <v-card-text>
                    <v-text-field
                        ref="inputFieldDuplicateFile"
                        v-model="dialogDuplicateFile.newName"
                        :label="$t('Files.Name')"
                        required
                        :rules="nameInputRules"
                        @update:error="(bool) => (isInvalidName = bool)"
                        @keyup.enter="duplicateFileAction"></v-text-field>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="" text @click="dialogDuplicateFile.show = false">{{ $t('Files.Cancel') }}</v-btn>
                    <v-btn :disabled="isInvalidName" color="primary" text @click="duplicateFileAction">
                        {{ $t('Files.Duplicate') }}
                    </v-btn>
                </v-card-actions>
            </panel>
        </v-dialog>
        <v-dialog v-model="dialogRenameDirectory.show" max-width="400">
            <panel
                :title="$t('Files.RenameDirectory')"
                card-class="gcode-files-rename-directory-dialog"
                :margin-bottom="false">
                <template #buttons>
                    <v-btn icon tile @click="dialogRenameDirectory.show = false">
                        <v-icon>{{ mdiCloseThick }}</v-icon>
                    </v-btn>
                </template>
                <v-card-text>
                    <v-text-field
                        ref="inputFieldRenameDirectory"
                        v-model="dialogRenameDirectory.newName"
                        :label="$t('Files.Name')"
                        required
                        :rules="nameInputRules"
                        @update:error="(bool) => (isInvalidName = bool)"
                        @keyup.enter="renameDirectoryAction"></v-text-field>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="" text @click="dialogRenameDirectory.show = false">{{ $t('Files.Cancel') }}</v-btn>
                    <v-btn :disabled="isInvalidName" color="primary" text @click="renameDirectoryAction">
                        {{ $t('Files.Rename') }}
                    </v-btn>
                </v-card-actions>
            </panel>
        </v-dialog>
        <v-dialog v-model="dialogDeleteDirectory.show" max-width="400">
            <panel
                :title="$t('Files.DeleteDirectory')"
                card-class="gcode-files-delete-directory-dialog"
                :margin-bottom="false">
                <template #buttons>
                    <v-btn icon tile @click="dialogDeleteDirectory.show = false">
                        <v-icon>{{ mdiCloseThick }}</v-icon>
                    </v-btn>
                </template>
                <v-card-text>
                    <p class="mb-0">
                        {{ $t('Files.DeleteDirectoryQuestion', { name: dialogDeleteDirectory.item.filename }) }}
                    </p>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="" text @click="dialogDeleteDirectory.show = false">{{ $t('Files.Cancel') }}</v-btn>
                    <v-btn color="error" text @click="deleteDirectoryAction">{{ $t('Files.Delete') }}</v-btn>
                </v-card-actions>
            </panel>
        </v-dialog>

        <!-- CONFIRM DELETE SINGLE FILE DIALOG -->
        <v-dialog v-model="deleteDialog" max-width="400">
            <panel :title="$t('Files.Delete')" card-class="gcode-files-delete-dialog" :margin-bottom="false">
                <template #buttons>
                    <v-btn icon tile @click="deleteDialog = false">
                        <v-icon>{{ mdiCloseThick }}</v-icon>
                    </v-btn>
                </template>
                <v-card-text>
                    <p class="mb-0">
                        {{ $t('Files.DeleteSingleFileQuestion', { name: contextMenu.item.filename }) }}
                    </p>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="" text @click="deleteDialog = false">
                        {{ $t('Files.Cancel') }}
                    </v-btn>
                    <v-btn color="error" text @click="removeFile">
                        {{ $t('Files.Delete') }}
                    </v-btn>
                </v-card-actions>
            </panel>
        </v-dialog>

        <!-- CONFIRM DELETE MULTIPLE FILES DIALOG -->
        <v-dialog v-model="deleteSelectedDialog" max-width="400">
            <panel :title="$t('Files.Delete')" card-class="gcode-files-delete-selected-dialog" :margin-bottom="false">
                <template #buttons>
                    <v-btn icon tile @click="deleteSelectedDialog = false">
                        <v-icon>{{ mdiCloseThick }}</v-icon>
                    </v-btn>
                </template>
                <v-card-text>
                    <p v-if="selectedFiles.length === 1" class="mb-0">
                        {{ $t('Files.DeleteSingleFileQuestion', { name: selectedFiles[0].filename }) }}
                    </p>
                    <p v-else class="mb-0">{{ $t('Files.DeleteSelectedQuestion', { count: selectedFiles.length }) }}</p>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="" text @click="deleteSelectedDialog = false">{{ $t('Files.Cancel') }}</v-btn>
                    <v-btn color="error" text @click="deleteSelectedFiles">{{ $t('Files.Delete') }}</v-btn>
                </v-card-actions>
            </panel>
        </v-dialog>
        <add-batch-to-queue-dialog
            :is-visible="dialogAddBatchToQueue.isVisible"
            :filename="dialogAddBatchToQueue.filename"
            @close="closeAddBatchToQueueDialog" />
    </div>
</template>

<script lang="ts">
import { Component, Mixins, Watch } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import { defaultBigThumbnailBackground, validGcodeExtensions } from '@/store/variables'
import { formatFilesize, formatPrintTime, sortFiles } from '@/plugins/helpers'
import { FileStateFile, FileStateGcodefile } from '@/store/files/types'
import Panel from '@/components/ui/Panel.vue'
import SettingsRow from '@/components/settings/SettingsRow.vue'
import draggable from 'vuedraggable'
import {
    mdiDragVertical,
    mdiCheckboxBlankOutline,
    mdiCheckboxMarked,
    mdiCloseThick,
    mdiCloudDownload,
    mdiCog,
    mdiDelete,
    mdiFile,
    mdiFileDocumentMultipleOutline,
    mdiFire,
    mdiFolder,
    mdiFolderPlus,
    mdiFolderUpload,
    mdiMagnify,
    mdiPlay,
    mdiPlaylistPlus,
    mdiRefresh,
    mdiRenameBox,
    mdiUpload,
    mdiVideo3d,
    mdiFileDocumentEditOutline,
    mdiContentCopy,
    mdiCloud,
    mdiCloudCheckOutline,
    mdiCloudUploadOutline,
    mdiSync,
    mdiSendOutline,
    mdiHarddisk,
    mdiCloudDownloadOutline,
    mdiClose,
    mdiAlertCircleOutline,
} from '@mdi/js'
import StartPrintDialog from '@/components/dialogs/StartPrintDialog.vue'
import AddBatchToQueueDialog from '@/components/dialogs/AddBatchToQueueDialog.vue'
import ControlMixin from '@/components/mixins/control'
import PathNavigation from '@/components/ui/PathNavigation.vue'
import { fleetDaemonEvents } from '@/plugins/fleetDaemonClient'
import { FleetGcodeFile } from '@/store/fleet/gcodes/types'

interface contextMenu {
    shown: boolean
    isDirectory: boolean
    touchTimer?: number | null
    x: number
    y: number
    item: FileStateGcodefile
}

interface draggingFile {
    item: FileStateGcodefile
}

interface dialogPrintFile {
    show: boolean
    item: FileStateGcodefile
}

interface dialogRenameObject {
    show: boolean
    newName: string
    item: FileStateGcodefile
}

interface tableColumnSetting {
    text: string
    value: string
    visible: boolean
    sortable?: boolean
    class?: string
    pos?: number
    outputType?: 'string' | 'date' | 'length' | 'weight' | 'filesize' | 'temp' | 'time'
}

@Component({
    components: { StartPrintDialog, AddBatchToQueueDialog, Panel, SettingsRow, PathNavigation, draggable },
})
export default class GcodefilesPanel extends Mixins(BaseMixin, ControlMixin) {
    mdiContentCopy = mdiContentCopy
    mdiFile = mdiFile
    mdiFileDocumentMultipleOutline = mdiFileDocumentMultipleOutline
    mdiMagnify = mdiMagnify
    mdiUpload = mdiUpload
    mdiFolderPlus = mdiFolderPlus
    mdiRefresh = mdiRefresh
    mdiCog = mdiCog
    mdiFolderUpload = mdiFolderUpload
    mdiFolder = mdiFolder
    mdiPlay = mdiPlay
    mdiPlaylistPlus = mdiPlaylistPlus
    mdiFire = mdiFire
    mdiVideo3d = mdiVideo3d
    mdiCloudDownload = mdiCloudDownload
    mdiRenameBox = mdiRenameBox
    mdiFileDocumentEditOutline = mdiFileDocumentEditOutline
    mdiDelete = mdiDelete
    mdiCloseThick = mdiCloseThick
    mdiCheckboxBlankOutline = mdiCheckboxBlankOutline
    mdiCheckboxMarked = mdiCheckboxMarked
    mdiDragVertical = mdiDragVertical
    mdiCloud = mdiCloud
    mdiCloudCheckOutline = mdiCloudCheckOutline
    mdiCloudUploadOutline = mdiCloudUploadOutline
    mdiSync = mdiSync
    mdiSendOutline = mdiSendOutline
    mdiHarddisk = mdiHarddisk
    mdiCloudDownloadOutline = mdiCloudDownloadOutline
    mdiClose = mdiClose
    mdiAlertCircleOutline = mdiAlertCircleOutline

    formatFilesize = formatFilesize
    formatPrintTime = formatPrintTime
    sortFiles = sortFiles

    declare $refs: {
        fileUpload: HTMLInputElement
        fleetFileUpload: HTMLInputElement
        inputFieldRenameFile: HTMLInputElement
        inputFieldDuplicateFile: HTMLInputElement
        inputFieldCreateDirectory: HTMLInputElement
        inputFieldRenameDirectory: HTMLInputElement
    }

    private search = ''

    private dialogCreateDirectory = {
        show: false,
        name: '',
    }

    private contextMenu: contextMenu = {
        shown: false,
        isDirectory: false,
        touchTimer: undefined,
        x: 0,
        y: 0,
        item: {
            isDirectory: false,
            filename: '',
            permissions: '',
            modified: new Date(),
            preheat_gcode: null,
            small_thumbnail: null,
            big_thumbnail: null,
            big_thumbnail_width: null,
            count_printed: 0,
            last_filament_used: null,
            last_start_time: null,
            last_end_time: null,
            last_print_duration: null,
            last_status: null,
            last_total_duration: null,
        },
    }

    private draggingFile: draggingFile = {
        item: { ...this.contextMenu.item },
    }

    private dialogPrintFile: dialogPrintFile = {
        show: false,
        item: { ...this.contextMenu.item },
    }

    dialogAddBatchToQueue: { isVisible: boolean; filename: string } = {
        isVisible: false,
        filename: '',
    }

    private dialogRenameFile: dialogRenameObject = {
        show: false,
        newName: '',
        item: { ...this.contextMenu.item },
    }

    private dialogDuplicateFile: dialogRenameObject = {
        show: false,
        newName: '',
        item: { ...this.contextMenu.item },
    }

    private dialogRenameDirectory: dialogRenameObject = {
        show: false,
        newName: '',
        item: { ...this.contextMenu.item },
    }

    private dialogDeleteDirectory: dialogRenameObject = {
        show: false,
        newName: '',
        item: { ...this.contextMenu.item },
    }

    private deleteDialog = false
    private deleteSelectedDialog = false

    // Fleet file mode (always on in Fleet_Mainsail)
    private fleetMode = true
    private fleetSearch = ''
    private fleetCurrentPath = ''
    private fleetDeleteDialog = { show: false, filename: '' }
    private fleetMkdirDialog = { show: false, name: '' }
    private fleetMoveDialog = { show: false, source: '', destination: '' }

    private isInvalidName = true
    private nameInputRules = [
        (value: string) => !!value || this.$t('Files.InvalidNameEmpty'),
        (value: string) => !this.existsFilename(value) || this.$t('Files.InvalidNameAlreadyExists'),
    ]
    private countInputRules = [
        (value: string) => !!value || this.$t('JobQueue.InvalidCountEmpty'),
        (value: string) => parseInt(value) > 0 || this.$t('JobQueue.InvalidCountGreaterZero'),
    ]

    existsFilename(name: string) {
        return this.files.findIndex((file: FileStateFile) => file.filename === name) >= 0
    }

    get gcodeInputFileAccept() {
        if (this.isIOS) return []

        return validGcodeExtensions
    }

    get currentPath() {
        const path = this.$store.state.gui.view.gcodefiles.currentPath
        if (path === 'gcodes') return ''

        return path
    }

    set currentPath(newVal) {
        this.$store.dispatch('gui/saveSettingWithoutUpload', { name: 'view.gcodefiles.currentPath', value: newVal })
    }

    get selectedFiles() {
        return this.$store.state.gui.view.gcodefiles.selectedFiles ?? []
    }

    set selectedFiles(newVal) {
        this.$store.dispatch('gui/saveSettingWithoutUpload', { name: 'view.gcodefiles.selectedFiles', value: newVal })
    }

    get fixedHeaders(): tableColumnSetting[] {
        return [
            { text: '', value: '', visible: true, sortable: false },
            {
                text: this.$t('Files.Name').toString(),
                value: 'filename',
                visible: true,
                class: 'text-no-wrap',
            },
            { text: '', value: 'status', visible: true, class: 'text-no-wrap', sortable: false },
        ]
    }

    get configurableHeaders() {
        const headers: tableColumnSetting[] = [
            {
                text: this.$t('Files.Filesize').toString(),
                value: 'size',
                visible: true,
                class: 'text-no-wrap',
                outputType: 'filesize',
            },
            {
                text: this.$t('Files.LastModified').toString(),
                value: 'modified',
                visible: true,
                class: 'text-no-wrap',
                outputType: 'date',
            },
            {
                text: this.$t('Files.ObjectHeight').toString(),
                value: 'object_height',
                visible: true,
                class: 'text-no-wrap',
                outputType: 'length',
            },
            {
                text: this.$t('Files.LayerHeight').toString(),
                value: 'layer_height',
                visible: true,
                class: 'text-no-wrap',
                outputType: 'length',
            },
            {
                text: this.$t('Files.NozzleDiameter').toString(),
                value: 'nozzle_diameter',
                visible: true,
                class: 'text-no-wrap',
                outputType: 'length',
            },
            {
                text: this.$t('Files.ExtruderTemp').toString(),
                value: 'first_layer_extr_temp',
                visible: true,
                class: 'text-no-wrap',
                outputType: 'temp',
            },
            {
                text: this.$t('Files.BedTemp').toString(),
                value: 'first_layer_bed_temp',
                visible: true,
                class: 'text-no-wrap',
                outputType: 'temp',
            },
            {
                text: this.$t('Files.ChamberTemp').toString(),
                value: 'chamber_temp',
                visible: true,
                class: 'text-no-wrap',
                outputType: 'temp',
            },
            {
                text: this.$t('Files.FilamentName').toString(),
                value: 'filament_name',
                visible: true,
                class: 'text-no-wrap',
            },
            {
                text: this.$t('Files.FilamentType').toString(),
                value: 'filament_type',
                visible: true,
                class: 'text-no-wrap',
                outputType: 'string',
            },
            {
                text: this.$t('Files.FilamentUsage').toString(),
                value: 'filament_total',
                visible: true,
                class: 'text-no-wrap',
                outputType: 'length',
            },
            {
                text: this.$t('Files.FilamentWeight').toString(),
                value: 'filament_weight_total',
                visible: true,
                class: 'text-no-wrap',
                outputType: 'weight',
            },
            {
                text: this.$t('Files.PrintTime').toString(),
                value: 'estimated_time',
                visible: true,
                class: 'text-no-wrap',
                outputType: 'time',
            },
            {
                text: this.$t('Files.LastStartTime').toString(),
                value: 'last_start_time',
                visible: true,
                class: 'text-no-wrap',
                outputType: 'date',
            },
            {
                text: this.$t('Files.LastEndTime').toString(),
                value: 'last_end_time',
                visible: true,
                class: 'text-no-wrap',
                outputType: 'date',
            },
            {
                text: this.$t('Files.LastPrintDuration').toString(),
                value: 'last_print_duration',
                visible: true,
                class: 'text-no-wrap',
                outputType: 'time',
            },
            {
                text: this.$t('Files.LastTotalDuration').toString(),
                value: 'last_total_duration',
                visible: true,
                class: 'text-no-wrap',
                outputType: 'time',
            },
            {
                text: this.$t('Files.LastFilamentUsed').toString(),
                value: 'last_filament_used',
                visible: true,
                class: 'text-no-wrap',
                outputType: 'length',
            },
            {
                text: this.$t('Files.Slicer').toString(),
                value: 'slicer',
                visible: true,
                class: 'text-no-wrap',
                outputType: 'string',
            },
        ]

        let unknownPos = 0
        headers.forEach((header) => {
            header.visible = !this.hideMetadataColumns.includes(header.value)

            let pos = this.orderMetadataColumns?.findIndex((value: string) => value === header.value)
            if (pos === -1) {
                unknownPos++
                pos = this.orderMetadataColumns.length + unknownPos
            }
            header.pos = pos
        })

        return headers.sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0))
    }

    set configurableHeaders(newVal) {
        const orderArray: string[] = []
        newVal.forEach((row: tableColumnSetting) => orderArray.push(row.value))

        this.orderMetadataColumns = orderArray
    }

    get headers() {
        return [...this.fixedHeaders, ...this.configurableHeaders]
    }

    get tableColumns() {
        return this.configurableHeaders.filter((column) => column.visible)
    }

    get directory() {
        return this.$store.getters['files/getDirectory']('gcodes' + this.currentPath)
    }

    get disk_usage() {
        return this.directory?.disk_usage ?? { used: 0, free: 0, total: 0 }
    }

    get files() {
        return this.$store.getters['files/getGcodeFiles'](this.currentPath, this.showHiddenFiles, this.showPrintedFiles)
    }

    get filteredHeaders() {
        return this.headers.filter((header) => header.visible)
    }

    get orderMetadataColumns() {
        return this.$store.state.gui.view.gcodefiles.orderMetadataColumns ?? []
    }

    set orderMetadataColumns(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'view.gcodefiles.orderMetadataColumns', value: newVal })
    }

    get hideMetadataColumns() {
        return this.$store.state.gui.view.gcodefiles.hideMetadataColumns ?? []
    }

    set hideMetadataColumns(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'view.gcodefiles.hideMetadataColumns', value: newVal })
    }

    get showHiddenFiles() {
        return this.$store.state.gui.view.gcodefiles.showHiddenFiles
    }

    set showHiddenFiles(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'view.gcodefiles.showHiddenFiles', value: newVal })
    }

    get showPrintedFiles() {
        return this.$store.state.gui.view.gcodefiles.showPrintedFiles
    }

    set showPrintedFiles(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'view.gcodefiles.showPrintedFiles', value: newVal })
    }

    get sortBy() {
        return this.$store.state.gui.view.gcodefiles.sortBy
    }

    set sortBy(newVal) {
        if (newVal === undefined) newVal = 'modified'

        this.$store.dispatch('gui/saveSetting', { name: 'view.gcodefiles.sortBy', value: newVal })
    }

    get sortDesc() {
        return this.$store.state.gui.view.gcodefiles.sortDesc
    }

    set sortDesc(newVal) {
        if (newVal === undefined) newVal = false

        this.$store.dispatch('gui/saveSetting', { name: 'view.gcodefiles.sortDesc', value: newVal })
    }

    get countPerPage() {
        return this.$store.state.gui.view.gcodefiles.countPerPage
    }

    set countPerPage(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'view.gcodefiles.countPerPage', value: newVal })
    }

    get bigThumbnailBackground() {
        return this.$store.state.gui.uiSettings.bigThumbnailBackground ?? defaultBigThumbnailBackground
    }

    get bigThumbnailTooltipColor() {
        if (defaultBigThumbnailBackground.toLowerCase() === this.bigThumbnailBackground.toLowerCase()) {
            return undefined
        }

        return this.bigThumbnailBackground
    }

    getStatusIcon(status: string | null) {
        return this.$store.getters['server/history/getPrintStatusIcon'](status)
    }

    getStatusTextColor(status: string | null) {
        return this.$store.getters['server/history/getPrintStatusTextColor'](status)
    }

    getStatusColor(status: string | null) {
        return this.$store.getters['server/history/getPrintStatusIconColor'](status)
    }

    dragOverFilelist(e: any, row: any) {
        e.preventDefault()

        if (row.isDirectory) e.target.parentElement.style.backgroundColor = '#43A04720'
    }

    dragLeaveFilelist(e: any) {
        e.preventDefault()
        e.stopPropagation()

        e.target.parentElement.style.backgroundColor = 'transparent'
    }

    async dragDropFilelist(e: any, row: any) {
        e.preventDefault()
        e.target.parentElement.style.backgroundColor = 'transparent'

        let dest: string
        if (row.filename === '..') {
            dest =
                this.currentPath.substring(0, this.currentPath.lastIndexOf('/') + 1) + this.draggingFile.item.filename
        } else dest = this.currentPath + '/' + row.filename + '/' + this.draggingFile.item.filename

        this.$socket.emit(
            'server.files.move',
            {
                source: 'gcodes' + this.currentPath + '/' + this.draggingFile.item.filename,
                dest: 'gcodes' + dest,
            },
            { action: 'files/getMove' }
        )
    }

    async uploadFile() {
        if (this.$refs.fileUpload.files?.length) {
            const files = [...this.$refs.fileUpload.files]
            this.$refs.fileUpload.value = ''

            await this.$store.dispatch('socket/addLoading', { name: 'gcodeUpload' })
            await this.$store.dispatch('files/uploadSetCurrentNumber', 0)
            await this.$store.dispatch('files/uploadSetMaxNumber', this.$refs.fileUpload.files.length)
            for (const file of files) {
                await this.$store.dispatch('files/uploadIncrementCurrentNumber')
                const path = this.currentPath.slice(0, 1) === '/' ? this.currentPath.slice(1) : this.currentPath
                const result = await this.$store.dispatch('files/uploadFile', {
                    file,
                    path,
                    root: 'gcodes',
                })

                if (result !== false)
                    this.$toast.success(this.$t('Files.SuccessfullyUploaded', { filename: result }).toString())
            }

            await this.$store.dispatch('socket/removeLoading', { name: 'gcodeUpload' })
        }
    }

    clickUploadButton() {
        this.$refs.fileUpload.click()
    }

    createDirectory() {
        this.dialogCreateDirectory.name = ''
        this.dialogCreateDirectory.show = true

        setTimeout(() => {
            this.$refs.inputFieldCreateDirectory?.focus()
        }, 200)
    }

    createDirectoryAction() {
        if (this.dialogCreateDirectory.name.length) {
            this.dialogCreateDirectory.show = false
            this.$socket.emit(
                'server.files.post_directory',
                { path: 'gcodes' + this.currentPath + '/' + this.dialogCreateDirectory.name },
                { action: 'files/getCreateDir' }
            )
        }
    }

    refreshFileList() {
        this.$socket.emit(
            'server.files.get_directory',
            { path: 'gcodes' + this.currentPath },
            { action: 'files/getDirectory' }
        )
    }

    advancedSearch(value: any, search: string | null) {
        if (search === null) return false
        if (typeof value !== 'string') return false

        value = value.toString().toLowerCase()
        const searchSplits = search.toLowerCase().split(' ')
        for (const searchWord of searchSplits) {
            if (!value.includes(searchWord)) return false
        }

        return true
    }

    refreshMetadata(data: FileStateGcodefile[]) {
        const items = data.filter((file) => !file.isDirectory && !file.metadataRequested && !file.metadataPulled)
        this.$store.dispatch(
            'files/requestMetadata',
            items.map((file: FileStateGcodefile) => ({
                filename: 'gcodes' + this.currentPath + '/' + file.filename,
            }))
        )
    }

    clickRow(item: FileStateGcodefile, force = false) {
        if (!this.contextMenu.shown || force) {
            if (force) this.contextMenu.shown = false

            if (item.isDirectory) {
                this.currentPath += '/' + item.filename
            } else if (!['error', 'printing', 'paused'].includes(this.printer_state) && this.isGcodeFile(item)) {
                this.dialogPrintFile.show = true
                this.dialogPrintFile.item = item
            }
        }
    }

    clickRowGoBack() {
        this.currentPath = this.currentPath.slice(0, this.currentPath.lastIndexOf('/'))
    }

    clickPathNavGoToDirectory(segment: { location: string }) {
        this.currentPath = segment.location
    }

    async addToQueue(item: FileStateGcodefile) {
        let filename = [this.currentPath, item.filename].join('/')
        if (filename.startsWith('/')) filename = filename.slice(1)

        await this.$store.dispatch('server/jobQueue/addToQueue', [filename])
    }

    openAddBatchToQueueDialog(item: FileStateGcodefile) {
        let filename = [this.currentPath, item.filename].join('/')
        if (filename.startsWith('/')) filename = filename.slice(1)

        this.dialogAddBatchToQueue.isVisible = true
        this.dialogAddBatchToQueue.filename = filename
    }

    closeAddBatchToQueueDialog() {
        this.dialogAddBatchToQueue.isVisible = false
    }

    changeMetadataVisible(name: string, value: boolean) {
        this.$store.dispatch('gui/setGcodefilesMetadata', { name: name, value: value })
    }

    showContextMenu(e: any, item: FileStateGcodefile) {
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

    editFile(item: FileStateGcodefile) {
        this.$store.dispatch('editor/openFile', {
            root: 'gcodes',
            path: this.currentPath,
            filename: item.filename,
            size: item.size,
            permissions: item.permissions,
        })
    }

    downloadFile() {
        const filename = this.currentPath + '/' + this.contextMenu.item.filename
        const href = this.apiUrl + '/server/files/gcodes' + encodeURI(filename)

        window.open(href)
    }

    async downloadSelectedFiles() {
        let items: string[] = []

        const addElementToItems = async (absolutPath: string, directory: FileStateFile[]) => {
            for (const file of directory) {
                const filePath = `${absolutPath}/${file.filename}`

                if (file.isDirectory && file.childrens) {
                    await addElementToItems(filePath, file.childrens)

                    continue
                }

                items.push(filePath)
            }
        }

        await addElementToItems('gcodes/' + this.currentPath, this.selectedFiles)
        const date = new Date()
        const timestamp = `${date.getFullYear()}${date.getMonth()}${date.getDate()}-${date.getHours()}${date.getMinutes()}${date.getSeconds()}`

        this.$socket.emit(
            'server.files.zip',
            { items, dest: `config/gcodes-${timestamp}.zip` },
            { action: 'files/downloadZip', loading: 'gcodeDownloadZip' }
        )

        this.selectedFiles = []
    }

    renameFile(item: FileStateGcodefile) {
        this.dialogRenameFile.item = item
        this.dialogRenameFile.newName = item.filename
        this.dialogRenameFile.show = true

        setTimeout(() => {
            this.$refs.inputFieldRenameFile?.focus()
        }, 200)
    }

    renameFileAction() {
        this.dialogRenameFile.show = false
        this.$socket.emit(
            'server.files.move',
            {
                source: 'gcodes' + this.currentPath + '/' + this.dialogRenameFile.item.filename,
                dest: 'gcodes' + this.currentPath + '/' + this.dialogRenameFile.newName,
            },
            { action: 'files/getMove' }
        )
    }

    duplicateFile(item: FileStateGcodefile) {
        this.dialogDuplicateFile.item = item
        this.dialogDuplicateFile.newName = item.filename
        this.dialogDuplicateFile.show = true

        setTimeout(() => {
            this.$refs.inputFieldDuplicateFile?.focus()
        }, 200)
    }

    duplicateFileAction() {
        this.dialogDuplicateFile.show = false
        this.$socket.emit('server.files.copy', {
            source: 'gcodes' + this.currentPath + '/' + this.dialogDuplicateFile.item.filename,
            dest: 'gcodes' + this.currentPath + '/' + this.dialogDuplicateFile.newName,
        })
    }

    renameDirectory(item: FileStateGcodefile) {
        this.dialogRenameDirectory.item = item
        this.dialogRenameDirectory.newName = item.filename
        this.dialogRenameDirectory.show = true

        setTimeout(() => {
            this.$refs.inputFieldRenameDirectory?.focus()
        }, 200)
    }

    renameDirectoryAction() {
        this.dialogRenameDirectory.show = false
        this.$socket.emit(
            'server.files.move',
            {
                source: 'gcodes' + this.currentPath + '/' + this.dialogRenameDirectory.item.filename,
                dest: 'gcodes' + this.currentPath + '/' + this.dialogRenameDirectory.newName,
            },
            { action: 'files/getMove' }
        )
    }

    removeFile() {
        this.$socket.emit(
            'server.files.delete_file',
            { path: 'gcodes' + this.currentPath + '/' + this.contextMenu.item.filename },
            { action: 'files/getDeleteFile' }
        )

        this.deleteDialog = false
    }

    deleteDirectory(item: FileStateGcodefile) {
        this.dialogDeleteDirectory.item = item
        this.dialogDeleteDirectory.show = true
    }

    deleteDirectoryAction() {
        this.dialogDeleteDirectory.show = false
        this.$socket.emit(
            'server.files.delete_directory',
            { path: 'gcodes' + this.currentPath + '/' + this.contextMenu.item.filename, force: true },
            { action: 'files/getDeleteDir' }
        )
    }

    closeStartPrint() {
        this.dialogPrintFile.show = false
    }

    dragFile(e: Event, item: FileStateGcodefile) {
        e.preventDefault()
        this.draggingFile.item = item
    }

    dragendFile(e: Event) {
        e.preventDefault()
        this.draggingFile.item = {
            isDirectory: false,
            filename: '',
            permissions: '',
            modified: new Date(),
            count_printed: 0,
            preheat_gcode: null,
            small_thumbnail: null,
            big_thumbnail: null,
            big_thumbnail_width: null,
            last_filament_used: null,
            last_start_time: null,
            last_end_time: null,
            last_print_duration: null,
            last_status: null,
            last_total_duration: null,
        }
    }

    @Watch('hideMetadataColums')
    hideMetadataColumsCanged(newVal: string[]) {
        newVal.forEach((key) => {
            let headerElement = this.headers.find((element) => element.value === key)
            if (headerElement) headerElement.visible = false
        })
    }

    isGcodeFile(file: FileStateFile) {
        const format = file.filename.slice(file.filename.lastIndexOf('.'))

        return validGcodeExtensions.includes(format)
    }

    view3D(item: FileStateFile) {
        this.$router.push({ path: '/viewer', query: { filename: 'gcodes' + this.currentPath + '/' + item.filename } })
    }

    scanMeta(item: FileStateFile) {
        this.$store.dispatch('files/scanMetadata', {
            filename: 'gcodes' + this.currentPath + '/' + item.filename,
        })
    }

    deleteSelectedFiles() {
        this.selectedFiles.forEach((item: FileStateGcodefile) => {
            if (item.isDirectory) {
                this.$socket.emit(
                    'server.files.delete_directory',
                    { path: 'gcodes' + this.currentPath + '/' + item.filename, force: true },
                    { action: 'files/getDeleteDir' }
                )
            } else {
                this.$socket.emit(
                    'server.files.delete_file',
                    { path: 'gcodes' + this.currentPath + '/' + item.filename },
                    { action: 'files/getDeleteFile' }
                )
            }
        })

        this.selectedFiles = []
        this.deleteSelectedDialog = false
    }

    outputValue(col: any, item: FileStateGcodefile) {
        const value = col.value in item ? item[col.value] : null

        if (value !== null) {
            switch (col.outputType) {
                case 'filesize':
                    return formatFilesize(value)

                case 'date':
                    return this.formatDateTime(value)

                case 'time':
                    return this.formatPrintTime(value)

                case 'temp':
                    return value.toFixed() + ' °C'

                case 'length':
                    if (value > 1000) return (value / 1000).toFixed(2) + ' m'

                    return value.toFixed(2) + ' mm'

                case 'weight':
                    return value.toFixed(2) + ' g'

                default:
                    return value
            }
        } else return '--'
    }

    // ------------------------------------------------------------------
    // Fleet GCode Methods
    // ------------------------------------------------------------------

    get fleetFiles(): FleetGcodeFile[] {
        return this.$store.state.fleet?.gcodes?.files ?? []
    }

    get fleetFilesLoading(): boolean {
        return this.$store.state.fleet?.gcodes?.loading ?? false
    }

    get fleetDiskUsage() {
        return this.$store.state.fleet?.gcodes?.diskUsage ?? null
    }

    get fleetFilesPushing(): Record<string, boolean> {
        return this.$store.state.fleet?.gcodes?.pushing ?? {}
    }

    get currentPrinterHostname(): string {
        return this.$store.state.socket?.hostname ?? ''
    }

    get fleetFilesFiltered(): FleetGcodeFile[] {
        if (!this.fleetSearch) return this.fleetFiles
        const q = this.fleetSearch.toLowerCase()
        return this.fleetFiles.filter((f: FleetGcodeFile) => f.filename.toLowerCase().includes(q))
    }

    get fleetHeaders() {
        return [
            { text: '', value: 'icon', sortable: false, width: '32px' },
            { text: 'Name', value: 'filename' },
            { text: 'Size', value: 'size', width: '100px' },
            { text: 'Modified', value: 'modified', width: '180px' },
            { text: 'Cached On', value: 'cached_on', sortable: false, width: '130px' },
            { text: 'Actions', value: 'actions', sortable: false, width: '200px' },
        ]
    }

    get fleetPathSegments(): string[] {
        if (!this.fleetCurrentPath) return []
        return this.fleetCurrentPath.split('/').filter(Boolean)
    }

    fleetPathUpTo(index: number): string {
        return this.fleetPathSegments.slice(0, index + 1).join('/')
    }

    fleetDisplayName(fullPath: string): string {
        const parts = fullPath.split('/')
        return parts[parts.length - 1]
    }

    fleetSortItems(items: FleetGcodeFile[], sortBy: string[], sortDesc: boolean[]) {
        // Always directories first, then sort by the requested column
        return [...items].sort((a, b) => {
            if (a.is_directory !== b.is_directory) return a.is_directory ? -1 : 1
            // Default sort: name ascending
            const nameA = a.filename.toLowerCase()
            const nameB = b.filename.toLowerCase()
            return nameA.localeCompare(nameB)
        })
    }

    navigateToFleetPath(path: string) {
        this.fleetCurrentPath = path
        this.$store.commit('fleet/gcodes/setCurrentPath', path)
        this.loadFleetFiles()
    }

    navigateFleetUp() {
        const segments = this.fleetPathSegments
        segments.pop()
        this.fleetCurrentPath = segments.join('/')
        this.$store.commit('fleet/gcodes/setCurrentPath', this.fleetCurrentPath)
        this.loadFleetFiles()
    }

    onFleetRowClick(item: FleetGcodeFile) {
        if (item.is_directory) {
            this.fleetCurrentPath = item.filename
            this.$store.commit('fleet/gcodes/setCurrentPath', this.fleetCurrentPath)
            this.loadFleetFiles()
        }
    }

    openFleetMoveDialog(item: FleetGcodeFile) {
        this.fleetMoveDialog = {
            show: true,
            source: item.filename,
            destination: item.filename,
        }
    }

    isFleetFileCached(item: FleetGcodeFile): boolean {
        const hostname = this.currentPrinterHostname
        return hostname ? item.cached_on.includes(hostname) : false
    }

    isFleetFilePushing(filename: string): boolean {
        const key = `${filename}:${this.currentPrinterHostname}`
        return !!this.fleetFilesPushing[key]
    }

    async loadFleetFiles() {
        try {
            await this.$store.dispatch('fleet/gcodes/loadFiles', this.fleetCurrentPath)
        } catch (e) {
            console.error('Failed to load fleet files:', e)
        }
    }

    async pushFleetFileToDevice(filename: string) {
        const hostname = this.currentPrinterHostname
        if (!hostname) return
        try {
            await this.$store.dispatch('fleet/gcodes/pushToDevice', { filename, printer_hostname: hostname })
            await this.loadFleetFiles()
        } catch (e) {
            console.error('Push failed:', e)
        }
    }

    async pushFleetFileToAll(filename: string) {
        try {
            await this.$store.dispatch('fleet/gcodes/pushToAll', { filename })
            await this.loadFleetFiles()
        } catch (e) {
            console.error('Push to all failed:', e)
        }
    }

    async createFleetDirectory() {
        const name = this.fleetMkdirDialog.name.trim()
        if (!name) return
        this.fleetMkdirDialog.show = false
        const fullPath = this.fleetCurrentPath ? `${this.fleetCurrentPath}/${name}` : name
        try {
            await this.$store.dispatch('fleet/gcodes/createDirectory', fullPath)
            this.fleetMkdirDialog.name = ''
            await this.loadFleetFiles()
        } catch (e) {
            console.error('Create directory failed:', e)
        }
    }

    async executeFleetMove() {
        const { source, destination } = this.fleetMoveDialog
        if (!destination || destination === source) return
        this.fleetMoveDialog.show = false
        try {
            await this.$store.dispatch('fleet/gcodes/moveFile', { source, destination })
            await this.loadFleetFiles()
        } catch (e) {
            console.error('Move failed:', e)
        }
    }

    async deleteFleetFile() {
        const filename = this.fleetDeleteDialog.filename
        this.fleetDeleteDialog.show = false
        try {
            await this.$store.dispatch('fleet/gcodes/deleteFile', filename)
            await this.loadFleetFiles()
        } catch (e) {
            console.error('Delete failed:', e)
        }
    }

    async uploadFleetFile(e: Event) {
        const target = e.target as HTMLInputElement
        if (!target.files?.length) return
        for (const file of Array.from(target.files)) {
            try {
                await this.$store.dispatch('fleet/gcodes/uploadFile', { file, path: this.fleetCurrentPath })
            } catch (err) {
                console.error('Fleet upload failed:', err)
            }
        }
        target.value = ''
        await this.loadFleetFiles()
    }

    // ------------------------------------------------------------------
    // Download queue
    // ------------------------------------------------------------------

    get downloadQueue() {
        return this.$store.state.fleet.gcodes.downloadQueue ?? []
    }

    get activeDownloadCount(): number {
        return this.downloadQueue.filter(
            (e: any) => e.status === 'pending' || e.status === 'downloading'
        ).length
    }

    get downloadQueueHeaders() {
        return [
            { text: 'File', value: 'filename', width: '30%' },
            { text: 'Printer', value: 'printer_hostname', width: '20%' },
            { text: 'Status', value: 'status', width: '100px', sortable: false },
            { text: 'Progress', value: 'progress_pct', width: '120px', sortable: false },
            { text: 'Source', value: 'source', width: '80px', sortable: false },
            { text: '', value: 'actions', width: '60px', sortable: false },
        ]
    }

    downloadStatusColor(status: string): string {
        switch (status) {
            case 'pending': return 'grey'
            case 'downloading': return 'primary'
            case 'completed': return 'success'
            case 'failed': return 'error'
            case 'cancelled': return 'grey darken-1'
            default: return 'grey'
        }
    }

    async loadDownloadQueue() {
        try {
            await this.$store.dispatch('fleet/gcodes/loadDownloadQueue', true)
        } catch (e) {
            console.error('Failed to load download queue:', e)
        }
    }

    async cancelQueueDownload(jobId: number) {
        try {
            await this.$store.dispatch('fleet/gcodes/cancelDownload', jobId)
            await this.loadDownloadQueue()
        } catch (e) {
            console.error('Cancel download failed:', e)
        }
    }

    mounted() {
        this.loadFleetFiles()
        this.loadDownloadQueue()
        fleetDaemonEvents.$on('gcodes_updated', this.loadFleetFiles)
        fleetDaemonEvents.$on('download_queue_updated', this.loadDownloadQueue)
    }

    beforeDestroy() {
        fleetDaemonEvents.$off('gcodes_updated', this.loadFleetFiles)
        fleetDaemonEvents.$off('download_queue_updated', this.loadDownloadQueue)
    }
}
</script>

<style>
/*noinspection CssUnusedSymbol*/
.files-table .v-data-table-header__icon {
    margin-left: 7px;
}

.files-table .file-list-cursor:hover {
    cursor: pointer;
}

/*noinspection CssUnusedSymbol*/
.file-list--select-td {
    width: 20px;
}

/*noinspection CssUnusedSymbol*/
.files-table th.text-start {
    padding-right: 0 !important;
}

/*noinspection CssUnusedSymbol*/
.v-chip.minimum-chip {
    padding: 0;
    min-width: 24px;
}

/*noinspection CssUnusedSymbol*/
.v-chip.minimum-chip .v-chip__content {
    margin: 0 auto;
}

/*noinspection CssUnusedSymbol*/
.file-list__count_printed {
    position: relative;
    top: 1px;
}

.handle {
    cursor: move;
}
</style>
