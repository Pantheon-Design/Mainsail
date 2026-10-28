<template>
    <v-dialog :value="value" max-width="560" persistent @input="$emit('input', $event)">
        <!-- data-fleet-dropzone: TheFullscreenUpload stands down while this card is visible;
             drops outside the zone are swallowed so the browser never opens the PDF. -->
        <v-card data-fleet-dropzone @dragover.prevent @drop.prevent>
            <v-card-title>Upload purchase order</v-card-title>
            <v-card-text>
                <v-alert v-if="error" type="error" dense class="mb-3">{{ error }}</v-alert>
                <v-alert v-if="config && !config.extraction_available" type="info" dense text class="mb-3">
                    PDF reading is not configured on the fleet daemon. The PDF is still stored and an empty draft
                    opens for you to fill in.
                </v-alert>

                <div v-if="busy" class="text-center py-6">
                    <v-progress-circular indeterminate size="48" color="primary" class="mb-3" />
                    <div class="text-subtitle-1">
                        {{ readingWithClaude ? 'Reading PO with Claude…' : 'Uploading…' }}
                    </div>
                    <div class="text-caption text--secondary">
                        {{ fileName }}
                        <template v-if="readingWithClaude">
                            · this can take a minute or two ({{ elapsed }} s)
                        </template>
                    </div>
                </div>

                <div
                    v-else
                    class="po-dropzone d-flex flex-column align-center justify-center pa-6"
                    :class="{ 'po-dropzone--over': dragOver }"
                    @dragenter.prevent.stop="dragOver = true"
                    @dragover.prevent.stop="dragOver = true"
                    @dragleave.prevent.stop="dragOver = false"
                    @drop.prevent.stop="onDrop">
                    <v-icon size="48" class="mb-2">{{ mdiFilePdfBox }}</v-icon>
                    <div class="mb-2">Drop the PO PDF here</div>
                    <v-btn small outlined color="primary" @click="pickFile">Choose file</v-btn>
                    <input ref="fileInput" type="file" accept="application/pdf,.pdf" hidden @change="onFileChosen" />
                    <div v-if="config" class="text-caption text--secondary mt-2">Max {{ config.max_pdf_mb }} MB</div>
                </div>
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn text :disabled="busy" @click="$emit('input', false)">Cancel</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { Prop, Watch } from 'vue-property-decorator'
import { mdiFilePdfBox } from '@mdi/js'
import { FleetPoConfig, FleetPoDetail } from '@/store/fleet/purchaseOrders/types'

/**
 * PDF -> POST /pos/extract -> emits `created` with the draft detail (plus
 * duplicate_of / extraction_error) so the page opens the review dialog.
 *
 * The card carries `data-fleet-dropzone`: TheFullscreenUpload ignores window
 * drags while such an element is visible, so a dropped PDF never goes to
 * Moonraker.
 */
@Component
export default class PoUploadDialog extends Vue {
    mdiFilePdfBox = mdiFilePdfBox

    @Prop({ type: Boolean, default: false }) value!: boolean

    busy = false
    dragOver = false
    error = ''
    fileName = ''
    elapsed = 0
    private ticker: ReturnType<typeof setInterval> | null = null

    get config(): FleetPoConfig | null {
        return this.$store.getters['fleet/purchaseOrders/getConfig']
    }

    get readingWithClaude(): boolean {
        return !!this.config?.extraction_available
    }

    @Watch('value')
    onOpen(open: boolean) {
        if (!open) return
        this.error = ''
        this.dragOver = false
        this.$store.dispatch('fleet/purchaseOrders/loadConfig').catch(() => {})
    }

    beforeDestroy() {
        this.stopTicker()
    }

    pickFile() {
        const input = this.$refs.fileInput as HTMLInputElement | undefined
        input?.click()
    }

    onFileChosen(e: Event) {
        const input = e.target as HTMLInputElement
        const file = input.files?.[0]
        input.value = ''
        if (file) this.upload(file)
    }

    onDrop(e: DragEvent) {
        this.dragOver = false
        const files = e.dataTransfer?.files
        if (!files || files.length === 0) return
        if (files.length > 1) {
            this.error = 'Drop one PDF at a time'
            return
        }
        this.upload(files[0])
    }

    stopTicker() {
        if (this.ticker) clearInterval(this.ticker)
        this.ticker = null
    }

    async upload(file: File) {
        this.error = ''
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        if (!isPdf) {
            this.error = `${file.name} is not a PDF`
            return
        }
        const maxMb = this.config?.max_pdf_mb
        if (maxMb && file.size > maxMb * 1024 * 1024) {
            this.error = `${file.name} is larger than ${maxMb} MB`
            return
        }
        this.busy = true
        this.fileName = file.name
        this.elapsed = 0
        this.ticker = setInterval(() => this.elapsed++, 1000)
        try {
            const detail: FleetPoDetail = await this.$store.dispatch('fleet/purchaseOrders/extractPo', { file })
            this.$emit('created', detail)
            this.$emit('input', false)
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        } finally {
            this.stopTicker()
            this.busy = false
        }
    }
}
</script>

<style scoped>
.po-dropzone {
    border: 2px dashed rgba(128, 128, 128, 0.6);
    border-radius: 8px;
    min-height: 200px;
    transition: background 0.15s, border-color 0.15s;
}
.po-dropzone--over {
    border-color: var(--v-primary-base);
    background: rgba(33, 150, 243, 0.08);
}
</style>
