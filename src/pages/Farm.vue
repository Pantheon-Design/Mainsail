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
            <img src="@/components/ui/NewBuilding v2.png" class="map-background" alt="Map Background">
            <div v-for="(printer, key) in printers" :key="key"
                 :style="getStyle(printer)"
                 :class="{ 'draggable': isEditing }"
                 :data-printer-id="printer.socket.id"
                 @mousedown="isEditing ? startDrag($event, printer) : null">
                <farm-printer-map-panel :printer="printer" :isEditing="isEditing"></farm-printer-map-panel>
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
    import SettingsRemotePrintersTab from '@/components/settings/SettingsRemotePrintersTab.vue'
    import { number } from 'echarts/core';
    import Vue from 'vue'
    @Component({
        components: { FarmPrinterPanel, SettingsRemotePrintersTab },
    })
    export default class PageFarm extends Mixins(BaseMixin) {
        isMapView: boolean = true;
        isEditing: boolean = false;
        draggingPrinter: any = null;
        offsetX: number = 0;
        offsetY: number = 0;
        printerId: any = null;
        printerHostName: any = null;
        printerPort: any = null;
        positions: { [id: string]: { x: number, y: number } } = {};


        get printers() {
            //this.$toast.success("getting printers");
            return this.$store.getters['farm/getPrinters'];
        }

        toggleEditMode() {
            if (this.isEditing) {
                this.savePrinterPositions();
            }
            this.isEditing = !this.isEditing;
        }

        startDrag(event: MouseEvent, printer: any) {
            //this.$toast.success(printer);
            this.draggingPrinter = printer;
            this.offsetX = event.clientX - this.getPositionX(this.draggingPrinter.socket.id);
            this.offsetY = event.clientY - this.getPositionY(this.draggingPrinter.socket.id);
            this.printerId = printer.socket.id;
            this.printerHostName = printer.socket.hostname;
            this.printerPort = printer.socket.port;
            document.addEventListener('mousemove', this.onDrag);
            document.addEventListener('mouseup', this.stopDrag);
        }

        onDrag(event: MouseEvent) {
            if (this.draggingPrinter) {
                //this.$toast.success("draging")
                let x = event.clientX - this.offsetX;
                let y = event.clientY - this.offsetY;
                this.positions[this.draggingPrinter.socket.id] = { x, y };
                this.updatePrinterPositionOnDrag(this.getPositionX(this.draggingPrinter.socket.id), this.getPositionY(this.draggingPrinter.socket.id))
                //Vue.set(this.positions, this.draggingPrinter.socket.id, { x, y });

            }
        }

        stopDrag() {
            document.removeEventListener('mousemove', this.onDrag);
            document.removeEventListener('mouseup', this.stopDrag);
            this.updatePrinterPosition(this.getPositionX(this.draggingPrinter.socket.id), this.getPositionY(this.draggingPrinter.socket.id))
            this.draggingPrinter = null;

        }

        updatePrinterPosition(xpos: number, ypos: number) {
            //this.$toast.error("printer " + this.printerId + " dragged and updating x:"+ xpos + " y:" + ypos);
            const values = {
                hostname: this.printerHostName,
                port: this.printerPort,
                position: { x: xpos, y: ypos }
            }
            this.$store.dispatch('gui/remoteprinters/update', { id: this.printerId, values })
        }

        updatePrinterPositionOnDrag(xpos: number, ypos: number) {
            //this.$toast.error("printer " + this.printerId + " dragged and updating x:"+ xpos + " y:" + ypos);
            const values = {
                hostname: this.printerHostName,
                port: this.printerPort,
                position: { x: xpos, y: ypos }
            }
            this.$store.dispatch('gui/remoteprinters/updateOnDrag', { id: this.printerId, values })
        }

        getStyle(printer: any) {

            //this.$toast.error(printer?.data?.print_stats?.state);
            //convert the printer state into a color code
            let color = 'gray'; // Default color

            if (printer.data?.print_stats?.state) {
                const state = printer.data.print_stats.state;
                if (state === 'error' || state === 'paused') {
                    color = 'red';
                } else if (state === 'printing') {
                    color = 'green';
                } else if (state === 'complete') {
                    color = 'purple';
                } else if (state === 'standby') {
                    color = 'blue';
                }
            }

            this.addPosition(printer.socket.id, printer.socket.position.x, printer.socket.position.y);
            //if (!this.positions[printer.socket.id]) { this.addPosition(printer.socket.id, printer.socket.position.x, printer.socket.position.y); }
            const size = "100px"; // Diameter of the circle


            return {
                position: 'absolute',
                left: this.positions[printer.socket.id].x + 'px',
                top: this.positions[printer.socket.id].y + 'px',
                width: size,
                height: size,
                borderRadius: '50%',  // Make the div a circle visually
                overflow: 'hidden',   // Ensure content stays within the circle
                clipPath: 'circle(50%)', // Constrain interaction to the circular area
                border: "0.5em solid " + color
            };
        }

        savePrinterPositions() {
            
        }


        // Method to add a new position
        addPosition(id: string, x: number, y: number) {
            this.positions[id] = { x, y };
        }

        // Method to update an existing position
        updatePosition(id: string, x: number, y: number) {
            if (this.positions[id]) {
                this.positions[id] = { x, y };
            }
        }

        // Method to get the X position by ID
        getPositionX(id: string): number {
            const position = this.positions[id];
            return position.x;
        }

        // Method to get the Y position by ID
        getPositionY(id: string): number{
            const position = this.positions[id];
            return position.y;
        }

        // Method to remove a position by ID
        removePosition(id: string) {
            delete this.positions[id];
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
        object-fit: contain;
        position: absolute;
        left: 20px;
        z-index: 0;
        pointer-events: none;
    }

    .draggable {
        cursor: move;
        z-index: 1;
    }
</style>
