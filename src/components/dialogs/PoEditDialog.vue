<template>
    <v-dialog :value="value" :fullscreen="$vuetify.breakpoint.smAndDown" max-width="1700" width="97vw" persistent scrollable @input="$emit('input', $event)">
        <v-card>
            <v-card-title class="d-flex align-center flex-wrap">
                <span class="mr-3">{{ title }}</span>
                <v-chip v-if="detail" small :color="statusColor(detail.po.status)" text-color="white" class="mr-2">
                    {{ detail.po.status }}
                </v-chip>
                <v-progress-circular v-if="pending > 0" indeterminate size="18" width="2" class="mr-2" />
                <span v-else-if="savedOnce" class="text-caption text--secondary mr-2">saved</span>
                <v-spacer />
                <v-btn v-if="hasPdf && $vuetify.breakpoint.mdAndUp" small text @click="showPdf = !showPdf">
                    <v-icon small left>{{ mdiFilePdfBox }}</v-icon>
                    {{ showPdf ? 'Hide PDF' : 'Show PDF' }}
                </v-btn>
                <v-btn icon :disabled="pending > 0" @click="close"><v-icon>{{ mdiClose }}</v-icon></v-btn>
            </v-card-title>
            <v-divider />

            <v-card-text v-if="!detail" class="text-center pa-6">
                <v-alert v-if="error" type="error" dense class="mb-3">{{ error }}</v-alert>
                <v-progress-circular v-else indeterminate />
            </v-card-text>

            <v-card-text v-else class="pt-3">
                <v-alert v-if="error" type="error" dense dismissible class="mb-3" @input="error = ''">{{ error }}</v-alert>
                <v-alert
                    v-for="d in duplicates"
                    :key="'dup-' + d.id"
                    type="warning"
                    dense
                    text
                    class="mb-2">
                    Possible duplicate of PO {{ d.po_number || '#' + d.id }} ({{ d.status }}).
                </v-alert>
                <v-alert v-if="extractionError" type="warning" dense text class="mb-2">{{ extractionError }}</v-alert>

                <v-row>
                    <!-- Source PDF -->
                    <v-col v-if="pdfVisible" cols="12" md="5" class="po-pdf-col">
                        <iframe :src="pdfUrl" class="po-pdf" title="PO document" />
                    </v-col>

                    <v-col cols="12" :md="pdfVisible ? 7 : 12">
                        <v-alert v-if="extractionWarnings.length" type="warning" dense text class="mb-3">
                            <div class="font-weight-medium mb-1">Check these against the PDF:</div>
                            <ul class="mb-0">
                                <li v-for="(w, i) in extractionWarnings" :key="'xw-' + i">{{ w }}</li>
                            </ul>
                        </v-alert>

                        <!-- Header -->
                        <v-row dense>
                            <v-col cols="12" sm="4">
                                <v-text-field
                                    v-model="form.po_number"
                                    label="PO number *"
                                    dense
                                    outlined
                                    :error="!form.po_number"
                                    @change="saveField('po_number', form.po_number)" />
                            </v-col>
                            <v-col cols="12" sm="8">
                                <div class="d-flex align-start">
                                    <v-select
                                        v-model="form.customer_id"
                                        :items="customerOptions"
                                        label="Customer"
                                        dense
                                        outlined
                                        clearable
                                        class="flex-grow-1"
                                        @change="saveField('customer_id', form.customer_id || 0)" />
                                    <v-btn icon class="ml-1" title="Add customer" @click="quickAdd.show = !quickAdd.show">
                                        <v-icon>{{ mdiAccountPlus }}</v-icon>
                                    </v-btn>
                                </div>
                                <div v-if="quickAdd.show" class="d-flex align-center mb-3">
                                    <v-text-field
                                        v-model="quickAdd.name"
                                        label="New customer name"
                                        dense
                                        outlined
                                        hide-details
                                        class="mr-2" />
                                    <v-btn
                                        small
                                        color="primary"
                                        :loading="quickAdd.saving"
                                        :disabled="!quickAdd.name"
                                        @click="saveQuickCustomer">
                                        Add
                                    </v-btn>
                                </div>
                            </v-col>
                            <v-col cols="12" sm="6">
                                <v-text-field
                                    v-model="form.buyer_name"
                                    label="Buyer (as on the PO)"
                                    dense
                                    outlined
                                    @change="saveField('buyer_name', form.buyer_name)" />
                            </v-col>
                            <v-col cols="12" sm="6">
                                <v-text-field
                                    v-model="form.vendor_name"
                                    label="Vendor"
                                    dense
                                    outlined
                                    @change="saveField('vendor_name', form.vendor_name)" />
                            </v-col>
                            <v-col cols="6" sm="3">
                                <v-text-field
                                    v-model="form.order_date"
                                    type="date"
                                    label="Order date"
                                    dense
                                    outlined
                                    @input="saveDate('order_date', $event)" />
                            </v-col>
                            <v-col cols="6" sm="3">
                                <v-text-field
                                    v-model="form.due_date"
                                    type="date"
                                    label="Due date"
                                    dense
                                    outlined
                                    @input="saveDate('due_date', $event)" />
                            </v-col>
                            <v-col cols="6" sm="2">
                                <v-text-field
                                    v-model="form.currency"
                                    label="Currency"
                                    dense
                                    outlined
                                    @change="saveField('currency', form.currency)" />
                            </v-col>
                            <v-col cols="6" sm="4">
                                <v-text-field
                                    v-model="form.payment_terms"
                                    label="Payment terms"
                                    dense
                                    outlined
                                    @change="saveField('payment_terms', form.payment_terms)" />
                            </v-col>
                            <v-col v-for="m in moneyFields" :key="m.key" cols="6" sm="3">
                                <v-text-field
                                    v-model="form[m.key]"
                                    type="number"
                                    :label="m.label"
                                    dense
                                    outlined
                                    @change="saveField(m.key, toNumber(form[m.key]))" />
                            </v-col>
                        </v-row>

                        <v-expansion-panels flat accordion class="mb-3 po-addr-panels">
                            <v-expansion-panel v-for="a in addressFields" :key="a.key">
                                <v-expansion-panel-header class="px-2 py-1">
                                    <span>
                                        {{ a.label }}
                                        <span class="text-caption text--secondary ml-2">{{ addressSummary(form[a.key]) }}</span>
                                    </span>
                                </v-expansion-panel-header>
                                <v-expansion-panel-content>
                                    <v-row dense>
                                        <v-col v-for="k in addressKeys" :key="a.key + k" cols="6" sm="4">
                                            <v-text-field
                                                v-model="form[a.key][k]"
                                                :label="addressLabel(k)"
                                                dense
                                                outlined
                                                hide-details
                                                @change="saveField(a.key, cleanAddress(form[a.key]))" />
                                        </v-col>
                                    </v-row>
                                </v-expansion-panel-content>
                            </v-expansion-panel>
                        </v-expansion-panels>

                        <v-textarea
                            v-model="form.notes"
                            label="Notes"
                            dense
                            outlined
                            rows="2"
                            auto-grow
                            @change="saveField('notes', form.notes)" />

                        <!-- Items -->
                        <div class="d-flex align-center mb-2">
                            <span class="text-subtitle-1">Items</span>
                            <span class="text-caption text--secondary ml-2">
                                each item has the parts you print for it; changes save when you leave a field
                            </span>
                        </div>
                        <v-alert v-if="detail.items.length === 0" type="warning" dense text class="mb-2">
                            No items yet. Add the PO lines below.
                        </v-alert>

                        <v-card
                            v-for="item in detail.items"
                            :key="item.id"
                            outlined
                            class="mb-2 pa-2"
                            :class="{ 'po-warn-border': item.parts.length === 0 }">
                            <v-row v-if="itemEdits[item.id]" dense align="center">
                                <v-col cols="3" sm="1">
                                    <v-text-field
                                        v-model="itemEdits[item.id].line_no"
                                        type="number"
                                        label="Line"
                                        dense
                                        outlined
                                        hide-details
                                        @change="saveItemField(item, 'line_no')" />
                                </v-col>
                                <v-col cols="9" sm="2">
                                    <v-text-field
                                        v-model="itemEdits[item.id].sku"
                                        label="SKU"
                                        dense
                                        outlined
                                        hide-details
                                        @change="saveItemField(item, 'sku')" />
                                </v-col>
                                <v-col cols="12" sm="4">
                                    <v-text-field
                                        v-model="itemEdits[item.id].description"
                                        label="Description"
                                        dense
                                        outlined
                                        hide-details
                                        @change="saveItemField(item, 'description')" />
                                </v-col>
                                <v-col cols="4" sm="1">
                                    <v-text-field
                                        v-model="itemEdits[item.id].quantity"
                                        type="number"
                                        min="0"
                                        label="Qty"
                                        dense
                                        outlined
                                        hide-details
                                        @change="saveItemField(item, 'quantity')" />
                                </v-col>
                                <v-col cols="4" sm="1">
                                    <v-text-field
                                        v-model="itemEdits[item.id].uom"
                                        label="UOM"
                                        dense
                                        outlined
                                        hide-details
                                        @change="saveItemField(item, 'uom')" />
                                </v-col>
                                <v-col cols="4" sm="1">
                                    <v-text-field
                                        v-model="itemEdits[item.id].unit_price"
                                        type="number"
                                        label="Unit price"
                                        dense
                                        outlined
                                        hide-details
                                        @change="saveItemField(item, 'unit_price')" />
                                </v-col>
                                <v-col cols="8" sm="1">
                                    <v-text-field
                                        v-model="itemEdits[item.id].line_total"
                                        type="number"
                                        label="Total"
                                        dense
                                        outlined
                                        hide-details
                                        @change="saveItemField(item, 'line_total')" />
                                </v-col>
                                <v-col cols="4" sm="1" class="text-right">
                                    <v-btn x-small icon title="Remove item" @click="askRemoveItem(item)">
                                        <v-icon small>{{ mdiDelete }}</v-icon>
                                    </v-btn>
                                </v-col>
                            </v-row>

                            <!-- Parts of this item -->
                            <div class="d-flex align-center mt-1">
                                <v-btn x-small text @click="toggleExpanded(item.id)">
                                    <v-icon x-small left>{{ expanded[item.id] ? mdiChevronUp : mdiChevronDown }}</v-icon>
                                    Parts ({{ item.parts.length }})
                                </v-btn>
                                <template v-if="!expanded[item.id]">
                                    <v-chip
                                        v-for="p in item.parts"
                                        :key="'pc-' + p.id"
                                        x-small
                                        class="mr-1"
                                        @click="toggleExpanded(item.id)">
                                        {{ p.name }}
                                        <span v-if="p.qty_per_item !== 1" class="ml-1">×{{ p.qty_per_item }}</span>
                                    </v-chip>
                                    <v-chip v-if="item.parts.length === 0" x-small :color="warnColor" text-color="white">
                                        no parts
                                    </v-chip>
                                </template>
                            </div>
                            <div v-if="expanded[item.id]" class="pl-4 pt-1">
                                <div v-for="p in item.parts" :key="'p-' + p.id" class="d-flex align-center mb-1">
                                    <template v-if="partEdits[p.id]">
                                        <v-text-field
                                            v-model="partEdits[p.id].name"
                                            label="Part name"
                                            dense
                                            outlined
                                            hide-details
                                            class="mr-2"
                                            @change="savePart(p, 'name')" />
                                        <v-text-field
                                            v-model="partEdits[p.id].qty_per_item"
                                            type="number"
                                            min="1"
                                            label="Per item"
                                            dense
                                            outlined
                                            hide-details
                                            style="max-width: 110px"
                                            class="mr-2"
                                            @change="savePart(p, 'qty_per_item')" />
                                        <span class="text-caption text--secondary mr-2 text-no-wrap">= {{ p.required }} needed</span>
                                        <v-btn x-small icon title="Remove part" @click="removePart(p)">
                                            <v-icon small>{{ mdiClose }}</v-icon>
                                        </v-btn>
                                    </template>
                                </div>
                                <div class="d-flex align-center">
                                    <v-text-field
                                        v-model="newPart(item.id).name"
                                        label="New part name"
                                        dense
                                        outlined
                                        hide-details
                                        class="mr-2"
                                        @keyup.enter="addPart(item)" />
                                    <v-text-field
                                        v-model="newPart(item.id).qty"
                                        type="number"
                                        min="1"
                                        label="Per item"
                                        dense
                                        outlined
                                        hide-details
                                        style="max-width: 110px"
                                        class="mr-2" />
                                    <v-btn small outlined color="primary" :disabled="!newPart(item.id).name" @click="addPart(item)">
                                        <v-icon small left>{{ mdiPlus }}</v-icon>
                                        Add part
                                    </v-btn>
                                </div>
                            </div>
                        </v-card>

                        <!-- New item -->
                        <v-card outlined class="pa-2 mb-2">
                            <div class="text-caption text--secondary mb-1">Add item</div>
                            <v-row dense align="center">
                                <v-col cols="12" sm="3">
                                    <v-text-field v-model="newItem.sku" label="SKU" dense outlined hide-details />
                                </v-col>
                                <v-col cols="12" sm="5">
                                    <v-text-field v-model="newItem.description" label="Description" dense outlined hide-details />
                                </v-col>
                                <v-col cols="6" sm="2">
                                    <v-text-field
                                        v-model="newItem.quantity"
                                        type="number"
                                        min="0"
                                        label="Qty"
                                        dense
                                        outlined
                                        hide-details />
                                </v-col>
                                <v-col cols="6" sm="2">
                                    <v-btn
                                        small
                                        color="primary"
                                        outlined
                                        block
                                        :disabled="!newItem.sku && !newItem.description"
                                        @click="addItem">
                                        <v-icon small left>{{ mdiPlus }}</v-icon>
                                        Add
                                    </v-btn>
                                </v-col>
                            </v-row>
                        </v-card>
                    </v-col>
                </v-row>
            </v-card-text>

            <v-divider />
            <v-card-actions v-if="detail">
                <v-btn v-if="detail.po.status === 'draft'" text color="error" :disabled="pending > 0" @click="discardDialog = true">
                    Discard draft
                </v-btn>
                <v-spacer />
                <span v-if="detail.po.status === 'draft' && confirmBlocker" class="text-caption amber--text text--darken-2 mr-3">
                    {{ confirmBlocker }}
                </span>
                <v-btn text :disabled="pending > 0" @click="close">{{ detail.po.status === 'draft' ? 'Keep as draft' : 'Close' }}</v-btn>
                <v-btn
                    v-if="detail.po.status === 'draft'"
                    color="primary"
                    :loading="confirming"
                    :disabled="pending > 0 || !!confirmBlocker"
                    @click="confirm">
                    <v-icon small left>{{ mdiCheck }}</v-icon>
                    Confirm PO
                </v-btn>
            </v-card-actions>
        </v-card>

        <!-- After confirm: what next -->
        <v-dialog v-model="nextDialog" max-width="460" persistent>
            <v-card>
                <v-card-title>PO confirmed</v-card-title>
                <v-card-text>Start production now? You can also do this later from the PO.</v-card-text>
                <v-card-actions class="flex-wrap">
                    <v-btn text @click="finishNext(null)">Later</v-btn>
                    <v-spacer />
                    <v-btn text color="primary" @click="finishNext('link-job')">Link existing job</v-btn>
                    <v-btn color="primary" @click="finishNext('create-job')">Create job</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Remove item -->
        <v-dialog v-model="removeItemDialog" max-width="420">
            <v-card>
                <v-card-title>Remove item</v-card-title>
                <v-card-text>
                    Remove <strong>{{ removeItemTarget ? itemLabel(removeItemTarget) : '' }}</strong> and its parts?
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="removeItemDialog = false">Cancel</v-btn>
                    <v-btn color="error" @click="removeItem">Remove</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Discard draft -->
        <v-dialog v-model="discardDialog" max-width="420">
            <v-card>
                <v-card-title>Discard draft</v-card-title>
                <v-card-text>Delete this draft PO and its PDF? This cannot be undone.</v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="discardDialog = false">Cancel</v-btn>
                    <v-btn color="error" :loading="discarding" @click="discard">Delete</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-dialog>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { Prop, Watch } from 'vue-property-decorator'
