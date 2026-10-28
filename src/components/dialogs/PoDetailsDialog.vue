<template>
    <v-dialog :value="value" max-width="1200" scrollable @input="$emit('input', $event)">
        <v-card v-if="detail">
            <v-card-title class="d-flex align-center flex-wrap">
                <span class="mr-3">PO {{ detail.po.po_number || '#' + detail.po.id }}</span>
                <v-chip small :color="statusColor(detail.po.status)" text-color="white" class="mr-2">
                    {{ detail.po.status }}
                </v-chip>
                <v-chip v-if="detail.totals.fulfilled" small color="green" text-color="white" class="mr-2">
                    <v-icon x-small left>{{ mdiCheckCircle }}</v-icon>
                    fulfilled
                </v-chip>
                <v-chip v-if="detail.warnings.length" small :color="warnColor" text-color="white" class="mr-2">
                    <v-icon x-small left>{{ mdiAlertOutline }}</v-icon>
                    {{ detail.warnings.length }} unlinked
                </v-chip>
                <v-spacer />
                <v-btn small text @click="$emit('edit', detail)">
                    <v-icon small left>{{ mdiPencil }}</v-icon>
                    {{ detail.po.status === 'draft' ? 'Review' : 'Edit' }}
                </v-btn>
                <v-btn v-if="detail.documents.length" small text @click="openPdf">
                    <v-icon small left>{{ mdiFilePdfBox }}</v-icon>
                    PDF
                </v-btn>
                <v-menu offset-y>
                    <template #activator="{ on }">
                        <v-btn small text v-on="on">
                            Status
                            <v-icon small right>{{ mdiChevronDown }}</v-icon>
                        </v-btn>
                    </template>
                    <v-list dense>
                        <v-list-item v-for="t in statusTransitions" :key="t.value" @click="setStatus(t.value)">
                            <v-list-item-title>{{ t.text }}</v-list-item-title>
                        </v-list-item>
                        <v-list-item v-if="detail.po.status === 'draft'" @click="deleteDialog = true">
                            <v-list-item-title class="error--text">Delete draft</v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-menu>
                <v-btn icon @click="$emit('input', false)"><v-icon>{{ mdiClose }}</v-icon></v-btn>
            </v-card-title>

            <v-card-text>
                <v-alert v-if="error" type="error" dense dismissible class="mb-3" @input="error = ''">{{ error }}</v-alert>

                <v-row dense class="mb-1">
                    <v-col cols="6" md="3">
                        <div class="text-caption text--secondary">Customer</div>
                        {{ detail.po.customer_name || detail.po.buyer_name || '—' }}
                    </v-col>
                    <v-col cols="6" md="2">
                        <div class="text-caption text--secondary">Order date</div>
                        {{ formatDate(detail.po.order_date) }}
                    </v-col>
                    <v-col cols="6" md="2">
                        <div class="text-caption text--secondary">Due</div>
                        <span :class="dueClass">{{ formatDate(detail.po.due_date) }}</span>
                    </v-col>
                    <v-col cols="6" md="2">
                        <div class="text-caption text--secondary">Total</div>
                        {{ formatMoney(detail.po.total, detail.po.currency) }}
                    </v-col>
                    <v-col cols="12" md="3">
                        <div class="text-caption text--secondary">Progress</div>
                        <div class="d-flex align-center">
                            <v-progress-linear
                                :value="100 * detail.totals.progress"
                                height="8"
                                rounded
                                color="green"
                                class="mr-2" />
                            <span class="text-caption text-no-wrap">
                                {{ detail.totals.units_complete }} / {{ detail.totals.units_required }} units
                            </span>
                        </div>
                    </v-col>
                </v-row>

                <v-tabs v-model="tab" background-color="transparent" class="mb-2">
                    <v-tab>Fulfillment</v-tab>
                    <v-tab>
                        Jobs
                        <v-chip x-small class="ml-1">{{ detail.jobs.length }}</v-chip>
                    </v-tab>
                    <v-tab>Timeline</v-tab>
                </v-tabs>

                <v-tabs-items v-model="tab">
                    <!-- Fulfillment -->
                    <v-tab-item>
                        <v-alert v-if="detail.warnings.length" type="warning" dense text :color="warnColor" class="mb-3">
                            <div class="font-weight-medium mb-1">Not linked (output will not count until linked):</div>
                            <ul class="mb-0">
                                <li v-for="(w, i) in detail.warnings" :key="'w-' + i">{{ w.message }}</li>
                            </ul>
                        </v-alert>
                        <div v-if="detail.items.length === 0" class="text--secondary">No items.</div>

                        <v-card
                            v-for="item in detail.items"
                            :key="item.id"
                            outlined
                            class="mb-2 pa-2"
                            :class="{ 'po-warn-border': item.tracking !== 'full' }">
                            <div class="d-flex align-center flex-wrap">
                                <span class="font-weight-medium mr-2">{{ itemLabel(item) }}</span>
                                <span v-if="item.sku && item.description" class="text--secondary text-truncate mr-2">
                                    {{ item.description }}
                                </span>
                                <v-spacer />
                                <span class="mr-2 text-no-wrap">
                                    <strong>{{ item.units_complete == null ? '—' : item.units_complete }}</strong>
                                    / {{ item.quantity }} {{ item.uom || 'units' }}
                                    <span v-if="item.units_surplus" class="blue--text">(+{{ item.units_surplus }})</span>
                                </span>
                                <v-chip
                                    x-small
                                    :color="item.tracking === 'full' ? 'green' : warnColor"
                                    text-color="white"
                                    class="mr-1">
                                    {{ trackingLabel(item.tracking) }}
                                </v-chip>
                                <v-chip v-if="item.fulfilled" x-small color="green" text-color="white">done</v-chip>
                            </div>

                            <div v-if="item.parts.length === 0" class="po-warn-text text-caption mt-1">
                                No parts: add one in Edit.
                            </div>
                            <div
                                v-for="p in item.parts"
                                :key="p.id"
                                class="po-part mt-2 pl-3"
                                :class="{ 'po-part--untracked': !p.tracked }">
                                <div class="d-flex align-center flex-wrap">
                                    <span class="mr-2">{{ p.name }}</span>
                                    <span v-if="p.qty_per_item !== 1" class="text-caption text--secondary mr-2">
                                        ×{{ p.qty_per_item }} per item
                                    </span>
                                    <v-spacer />
                                    <span class="text-caption mr-2 text-no-wrap">
                                        <strong>{{ p.good }}</strong>
                                        / {{ p.required }}
                                        <span v-if="p.surplus" class="blue--text">(+{{ p.surplus }})</span>
                                        <span v-if="p.printing" class="blue--text"> · {{ p.printing }} printing</span>
                                        <span v-if="p.qc_failed" class="error--text"> · {{ p.qc_failed }} QC fail</span>
                                        <span v-if="p.planned_open" class="text--secondary"> · {{ p.planned_open }} queued</span>
                                        <span v-if="p.tracked && p.unscheduled" class="po-warn-text">
                                            · {{ p.unscheduled }} unscheduled
                                        </span>
                                    </span>
                                    <v-btn
                                        v-if="!p.tracked"
                                        x-small
                                        outlined
                                        :color="warnColor"
                                        class="mr-1"
                                        @click="linkGcodeShortcut">
                                        <v-icon x-small left>{{ mdiLinkVariant }}</v-icon>
                                        Link gcode
                                    </v-btn>
                                    <v-btn v-if="p.tracked" x-small text @click="toggleBreakdown(p.id)">
                                        {{ breakdown[p.id] ? 'Hide' : 'Details' }}
                                    </v-btn>
                                </div>
                                <div class="run-bar mt-1" :title="partBarTitle(p)">
                                    <div class="seg seg-passed" :style="{ width: bar(p).good + '%' }" />
                                    <div class="seg seg-qcfail" :style="{ width: bar(p).qcFailed + '%' }" />
                                    <div class="seg seg-active" :style="{ width: bar(p).printing + '%' }" />
                                    <div class="seg seg-remaining" :style="{ width: bar(p).remaining + '%' }" />
                                </div>
                                <div v-if="bar(p).surplus" class="po-surplus-mark text-caption blue--text">
                                    surplus +{{ p.surplus }}
                                </div>
                                <div v-if="!p.tracked" class="po-warn-text text-caption">
                                    No gcode produces this part yet.
                                </div>

                                <div v-if="breakdown[p.id]" class="mt-2 mb-1">
                                    <v-row dense>
                                        <v-col cols="12" md="4">
                                            <div class="text-caption text--secondary">By job</div>
                                            <div v-for="j in p.by_job" :key="'bj-' + j.job_id" class="text-caption">
                                                <a @click="openJob(j.job_id)">{{ j.job_name || '#' + j.job_id }}</a>
                                                ({{ (j.job_status || '').replace('_', ' ') }}): {{ j.good }} good
                                                <span v-if="j.printing">· {{ j.printing }} printing</span>
                                                <span v-if="j.planned_open">· {{ j.planned_open }} queued</span>
                                                <span v-if="j.qc_failed" class="error--text">· {{ j.qc_failed }} QC fail</span>
                                            </div>
                                        </v-col>
                                        <v-col cols="12" md="4">
                                            <div class="text-caption text--secondary">By gcode</div>
                                            <div v-for="g in p.by_gcode" :key="'bg-' + g.job_item_id" class="text-caption">
                                                <span :title="g.gcode_filename || ''">{{ baseName(g.gcode_filename) }}</span>
                                                ({{ g.qty_per_run }}/plate): {{ g.good }} good
                                                <span v-if="g.printing">· {{ g.printing }} printing</span>
                                                <span v-if="g.failed" class="error--text">· {{ g.failed }} failed</span>
                                            </div>
                                        </v-col>
                                        <v-col cols="12" md="4">
                                            <div class="text-caption text--secondary">By printer</div>
                                            <div v-if="p.by_printer.length === 0" class="text-caption text--secondary">—</div>
                                            <div v-for="pr in p.by_printer" :key="'bp-' + pr.printer_hostname" class="text-caption">
                                                {{ pr.printer_hostname }}: {{ pr.good }} good
                                                <span v-if="pr.printing">· {{ pr.printing }} printing</span>
                                                <span v-if="pr.qc_failed" class="error--text">· {{ pr.qc_failed }} QC fail</span>
                                            </div>
                                        </v-col>
                                    </v-row>
                                </div>
                            </div>
                        </v-card>
                    </v-tab-item>

                    <!-- Jobs -->
                    <v-tab-item>
                        <div class="d-flex align-center mb-2">
                            <v-spacer />
                            <v-btn small outlined color="primary" class="mr-2" :disabled="!canAddJobs" @click="$emit('link-job', detail)">
                                <v-icon small left>{{ mdiLinkVariant }}</v-icon>
                                Link existing job
                            </v-btn>
                            <v-btn small color="primary" :disabled="!canAddJobs" @click="$emit('create-job', detail)">
                                <v-icon small left>{{ mdiPlus }}</v-icon>
                                Create job for this PO
                            </v-btn>
                        </div>
                        <div v-if="detail.jobs.length === 0" class="text--secondary">No jobs linked yet.</div>
                        <v-card
                            v-for="job in detail.jobs"
                            :key="job.id"
                            outlined
                            class="mb-2 pa-2"
                            :class="{ 'po-warn-border': job.unlinked_gcodes > 0 }">
                            <div class="d-flex align-center flex-wrap">
                                <a class="font-weight-medium mr-2" @click="openJob(job.id)">{{ job.name }}</a>
                                <v-chip x-small :color="jobStatusColor(job.status)" text-color="white" class="mr-2">
                                    {{ job.status.replace('_', ' ') }}
                                </v-chip>
                                <v-chip v-if="job.unlinked_gcodes" x-small :color="warnColor" text-color="white" class="mr-2">
                                    {{ job.unlinked_gcodes }} gcode{{ job.unlinked_gcodes === 1 ? '' : 's' }} without part
                                </v-chip>
                                <v-spacer />
                                <span class="text-caption mr-2">
                                    {{ job.runs_done }} / {{ job.runs_total }} runs
                                    <span v-if="job.runs_active" class="blue--text">· {{ job.runs_active }} printing</span>
                                    <span v-if="job.runs_failed" class="error--text">· {{ job.runs_failed }} failed</span>
                                </span>
                                <v-menu offset-y>
                                    <template #activator="{ on }">
                                        <v-btn x-small icon v-on="on"><v-icon small>{{ mdiDotsVertical }}</v-icon></v-btn>
                                    </template>
                                    <v-list dense>
                                        <v-list-item @click="openJob(job.id)"><v-list-item-title>Open job</v-list-item-title></v-list-item>
                                        <v-list-item v-if="isOpenJob(job.status)" @click="askEnd(job)">
                                            <v-list-item-title>End job early</v-list-item-title>
                                        </v-list-item>
                                        <v-list-item @click="askUnlink(job)">
                                            <v-list-item-title class="error--text">Unlink from PO</v-list-item-title>
                                        </v-list-item>
                                    </v-list>
                                </v-menu>
                            </div>
                            <v-progress-linear
                                :value="job.runs_total ? (100 * job.runs_done) / job.runs_total : 0"
                                :buffer-value="job.runs_total ? (100 * (job.runs_done + job.runs_active)) / job.runs_total : 0"
                                height="6"
                                rounded
                                color="green"
                                class="my-1" />
                            <div v-for="g in job.gcodes" :key="g.job_item_id" class="d-flex align-center flex-wrap mt-1">
                                <v-icon x-small class="mr-1">{{ mdiFile }}</v-icon>
                                <span class="text-caption mr-2 text-truncate" :title="g.gcode_filename || ''" style="max-width: 360px">
                                    {{ baseName(g.gcode_filename) }}
                                </span>
                                <span class="text-caption text--secondary mr-2">{{ g.success }} done</span>
                                <v-chip
                                    v-for="pl in g.parts"
                                    :key="'gp-' + g.job_item_id + '-' + pl.part_id"
                                    x-small
                                    class="mr-1"
                                    title="Edit parts"
                                    @click="editLinks(g)">
                                    {{ pl.qty_per_run }}× {{ pl.part_name }}
                                </v-chip>
                                <v-chip
                                    v-if="g.parts.length === 0"
                                    x-small
                                    :color="warnColor"
                                    text-color="white"
                                    title="Link this gcode to PO parts"
                                    @click="editLinks(g)">
                                    <v-icon x-small left>{{ mdiAlertOutline }}</v-icon>
                                    no part
                                </v-chip>
                                <v-btn v-else x-small icon title="Edit parts" @click="editLinks(g)">
                                    <v-icon x-small>{{ mdiPencil }}</v-icon>
                                </v-btn>
                            </div>
                        </v-card>
                    </v-tab-item>

                    <!-- Timeline -->
                    <v-tab-item>
                        <v-progress-linear v-if="timelineLoading && timeline.length === 0" indeterminate class="mb-2" />
                        <div v-if="!timelineLoading && timeline.length === 0" class="text--secondary">No events yet.</div>
                        <v-timeline dense align-top class="po-timeline">
                            <v-timeline-item
                                v-for="(e, i) in timeline"
                                :key="'t-' + i + '-' + e.at + '-' + e.kind"
                                small
                                :color="view(e).color"
                                :icon="iconFor(view(e).icon)">
                                <div class="d-flex flex-wrap align-baseline">
                                    <span class="text-caption text--secondary mr-2 text-no-wrap">{{ formatDateTime(e.at) }}</span>
                                    <span class="text-body-2">{{ view(e).text }}</span>
                                    <span v-if="e.operator_name" class="text-caption text--secondary ml-2">· {{ e.operator_name }}</span>
                                </div>
                            </v-timeline-item>
                        </v-timeline>
                        <div v-if="timelineMore" class="text-center">
                            <v-btn small text :loading="timelineLoading" @click="loadTimeline(true)">Load more</v-btn>
                        </div>
                    </v-tab-item>
                </v-tabs-items>
            </v-card-text>
        </v-card>
        <v-card v-else>
            <v-card-text class="text-center pa-6"><v-progress-circular indeterminate /></v-card-text>
        </v-card>

        <gcode-parts-edit-dialog
            v-model="linksDialog"
            :job-id="linksTarget ? linksTarget.job_id : 0"
            :item-id="linksTarget ? linksTarget.job_item_id : 0"
            :gcode-filename="linksTarget ? linksTarget.gcode_filename || '' : ''"
            :links="linksTarget ? linksTarget.parts : []"
            :options="partOptions"
            @saved="reload" />

        <v-dialog v-model="endDialog" max-width="460">
            <v-card>
                <v-card-title>End job early</v-card-title>
                <v-card-text>
                    End <strong>{{ actionJob ? actionJob.name : '' }}</strong> now? Queued runs are cancelled and the job is
                    closed as complete. Prints already running finish and still count toward the PO.
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="endDialog = false">Cancel</v-btn>
                    <v-btn color="orange" dark :loading="busy" @click="doEnd">End job</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="unlinkDialog" max-width="460">
            <v-card>
                <v-card-title>Unlink job</v-card-title>
                <v-card-text>
                    Unlink <strong>{{ actionJob ? actionJob.name : '' }}</strong> from this PO? Its gcode-to-part links are
                    removed and its output no longer counts here. The job itself keeps running.
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="unlinkDialog = false">Cancel</v-btn>
                    <v-btn color="error" :loading="busy" @click="doUnlink">Unlink</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="deleteDialog" max-width="420">
            <v-card>
                <v-card-title>Delete draft</v-card-title>
                <v-card-text>Delete this draft PO and its PDF? This cannot be undone.</v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="deleteDialog = false">Cancel</v-btn>
                    <v-btn color="error" :loading="busy" @click="doDelete">Delete</v-btn>
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
    mdiAlertCircle,
    mdiAlertOutline,
    mdiCancel,
    mdiCheck,
    mdiCheckCircle,
    mdiChevronDown,
    mdiClose,
    mdiDelete,
    mdiDotsVertical,
    mdiFile,
    mdiFilePdfBox,
    mdiLinkVariant,
    mdiLinkVariantOff,
    mdiPencil,
    mdiPlus,
    mdiPrinter3d,
    mdiRobotOutline,
    mdiStopCircleOutline,
    mdiSwapHorizontal,
    mdiFileDocumentOutline,
    mdiCircleSmall,
    mdiMagnifyClose,
} from '@mdi/js'
import GcodePartsEditDialog from '@/components/po/GcodePartsEditDialog.vue'
import {
    FleetPoDetail,
    FleetPoGcode,
    FleetPoJob,
    FleetPoPart,
    FleetPoTimelineEntry,
    PoItemTracking,
    PoStatus,
} from '@/store/fleet/purchaseOrders/types'
import {
    PO_WARN_COLOR,
    baseName,
    itemLabel,
    partBar,
    poPartOptions,
    poStatusColor,
    timelineView,
    PoPartOption,
    TimelineView,
} from '@/components/po/poFormat'

