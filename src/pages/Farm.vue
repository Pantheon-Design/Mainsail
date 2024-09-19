<template>
    <div>
        <!-- Toggle Button -->
        <v-switch v-model="isMapView"
                  :label="isMapView ? 'Switch to List View' : 'Switch to Map View'"
                  class="mb-4 custom-width-switch" />
        <!-- Edit/Save Button -->
        <v-btn v-if="isMapView" @click="toggleEditMode" class="mb-4 mr-4">
            {{ isEditing ? 'Save' : 'Edit' }}
        </v-btn>

        <!-- Reconnect All Button -->
        <v-btn v-if="isMapView" @click="reconnectAllPrinters" class="mb-4 mr-4">
            Reconnect All
        </v-btn>

        <!-- Add Printer Button -->
        <v-btn v-if="isMapView" @click="openAddPrinterDialog" class="mb-4">
            WIP:Add Printer
        </v-btn>

        <!-- Conditional Rendering of Views -->
        <div v-if="isMapView" class="map-container" @wheel="onScroll" @mousedown="startPan" @mousemove="onPan" @mouseup="endPan">
            <div class="background-container" :style="mapStyle">
                <div v-for="(printer, key) in printers" :key="key"
                     :style="getStyle(printer)"
                     :class="{ 'draggable': isEditing }"
                     :data-printer-id="printer.socket.id"
                     @mousedown="isEditing ? startDrag($event, printer) : null"
                     @mouseover="showTooltip(printer, $event)"
                     @mouseleave="hideTooltip">
                    <div :style="spinningBorderStyle(printer)"></div>

                    <farm-printer-map-panel :printer="printer" :isEditing="isEditing"></farm-printer-map-panel>
                </div>
                <!-- Tooltip: Shows printer details on hover -->
                <div v-if="hoveredPrinter" class="tooltip" ref="tooltip" :style="tooltipStyle">
                    <p>{{ hoveredPrinter.socket.hostname }}: {{ hoveredPrinter.data.print_stats.state }}</p>
                    <p>IsConnected: {{ hoveredPrinter.socket.isConnected }}</p>
                    <p>Filament: {{ hoveredPrinter.data.toolhead.filament_type }}</p>
                    <p>Nozzle: {{ hoveredPrinter.data.toolhead.nozzle_size }}</p>
                    <p>CurrentFile: {{ hoveredPrinter.current_file.filename }}</p>
                    <p>Progress: {{ getPrinterPrintPercent(hoveredPrinter) }}%</p>

                </div>
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
            components: { FarmPrinterPanel, SettingsRemotePrintersTab},
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


            // properties for zooming and panning
            scale: number = 1;             // Zoom level
            panX: number = 0;              // Horizontal pan offset
            panY: number = 0;              // Vertical pan offset
            isPanning: boolean = false;    // Flag for panning state
            startX: number = 0;            // Initial X position for pan
            startY: number = 0;            // Initial Y position for pan

            hoveredPrinter: any = null; // Mutable data property for hoveredPrinter
            tooltipStyle = {
                top: '0px',
                left: '0px',
                position: 'absolute',
            };

            get printPercent() {
                return Math.floor(this.$store.getters['printer/getPrintPercent'] * 100)
            }

            get printers() {
                //this.$toast.success("getting printers");
                return this.$store.getters['farm/getPrinters'];
            }

            toggleEditMode() {
                this.isEditing = !this.isEditing;
            }

            startDrag(event: MouseEvent, printer: any) {
                //console.log(this.$store.state);
                console.log(printer);
                this.getRemotePrinters();
                //this.$toast.success(printer);
                //if (printer.data?.print_stats?.state) this.$toast.error(printer.data?.print_stats?.state)
                this.draggingPrinter = printer;
                this.offsetX = (event.clientX - (this.getPositionX(this.draggingPrinter.socket.id) * this.scale + this.panX)) / this.scale;
                this.offsetY = (event.clientY - (this.getPositionY(this.draggingPrinter.socket.id) * this.scale + this.panY)) / this.scale;

                //console.log("mouse position X: " + event.clientX + " Y: " + event.clientY);
                //console.log("printer position X: " + this.getPositionX(this.draggingPrinter.socket.id) + " Y: " + this.getPositionY(this.draggingPrinter.socket.id));
                //console.log("offset X: " + this.offsetX + " Y: " + this.offsetY);

                this.printerId = printer.socket.id;
                this.printerHostName = printer.socket.hostname;
                this.printerPort = printer.socket.port;
                document.addEventListener('mousemove', this.onDrag);
                document.addEventListener('mouseup', this.stopDrag);
            }

            onDrag(event: MouseEvent) {
                if (this.draggingPrinter) {
                    let x = (event.clientX - this.panX) / this.scale - this.offsetX;
                    let y = (event.clientY - this.panY) / this.scale - this.offsetY;

                    this.positions[this.draggingPrinter.socket.id] = { x, y };
                    this.updatePrinterPositionOnDrag(this.getPositionX(this.draggingPrinter.socket.id), this.getPositionY(this.draggingPrinter.socket.id))
                }
            }

            stopDrag() {
                document.removeEventListener('mousemove', this.onDrag);
                document.removeEventListener('mouseup', this.stopDrag);
                this.updatePrinterPosition(this.getPositionX(this.draggingPrinter.socket.id), this.getPositionY(this.draggingPrinter.socket.id))
                this.draggingPrinter = null;

            }

            updatePrinterPosition(xpos: number, ypos: number) {
                //this.$toast.error("printer " + this.printerId);
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

            getRemotePrinters() {
                //this.$toast.error('1')
                this.$store.dispatch('gui/remoteprinters/getRemotePrinters', { id: this.printerId})
            }

            getStyle(printer: any) {

                //this.$toast.error(printer?.data?.print_stats?.state);
                //convert the printer state into a color code

                this.addPosition(printer.socket.id, printer.socket.position.x, printer.socket.position.y);
                //if (!this.positions[printer.socket.id]) { this.addPosition(printer.socket.id, printer.socket.position.x, printer.socket.position.y); }
                const size = "25px"; // Diameter of the circle


                return {
                    position: 'absolute',
                    left: this.positions[printer.socket.id].x + 'px',
                    top: this.positions[printer.socket.id].y + 'px',
                    width: size,
                    height: size,
                    borderRadius: '50%',  // Make the div a circle visually
                    overflow: 'hidden',   // Ensure content stays within the circle
                    clipPath: 'circle(50%)', // Constrain interaction to the circular area
                    backgroundColor: 'transparent'
                };
            }
            spinningBorderStyle(printer: any) {
                let color = 'gray'; // Default color

                // Check if the printer is connected
                if (!printer.socket.isConnected) {
                    // If the printer is not connected, return gray style
                    return {
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        border: "0.25em solid gray", // Gray border for disconnected state
                        zIndex: 2, // Ensure the border is above the content
                        pointerEvents: 'none', // Prevent the spinning border from capturing mouse events
                    };
                }

                if (printer.data?.print_stats?.state) {
                    const state = printer.data.print_stats.state;
                    if (state === 'error' || state === 'paused' || state === 'cancelled') {
                        color = 'red';
                    } else if (state === 'printing') {
                        color = 'blue';
                        return {
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            borderRadius: '50%',
                            background: `conic-gradient(transparent 0%, ${color} 10%, transparent 90%)`, // Gradient effect
                            mask: "radial-gradient(farthest-side, transparent calc(100% - 0.3em), black calc(100% - 0.3em))",
                            animation: 'spin 2s linear infinite', // Apply spinning animation
                            zIndex: 2, // Ensure the border is above the content
                            pointerEvents: 'none', // Prevent the spinning border from capturing mouse events
                        };
                    } else if (state === 'complete') {
                        color = 'blue';
                    } else if (state === 'standby') {
                        color = 'hsl(90, 100%, 32%)';
                    }
                }
                return {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    border: "0.25em solid "+color, // Transparent base for the border
                    zIndex: 2, // Ensure the border is above the content
                    pointerEvents: 'none', // Prevent the spinning border from capturing mouse events
                };

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

            // Computed property for map styling (zoom and pan)
            get mapStyle() {
                return {
                    transform: `scale(${this.scale}) translate(${this.panX}px, ${this.panY}px)`
                };
            }

            // Method for zooming the map
            onScroll(event: WheelEvent) {
                event.preventDefault();
                const delta = event.deltaY > 0 ? -0.1 : 0.1;
                this.scale = Math.min(Math.max(this.scale + delta, 0.5), 3); // Limit zoom level between 0.5 and 3
            }

            // Methods for handling panning of the map
            startPan(event: MouseEvent) {
                if (!this.isEditing) {
                    this.isPanning = true;
                    this.startX = event.clientX - this.panX * this.scale;
                    this.startY = event.clientY - this.panY * this.scale;
                }
            }

            onPan(event: MouseEvent) {
                if (this.isPanning) {
                    this.panX = (event.clientX - this.startX) / this.scale;
                    this.panY = (event.clientY - this.startY) / this.scale;
                }
            }

            endPan() {
                this.isPanning = false;
            }

            // Show the tooltip
            showTooltip(printer: any, event: MouseEvent) {
                this.hoveredPrinter = printer;

                this.$nextTick(() => {
                    const tooltipElement = this.$refs.tooltip as HTMLElement;

                    if (!tooltipElement) return;
                    // Get the position of the printer element
                    const printerPosition = this.positions[printer.socket.id];

                    // Get the width of the screen and tooltip
                    const screenWidth = window.innerWidth;
                    const tooltipWidth = tooltipElement.offsetWidth;// Set the tooltip's width 

                    // Calculate the default tooltip position (to the right of the printer)
                    let tooltipLeft = this.positions[printer.socket.id].x + 50;

                    // If the tooltip is too close to the right edge, move it to the left side
                    if (event.clientX + tooltipWidth > (screenWidth - 300)) {
                        tooltipLeft = this.positions[printer.socket.id].x - tooltipWidth + 20; // Move tooltip to the left
                    }

                    // Set the tooltip position
                    this.tooltipStyle.top = `${this.positions[printer.socket.id].y + 20}px`; // Adjust to position above the mouse
                    this.tooltipStyle.left = `${tooltipLeft - 20}px`;
                });
            }
            // Hides the tooltip
            hideTooltip() {
                this.hoveredPrinter = null;
            }

            // Reconnect all printers by dispatching Vuex actions
            reconnectAllPrinters() {
                const printersArray = Object.values(this.printers); // Convert the object to an array

                if (printersArray.length > 0) {
                    printersArray.forEach((printer: any) => {
                        this.$store.dispatch('farm/' + printer._namespace + '/reconnect');
                    });
                } else {
                    console.warn('No printers available to reconnect');
                }
            }

            openAddPrinterDialog() {
                const settingsMenu = this.$refs.settingsMenu as any;
                settingsMenu.activeTab = 'remote-printers';
                settingsMenu.showSettings = true;            }

            getPrinterPrintPercent(printer: any) {
                return Math.floor(this.$store.getters['farm/' + printer._namespace + '/getPrintPercent']*100);
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

        .background-container {
            background-image: url('@/components/ui/NewBuilding v2.png');
            background-size: 100% 100%; /* Retains the aspect ratio */
            background-repeat: no-repeat; /* Prevents repeating the image */
            background-position: left; /* Centers the image */
            width: 1000px;
            height: 500px; /* Adjusts the height automatically */
            position: absolute;
        }

        .custom-width-switch {
            width: 200px; /* Set the desired width */
        }

        .draggable {
            cursor: move;
            z-index: 1;
            background-image: url('@/components/ui/logo.png');
            background-size: 55% 55%; /* Retains the aspect ratio */
            background-repeat: no-repeat; /* Prevents repeating the image */
            background-position: center; /* Centers the image */
            position: absolute;
            background-color: #424143;
        }

        @keyframes spin {
            from {
                transform: rotate(0);
            }

            to {
                transform: rotate(360deg);
            }
        }

        .tooltip {
            position: absolute;
            background-color: rgba(0, 0, 0, 0.75);
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            white-space: nowrap;
            z-index: 10;
            top: -50px; /* Adjust based on your printer element */
            left: 0; /* Adjust as needed */
        }

    </style>