import {
    mdiAccountPlus,
    mdiCheck,
    mdiChevronDown,
    mdiChevronUp,
    mdiClose,
    mdiDelete,
    mdiFilePdfBox,
    mdiPlus,
} from '@mdi/js'
import { FleetCustomer } from '@/store/fleet/jobs/types'
import {
    FleetPoDetail,
    FleetPoItem,
    FleetPoPart,
    PoAddress,
    PoAddressKey,
    PO_ADDRESS_KEYS,
} from '@/store/fleet/purchaseOrders/types'
import { itemLabel, poStatusColor, PO_WARN_COLOR } from '@/components/po/poFormat'

type ItemField = 'line_no' | 'sku' | 'description' | 'quantity' | 'uom' | 'unit_price' | 'line_total'
const NUMBER_ITEM_FIELDS: ItemField[] = ['line_no', 'quantity', 'unit_price', 'line_total']

interface ItemEdit {
    line_no: string
    sku: string
    description: string
    quantity: string
    uom: string
    unit_price: string
    line_total: string
}

function str(v: any): string {
    return v === null || v === undefined ? '' : String(v)
}

function emptyAddress(): Record<PoAddressKey, string> {
    const a = {} as Record<PoAddressKey, string>
    for (const k of PO_ADDRESS_KEYS) a[k] = ''
    return a
}

