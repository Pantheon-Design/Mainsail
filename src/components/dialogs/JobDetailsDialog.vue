<template>
    <v-dialog v-model="dialogVisible"
              :max-width="1000"
              persistent
              @keydown.esc="closeDialog">
        <panel title="Job Details"
               :icon="mdiBriefcaseOutline"
               card-class="job-details-dialog"
               :margin-bottom="false">
            <template #buttons>
                <!-- Refresh button -->
                <v-btn icon
                       tile
                       :loading="isLoadingJobDetails"
                       @click="refreshJobDetails"
                       title="Refresh job details">
                    <v-icon>{{ mdiRefresh }}</v-icon>
                </v-btn>
                <v-btn icon tile @click="closeDialog">
                    <v-icon>{{ mdiCloseThick }}</v-icon>
                </v-btn>
            </template>
            <v-card-text class="px-0">
                <overlay-scrollbars style="height: 600px" class="px-6">
                    <v-row v-if="job">
                        <v-col cols="6">
                            <div class="d-flex justify-space-between align-center mb-3">
                                <h3>Job Information</h3>
                                <v-btn color="primary"
                                       small
                                       @click="$emit('edit-job', job)">
                                    <v-icon left small>{{ mdiPencil }}</v-icon>
                                    Edit Job
                                </v-btn>
                            </div>
                            <v-divider class="mb-3" />

                            <!-- Complete Job Information -->
                            <v-row class="mb-2">
                                <v-col cols="4"><strong>Name:</strong></v-col>
                                <v-col cols="8">{{ job.name }}</v-col>
                            </v-row>

                            <v-row class="mb-2">
                                <v-col cols="4"><strong>Customer:</strong></v-col>
                                <v-col cols="8">{{ getCustomerName(job.customer_id) }}</v-col>
                            </v-row>

                            <v-row>
                                <v-col cols="4"><strong>Status:</strong></v-col>
                                <v-col cols="8">
                                    <v-menu offset-y>
                                        <template v-slot:activator="{ on, attrs }">
                                            <v-chip :color="getStatusColor(job.status)"
                                                    :text-color="getStatusTextColor(job.status)"
                                                    small
                                                    v-bind="attrs"
                                                    v-on="on"
                                                    style="cursor: pointer;"
                                                    title="Click to change status">
                                                <v-icon left small>{{ getStatusIcon(job.status) }}</v-icon>
                                                {{ job.status.replace('_', ' ') }}
                                                <v-icon right small>{{ mdiChevronDown }}</v-icon>
                                            </v-chip>
                                        </template>
                                        <v-list dense>
                                            <v-list-item v-if="job.status === 'pending'"
                                                         @click="updateJobStatus('in_progress')">
                                                <v-list-item-icon>
                                                    <v-icon small color="blue">{{ mdiPlay }}</v-icon>
                                                </v-list-item-icon>
                                                <v-list-item-content>
                                                    <v-list-item-title>Start Job</v-list-item-title>
                                                </v-list-item-content>
                                            </v-list-item>

                                            <v-list-item v-if="job.status === 'in_progress'"
                                                         @click="updateJobStatus('complete')">
                                                <v-list-item-icon>
                                                    <v-icon small color="green">{{ mdiCheck }}</v-icon>
                                                </v-list-item-icon>
                                                <v-list-item-content>
                                                    <v-list-item-title>Mark Complete</v-list-item-title>
                                                </v-list-item-content>
                                            </v-list-item>

                                            <v-list-item v-if="['pending', 'in_progress'].includes(job.status)"
                                                         @click="updateJobStatus('cancelled')">
                                                <v-list-item-icon>
                                                    <v-icon small color="red">{{ mdiCancel }}</v-icon>
                                                </v-list-item-icon>
                                                <v-list-item-content>
                                                    <v-list-item-title>Cancel Job</v-list-item-title>
                                                </v-list-item-content>
                                            </v-list-item>

                                            <!-- Options to revert status -->
                                            <v-divider v-if="job.status !== 'pending'" />

                                            <v-list-item v-if="job.status === 'in_progress'"
                                                         @click="updateJobStatus('pending')">
                                                <v-list-item-icon>
                                                    <v-icon small color="orange">{{ mdiAlertOutline }}</v-icon>
                                                </v-list-item-icon>
                                                <v-list-item-content>
                                                    <v-list-item-title>Back to Pending</v-list-item-title>
                                                </v-list-item-content>
                                            </v-list-item>

                                            <v-list-item v-if="job.status === 'complete'"
                                                         @click="updateJobStatus('in_progress')">
                                                <v-list-item-icon>
                                                    <v-icon small color="blue">{{ mdiProgressClock }}</v-icon>
                                                </v-list-item-icon>
                                                <v-list-item-content>
                                                    <v-list-item-title>Reopen Job</v-list-item-title>
                                                </v-list-item-content>
                                            </v-list-item>

                                            <v-list-item v-if="job.status === 'cancelled'"
                                                         @click="updateJobStatus('pending')">
                                                <v-list-item-icon>
                                                    <v-icon small color="orange">{{ mdiAlertOutline }}</v-icon>
                                                </v-list-item-icon>
                                                <v-list-item-content>
                                                    <v-list-item-title>Restore Job</v-list-item-title>
                                                </v-list-item-content>
                                            </v-list-item>
                                        </v-list>
                                    </v-menu>
                                </v-col>
                            </v-row>

                            <v-row class="mb-2">
                                <v-col cols="4"><strong>Type:</strong></v-col>
                                <v-col cols="8">{{ job.job_type }}</v-col>
                            </v-row>

                            <v-row class="mb-2">
                                <v-col cols="4"><strong>Priority:</strong></v-col>
                                <v-col cols="8">
                                    <v-chip :color="getPriorityColor(job.priority)"
                                            text-color="white"
                                            x-small>
                                        {{ getPriorityDisplay(job.priority) }}
                                    </v-chip>
                                </v-col>
                            </v-row>

                            <v-row class="mb-2">
                                <v-col cols="4"><strong>Operator:</strong></v-col>
                                <v-col cols="8">{{ job.operator_name || '--' }}</v-col>
                            </v-row>

                            <v-row class="mb-2">
                                <v-col cols="4"><strong>Due Date:</strong></v-col>
                                <v-col cols="8" :class="getDueDateClass(job.due_date)">
                                    {{ formatDateTime(job.due_date) || '--' }}
                                </v-col>
                            </v-row>

                            <v-row class="mb-2">
                                <v-col cols="4"><strong>Created:</strong></v-col>
                                <v-col cols="8">{{ formatDateTime(job.created_at) }}</v-col>
                            </v-row>

                            <v-row class="mb-2">
                                <v-col cols="4"><strong>Updated:</strong></v-col>
                                <v-col cols="8">{{ formatDateTime(job.updated_at) }}</v-col>
                            </v-row>

                            <v-row class="mb-2" v-if="job.description">
                                <v-col cols="4"><strong>Description:</strong></v-col>
                                <v-col cols="8">{{ job.description }}</v-col>
                            </v-row>
                        </v-col>

                        <v-col cols="6">
                            <div class="d-flex justify-space-between align-center mb-3">
                                <h3>
                                    GCode Files
                                    <!-- Loading indicator for gcode files -->
                                    <v-progress-circular v-if="loadingGcodes"
                                                         indeterminate
                                                         size="16"
                                                         width="2"
                                                         color="primary"
                                                         class="ml-2" />
                                </h3>
                                <div class="d-flex align-center">
                                    <!-- Progress bar legend -->
                                    <v-menu offset-y>
                                        <template #activator="{ on, attrs }">
                                            <v-btn icon
                                                   small
                                                   v-bind="attrs"
                                                   v-on="on"
                                                   title="Progress bar legend">
                                                <v-icon small>{{ mdiInformationOutline }}</v-icon>
                                            </v-btn>
                                        </template>
                                        <v-card class="pa-3" style="max-width: 280px;">
                                            <div class="text-subtitle2 mb-2">Progress Bar Legend</div>
                                            <div class="legend-item mb-1">
                                                <div class="legend-color" style="background-color: #bdbdbd;"></div>
                                                <span class="text-caption">Gray: Runs still needed</span>
                                            </div>
                                            <div class="legend-item mb-1">
                                                <div class="legend-color breathing-blue" style="background-color: #2196f3;"></div>
                                                <span class="text-caption">Rolling blue: In progress</span>
                                            </div>
                                            <div class="legend-item mb-1">
                                                <div class="legend-color" style="background-color: #2196f3;"></div>
                                                <span class="text-caption">Blue: Completed, awaiting QC</span>
                                            </div>
                                            <div class="legend-item mb-1">
                                                <div class="legend-color" style="background-color: #4caf50;"></div>
                                                <span class="text-caption">Green: Passed QC</span>
                                            </div>
                                            <div class="legend-item">
                                                <div class="legend-color" style="background-color: #f44336;"></div>
                                                <span class="text-caption">Red: Failed runs</span>
                                            </div>
                                        </v-card>
                                    </v-menu>

                                    <v-btn color="primary"
                                           small
                                           class="ml-2"
                                           :disabled="loadingGcodes"
                                           @click="$emit('add-gcode', job)">
                                        <v-icon left small>{{ mdiPlus }}</v-icon>
                                        Add GCode
                                    </v-btn>
                                </div>
                            </div>
                            <v-divider class="mb-3" />

                            <!-- Loading skeleton for gcode files -->
                            <div v-if="loadingGcodes">
                                <div v-for="i in 2" :key="`skeleton-${i}`" class="gcode-skeleton mb-4">
                                    <v-skeleton-loader type="list-item-three-line"
                                                       class="pa-3"
                                                       style="border: 1px solid #e0e0e0; border-radius: 8px;">
                                    </v-skeleton-loader>
                                </div>
                            </div>

                            <!-- No gcode files message -->
                            <div v-else-if="gcodeFiles.length === 0" class="text-center text--secondary">
                                No GCode files added yet
                            </div>

                            <!-- Gcode files list -->
                            <div v-else>
                                <div v-for="gcode in gcodeFiles" :key="gcode.id" class="gcode-file-item mb-4 pa-3" style="border: 1px solid #e0e0e0; border-radius: 8px; background-color: #2a2a2a; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                    <!-- File header -->
                                    <div class="d-flex justify-space-between align-center mb-2">
                                        <div class="font-weight-bold text--primary" style="color: #1976d2 !important; font-size: 14px;">
                                            {{ gcode.gcode_filename }}
                                        </div>
                                        <div class="d-flex align-center">
                                            <v-btn icon
                                                   small
                                                   color="primary"
                                                   class="elevation-1 mr-1"
                                                   style="background-color: #1976d2 !important;"
                                                   @click="$emit('edit-gcode', gcode)"
                                                   title="Edit GCode file">
                                                <v-icon small color="white">{{ mdiPencil }}</v-icon>
                                            </v-btn>
                                            <v-btn icon
                                                   small
                                                   :color="getRunStatistics(gcode).totalRuns > 0 ? 'grey' : 'error'"
                                                   :disabled="getRunStatistics(gcode).totalRuns > 0"
                                                   class="elevation-1 mr-1"
                                                   @click="$emit('delete-gcode', gcode)"
                                                   :title="getRunStatistics(gcode).totalRuns > 0 ? 'Cannot delete - has associated runs' : 'Delete GCode file'">
                                                <v-icon small :color="getRunStatistics(gcode).totalRuns > 0 ? 'grey' : 'white'">{{ mdiDelete }}</v-icon>
                                            </v-btn>
                                            <v-btn icon
                                                   small
                                                   color="primary"
                                                   class="elevation-1"
                                                   style="background-color: #1976d2 !important;"
                                                   @click="$emit('view-gcode-runs', gcode)"
                                                   title="View print runs">
                                                <v-icon small color="white">{{ mdiPlay }}</v-icon>
                                            </v-btn>
                                        </div>
                                    </div>

                                    <!-- File info chips -->
                                    <div class="mb-3">
                                        <v-chip x-small color="blue" text-color="white" class="mr-1">
                                            {{ gcode.filament_type }}
                                        </v-chip>
                                        <v-chip x-small color="orange" text-color="white" class="mr-1">
                                            {{ gcode.required_runs }} runs
                                        </v-chip>
                                        <v-chip x-small color="green" text-color="white">
                                            {{ gcode.preferred_printer }}
                                        </v-chip>
                                    </div>

                                    <!-- Progress bar section -->
                                    <div class="gcode-progress-container mb-2">
                                        <!-- Loading state for runs -->
                                        <div v-if="loadingRuns" class="d-flex align-center justify-center pa-3">
                                            <v-progress-circular indeterminate
                                                                 size="24"
                                                                 width="3"
                                                                 color="primary"
                                                                 class="mr-2" />
                                            <span class="text-caption text--secondary">Loading print runs...</span>
                                        </div>

                                        <!-- Progress bar (shown when not loading) -->
                                        <div v-else class="d-flex align-center">
                                            <!-- Main progress bar -->
                                            <div class="gcode-progress-bar" style="height: 22px; border-radius: 11px; overflow: hidden; flex: 1; position: relative; background-color: #e8e8e8; border: 1px solid #ccc; box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);">
                                                <!-- Gray portion (remaining needed) -->
                                                <div v-if="getRunStatistics(gcode).percentages.remaining > 0"
                                                     class="progress-segment remaining"
                                                     :style="`width: ${getRunStatistics(gcode).percentages.remaining}%; background-color: #9e9e9e; height: 100%; float: left;`">
                                                </div>

                                                <!-- Breathing blue portion (in progress) -->
                                                <div v-if="getRunStatistics(gcode).percentages.inProgress > 0"
                                                     class="progress-segment in-progress breathing-blue"
                                                     :style="`width: ${getRunStatistics(gcode).percentages.inProgress}%; height: 100%; float: left;`">
                                                </div>

                                                <!-- Blue portion (completed, no QC) -->
                                                <div v-if="getRunStatistics(gcode).percentages.completed > 0"
                                                     class="progress-segment completed"
                                                     :style="`width: ${getRunStatistics(gcode).percentages.completed}%; background-color: #2196f3; height: 100%; float: left;`">
                                                </div>

                                                <!-- Green portion (passed QC) -->
                                                <div v-if="getRunStatistics(gcode).percentages.passed > 0"
                                                     class="progress-segment passed"
                                                     :style="`width: ${getRunStatistics(gcode).percentages.passed}%; background-color: #4caf50; height: 100%; float: left;`">
                                                </div>
                                            </div>

                                            <!-- Red bar for failures (separate, attached to the right) -->
                                            <div v-if="getRunStatistics(gcode).totalFailed > 0"
                                                 class="failure-bar ml-2"
                                                 :style="`width: ${Math.min(getRunStatistics(gcode).totalFailed * 8 + 20, 60)}px; height: 22px; background-color: #f44336; border-radius: 11px; position: relative; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.2);`"
                                                 :title="`${getRunStatistics(gcode).totalFailed} failed runs (${getRunStatistics(gcode).technicalFailures} technical + ${getRunStatistics(gcode).qcFailures} QC failures)`">
                                                <span style="color: white; font-size: 11px; font-weight: bold;">
                                                    {{ getRunStatistics(gcode).totalFailed }}
                                                </span>
                                            </div>
                                        </div>

                                        <!-- Statistics text below the bar -->
                                        <div v-if="!loadingRuns" class="gcode-progress-stats mt-2" style="font-size: 12px; color: #424242; font-weight: 500;">
                                            <span class="font-weight-bold" style="color: #1976d2;">{{ getRunStatistics(gcode).goodRuns }}/{{ getRunStatistics(gcode).requiredRuns }}</span>
                                            <span v-if="getRunStatistics(gcode).totalFailed > 0" class="ml-2" style="color: #d32f2f;">
                                                {{ getRunStatistics(gcode).totalFailed }} failed
                                            </span>
                                            <span v-if="getRunStatistics(gcode).inProgress > 0" class="ml-2" style="color: #1976d2;">
                                                {{ getRunStatistics(gcode).inProgress }} in progress
                                            </span>
                                            <span v-if="getRunStatistics(gcode).passedQC > 0" class="ml-2" style="color: #388e3c;">
                                                {{ getRunStatistics(gcode).passedQC }} passed QC
                                            </span>
                                            <span v-if="getRunStatistics(gcode).completedNoQC > 0" class="ml-2" style="color: #1976d2;">
                                                {{ getRunStatistics(gcode).completedNoQC }} awaiting QC
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </v-col>
                    </v-row>
                </overlay-scrollbars>
            </v-card-text>
        </panel>
    </v-dialog>
