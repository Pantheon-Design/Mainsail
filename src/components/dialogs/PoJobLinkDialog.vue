<template>
    <v-dialog :value="value" max-width="900" persistent scrollable @input="$emit('input', $event)">
        <v-card>
            <v-card-title>Link existing job to PO {{ po ? po.po.po_number || '#' + po.po.id : '' }}</v-card-title>
            <v-card-text>
                <v-alert v-if="error" type="error" dense class="mb-3">{{ error }}</v-alert>
                <v-autocomplete
                    v-model="jobId"
                    :items="jobOptions"
                    :loading="loadingJobs"
                    label="Job"
                    hint="open jobs that are not linked to another PO"
                    persistent-hint
                    dense
                    outlined
                    class="mb-3"
                    @change="loadJob" />

                <v-progress-linear v-if="loadingJob" indeterminate class="mb-2" />
                <template v-if="job">
                    <div v-if="job.items.length === 0" class="text--secondary text-caption">This job has no gcodes.</div>
                    <div v-else class="text-subtitle-2 mb-1">Map each gcode to the PO parts it prints</div>
                    <v-card
                        v-for="it in job.items"
                        :key="it.id"
                        outlined
                        class="mb-2 pa-2"
                        :class="{ 'po-warn-border': !hasLinks(it.id) }">
                        <div class="d-flex align-center mb-1">
                            <v-icon small class="mr-1">{{ mdiFile }}</v-icon>
                            <span class="text-truncate flex-grow-1" :title="it.gcode_filename">{{ it.gcode_filename }}</span>
                            <span class="text-caption text--secondary ml-2 text-no-wrap">
                                {{ it.success_count }} / {{ it.total_runs }} runs done
                            </span>
                        </div>
                        <gcode-part-links-editor v-model="links[it.id]" :options="partOptions" :disabled="saving" />
                    </v-card>
                    <v-alert v-if="uncovered.length" type="warning" dense text class="mt-2" color="amber darken-2">
                        Parts with no gcode yet: {{ uncovered.map((p) => p.name).join(', ') }}
                    </v-alert>
                </template>
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn text :disabled="saving" @click="$emit('input', false)">Cancel</v-btn>
                <v-btn color="primary" :loading="saving" :disabled="!job || !valid" @click="save">Link job</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { Prop, Watch } from 'vue-property-decorator'
import { mdiFile } from '@mdi/js'
import GcodePartLinksEditor from '@/components/po/GcodePartLinksEditor.vue'
import { PoPartOption, cleanLinks, poPartOptions } from '@/components/po/poFormat'
import { FleetPoDetail, PartLinkPayload } from '@/store/fleet/purchaseOrders/types'
import { FleetJob, FleetJobDetail } from '@/store/fleet/jobs/types'

/** Pick an existing job, map its gcodes to PO parts, POST /pos/{id}/jobs. */
@Component({ components: { GcodePartLinksEditor } })
export default class PoJobLinkDialog extends Vue {
    mdiFile = mdiFile

    @Prop({ type: Boolean, default: false }) value!: boolean
    @Prop({ type: Object, default: null }) po!: FleetPoDetail | null
    /** Preselect this job (e.g. relinking from the Jobs tab) */
    @Prop({ type: Number, default: 0 }) presetJobId!: number

    jobId: number | null = null
    job: FleetJobDetail | null = null
    links: Record<number, PartLinkPayload[]> = {}
    loadingJobs = false
    loadingJob = false
    saving = false
    error = ''

    get partOptions(): PoPartOption[] {
        return poPartOptions(this.po)
    }

    get jobOptions() {
        const poId = this.po?.po.id
        return (this.$store.getters['fleet/jobs/getJobs'] as FleetJob[])
            .filter((j) => !j.po_id || j.po_id === poId)
            .map((j) => ({
                text: `${j.name}${j.customer_name ? ' · ' + j.customer_name : ''} (${j.status.replace('_', ' ')})${
                    j.po_id === poId ? ' · already linked' : ''
                }`,
                value: j.id,
            }))
    }

    get valid(): boolean {
        return Object.values(this.links).every((rows) => rows.every((r) => r.part_id > 0 && Number(r.qty_per_run) >= 1))
    }

    /** PO parts not tracked by any job and not mapped in this form. */
    get uncovered(): PoPartOption[] {
        const mapped = new Set<number>()
        for (const rows of Object.values(this.links)) rows.forEach((r) => mapped.add(r.part_id))
        return this.partOptions.filter((p) => !p.tracked && !mapped.has(p.part_id))
    }

    hasLinks(itemId: number): boolean {
        return (this.links[itemId] ?? []).some((r) => r.part_id > 0)
    }

    @Watch('value')
    async onOpen(open: boolean) {
        if (!open) return
        this.error = ''
        this.job = null
        this.links = {}
        this.jobId = this.presetJobId || null
        this.loadingJobs = true
        try {
            await this.$store.dispatch('fleet/jobs/loadJobs')
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        } finally {
            this.loadingJobs = false
        }
        if (this.jobId) await this.loadJob()
    }

    async loadJob() {
        this.job = null
        this.links = {}
        if (!this.jobId) return
        this.loadingJob = true
        this.error = ''
        try {
            const detail: FleetJobDetail = await this.$store.dispatch('fleet/jobs/fetchJob', this.jobId)
            const links: Record<number, PartLinkPayload[]> = {}
            for (const it of detail.items) {
                links[it.id] = (it.parts ?? []).map((p) => ({ part_id: p.part_id, qty_per_run: p.qty_per_run }))
            }
            this.links = links
            this.job = detail
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        } finally {
            this.loadingJob = false
        }
    }

    async save() {
        if (!this.po || !this.job) return
        this.saving = true
        this.error = ''
        try {
            const detail: FleetPoDetail = await this.$store.dispatch('fleet/purchaseOrders/linkJob', {
                poId: this.po.po.id,
                job_id: this.job.job.id,
                links: this.job.items.map((it) => ({ job_item_id: it.id, parts: cleanLinks(this.links[it.id] ?? []) })),
            })
            this.$emit('saved', detail)
            this.$emit('input', false)
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        } finally {
            this.saving = false
        }
    }
}
</script>

<style scoped>
.po-warn-border {
    border-color: #ffa000 !important;
}
</style>