/**
 * Review + edit a PO (drafts right after upload, and later edits). Every field
 * saves on change (blur / enter) through the PATCH / item / part endpoints, so
 * there is no unsaved state to lose. Drafts get "Confirm PO", then a choice to
 * create or link a job (emitted as create-job / link-job with the detail).
 */
@Component
export default class PoEditDialog extends Vue {
    mdiAccountPlus = mdiAccountPlus
    mdiCheck = mdiCheck
    mdiChevronDown = mdiChevronDown
    mdiChevronUp = mdiChevronUp
    mdiClose = mdiClose
    mdiDelete = mdiDelete
    mdiFilePdfBox = mdiFilePdfBox
    mdiPlus = mdiPlus
    warnColor = PO_WARN_COLOR
    itemLabel = itemLabel

    @Prop({ type: Boolean, default: false }) value!: boolean
    @Prop({ type: Number, default: 0 }) poId!: number
    /** Detail already in hand (e.g. the POST /pos/extract response with duplicate_of). */
    @Prop({ type: Object, default: null }) initial!: FleetPoDetail | null

    detail: FleetPoDetail | null = null
    form: Record<string, any> = this.emptyForm()
    itemEdits: Record<number, ItemEdit> = {}
    partEdits: Record<number, { name: string; qty_per_item: string }> = {}
    newParts: Record<number, { name: string; qty: string }> = {}
    expanded: Record<number, boolean> = {}
    newItem = { sku: '', description: '', quantity: '1' }
    quickAdd = { show: false, name: '', saving: false }
    showPdf = true
    pending = 0
    savedOnce = false
    confirming = false
    error = ''
    nextDialog = false
    removeItemDialog = false
    removeItemTarget: FleetPoItem | null = null
    discardDialog = false
    discarding = false