const TIMELINE_PAGE = 100

const TIMELINE_ICONS: Record<string, string> = {
    create: mdiFileDocumentOutline,
    extract: mdiRobotOutline,
    error: mdiAlertCircle,
    edit: mdiPencil,
    confirm: mdiCheck,
    status: mdiSwapHorizontal,
    add: mdiPlus,
    remove: mdiDelete,
    link: mdiLinkVariant,
    unlink: mdiLinkVariantOff,
    end: mdiStopCircleOutline,
    print: mdiPrinter3d,
    success: mdiCheckCircle,
    cancel: mdiCancel,
    qc: mdiMagnifyClose,
    other: mdiCircleSmall,
}

/**
 * PO details: fulfillment per item/part, linked jobs (gcode -> part links,
 * end early, unlink) and the timeline. Shows fleet/purchaseOrders current;
 * the page keeps it fresh on pos_updated / jobs_updated.
 */
@Component({ components: { GcodePartsEditDialog } })
export default class PoDetailsDialog extends Vue {
    mdiAlertOutline = mdiAlertOutline
    mdiCheckCircle = mdiCheckCircle
    mdiChevronDown = mdiChevronDown
    mdiClose = mdiClose
    mdiDotsVertical = mdiDotsVertical
    mdiFile = mdiFile
    mdiFilePdfBox = mdiFilePdfBox
    mdiLinkVariant = mdiLinkVariant
    mdiPencil = mdiPencil
    mdiPlus = mdiPlus
    warnColor = PO_WARN_COLOR

