<style></style>

<template>
    <div>
        <!-- Toggle Button -->
        <v-switch v-model="isMapView"
                  :label="isMapView ? 'Switch to List View' : 'Switch to Map View'"
                  class="mb-4" />

        <!-- Conditional Rendering of Views -->
        <div v-if="isMapView">
            <div class="map-container">
                <div v-for="(printer, index) in printers" :key="index">
                    <farm-printer-map-panel :printer="printer"></farm-printer-map-panel>
                </div>
                <v-btn class="edit-button" @click="toggleEditMode">{{ isEditMode ? 'Save' : 'Edit' }}</v-btn>
            </div>
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
        isEditMode: boolean = false;
        printerPositions: { [key: string]: { top: string; left: string } } = {};

        get printers() {
            return this.$store.getters['farm/getPrinters'];
        }

        toggleEditMode() {
            this.isEditMode = !this.isEditMode;
        }


        mounted() {
            // Initialize printer positions if not set
            this.printers.forEach((printer) => {
                if (!this.printerPositions[printer.id]) {
                    this.$set(this.printerPositions, printer.id, { top: '50%', left: '50%' });
                }
            });
        }

        onDragStart(event: DragEvent, printerId: string) {
            if (this.isEditMode) {
                event.dataTransfer?.setData('printerId', printerId);
            }
        }

        onDrop(event: DragEvent) {
            if (this.isEditMode) {
                const printerId = event.dataTransfer?.getData('printerId');
                if (printerId) {
                    const dropX = event.clientX;
                    const dropY = event.clientY;
                    const mapRect = this.$refs.mapContainer.getBoundingClientRect();

                    const newLeft = ((dropX - mapRect.left) / mapRect.width) * 100 + '%';
                    const newTop = ((dropY - mapRect.top) / mapRect.height) * 100 + '%';

                    this.$set(this.printerPositions, printerId, { top: newTop, left: newLeft });
                }
            }
        }
    }
</script>