    moneyFields = [
        { key: 'subtotal', label: 'Subtotal' },
        { key: 'tax_total', label: 'Tax' },
        { key: 'shipping_total', label: 'Shipping' },
        { key: 'total', label: 'Total' },
    ]
    addressFields = [
        { key: 'bill_to', label: 'Bill to' },
        { key: 'ship_to', label: 'Ship to' },
    ]
    addressKeys = PO_ADDRESS_KEYS

    get title(): string {
        if (!this.detail) return 'Purchase order'
        const n = this.detail.po.po_number
        return this.detail.po.status === 'draft' ? `Review PO ${n || '(no number)'}` : `Edit PO ${n || ''}`
    }

    get hasPdf(): boolean {
        return (this.detail?.documents.length ?? 0) > 0
    }

    get pdfVisible(): boolean {
        return this.hasPdf && this.showPdf && this.$vuetify.breakpoint.mdAndUp
    }

    get pdfUrl(): string {
        return this.detail ? this.$store.getters['fleet/purchaseOrders/documentUrl'](this.detail.po.id) : ''
    }

    get duplicates() {
        return this.initial?.po.id === this.poId ? this.initial?.duplicate_of ?? [] : []
    }

    get extractionError(): string | null {
        return this.initial?.po.id === this.poId ? this.initial?.extraction_error ?? null : null
    }

