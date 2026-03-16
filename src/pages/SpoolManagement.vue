<template>
    <v-container fluid class="pa-4">
        <!-- Connection error banner -->
        <v-alert v-if="loadError" type="error" dense dismissible class="mb-4" @input="loadError = ''">
            {{ loadError }}
        </v-alert>

        <v-tabs v-model="activeTab" background-color="transparent">
            <v-tab>Spools</v-tab>
            <v-tab>Filaments</v-tab>
            <v-tab>Vendors</v-tab>
        </v-tabs>

        <v-tabs-items v-model="activeTab">
            <v-tab-item>
                <spool-list-panel ref="spoolPanel" />
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
import { Watch } from 'vue-property-decorator'
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
    loadError = ''

    async mounted() {
        const errors: string[] = []
        await Promise.allSettled([
            this.$store.dispatch('fleet/spools/loadVendors').catch((e: Error) => errors.push(e.message)),
            this.$store.dispatch('fleet/spools/loadFilaments').catch((e: Error) => errors.push(e.message)),
            this.$store.dispatch('fleet/spools/loadSpools').catch((e: Error) => errors.push(e.message)),
        ])
        if (errors.length > 0) {
            const unique = [...new Set(errors)]
            this.loadError = unique.join(' | ')
        }
        this.checkAddSpoolMode()
    }

    @Watch('$route')
    onRouteChange() {
        this.checkAddSpoolMode()
    }

    checkAddSpoolMode() {
        if (this.$route.query.addSpoolMode === '1') {
            this.activeTab = 0 // Spools tab
            this.$nextTick(() => {
                const panel = this.$refs.spoolPanel as any
                if (panel && typeof panel.enterAddSpoolMode === 'function') {
                    panel.enterAddSpoolMode()
                }
                this.$router.replace({ path: '/spools' }).catch(() => {})
            })
        }
    }
}
</script>
