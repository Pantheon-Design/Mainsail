<template>
    <div class="fleet-gcode-picker">
        <div class="d-flex align-center mb-3">
            <v-breadcrumbs :items="breadcrumbs" class="pa-0" divider="/">
                <template #item="{ item }">
                    <v-breadcrumbs-item :disabled="item.disabled" @click="goTo(item.path)">
                        <span :class="{ 'file-list-cursor': !item.disabled }">{{ item.text }}</span>
                    </v-breadcrumbs-item>
                </template>
            </v-breadcrumbs>
            <v-spacer />
            <v-text-field
                v-model="search"
                :append-icon="mdiMagnify"
                label="Search"
                single-line
                outlined
                dense
                clearable
                hide-details
                style="max-width: 220px" />
        </div>

        <v-alert v-if="error" type="error" dense class="mb-2">{{ error }}</v-alert>

        <div class="picker-list">
            <div v-if="loading" class="text-center pa-4">
                <v-progress-circular indeterminate size="24" />
            </div>
            <template v-else>
                <div v-if="currentPath !== ''" class="picker-item d-flex align-center pa-2 file-list-cursor" @click="goUp">
                    <v-icon class="mr-2">{{ mdiFolderUpload }}</v-icon>
                    <span>..</span>
                </div>
                <div
                    v-for="item in filteredEntries"
                    :key="item.path"
                    class="picker-item d-flex align-center pa-2 file-list-cursor"
                    :class="{ 'file-selected': isSelected(item) }"
                    @click="clickRow(item)">
                    <v-icon class="mr-2">{{ item.is_directory ? mdiFolder : mdiFile }}</v-icon>
                    <div class="flex-grow-1 text-truncate">{{ item.name }}</div>
                    <v-icon v-if="isSelected(item)" color="primary" small class="mr-2">{{ mdiCheckCircle }}</v-icon>
                    <span v-if="!item.is_directory" class="text-caption text--secondary">{{ formatFilesize(item.size) }}</span>
                </div>
                <div v-if="filteredEntries.length === 0" class="text-center pa-4 text--secondary">No gcode files here</div>
            </template>
        </div>

        <div v-if="selected.length > 0" class="mt-3">
            <div class="text-subtitle-2 mb-1">Selected ({{ selected.length }})</div>
            <v-chip v-for="p in selected" :key="p" small close class="ma-1" @click:close="removeSelected(p)">{{ p }}</v-chip>
        </div>

        <div class="d-flex justify-end mt-3">
            <v-btn text @click="selected = []">Clear</v-btn>
            <v-btn color="primary" :disabled="selected.length === 0" @click="confirm">
                {{ selectionMode === 'single' ? 'Select file' : `Select ${selected.length} file(s)` }}
            </v-btn>
        </div>
    </div>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { Prop, Watch } from 'vue-property-decorator'
import { mdiFolder, mdiFolderUpload, mdiFile, mdiMagnify, mdiCheckCircle } from '@mdi/js'
import { formatFilesize } from '@/plugins/helpers'
import { FleetGcodeFile } from '@/store/fleet/gcodes/types'

const GCODE_EXT = /\.(gcode|gco|g)$/i

interface PickerEntry {
    name: string
    path: string
    is_directory: boolean
    size: number
}

/**
 * Browses the CENTRAL fleet gcode library (fleet_daemon GET /gcodes) and emits
 * `files-selected` with relative paths (e.g. "sub/part.gcode"). Uses the
 * non-committing `fleet/gcodes/fetchDirectory` action so it never disturbs the
 * GcodefilesPanel browser state.
 */
@Component
export default class FleetGcodePicker extends Vue {
    mdiFolder = mdiFolder
    mdiFolderUpload = mdiFolderUpload
    mdiFile = mdiFile
    mdiMagnify = mdiMagnify
    mdiCheckCircle = mdiCheckCircle
    formatFilesize = formatFilesize

    @Prop({ type: String, default: 'multiple' })
    selectionMode!: 'single' | 'multiple'

    @Prop({ type: Number, default: 0 })
    resetKey!: number

    currentPath = ''
    search = ''
    loading = false
    error = ''
    entries: PickerEntry[] = []
    selected: string[] = []

    mounted() {
        this.load()
    }

    get breadcrumbs() {
        const parts = this.currentPath ? this.currentPath.split('/') : []
        const crumbs: Array<{ text: string; path: string; disabled: boolean }> = [
            { text: 'fleet', path: '', disabled: parts.length === 0 },
        ]
        parts.forEach((p, i) => {
            crumbs.push({ text: p, path: parts.slice(0, i + 1).join('/'), disabled: i === parts.length - 1 })
        })
        return crumbs
    }

    get filteredEntries(): PickerEntry[] {
        let list = this.entries.filter((e) => e.is_directory || GCODE_EXT.test(e.name))
        if (this.search) {
            const s = this.search.toLowerCase()
            list = list.filter((e) => e.name.toLowerCase().includes(s))
        }
        return list.sort((a, b) => {
            if (a.is_directory !== b.is_directory) return a.is_directory ? -1 : 1
            return a.name.localeCompare(b.name)
        })
    }

    async load() {
        this.loading = true
        this.error = ''
        try {
            const files: FleetGcodeFile[] = await this.$store.dispatch('fleet/gcodes/fetchDirectory', this.currentPath)
            this.entries = files.map((f) => {
                // The daemon may return either a bare name or a path relative to the library root.
                const name = f.filename.includes('/') ? f.filename.slice(f.filename.lastIndexOf('/') + 1) : f.filename
                const path = f.filename.includes('/')
                    ? f.filename
                    : this.currentPath
                    ? `${this.currentPath}/${f.filename}`
                    : f.filename
                return { name, path, is_directory: f.is_directory, size: f.size }
            })
        } catch (e: any) {
            this.error = e?.message ?? String(e)
            this.entries = []
        } finally {
            this.loading = false
        }
    }

    isSelected(item: PickerEntry) {
        return !item.is_directory && this.selected.includes(item.path)
    }

    clickRow(item: PickerEntry) {
        if (item.is_directory) {
            this.currentPath = item.path
            return
        }
        if (this.selectionMode === 'single') {
            this.selected = [item.path]
            return
        }
        const idx = this.selected.indexOf(item.path)
        if (idx >= 0) this.selected.splice(idx, 1)
        else this.selected.push(item.path)
    }

    goUp() {
        const i = this.currentPath.lastIndexOf('/')
        this.currentPath = i >= 0 ? this.currentPath.slice(0, i) : ''
    }

    goTo(path: string) {
        this.currentPath = path
    }

    removeSelected(p: string) {
        const idx = this.selected.indexOf(p)
        if (idx >= 0) this.selected.splice(idx, 1)
    }

    confirm() {
        this.$emit('files-selected', [...this.selected])
        this.selected = []
    }

    @Watch('currentPath')
    onPathChanged() {
        this.load()
    }

    @Watch('resetKey')
    onReset() {
        this.selected = []
        this.currentPath = ''
        this.search = ''
    }
}
</script>

<style scoped>
.picker-list {
    max-height: 320px;
    overflow-y: auto;
    border: 1px solid rgba(128, 128, 128, 0.35);
    border-radius: 4px;
}
.picker-item {
    border-bottom: 1px solid rgba(128, 128, 128, 0.2);
}
.picker-item:hover {
    background-color: rgba(128, 128, 128, 0.15);
}
.picker-item:last-child {
    border-bottom: none;
}
.file-selected {
    background-color: rgba(25, 118, 210, 0.35) !important;
}
.file-list-cursor {
    cursor: pointer;
}
</style>