    get extractionWarnings(): string[] {
        const x = this.detail?.po.extraction
        const w = x?.warnings ?? []
        // The extraction error is already shown above as its own alert.
        return w.filter((m) => m !== this.extractionError)
    }

    get customerOptions() {
        return (this.$store.getters['fleet/customers/getCustomers'] as FleetCustomer[]).map((c) => ({
            text: c.name,
            value: c.id,
        }))
    }

    /** Mirrors POST /pos/{id}/confirm's checks so the button explains itself. */
    get confirmBlocker(): string {
        if (!this.detail) return ''
        if (!this.detail.po.po_number) return 'PO number is required'
        if (this.detail.items.length === 0) return 'add at least one item'
        if (this.detail.items.some((i) => i.parts.length === 0)) return 'every item needs at least one part'
        return ''
    }

    statusColor = poStatusColor

    emptyForm(): Record<string, any> {
        return {
            po_number: '',
            customer_id: null,
            buyer_name: '',
            vendor_name: '',
            order_date: '',
            due_date: '',
            currency: '',
            payment_terms: '',
            subtotal: '',
            tax_total: '',
            shipping_total: '',
            total: '',
            notes: '',
            bill_to: emptyAddress(),
            ship_to: emptyAddress(),
        }
    }

    @Watch('value')
    async onOpen(open: boolean) {
        if (!open) return
        this.error = ''
        this.detail = null
        this.savedOnce = false
        this.pending = 0
        this.itemEdits = {}
        this.partEdits = {}
        this.newParts = {}
        this.expanded = {}
        this.newItem = { sku: '', description: '', quantity: '1' }
        this.quickAdd = { show: false, name: '', saving: false }
        this.showPdf = true
        this.$store.dispatch('fleet/customers/loadCustomers').catch(() => {})
        try {
            const d: FleetPoDetail =
                this.initial && this.initial.po.id === this.poId
                    ? this.initial
                    : await this.$store.dispatch('fleet/purchaseOrders/fetchPo', this.poId)
            this.setDetail(d, true)
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        }
    }

