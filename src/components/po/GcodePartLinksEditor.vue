<template>
    <div class="gcode-part-links">
        <div class="d-flex align-center mb-1">
            <span class="text-caption text--secondary">Parts on this plate</span>
            <v-spacer />
            <v-btn x-small text color="primary" :disabled="disabled || options.length === 0" @click="add">
                <v-icon x-small left>{{ mdiPlus }}</v-icon>
                Add part
            </v-btn>
        </div>
        <div v-if="value.length === 0" class="po-warn-text text-caption mb-1">
            <v-icon x-small :color="warnColor">{{ mdiAlertOutline }}</v-icon>
            No PO part: this gcode's output will not count toward the PO.
        </div>
        <div v-for="(row, idx) in value" :key="idx" class="d-flex align-center mb-1">
            <v-select
                :value="row.part_id"
                :items="selectItems"
                label="PO part"
                dense
                outlined
                hide-details
                :disabled="disabled"
                class="flex-grow-1 mr-2"
                @change="setPart(idx, $event)">
                <template #item="{ item }">
                    <v-list-item-content>
                        <v-list-item-title>{{ item.text }}</v-list-item-title>
                        <v-list-item-subtitle>{{ item.subtitle }}</v-list-item-subtitle>
                    </v-list-item-content>
                </template>
            </v-select>
            <v-text-field
                :value="row.qty_per_run"
                type="number"
                min="1"
                label="Per plate"
                dense
                outlined
                hide-details
                :disabled="disabled"
                :error="!(Number(row.qty_per_run) >= 1)"
                style="max-width: 100px"
                class="mr-1"
                @input="setQty(idx, $event)" />
            <v-btn x-small icon title="Remove" :disabled="disabled" @click="remove(idx)">
                <v-icon small>{{ mdiClose }}</v-icon>
            </v-btn>
        </div>
    </div>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { Prop } from 'vue-property-decorator'
import { mdiAlertOutline, mdiClose, mdiPlus } from '@mdi/js'
import { PartLinkPayload } from '@/store/fleet/purchaseOrders/types'
import { PoPartOption, partSelectItems, PO_WARN_COLOR } from '@/components/po/poFormat'

/**
 * Edits which PO parts one gcode (job item) produces and how many per plate.
 * v-model: PartLinkPayload[] (rows may have part_id 0 while being filled in;
 * callers send cleanLinks(value)).
 */
@Component
export default class GcodePartLinksEditor extends Vue {
    mdiAlertOutline = mdiAlertOutline
    mdiClose = mdiClose
    mdiPlus = mdiPlus
    warnColor = PO_WARN_COLOR

    @Prop({ type: Array, default: () => [] }) value!: PartLinkPayload[]
    /** All parts of the PO (see poPartOptions) */
    @Prop({ type: Array, default: () => [] }) options!: PoPartOption[]
    @Prop({ type: Boolean, default: false }) disabled!: boolean

    get selectItems() {
        return partSelectItems(this.options)
    }

    emit(rows: PartLinkPayload[]) {
        this.$emit('input', rows)
    }

    add() {
        // Preselect the first part not used yet on this plate.
        const used = new Set(this.value.map((r) => r.part_id))
        const next = this.options.find((o) => !used.has(o.part_id))
        this.emit([...this.value, { part_id: next ? next.part_id : 0, qty_per_run: 1 }])
    }

    remove(idx: number) {
        const rows = [...this.value]
        rows.splice(idx, 1)
        this.emit(rows)
    }

    setPart(idx: number, partId: number) {
        const rows = this.value.map((r, i) => (i === idx ? { ...r, part_id: partId } : r))
        this.emit(rows)
    }

    setQty(idx: number, v: string) {
        const n = parseInt(String(v), 10)
        const rows = this.value.map((r, i) => (i === idx ? { ...r, qty_per_run: isNaN(n) ? 0 : n } : r))
        this.emit(rows)
    }
}
</script>

<style scoped>
.po-warn-text {
    color: #ffa000;
}
</style>