    itemLabel = itemLabel
    baseName = baseName
    statusColor = poStatusColor

    @Prop({ type: Boolean, default: false }) value!: boolean

    tab = 0
    error = ''
    busy = false
    breakdown: Record<number, boolean> = {}

    timeline: FleetPoTimelineEntry[] = []
    timelineLoading = false
    timelineMore = false
    private timelinePoId: number | null = null

    linksDialog = false
    linksTarget: FleetPoGcode | null = null
    endDialog = false
    unlinkDialog = false
    deleteDialog = false
    actionJob: FleetPoJob | null = null

    get detail(): FleetPoDetail | null {
        return this.$store.getters['fleet/purchaseOrders/getCurrent']
    }

    get partOptions(): PoPartOption[] {
        return poPartOptions(this.detail)
    }

    get canAddJobs(): boolean {
        return !!this.detail && this.detail.po.status !== 'cancelled'
    }

    get statusTransitions(): { text: string; value: PoStatus }[] {
        const s = this.detail?.po.status
        const t: { text: string; value: PoStatus }[] = []
        if (s === 'open') t.push({ text: 'Close (done)', value: 'closed' })
        if (s === 'closed' || s === 'cancelled') t.push({ text: 'Reopen', value: 'open' })
        if (s !== 'cancelled') t.push({ text: 'Cancel PO', value: 'cancelled' })
        return t
    }