</template>

<script lang="ts">
import { Component, Mixins, Prop, Watch } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import Panel from '@/components/ui/Panel.vue'
import {
    mdiBriefcaseOutline,
    mdiRefresh,
    mdiCloseThick,
    mdiPencil,
    mdiChevronDown,
    mdiPlay,
    mdiCheck,
    mdiCancel,
    mdiAlertOutline,
    mdiProgressClock,
    mdiDelete,
    mdiPlus,
    mdiInformationOutline,
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
    components: { Panel },
})
export default class JobDetailsDialog extends Mixins(BaseMixin) {
    mdiBriefcaseOutline = mdiBriefcaseOutline
    mdiRefresh = mdiRefresh
    mdiCloseThick = mdiCloseThick
    mdiPencil = mdiPencil
    mdiChevronDown = mdiChevronDown
    mdiPlay = mdiPlay
    mdiCheck = mdiCheck
    mdiCancel = mdiCancel
    mdiAlertOutline = mdiAlertOutline
    mdiProgressClock = mdiProgressClock
    mdiDelete = mdiDelete
    mdiPlus = mdiPlus
    mdiInformationOutline = mdiInformationOutline

    @Prop({ type: Boolean, default: false })
    readonly value!: boolean

    @Prop({ type: Object, default: null })
    readonly job!: FleetJob | null

