<template>
    <v-container fluid class="pa-4">
        <!-- Printer status overview (collapsible) -->
        <v-expansion-panels flat class="mb-4">
            <v-expansion-panel>
                <v-expansion-panel-header class="subtitle-2">Printer Status Overview</v-expansion-panel-header>
                <v-expansion-panel-content>
                    <fleet-printer-status-panel />
                </v-expansion-panel-content>
            </v-expansion-panel>
        </v-expansion-panels>

        <!-- Tabs -->
        <v-tabs v-model="activeTab" background-color="transparent">
            <v-tab>Jobs</v-tab>
            <v-tab>Parts</v-tab>
            <v-tab>Analytics</v-tab>
        </v-tabs>

        <v-tabs-items v-model="activeTab" touchless>
            <v-tab-item>
                <fleet-history-list-panel />
            </v-tab-item>
            <v-tab-item eager>
                <fleet-parts-panel ref="partsPanel" />
            </v-tab-item>
            <v-tab-item>
                <fleet-analytics-panel />
            </v-tab-item>
        </v-tabs-items>
    </v-container>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { Watch } from 'vue-property-decorator'
import { Route } from 'vue-router'
import FleetPrinterStatusPanel from '@/components/panels/FleetPrinterStatusPanel.vue'
import FleetHistoryListPanel from '@/components/panels/FleetHistoryListPanel.vue'
import FleetPartsPanel from '@/components/panels/FleetPartsPanel.vue'
import FleetAnalyticsPanel from '@/components/panels/FleetAnalyticsPanel.vue'

@Component({
    components: {
        FleetPrinterStatusPanel,
        FleetHistoryListPanel,
        FleetPartsPanel,
        FleetAnalyticsPanel,
    },
})
export default class FleetHistory extends Vue {
    activeTab = 0

    mounted() {
        this.$store.dispatch('fleet/history/loadAnalytics')
        this.checkQcMode()
    }

    @Watch('$route')
    onRouteChange(_route: Route) {
        this.checkQcMode()
    }

    checkQcMode() {
        if (this.$route.query.qcMode === '1') {
            // Switch to Parts tab and trigger QC mode
            this.activeTab = 1
            this.$nextTick(() => {
                const panel = this.$refs.partsPanel as any
                if (panel?.enterQcMode) panel.enterQcMode()
                // Clean up the query param so it doesn't re-trigger
                this.$router.replace({ path: '/fleet-history' }).catch(() => {})
            })
        }
    }
}
</script>