    /** Take a fresh detail. Header form is only (re)filled on open so typing is never clobbered. */
    setDetail(d: FleetPoDetail, fillForm = false) {
        this.detail = d
        if (fillForm) {
            const po = d.po
            const f = this.emptyForm()
            for (const k of Object.keys(f)) {
                if (k === 'bill_to' || k === 'ship_to') {
                    const src = (po as any)[k] ?? {}
                    for (const ak of PO_ADDRESS_KEYS) f[k][ak] = str(src[ak])
                } else if (k === 'customer_id') {
                    f[k] = po.customer_id
                } else if (k === 'order_date' || k === 'due_date') {
                    f[k] = po[k] ? String(po[k]).slice(0, 10) : ''
                } else {
                    f[k] = str((po as any)[k])
                }
            }
            this.form = f
        }
        // Edits for rows we have not seen yet; existing rows keep what the user typed.
        const items: Record<number, ItemEdit> = {}
        const parts: Record<number, { name: string; qty_per_item: string }> = {}
        for (const it of d.items) {
            items[it.id] = this.itemEdits[it.id] ?? {
                line_no: str(it.line_no),
                sku: str(it.sku),
                description: str(it.description),
                quantity: str(it.quantity),
                uom: str(it.uom),
                unit_price: str(it.unit_price),
                line_total: str(it.line_total),
            }
            if (fillForm && it.parts.length !== 1) Vue.set(this.expanded, it.id, true)
            if (!this.newParts[it.id]) Vue.set(this.newParts, it.id, { name: '', qty: '1' })
            for (const p of it.parts) {
                parts[p.id] = this.partEdits[p.id] ?? { name: p.name, qty_per_item: str(p.qty_per_item) }
            }
        }
        this.itemEdits = items
        this.partEdits = parts
    }

