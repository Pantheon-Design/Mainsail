<template>
    <v-container fluid class="pa-4">
        <v-alert v-if="loadError" type="error" dense dismissible class="mb-4" @input="loadError = ''">
            {{ loadError }}
        </v-alert>

        <v-tabs v-model="activeTab" background-color="transparent">
            <v-tab>Jobs</v-tab>
            <v-tab>Customers</v-tab>
            <v-tab>Workers</v-tab>
        </v-tabs>

        <v-tabs-items v-model="activeTab">
            <v-tab-item>
                <job-list-panel ref="jobPanel" />
            </v-tab-item>
            <v-tab-item>
                <customer-list-panel />
            </v-tab-item>
            <v-tab-item>
                <worker-list-panel />
            </v-tab-item>
        </v-tabs-items>
    </v-container>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { Watch } from 'vue-property-decorator'
import JobListPanel from '@/components/panels/JobListPanel.vue'
import CustomerListPanel from '@/components/panels/CustomerListPanel.vue'
import WorkerListPanel from '@/components/panels/WorkerListPanel.vue'
import { fleetDaemonEvents } from '@/plugins/fleetDaemonClient'

@Component({
    components: {
        JobListPanel,
        CustomerListPanel,
        WorkerListPanel,
    },
})
export default class Jobs extends Vue {
    activeTab = 0
    loadError = ''
    private jobsTimer: ReturnType<typeof setTimeout> | null = null
    private workersTimer: ReturnType<typeof setTimeout> | null = null
    private pollTimer: ReturnType<typeof setInterval> | null = null
    private polling = false

    /** Fallback poll period (ms). WS events trigger refreshes immediately; this only covers missed events. */
    static readonly POLL_MS = 10000

    async mounted() {
        await this.loadAll()
        fleetDaemonEvents.$on('jobs_updated', this.onJobsUpdated)
        fleetDaemonEvents.$on('workers_updated', this.onWorkersUpdated)
        document.addEventListener('visibilitychange', this.onVisibility)
        this.pollTimer = setInterval(this.poll, Jobs.POLL_MS)
        this.checkOpenJob()
    }

    beforeDestroy() {
        fleetDaemonEvents.$off('jobs_updated', this.onJobsUpdated)
        fleetDaemonEvents.$off('workers_updated', this.onWorkersUpdated)
        document.removeEventListener('visibilitychange', this.onVisibility)
        if (this.jobsTimer) clearTimeout(this.jobsTimer)
        if (this.workersTimer) clearTimeout(this.workersTimer)
        if (this.pollTimer) clearInterval(this.pollTimer)
    }

    onVisibility() {
        if (document.visibilityState === 'visible') this.poll()
    }

    /** Periodic refresh of everything the page shows, including an open job dialog. */
    async poll() {
        if (this.polling || document.visibilityState !== 'visible') return
        this.polling = true
        try {
            const current = this.$store.state.fleet.jobs.currentJob
            await Promise.allSettled([
                this.$store.dispatch('fleet/jobs/loadJobs'),
                this.$store.dispatch('fleet/workers/loadWorkers'),
                this.$store.dispatch('fleet/workers/loadSchedulerStatus'),
                this.activeTab === 1 ? this.$store.dispatch('fleet/customers/loadCustomers') : Promise.resolve(),
                current ? this.$store.dispatch('fleet/jobs/loadJob', current.job.id) : Promise.resolve(),
            ])
        } finally {
            this.polling = false
        }
    }

    async loadAll() {
        const errors: string[] = []
        await Promise.allSettled([
            this.$store.dispatch('fleet/jobs/loadJobs').catch((e: Error) => errors.push(e.message)),
            this.$store.dispatch('fleet/customers/loadCustomers').catch((e: Error) => errors.push(e.message)),
            this.$store.dispatch('fleet/workers/loadWorkers').catch((e: Error) => errors.push(e.message)),
            this.$store.dispatch('fleet/workers/loadSchedulerStatus').catch((e: Error) => errors.push(e.message)),
        ])
        if (errors.length > 0) this.loadError = [...new Set(errors)].join(' | ')
    }

    /** Debounced: the daemon broadcasts several jobs_updated per dispatch step. */
    onJobsUpdated() {
        if (this.jobsTimer) clearTimeout(this.jobsTimer)
        this.jobsTimer = setTimeout(async () => {
            this.jobsTimer = null
            await Promise.allSettled([
                this.$store.dispatch('fleet/jobs/loadJobs'),
                this.$store.dispatch('fleet/customers/loadCustomers'),
                this.$store.dispatch('fleet/workers/loadWorkers'),
            ])
            const current = this.$store.state.fleet.jobs.currentJob
            if (current) this.$store.dispatch('fleet/jobs/loadJob', current.job.id).catch(() => {})
        }, 500)
    }

    onWorkersUpdated() {
        if (this.workersTimer) clearTimeout(this.workersTimer)
        this.workersTimer = setTimeout(() => {
            this.workersTimer = null
            this.$store.dispatch('fleet/workers/loadWorkers').catch(() => {})
            this.$store.dispatch('fleet/workers/loadSchedulerStatus').catch(() => {})
        }, 500)
    }

    @Watch('$route')
    onRouteChange() {
        this.checkOpenJob()
    }

    checkOpenJob() {
        const id = parseInt(String(this.$route.query.openJob ?? ''), 10)
        if (!isNaN(id) && id > 0) {
            this.activeTab = 0
            this.$nextTick(() => {
                const panel = this.$refs.jobPanel as any
                if (panel && typeof panel.openDetails === 'function') panel.openDetails(id)
                this.$router.replace({ path: '/jobs' }).catch(() => {})
            })
        }
    }
}
</script>