    get dueClass(): string {
        const po = this.detail?.po
        if (!po?.due_date || po.status === 'closed' || po.status === 'cancelled' || this.detail?.totals.fulfilled)
            return ''
        const ms = new Date(`${po.due_date.slice(0, 10)}T23:59:59`).getTime() - Date.now()
        if (ms < 0) return 'error--text font-weight-bold'
        if (ms < 3 * 86400000) return 'orange--text font-weight-bold'
        return ''
    }

    @Watch('value')
    onOpen(open: boolean) {
        if (!open) return
        this.tab = 0
        this.error = ''
        this.breakdown = {}
        this.timeline = []
        this.timelinePoId = null
        this.timelineMore = false
    }

    @Watch('tab')
    onTab(tab: number) {
        if (tab === 2 && this.detail && this.timelinePoId !== this.detail.po.id) this.loadTimeline(false)
    }

    /** Detail refreshed (PO edit, run finished...): refresh the first timeline page if it is showing. */
    @Watch('detail')
    onDetail(d: FleetPoDetail | null, old: FleetPoDetail | null) {
        if (!d || !this.value) return
        if (old && old.po.id !== d.po.id) {
            this.timeline = []
            this.timelinePoId = null
        }
        // Skip while the operator has paged back with "Load more" (a refresh would drop those pages).
        if (this.tab === 2 && this.timeline.length <= TIMELINE_PAGE) this.loadTimeline(false)
    }