    /** Run one save; the detail it returns becomes current. */
    async run(fn: () => Promise<FleetPoDetail>): Promise<boolean> {
        this.pending++
        this.error = ''
        try {
            const d = await fn()
            this.setDetail(d)
            this.savedOnce = true
            return true
        } catch (e: any) {
            this.error = e?.message ?? String(e)
            return false
        } finally {
            this.pending--
        }
    }

    toNumber(v: any): number | null {
        if (v === null || v === undefined || String(v).trim() === '') return null
        const n = Number(v)
        return isNaN(n) ? null : n
    }

    /** Native date inputs emit `input` only for a complete date or a clear, so save right away. */
    saveDate(field: 'order_date' | 'due_date', val: string) {
        const v = (val ?? '').trim()
        if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return
        const cur = this.detail?.po[field] ? String(this.detail.po[field]).slice(0, 10) : ''
        if (v === cur) return
        this.saveField(field, v)
    }

    saveField(field: string, val: any) {
        if (!this.detail) return
        const id = this.detail.po.id
        const v = typeof val === 'string' ? val.trim() : val
        this.run(() => this.$store.dispatch('fleet/purchaseOrders/updatePo', { id, [field]: v }))
    }

    cleanAddress(a: Record<PoAddressKey, string>): Partial<PoAddress> {
        const out: Partial<PoAddress> = {}
        for (const k of PO_ADDRESS_KEYS) out[k] = (a[k] ?? '').trim() || null
        return out
    }

    addressSummary(a: Record<PoAddressKey, string>): string {
        return [a.company || a.name, a.city, a.country].filter((x) => !!x).join(', ')
    }

    addressLabel(k: string): string {
        return (
            {
                name: 'Name',
                company: 'Company',
                address1: 'Address',
                address2: 'Address 2',
                city: 'City',
                province: 'Province / state',
                zip: 'ZIP / postal code',
                country: 'Country',
                phone: 'Phone',
            } as Record<string, string>
        )[k] ?? k
    }

    async saveQuickCustomer() {
        this.quickAdd.saving = true
        try {
            const c: FleetCustomer = await this.$store.dispatch('fleet/customers/createCustomer', {
                name: this.quickAdd.name.trim(),
            })
            this.form.customer_id = c.id
            this.quickAdd = { show: false, name: '', saving: false }
            this.saveField('customer_id', c.id)
        } catch (e: any) {
            this.error = e?.message ?? String(e)
            this.quickAdd.saving = false
        }
    }

    // -- Items ---------------------------------------------------------------------

    saveItemField(item: FleetPoItem, field: ItemField) {
        if (!this.detail) return
        const raw = this.itemEdits[item.id]?.[field] ?? ''
        let v: any = String(raw).trim()
        if (NUMBER_ITEM_FIELDS.includes(field)) {
            v = this.toNumber(v)
            if (field === 'quantity') {
                if (v === null || v < 0) {
                    this.error = 'Quantity must be 0 or more'
                    return
                }
                v = Math.floor(v)
            }
            if (field === 'line_no' && v !== null) v = Math.floor(v)
        } else {
            v = v || null
        }
        const poId = this.detail.po.id
        this.run(() => this.$store.dispatch('fleet/purchaseOrders/updateItem', { poId, itemId: item.id, [field]: v }))
    }

    async addItem() {
        if (!this.detail) return
        const poId = this.detail.po.id
        const qty = Math.max(0, Math.floor(Number(this.newItem.quantity) || 0))
        const ok = await this.run(() =>
            this.$store.dispatch('fleet/purchaseOrders/addItem', {
                poId,
                sku: this.newItem.sku.trim() || null,
                description: this.newItem.description.trim() || null,
                quantity: qty,
            })
        )
        if (ok) this.newItem = { sku: '', description: '', quantity: '1' }
    }

