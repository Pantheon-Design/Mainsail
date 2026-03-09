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
            <v-tab>History</v-tab>
            <v-tab>Analytics</v-tab>
        </v-tabs>

        <v-tabs-items v-model="activeTab">
            <v-tab-item>
                <fleet-history-list-panel />
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
import FleetPrinterStatusPanel from '@/components/panels/FleetPrinterStatusPanel.vue'
import FleetHistoryListPanel from '@/components/panels/FleetHistoryListPanel.vue'
import FleetAnalyticsPanel from '@/components/panels/FleetAnalyticsPanel.vue'

@Component({
    components: {
        FleetPrinterStatusPanel,
        FleetHistoryListPanel,
        FleetAnalyticsPanel,
    },
})
export default class FleetHistory extends Vue {
    activeTab = 0

    mounted() {
        this.$store.dispatch('fleet/history/loadHistory')
        this.$store.dispatch('fleet/history/loadAnalytics')
    }
}
</script>
