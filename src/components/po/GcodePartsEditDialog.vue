<template>
    <v-dialog :value="value" max-width="620" persistent @input="$emit('input', $event)">
        <v-card>
            <v-card-title class="text-subtitle-1">
                Parts made by
                <span class="font-weight-medium ml-1 text-truncate" :title="gcodeFilename">{{ shortName }}</span>
            </v-card-title>
            <v-card-text>
                <v-alert v-if="error" type="error" dense class="mb-3">{{ error }}</v-alert>
                <v-progress-linear v-if="loadingOptions" indeterminate class="mb-2" />
                <gcode-part-links-editor v-model="rows" :options="partOptions" :disabled="saving" />
                <div class="text-caption text--secondary mt-2">
                    Each successful run adds "per plate" parts to the PO. Runs already printed are re-counted with the
                    new mapping.
                </div>
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn text :disabled="saving" @click="$emit('input', false)">Cancel</v-btn>
                <v-btn color="primary" :loading="saving" :disabled="!valid" @click="save">Save</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { Prop, Watch } from 'vue-property-decorator'
import GcodePartLinksEditor from '@/components/po/GcodePartLinksEditor.vue'
import { PoPartOption, cleanLinks, poPartOptions, baseName } from '@/components/po/poFormat'
import { FleetPoDetail, PartLinkPayload } from '@/store/fleet/purchaseOrders/types'

/** Edit one gcode's PO part links (PUT /jobs/{job_id}/items/{item_id}/parts). */
@Component({ components: { GcodePartLinksEditor } })
export default class GcodePartsEditDialog extends Vue {
    @Prop({ type: Boolean, default: false }) value!: boolean
    @Prop({ type: Number, default: 0 }) jobId!: number
    @Prop({ type: Number, default: 0 }) itemId!: number
    @Prop({ type: String, default: '' }) gcodeFilename!: string
    /** Current links of the gcode */
    @Prop({ type: Array, default: () => [] }) links!: { part_id: number; qty_per_run: number }[]
    /** PO part options; when empty and poId is set, the PO is fetched */
    @Prop({ type: Array, default: () => [] }) options!: PoPartOption[]
    @Prop({ type: Number, default: 0 }) poId!: number

    rows: PartLinkPayload[] = []
    fetched: PoPartOption[] = []
    loadingOptions = false
    saving = false
    error = ''

    get shortName() {
        return baseName(this.gcodeFilename)
    }

    get partOptions(): PoPartOption[] {
        return this.options.length ? this.options : this.fetched
    }

    get valid(): boolean {
        return this.rows.every((r) => r.part_id > 0 && Number(r.qty_per_run) >= 1)
    }

    @Watch('value')
    async onOpen(open: boolean) {
        if (!open) return
        this.error = ''
        this.saving = false
        this.rows = this.links.map((l) => ({ part_id: l.part_id, qty_per_run: l.qty_per_run }))
        if (!this.options.length && this.poId) {
            this.loadingOptions = true
            try {
                const po: FleetPoDetail = await this.$store.dispatch('fleet/purchaseOrders/fetchPo', this.poId)
                this.fetched = poPartOptions(po)
            } catch (e: any) {
                this.error = e?.message ?? String(e)
            } finally {
                this.loadingOptions = false
            }
        }
    }

    async save() {
        this.saving = true
        this.error = ''
        try {
            const res = await this.$store.dispatch('fleet/purchaseOrders/setGcodeParts', {
                jobId: this.jobId,
                itemId: this.itemId,
                parts: cleanLinks(this.rows),
            })
            this.$emit('saved', res)
            this.$emit('input', false)
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        } finally {
            this.saving = false
        }
    }
}
</script>