    askRemoveItem(item: FleetPoItem) {
        this.removeItemTarget = item
        this.removeItemDialog = true
    }

    async removeItem() {
        if (!this.detail || !this.removeItemTarget) return
        const poId = this.detail.po.id
        const itemId = this.removeItemTarget.id
        this.removeItemDialog = false
        await this.run(() => this.$store.dispatch('fleet/purchaseOrders/deleteItem', { poId, itemId }))
    }

    toggleExpanded(itemId: number) {
        Vue.set(this.expanded, itemId, !this.expanded[itemId])
    }

    // -- Parts ---------------------------------------------------------------------

    /** New-part inputs of one item (created in setDetail for every item). */
    newPart(itemId: number) {
        return this.newParts[itemId] ?? { name: '', qty: '1' }
    }

    savePart(part: FleetPoPart, field: 'name' | 'qty_per_item') {
        if (!this.detail) return
        const edit = this.partEdits[part.id]
        if (!edit) return
        const poId = this.detail.po.id
        if (field === 'name') {
            const name = edit.name.trim()
            if (!name) {
                this.error = 'Part name cannot be empty'
                edit.name = part.name
                return
            }
            this.run(() => this.$store.dispatch('fleet/purchaseOrders/updatePart', { poId, partId: part.id, name }))
        } else {
            const q = Math.floor(Number(edit.qty_per_item))
            if (!(q >= 1)) {
                this.error = 'Parts per item must be 1 or more'
                edit.qty_per_item = str(part.qty_per_item)
                return
            }
            this.run(() =>
                this.$store.dispatch('fleet/purchaseOrders/updatePart', { poId, partId: part.id, qty_per_item: q })
            )
        }
    }

    async addPart(item: FleetPoItem) {
        if (!this.detail) return
        const np = this.newPart(item.id)
        const name = np.name.trim()
        if (!name) return
        const poId = this.detail.po.id
        const ok = await this.run(() =>
            this.$store.dispatch('fleet/purchaseOrders/addPart', {
                poId,
                itemId: item.id,
                name,
                qty_per_item: Math.max(1, Math.floor(Number(np.qty) || 1)),
            })
        )
        if (ok) Vue.set(this.newParts, item.id, { name: '', qty: '1' })
    }

    removePart(part: FleetPoPart) {
        if (!this.detail) return
        const poId = this.detail.po.id
        this.run(() => this.$store.dispatch('fleet/purchaseOrders/deletePart', { poId, partId: part.id }))
    }

    // -- Confirm / discard -----------------------------------------------------------

    async confirm() {
        if (!this.detail) return
        this.confirming = true
        const id = this.detail.po.id
        const ok = await this.run(() => this.$store.dispatch('fleet/purchaseOrders/confirmPo', { id }))
        this.confirming = false
        if (ok) this.nextDialog = true
    }

    finishNext(action: 'create-job' | 'link-job' | null) {
        this.nextDialog = false
        if (action && this.detail) this.$emit(action, this.detail)
        this.close()
    }

    async discard() {
        if (!this.detail) return
        this.discarding = true
        try {
            await this.$store.dispatch('fleet/purchaseOrders/deletePo', this.detail.po.id)
            this.discardDialog = false
            this.$emit('deleted', this.detail.po.id)
            this.close()
        } catch (e: any) {
            this.error = e?.message ?? String(e)
            this.discardDialog = false
        } finally {
            this.discarding = false
        }
    }

    close() {
        if (this.detail) this.$emit('closed', this.detail.po.id)
        this.$emit('input', false)
    }
}
</script>

<style scoped>
.po-pdf-col {
    position: sticky;
    top: 0;
    align-self: flex-start;
}
.po-pdf {
    width: 100%;
    height: calc(100vh - 220px);
    min-height: 480px;
    border: 1px solid rgba(128, 128, 128, 0.4);
    border-radius: 4px;
    background: #fff;
}
.po-warn-border {
    border-color: #ffa000 !important;
}
.po-addr-panels >>> .v-expansion-panel-header {
    min-height: 36px;
}
</style>
