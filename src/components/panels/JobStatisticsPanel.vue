<template>
    <panel
        :icon="mdiChartLine"
        title="Job Statistics"
        card-class="job-statistics-panel">
        <v-card-text>
            <v-row>
                <v-col cols="12" sm="6" md="3">
                    <v-card color="blue" dark>
                        <v-card-text class="text-center">
                            <div class="text-h4">{{ totalJobs }}</div>
                            <div>Total Jobs</div>
                        </v-card-text>
                    </v-card>
                </v-col>
                <v-col cols="12" sm="6" md="3">
                    <v-card color="orange" dark>
                        <v-card-text class="text-center">
                            <div class="text-h4">{{ pendingJobs }}</div>
                            <div>Pending Jobs</div>
                        </v-card-text>
                    </v-card>
                </v-col>
                <v-col cols="12" sm="6" md="3">
                    <v-card color="primary" dark>
                        <v-card-text class="text-center">
                            <div class="text-h4">{{ inProgressJobs }}</div>
                            <div>In Progress</div>
                        </v-card-text>
                    </v-card>
                </v-col>
                <v-col cols="12" sm="6" md="3">
                    <v-card color="green" dark>
                        <v-card-text class="text-center">
                            <div class="text-h4">{{ completedJobs }}</div>
                            <div>Completed</div>
                        </v-card-text>
                    </v-card>
                </v-col>
            </v-row>
            
            <v-row class="mt-4">
                <v-col cols="12" md="4">
                    <v-card outlined>
                        <v-card-title class="text-h6">Jobs by Type</v-card-title>
                        <v-card-text>
                            <v-row>
                                <v-col cols="6">
                                    <div class="text-center">
                                        <div class="text-h5 blue--text">{{ sampleJobs }}</div>
                                        <div class="text-caption">Sample</div>
                                        <v-progress-linear
                                            :value="samplePercentage"
                                            color="blue"
                                            height="4"
                                            class="mt-1" />
                                    </div>
                                </v-col>
                                <v-col cols="6">
                                    <div class="text-center">
                                        <div class="text-h5 orange--text">{{ productionJobs }}</div>
                                        <div class="text-caption">Production</div>
                                        <v-progress-linear
                                            :value="productionPercentage"
                                            color="orange"
                                            height="4"
                                            class="mt-1" />
                                    </div>
                                </v-col>
                            </v-row>
                        </v-card-text>
                    </v-card>
                </v-col>
                
                <v-col cols="12" md="4">
                    <v-card outlined>
                        <v-card-title class="text-h6">Priority Breakdown</v-card-title>
                        <v-card-text>
                            <v-row>
                                <v-col cols="4">
                                    <div class="text-center">
                                        <div class="text-h6 red--text">{{ highPriorityJobs }}</div>
                                        <div class="text-caption">High (5+)</div>
                                        <v-progress-linear
                                            :value="highPriorityPercentage"
                                            color="red"
                                            height="3"
                                            class="mt-1" />
                                    </div>
                                </v-col>
                                <v-col cols="4">
                                    <div class="text-center">
                                        <div class="text-h6 orange--text">{{ mediumPriorityJobs }}</div>
                                        <div class="text-caption">Medium (3-4)</div>
                                        <v-progress-linear
                                            :value="mediumPriorityPercentage"
                                            color="orange"
                                            height="3"
                                            class="mt-1" />
                                    </div>
                                </v-col>
                                <v-col cols="4">
                                    <div class="text-center">
                                        <div class="text-h6 grey--text">{{ lowPriorityJobs }}</div>
                                        <div class="text-caption">Low (0-2)</div>
                                        <v-progress-linear
                                            :value="lowPriorityPercentage"
                                            color="grey"
                                            height="3"
                                            class="mt-1" />
                                    </div>
                                </v-col>
                            </v-row>
                        </v-card-text>
                    </v-card>
                </v-col>
                
                <v-col cols="12" md="4">
                    <v-card outlined>
                        <v-card-title class="text-h6">Fleet Overview</v-card-title>
                        <v-card-text>
                            <v-row>
                                <v-col cols="6">
                                    <div class="text-center">
                                        <div class="text-h6 success--text">{{ customersCount }}</div>
                                        <div class="text-caption">Customers</div>
                                    </div>
                                </v-col>
                                <v-col cols="6">
                                    <div class="text-center">
                                        <div class="text-h6 info--text">{{ activeJobsCount }}</div>
                                        <div class="text-caption">Active Jobs</div>
                                    </div>
                                </v-col>
                            </v-row>
                            <v-row class="mt-2">
                                <v-col cols="12">
                                    <div class="text-center">
                                        <div class="text-body-2">Completion Rate</div>
                                        <v-progress-linear
                                            :value="completionRate"
                                            color="success"
                                            height="15"
                                            class="mt-1">
                                            <template v-slot:default>
                                                <strong>{{ Math.round(completionRate) }}%</strong>
                                            </template>
                                        </v-progress-linear>
                                    </div>
                                </v-col>
                            </v-row>
                        </v-card-text>
                    </v-card>
                </v-col>
            </v-row>
            
            <v-row class="mt-4" v-if="overdueJobs > 0">
                <v-col cols="12">
                    <v-alert type="warning" outlined prominent border="left">
                        <v-row align="center">
                            <v-col class="grow">
                                <div class="title">Attention Required</div>
                                <div>
                                    <strong>{{ overdueJobs }}</strong> job(s) are overdue and need immediate attention
                                </div>
                            </v-col>
                            <v-col class="shrink">
                                <v-btn color="warning" outlined @click="viewOverdueJobs">
                                    View Overdue
                                </v-btn>
                            </v-col>
                        </v-row>
                    </v-alert>
                </v-col>
            </v-row>
            
            <v-row class="mt-4" v-if="highPriorityActiveJobs > 0">
                <v-col cols="12">
                    <v-alert type="info" outlined>
                        <v-icon left>{{ mdiInformationOutline }}</v-icon>
                        <strong>{{ highPriorityActiveJobs }}</strong> high-priority job(s) are currently active
                    </v-alert>
                </v-col>
            </v-row>
        </v-card-text>
    </panel>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import Panel from '@/components/ui/Panel.vue'
