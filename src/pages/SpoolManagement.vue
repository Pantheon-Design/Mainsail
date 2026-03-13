<template>
    <v-container fluid class="pa-4">
        <v-tabs v-model="activeTab" background-color="transparent">
            <v-tab>Spools</v-tab>
            <v-tab>Filaments</v-tab>
            <v-tab>Vendors</v-tab>
        </v-tabs>

        <v-tabs-items v-model="activeTab">
            <v-tab-item>
                <spool-list-panel />
            </v-tab-item>
            <v-tab-item>
                <filament-list-panel />
            </v-tab-item>
            <v-tab-item>
                <vendor-list-panel />
            </v-tab-item>
        </v-tabs-items>
    </v-container>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import SpoolListPanel from '@/components/panels/SpoolListPanel.vue'
import FilamentListPanel from '@/components/panels/FilamentListPanel.vue'
import VendorListPanel from '@/components/panels/VendorListPanel.vue'

@Component({
    components: {
        SpoolListPanel,
        FilamentListPanel,
        VendorListPanel,
    },
})
export default class SpoolManagement extends Vue {
    activeTab = 0

    mounted() {
        this.$store.dispatch('fleet/spools/loadVendors')
        this.$store.dispatch('fleet/spools/loadFilaments')
        this.$store.dispatch('fleet/spools/loadSpools')
    }
}
</script>