    view(e: FleetPoTimelineEntry): TimelineView {
        return timelineView(e, (id) => this.partOptions.find((p) => p.part_id === id)?.name ?? null)
    }

    iconFor(key: string): string {
        return TIMELINE_ICONS[key] ?? mdiCircleSmall
    }

    async loadTimeline(more: boolean) {
        if (!this.detail || this.timelineLoading) return
        const id = this.detail.po.id
        this.timelineLoading = true
        try {
            const before = more && this.timeline.length ? this.timeline[this.timeline.length - 1].at : null
            const rows: FleetPoTimelineEntry[] = await this.$store.dispatch('fleet/purchaseOrders/loadTimeline', {
                id,
                limit: TIMELINE_PAGE,
                before,
            })
            this.timeline = more ? [...this.timeline, ...rows] : rows
            this.timelineMore = rows.length >= TIMELINE_PAGE
            this.timelinePoId = id
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        } finally {
            this.timelineLoading = false
        }
    }

    async reload() {
        if (!this.detail) return
        try {
            await this.$store.dispatch('fleet/purchaseOrders/loadPo', this.detail.po.id)
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        }
    }

    bar(p: FleetPoPart) {
        return partBar(p)
    }

    partBarTitle(p: FleetPoPart): string {
        return `${p.good} good · ${p.qc_failed} QC failed · ${p.printing} printing · ${p.remaining} remaining${
            p.surplus ? ` · +${p.surplus} surplus` : ''
        }`
    }

