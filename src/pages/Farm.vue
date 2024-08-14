<style></style>

<template>
    <div>
        <!-- Toggle Button -->
        <v-switch v-model="isMapView"
                  :label="isMapView ? 'Switch to List View' : 'Switch to Map View'"
                  class="mb-4" />

        <!-- Edit/Save Button -->
        <v-btn v-if="isMapView" @click="toggleEditMode" class="mb-4">
            {{ isEditing ? 'Save' : 'Edit' }}
        </v-btn>

        <!-- Conditional Rendering of Views -->
        <div v-if="isMapView">
            <img src="@/components/ui/office-layout-example-3.jpg" class="map-background" alt="Map Background">
            <div v-for="(printer, key) in printers" :key="key"
                 :style="getStyle(printer)"
                 :class="{ 'draggable': isEditing }"
                 @mousedown="isEditing ? startDrag($event, printer) : null">
                <farm-printer-map-panel :printer="printer"></farm-printer-map-panel>
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
        isEditing: boolean = false;
        draggingPrinter: any = null;
        offsetX: number = 0;
        offsetY: number = 0;
        positionX: number = 100;
        positionY: number = 100;

        get printers() {
            return this.$store.getters['farm/getPrinters'];
        }

        toggleEditMode() {
            if (this.isEditing) {
                this.savePrinterPositions();
            }
            this.isEditing = !this.isEditing;
        }

        startDrag(event: MouseEvent, printer: any) {
            //this.$toast.success("");
            this.draggingPrinter = printer;
            this.offsetX = event.clientX - this.positionX;
            this.offsetY = event.clientY - this.positionY;
            document.addEventListener('mousemove', this.onDrag);
            document.addEventListener('mouseup', this.stopDrag);
        }

        onDrag(event: MouseEvent) {
            if (this.draggingPrinter) {
                this.positionX = event.clientX - this.offsetX;
                this.positionY = event.clientY - this.offsetY;
            }
        }

        stopDrag() {
            document.removeEventListener('mousemove', this.onDrag);
            document.removeEventListener('mouseup', this.stopDrag);
            this.draggingPrinter = null;
        }

        getStyle(printer: any) {
            return {
                position: 'absolute',
                left: this.positionX + 'px',
                top: this.positionY + 'px',
                width: "500px",
                height: "500px",
            };
        }

        savePrinterPositions() {
            
        }
    }
</script>

<style scoped>
    .map-view {
        position: relative;
        width: 100%;
        height: 500px;
    }

    .map-background {
        width: 100%;
        height: 100%;
        object-fit: none;
        position: absolute;
        top: 100;
        left: 0;
        z-index: 0;
        pointer-events: none;
    }

    .draggable {
        cursor: move;
        z-index: 1;
    }
</style>
