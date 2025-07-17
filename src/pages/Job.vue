<template>
    <div>
        <v-row>
            <v-col>
                <job-statistics-panel />
            </v-col>
        </v-row>
        <v-row class="mt-0">
            <v-col>
                <job-list-panel />
            </v-col>
        </v-row>
        <v-row>
            <v-col>
                <customer-panel />
            </v-col>
        </v-row>
    </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import JobListPanel from '@/components/panels/JobListPanel.vue'
import JobStatisticsPanel from '@/components/panels/JobStatisticsPanel.vue'
import CustomerPanel from '@/components/panels/CustomerPanel.vue'

@Component({
    components: {
        JobStatisticsPanel,
        JobListPanel,
        CustomerPanel,
    },
})
export default class PageJob extends Mixins(BaseMixin) {
    async mounted() {
        // Initialize job data when page loads
        await this.loadJobs()
        await this.loadCustomers()
    }

    async loadJobs() {
        try {
            await this.$store.dispatch('fleet/jobs/loadJobs')
        } catch (error) {
            console.error('Failed to load jobs:', error)
        }
    }

    async loadCustomers() {
        try {
            await this.$store.dispatch('fleet/jobs/loadCustomers')
        } catch (error) {
            console.error('Failed to load customers:', error)
        }
    }
}
</script>