    trackingLabel(t: PoItemTracking): string {
        return { none: 'not tracked', partial: 'partly tracked', full: 'tracked' }[t] ?? t
    }

    toggleBreakdown(partId: number) {
        Vue.set(this.breakdown, partId, !this.breakdown[partId])
    }

    /** Untracked part: map it on an existing job's gcode, or link / create a job. */
    linkGcodeShortcut() {
        if (!this.detail) return
        if (this.detail.jobs.length) this.tab = 1
        else this.$emit('link-job', this.detail)
    }

    isOpenJob(s: string): boolean {
        return s === 'pending' || s === 'in_progress' || s === 'on_hold'
    }

    jobStatusColor(s: string) {
        return { pending: 'grey', in_progress: 'blue', on_hold: 'orange', complete: 'green', cancelled: 'red' }[s] ?? 'grey'
    }

    openJob(jobId: number) {
        this.$emit('input', false)
        this.$router.push({ path: '/jobs', query: { openJob: String(jobId) } }).catch(() => {})
    }

    openPdf() {
        if (!this.detail) return
        window.open(this.$store.getters['fleet/purchaseOrders/documentUrl'](this.detail.po.id), '_blank')
    }

    editLinks(g: FleetPoGcode) {
        this.linksTarget = g
        this.linksDialog = true
    }