    @Prop({ type: Array, default: () => [] })
    readonly gcodeFiles!: FleetJobGcode[]

    @Prop({ type: Object, default: () => ({}) })
    readonly allJobRuns!: { [gcodeId: string]: FleetJobGcodeRun[] }

    @Prop({ type: Boolean, default: false })
    readonly loadingGcodes!: boolean

    @Prop({ type: Boolean, default: false })
    readonly loadingRuns!: boolean

    private runStatisticsCache: { [gcodeId: string]: any } = {}

    get dialogVisible() {
        return this.value
    }

    set dialogVisible(val: boolean) {
        this.$emit('input', val)
    }

    get customers() {
        return this.$store.state.fleet?.jobs?.customers ?? []
    }

    get isLoadingJobDetails(): boolean {
        return this.loadingGcodes || this.loadingRuns
    }

    closeDialog() {
        this.$emit('close')
    }

    refreshJobDetails() {
        this.$emit('refresh')
    }

    updateJobStatus(status: string) {
        this.$emit('update-status', status)
    }

    getCustomerName(customerId: string) {
        const customer = this.customers.find((c: any) => c.id === customerId)
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
                return this.mdiCheck
            case 'cancelled':
                return this.mdiCancel
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

    getRunStatistics(gcode: FleetJobGcode) {
        const cacheKey = `${gcode.id}-${gcode.required_runs}`
        
        // Use better cache key that includes runs data hash
        const runs = this.allJobRuns[gcode.id] || []
        const runsHash = runs.length ? runs.map(r => `${r.id}-${r.status}-${r.qc}`).join(',') : 'empty'
        const fullCacheKey = `${cacheKey}-${runsHash}`
        
        if (this.runStatisticsCache[fullCacheKey] && !this.loadingRuns) {
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

        // Calculate all stats in one pass
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

    @Watch('allJobRuns', { deep: true })
    onAllJobRunsChanged() {
        // Clear cache when runs data changes
        setTimeout(() => {
            this.runStatisticsCache = {}
        }, 100)
    }
}
</script>

<style scoped>
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
</style>