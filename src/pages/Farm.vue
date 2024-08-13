<style></style>

<template>
    <div>
        <!-- Toggle Button -->
        <v-switch v-model="isMapView"
                  :label="isMapView ? 'Switch to List View' : 'Switch to Map View'"
                  class="mb-4" />

        <!-- Conditional Rendering of Views -->
        <div v-if="isMapView">
            <v-row>
                <v-col v-for="(printer, key) in printers" :key="key" class="col-12 col-sm-6 col-md-4 pb-0">
                    <farm-printer-Map-panel :printer="printer"></farm-printer-Map-panel>
                </v-col>
            </v-row>
        </div>
        <div v-else>
            <v-row>
                <v-col v-for="(printer, key) in printers" :key="key" class="col-12 col-sm-6 col-md-4 pb-0">
                    <farm-printer-panel :printer="printer"></farm-printer-panel>
                </v-col>
            </v-row>
        </div>
    </div>
</template>
<script lang="ts">
    import { Component, Mixins } from 'vue-property-decorator';
    import BaseMixin from '@/components/mixins/base';
    import FarmPrinterPanel from '@/components/panels/FarmPrinterPanel.vue';
    import FarmPrinterMapPanel from '@/components/panels/FarmPrinterMapPanel.vue';
    @Component({
        components: { FarmPrinterPanel },
    })
    export default class PageFarm extends Mixins(BaseMixin) {

        isMapView: boolean = false;

        get printers() {
            return this.$store.getters['farm/getPrinters'];
        }

    }
</script>