    async setStatus(status: PoStatus) {
        if (!this.detail) return
        this.error = ''
        try {
            await this.$store.dispatch('fleet/purchaseOrders/setPoStatus', { id: this.detail.po.id, status })
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        }
    }

    askEnd(job: FleetPoJob) {
        this.actionJob = job
        this.endDialog = true
    }

    askUnlink(job: FleetPoJob) {
        this.actionJob = job
        this.unlinkDialog = true
    }

    async doEnd() {
        if (!this.actionJob) return
        this.busy = true
        this.error = ''
        try {
            await this.$store.dispatch('fleet/jobs/endJob', { id: this.actionJob.id })
            this.endDialog = false
            await this.reload()
        } catch (e: any) {
            this.error = e?.message ?? String(e)
            this.endDialog = false
        } finally {
            this.busy = false
        }
    }

    async doUnlink() {
        if (!this.actionJob || !this.detail) return
        this.busy = true
        this.error = ''
        try {
            await this.$store.dispatch('fleet/purchaseOrders/unlinkJob', {
                poId: this.detail.po.id,
                jobId: this.actionJob.id,
            })
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        } finally {
            this.unlinkDialog = false
            this.busy = false
        }
    }

    async doDelete() {
        if (!this.detail) return
        const id = this.detail.po.id
        this.busy = true
        try {
            await this.$store.dispatch('fleet/purchaseOrders/deletePo', id)
            this.deleteDialog = false
            this.$emit('deleted', id)
            this.$emit('input', false)
        } catch (e: any) {
            this.error = e?.message ?? String(e)
            this.deleteDialog = false
        } finally {
            this.busy = false
        }
    }

    formatDate(d: string | null) {
        if (!d) return '—'
        // Plain dates (YYYY-MM-DD) are local calendar days, not UTC midnight.
        const v = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d)
        return isNaN(v.getTime()) ? d : v.toLocaleDateString()
    }

    formatDateTime(iso: string | null) {
        return iso ? new Date(iso).toLocaleString() : '—'
    }

    formatMoney(v: number | null, currency: string | null) {
        if (v == null) return '—'
        return `${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${
            currency ? ' ' + currency : ''
        }`
    }
}
</script>

<style scoped>
.po-warn-border {
    border-color: #ffa000 !important;
}
.po-warn-text {
    color: #ffa000;
}
.po-part {
    border-left: 3px solid rgba(128, 128, 128, 0.35);
}
.po-part--untracked {
    border-left-color: #ffa000;
}
.po-surplus-mark {
    text-align: right;
    line-height: 1.2;
}
.po-timeline >>> .v-timeline-item {
    padding-bottom: 8px;
}
.run-bar {
    display: flex;
    height: 10px;
    border-radius: 5px;
    overflow: hidden;
    background: rgba(128, 128, 128, 0.25);
}
.seg {
    height: 100%;
    transition: width 0.4s;
}
.seg-passed {
    background: #43a047;
}
.seg-active {
    background: #64b5f6;
    animation: breathe 1.6s ease-in-out infinite;
}
.seg-qcfail {
    background: repeating-linear-gradient(45deg, #e53935 0 4px, #b71c1c 4px 8px);
}
.seg-remaining {
    background: transparent;
}
@keyframes breathe {
    0%,
    100% {
        opacity: 1;
    }
    50% {
        opacity: 0.45;
    }
}
</style>