import { mdiChartLine, mdiInformationOutline } from '@mdi/js'

@Component({
    components: { Panel },
})
export default class JobStatisticsPanel extends Mixins(BaseMixin) {
    mdiChartLine = mdiChartLine
    mdiInformationOutline = mdiInformationOutline

    get totalJobs() {
        return this.$store.getters['fleet/jobs/getTotalJobsCount']
    }

    get pendingJobs() {
        return this.$store.getters['fleet/jobs/getPendingJobsCount']
    }

    get inProgressJobs() {
        return this.$store.getters['fleet/jobs/getInProgressJobsCount']
    }

    get completedJobs() {
        return this.$store.getters['fleet/jobs/getCompletedJobsCount']
    }

    get cancelledJobs() {
        return this.$store.getters['fleet/jobs/getCancelledJobsCount']
    }

    get sampleJobs() {
        return this.$store.getters['fleet/jobs/getSampleJobsCount']
    }

    get productionJobs() {
        return this.$store.getters['fleet/jobs/getProductionJobsCount']
    }

    get highPriorityJobs() {
        return this.$store.getters['fleet/jobs/getHighPriorityJobsCount']
    }

    get mediumPriorityJobs() {
        return this.$store.getters['fleet/jobs/getMediumPriorityJobsCount']
    }

    get lowPriorityJobs() {
        return this.$store.getters['fleet/jobs/getLowPriorityJobsCount']
    }

    get overdueJobs() {
        return this.$store.getters['fleet/jobs/getOverdueJobsCount']
    }

    get customersCount() {
        return this.$store.getters['fleet/jobs/getCustomersCount']
    }

    get activeJobsCount() {
        return this.pendingJobs + this.inProgressJobs
    }

    get highPriorityActiveJobs() {
        const activeJobs = this.$store.getters['fleet/jobs/getJobsByStatus']('pending')
            .concat(this.$store.getters['fleet/jobs/getJobsByStatus']('in_progress'))
        return activeJobs.filter((job: any) => job.priority >= 5).length
    }

    get samplePercentage() {
        return this.totalJobs > 0 ? (this.sampleJobs / this.totalJobs) * 100 : 0
    }

    get productionPercentage() {
        return this.totalJobs > 0 ? (this.productionJobs / this.totalJobs) * 100 : 0
    }

    get highPriorityPercentage() {
        return this.totalJobs > 0 ? (this.highPriorityJobs / this.totalJobs) * 100 : 0
    }

    get mediumPriorityPercentage() {
        return this.totalJobs > 0 ? (this.mediumPriorityJobs / this.totalJobs) * 100 : 0
    }

    get lowPriorityPercentage() {
        return this.totalJobs > 0 ? (this.lowPriorityJobs / this.totalJobs) * 100 : 0
    }

    get completionRate() {
        const totalFinishedJobs = this.completedJobs + this.cancelledJobs
        return this.totalJobs > 0 ? (this.completedJobs / this.totalJobs) * 100 : 0
    }

    viewOverdueJobs() {
        // Emit event or navigate to filtered view
        this.$emit('filter-overdue')
        this.$toast.info('Filtering overdue jobs - feature to be implemented')
    }
}
</script>

<style scoped>
.v-card .v-card__text {
    padding: 16px !important;
}
</style>
