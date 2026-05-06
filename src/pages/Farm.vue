<template>
    <div>
        <!-- Toggle Button -->
        <v-switch v-model="isMapView"
                  :label="isMapView ? 'Switch to Grid Map' : 'Switch to Free Map'"
                  class="mb-4 custom-width-switch" />

        <!-- Edit/Save Button -->
        <v-btn @click="toggleEditMode" class="mb-4 mr-4">
            {{ isEditing ? 'Save' : 'Edit' }}
        </v-btn>

        <!-- Draw Button (only visible in edit mode) -->
        <v-btn v-if="isEditing" @click="toggleDrawMode" class="mb-4 mr-4" :color="isDrawing ? 'primary' : undefined">
            {{ isDrawing ? 'Done Drawing' : 'Draw' }}
        </v-btn>

        <!-- Reconnect All Button -->
        <v-btn @click="reconnectAllFleetPrinters" class="mb-4 mr-4">
            Reconnect All
        </v-btn>

        <!-- Display printer count and status breakdown -->
        <div class="printer-stats mb-4">
            <p class="mb-1">Total Printers: {{ Object.keys(fleetDaemonPrinters).length }}</p>
            <div class="status-counters">
                <span class="status-counter ready" v-if="printerStatusCounts.ready > 0">
                    <v-icon small color="hsl(90, 100%, 32%)">mdi-check-circle</v-icon> Ready: {{ printerStatusCounts.ready }}
                </span>
                <span class="status-counter printing pulsing-text" v-if="printerStatusCounts.printing > 0">
                    <v-icon small color="blue">mdi-play-circle</v-icon> Printing: {{ printerStatusCounts.printing }}
                </span>
                <span class="status-counter complete" v-if="printerStatusCounts.complete > 0">
                    <v-icon small color="blue">mdi-checkbox-marked-circle</v-icon> Complete: {{ printerStatusCounts.complete }}
                </span>
                <span class="status-counter error" v-if="printerStatusCounts.error > 0">
                    <v-icon small color="red">mdi-alert-circle</v-icon> Error: {{ printerStatusCounts.error }}
                </span>
                <span class="status-counter disconnected" v-if="printerStatusCounts.disconnected > 0">
                    <v-icon small color="gray">mdi-connection</v-icon> Disconnected: {{ printerStatusCounts.disconnected }}
                </span>
            </div>
        </div>

        <!-- Conditional Rendering of Views -->
        <div v-if="isMapView" class="map-container" @wheel="onScroll" @mousedown="startPan" @mousemove="onPan" @mouseup="endPan">
            <div class="background-container" :style="mapStyle">
                <map-drawing-overlay :editable="isEditing && isDrawing" />
                <div v-for="(printer, hostname) in fleetDaemonPrinters" :key="hostname"
                     :style="getStyle(printer)"
                     :class="{ 'draggable': isEditing && !isDrawing }"
                     :data-printer-id="hostname"
                     @mousedown="isEditing && !isDrawing ? startDrag($event, printer, hostname) : null"
                     @mouseover="showTooltip(printer, $event)"
                     @mouseleave="hideTooltip">
                    <div :style="spinningBorderStyle(printer)"></div>

                    <farm-printer-map-panel :printer="printer" :isEditing="isEditing && !isDrawing"></farm-printer-map-panel>
                </div>

                <!-- Tooltip: Shows printer details on hover -->
                <div v-if="hoveredPrinter" class="tooltip" ref="tooltip" :style="tooltipStyle">
                    <p>{{ hoveredPrinter.socket.hostname }}: {{ hoveredPrinter.print_stats?.state || 'Unknown' }}</p>
                    <p>IsConnected: {{ hoveredPrinter.socket.isConnected }}</p>
                    <p>Filament: {{ hoveredPrinter.toolhead?.filament_type || 'N/A' }}</p>
                    <p>Nozzle: {{ hoveredPrinter.toolhead?.nozzle_size || 'N/A' }}</p>
                    <p>CurrentFile: {{ hoveredPrinter.current_file?.filename || 'None' }}</p>
                    <p>Progress: {{ getPrinterPrintPercent(hoveredPrinter) }}%</p>
                    <p v-if="hoveredPrinter.webhooks?.state_message" style="white-space: pre-wrap; max-width: 300px;">
                        <strong>Webhook:</strong><br>{{ hoveredPrinter.webhooks.state_message }}
                    </p>
                </div>
            </div>
        </div>

        <div v-else class="grid-container">
            <div class="grid-background"
                 :style="{
                     width: GRID_W + 'px',
                     height: GRID_H + 'px',
                     backgroundColor: gridBackgroundColor
                 }">
                <!-- Grid lines -->
                <div class="grid-lines"
                     :style="{
                         backgroundImage: gridLinesBackgroundImage,
                         backgroundSize: gridCellWidth + 'px ' + gridCellHeight + 'px'
                     }"></div>

                <!-- Drawing overlay (scales onto the grid canvas) -->
                <map-drawing-overlay :editable="isEditing && isDrawing"
                                     :width="GRID_W"
                                     :height="GRID_H"
                                     storage-key="mapdrawing.gridStrokes" />

                <!-- Drag ghost (target cell highlight) -->
                <div v-if="gridDragGhost" :style="gridGhostStyle()"></div>

                <!-- Printer tiles -->
                <div v-for="(printer, hostname) in fleetDaemonPrinters"
                     :key="hostname"
                     :style="gridCellStyle(getPrinterGridPosition(hostname).x, getPrinterGridPosition(hostname).y)"
                     :class="{ 'grid-printer': true, 'draggable': isEditing && !isDrawing }"
                     :data-printer-id="hostname"
                     @mousedown="isEditing && !isDrawing ? startGridDrag($event, printer, hostname) : null">
                    <farm-printer-grid-panel
                        :printer="printer"
                        :is-editing="isEditing && !isDrawing"
                        :model="getPrinterModel(hostname)"
                        :fleet-daemon-connected="$store.state.farm.fleetDaemonConnected" />
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
    import { Component, Mixins, Watch } from 'vue-property-decorator';
    import BaseMixin from '@/components/mixins/base';
    import FarmPrinterMapPanel from '@/components/panels/FarmPrinterMapPanel.vue';
    import FarmPrinterGridPanel from '@/components/panels/FarmPrinterGridPanel.vue';
    import MapDrawingOverlay from '@/components/panels/MapDrawingOverlay.vue';
    import SettingsRemotePrintersTab from '@/components/settings/SettingsRemotePrintersTab.vue';
    import Vue from 'vue';
    import { fleetDaemonClient } from '@/plugins/fleetDaemonClient';
    import {
        getPrinterStatus as getPrinterStatusUtil,
        getStatusBorderStyle,
    } from '@/components/panels/farmPrinterStatus';

    @Component({
        components: {
            FarmPrinterMapPanel,
            FarmPrinterGridPanel,
            MapDrawingOverlay,
            SettingsRemotePrintersTab,
        },
    })
    export default class PageFarm extends Mixins(BaseMixin) {
        isMapView = true;
        isEditing = false;
        isDrawing = false;

        // Grid view configuration
        readonly GRID_COLS = 20;
        readonly GRID_ROWS = 15;
        readonly GRID_W = 2400;
        readonly GRID_H = 1800;

        // Map view properties
        draggingPrinter: any = null;
        draggingHostname: string = '';
        offsetX: number = 0;
        offsetY: number = 0;
        positions: { [id: string]: { x: number, y: number } } = {};

        // Grid view properties
        gridPositions: { [id: string]: { x: number, y: number } } = {};
        draggingGridHostname: string = '';
        gridDragGhost: { x: number, y: number } | null = null;

        // Zooming and panning
        scale: number = 1;
        panX: number = 0;
        panY: number = 0;
        isPanning: boolean = false;
        startX: number = 0;
        startY: number = 0;

        // Tooltip
        hoveredPrinter: any = null;
        tooltipStyle = {
            top: '0px',
            left: '0px',
            position: 'absolute',
        };

        get fleetDaemonUrl() {
            return this.$store.getters['gui/fleetDaemonUrl']
        }

        get fleetDaemonPrinters() {
            return this.$store.state.farm.fleetDaemonPrinters || {};
        }

        get printerStatusCounts() {
            const counts = {
                printing: 0,
                ready: 0,
                complete: 0,
                error: 0,
                disconnected: 0
            };

            Object.values(this.fleetDaemonPrinters).forEach((printer: any) => {
                const status = this.getPrinterStatus(printer);
                counts[status]++;
            });

            return counts;
        }

        getPrinterStatus(printer: any): 'disconnected' | 'error' | 'printing' | 'complete' | 'ready' {
            return getPrinterStatusUtil(printer, this.$store.state.farm.fleetDaemonConnected);
        }

        mounted() {
            this.loadPrinterPositions();
            this.loadGridPositions();
        }

        // Re-load positions when the remoteprinters store updates (e.g. after async DB load)
        @Watch('$store.state.gui.remoteprinters.printers', { deep: true })
        onRemotePrintersChanged() {
            this.loadPrinterPositions();
            this.loadGridPositions();
        }

        loadPrinterPositions() {
            const remotePrinters = this.$store.state.gui?.remoteprinters?.printers || {};
            Object.entries(remotePrinters).forEach(([id, printer]: [string, any]) => {
                if (printer.hostname && printer.position) {
                    Vue.set(this.positions, printer.hostname.toLowerCase(), printer.position);
                }
            });
        }

        loadGridPositions() {
            const remotePrinters = this.$store.state.gui?.remoteprinters?.printers || {};
            Object.entries(remotePrinters).forEach(([id, printer]: [string, any]) => {
                if (printer.hostname && printer.gridPosition) {
                    Vue.set(this.gridPositions, printer.hostname.toLowerCase(), printer.gridPosition);
                }
            });
        }

        toggleEditMode() {
            this.isEditing = !this.isEditing;
            if (!this.isEditing) this.isDrawing = false;
        }

        toggleDrawMode() {
            this.isDrawing = !this.isDrawing;
        }

        refreshPrinterList() {
            fetch(`${this.fleetDaemonUrl}/refresh_printer_list`, { method: 'POST' })
                .then(res => {
                    if (res.ok) {
                        Vue.$toast.success('Printer list refreshed');
                    } else {
                        throw new Error('Failed to refresh printer list');
                    }
                })
                .catch(err => {
                    console.error(err);
                    Vue.$toast.error('Failed to refresh printer list');
                });
        }

        reconnectAllFleetPrinters() {
            Vue.$toast.info('Reconnecting all printers...');

            // Reconnect the shared fleet daemon WebSocket
            fleetDaemonClient.reconnect();

            // Then trigger printer reconnect on the daemon
            fetch(`${this.fleetDaemonUrl}/reconnect_all`, { method: 'POST' })
                .then(res => {
                    if (res.ok) {
                        Vue.$toast.success('Reconnecting all printers...');
                    } else {
                        throw new Error('Failed to reconnect');
                    }
                })
                .catch(err => {
                    console.error(err);
                    Vue.$toast.error('Failed to trigger reconnect');
                });
        }

        // Map view methods
        startDrag(event: MouseEvent, printer: any, hostname: string) {
            this.draggingPrinter = printer;
            this.draggingHostname = hostname;
            const currentPos = this.getPrinterPosition(hostname);

            this.offsetX = (event.clientX - (currentPos.x * this.scale + this.panX)) / this.scale;
            this.offsetY = (event.clientY - (currentPos.y * this.scale + this.panY)) / this.scale;

            document.addEventListener('mousemove', this.onDrag);
            document.addEventListener('mouseup', this.stopDrag);
        }

        onDrag(event: MouseEvent) {
            if (this.draggingPrinter && this.draggingHostname) {
                let x = (event.clientX - this.panX) / this.scale - this.offsetX;
                let y = (event.clientY - this.panY) / this.scale - this.offsetY;

                Vue.set(this.positions, this.draggingHostname.toLowerCase(), { x, y });
            }
        }

        stopDrag() {
            document.removeEventListener('mousemove', this.onDrag);
            document.removeEventListener('mouseup', this.stopDrag);

            if (this.draggingPrinter && this.draggingHostname) {
                // Save position to remoteprinters config
                const position = this.positions[this.draggingHostname.toLowerCase()];
                if (position) {
                    this.updatePrinterPosition(this.draggingHostname, position.x, position.y);
                }
            }

            this.draggingPrinter = null;
            this.draggingHostname = '';
        }

        updatePrinterPosition(hostname: string, x: number, y: number) {
            // Find the printer ID in remoteprinters config
            const remotePrinters = this.$store.state.gui?.remoteprinters?.printers || {};
            let printerId = null;

            const key = hostname.toLowerCase();
            for (const [id, printer] of Object.entries(remotePrinters)) {
                if ((printer as any).hostname?.toLowerCase() === key) {
                    printerId = id;
                    break;
                }
            }

            if (printerId) {
                const values = {
                    hostname: hostname,
                    port: 7125,
                    position: { x, y }
                };
                this.$store.dispatch('gui/remoteprinters/updateOnDrag', { id: printerId, values });
            }
        }

        getPrinterPosition(hostname: string): { x: number, y: number } {
            const key = hostname.toLowerCase();
            // Check local cache first (updated by drag operations)
            if (this.positions[key]) {
                return this.positions[key];
            }
            // Fall back to store (database values) - case-insensitive match
            const remotePrinters = this.$store.state.gui?.remoteprinters?.printers || {};
            for (const printer of Object.values(remotePrinters)) {
                if ((printer as any).hostname?.toLowerCase() === key && (printer as any).position) {
                    // Cache it for future lookups
                    Vue.set(this.positions, key, (printer as any).position);
                    return (printer as any).position;
                }
            }
            return { x: 400, y: 400 };
        }

        getPrinterModel(hostname: string): 'HS-3' | 'HS-Pro' | null {
            const key = hostname.toLowerCase();
            const remotePrinters = this.$store.state.gui?.remoteprinters?.printers || {};
            for (const printer of Object.values(remotePrinters)) {
                if ((printer as any).hostname?.toLowerCase() === key) {
                    return (printer as any).printerModel ?? null;
                }
            }
            return null;
        }

        // ========= Grid view ==========
        get gridCellWidth(): number {
            return this.GRID_W / this.GRID_COLS;
        }

        get gridCellHeight(): number {
            return this.GRID_H / this.GRID_ROWS;
        }

        get gridBackgroundColor(): string {
            return this.$vuetify.theme.dark ? '#1e1e1f' : '#fafafa';
        }

        get gridLinesBackgroundImage(): string {
            const stroke = this.$vuetify.theme.dark
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(0, 0, 0, 0.12)';
            return `linear-gradient(to right, ${stroke} 1px, transparent 1px),
                    linear-gradient(to bottom, ${stroke} 1px, transparent 1px)`;
        }

        getPrinterGridPosition(hostname: string): { x: number, y: number } {
            const key = hostname.toLowerCase();
            if (this.gridPositions[key]) return this.gridPositions[key];

            const remotePrinters = this.$store.state.gui?.remoteprinters?.printers || {};
            for (const printer of Object.values(remotePrinters)) {
                if ((printer as any).hostname?.toLowerCase() === key && (printer as any).gridPosition) {
                    Vue.set(this.gridPositions, key, (printer as any).gridPosition);
                    return (printer as any).gridPosition;
                }
            }
            return { x: 1, y: 1 };
        }

        gridCellStyle(gx: number, gy: number) {
            return {
                position: 'absolute',
                left: ((gx - 1) * this.gridCellWidth) + 'px',
                top: ((gy - 1) * this.gridCellHeight) + 'px',
                width: this.gridCellWidth + 'px',
                height: this.gridCellHeight + 'px',
            };
        }

        gridGhostStyle() {
            if (!this.gridDragGhost) return { display: 'none' };
            return {
                position: 'absolute',
                left: ((this.gridDragGhost.x - 1) * this.gridCellWidth) + 'px',
                top: ((this.gridDragGhost.y - 1) * this.gridCellHeight) + 'px',
                width: this.gridCellWidth + 'px',
                height: this.gridCellHeight + 'px',
                backgroundColor: 'rgba(33, 150, 243, 0.25)',
                border: '2px dashed #2196f3',
                pointerEvents: 'none',
                zIndex: 3,
                boxSizing: 'border-box',
            };
        }

        startGridDrag(event: MouseEvent, printer: any, hostname: string) {
            event.preventDefault();
            this.draggingPrinter = printer;
            this.draggingGridHostname = hostname;
            const current = this.getPrinterGridPosition(hostname);
            this.gridDragGhost = { x: current.x, y: current.y };

            document.addEventListener('mousemove', this.onGridDrag);
            document.addEventListener('mouseup', this.stopGridDrag);
        }

        onGridDrag(event: MouseEvent) {
            if (!this.draggingGridHostname) return;
            const container = document.querySelector('.grid-background') as HTMLElement | null;
            if (!container) return;

            const rect = container.getBoundingClientRect();
            const rawX = event.clientX - rect.left;
            const rawY = event.clientY - rect.top;

            const gx = Math.min(this.GRID_COLS, Math.max(1, Math.floor(rawX / this.gridCellWidth) + 1));
            const gy = Math.min(this.GRID_ROWS, Math.max(1, Math.floor(rawY / this.gridCellHeight) + 1));

            this.gridDragGhost = { x: gx, y: gy };
        }

        stopGridDrag() {
            document.removeEventListener('mousemove', this.onGridDrag);
            document.removeEventListener('mouseup', this.stopGridDrag);

            if (this.draggingGridHostname && this.gridDragGhost) {
                Vue.set(this.gridPositions, this.draggingGridHostname.toLowerCase(), { ...this.gridDragGhost });
                this.updatePrinterGridPosition(this.draggingGridHostname, this.gridDragGhost.x, this.gridDragGhost.y);
            }

            this.draggingPrinter = null;
            this.draggingGridHostname = '';
            this.gridDragGhost = null;
        }

        updatePrinterGridPosition(hostname: string, gx: number, gy: number) {
            const remotePrinters = this.$store.state.gui?.remoteprinters?.printers || {};
            let printerId: string | null = null;

            const key = hostname.toLowerCase();
            for (const [id, printer] of Object.entries(remotePrinters)) {
                if ((printer as any).hostname?.toLowerCase() === key) {
                    printerId = id;
                    break;
                }
            }

            if (printerId) {
                this.$store.dispatch('gui/remoteprinters/updateOnDrag', {
                    id: printerId,
                    values: { gridPosition: { x: gx, y: gy } },
                });
            }
        }
        // ========= /Grid view ==========

         getStyle(printer: any) {
            const hostname = printer.socket?.hostname || '';
            // Local positions cache (updated by drag) takes priority, then socket data, then store lookup
            const position = this.positions[hostname.toLowerCase()] || printer.socket?.position || this.getPrinterPosition(hostname);
            const size = "25px";

            // Determine style based on model
            const model = printer.socket?.printerModel || this.getPrinterModel(hostname);
            const clip = model === 'HS-Pro' ? 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' : 'circle(50%)';

            return {
                position: 'absolute',
                left: position.x + 'px',
                top: position.y + 'px',
                width: size,
                height: size,
                borderRadius: model === 'HS-Pro' ? '0%' : '50%',
                clipPath: clip,
                backgroundColor: 'transparent'
            };
        }


        spinningBorderStyle(printer: any) {
            const hostname = printer.socket?.hostname || '';
            const model = printer.socket?.printerModel || this.getPrinterModel(hostname);
            return getStatusBorderStyle(printer, model, this.$store.state.farm.fleetDaemonConnected, 0.25);
        }


        // Zoom and pan methods
        get mapStyle() {
            return {
                transform: `scale(${this.scale}) translate(${this.panX}px, ${this.panY}px)`
            };
        }

        onScroll(event: WheelEvent) {
            event.preventDefault();
            const delta = event.deltaY > 0 ? -0.1 : 0.1;
            this.scale = Math.min(Math.max(this.scale + delta, 0.5), 3);
        }

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

        // Fixed tooltip method - keeps your coordinate system, adds left edge check
        showTooltip(printer: any, event: MouseEvent) {
            this.hoveredPrinter = printer;

            this.$nextTick(() => {
                const tooltipElement = this.$refs.tooltip as HTMLElement;
                if (!tooltipElement) return;

                const hostname = printer.socket?.hostname || '';
                const printerPosition = this.positions[hostname] || { x: 400, y: 400 };
                const screenWidth = window.innerWidth;
                const tooltipWidth = tooltipElement.offsetWidth;

                // DEFAULT: Position tooltip 50px to the RIGHT of printer
                let tooltipLeft = printerPosition.x + 50;

                // CHECK: If tooltip would go off RIGHT edge of screen
                if (event.clientX + tooltipWidth > (screenWidth - 300)) {
                    // Move tooltip to the LEFT of printer
                    tooltipLeft = printerPosition.x - tooltipWidth + 20;

                    // NEW: Check if moving to left would go off LEFT edge of screen
                    if (tooltipLeft < 10) {
                        // If left positioning would go off screen, force it to stay on right
                        tooltipLeft = printerPosition.x + 50;
                        // And if right is still too far, clamp it to screen edge
                        if (tooltipLeft + tooltipWidth > screenWidth - 10) {
                            tooltipLeft = screenWidth - tooltipWidth - 10;
                        }
                    }
                }

                this.tooltipStyle.top = `${printerPosition.y + 20}px`;
                this.tooltipStyle.left = `${tooltipLeft - 20}px`;
            });
        }

        hideTooltip() {
            this.hoveredPrinter = null;
        }

        openAddPrinterDialog() {
            //TODO: jump to settings button then Printers, then add printer to get to the settingsremoteprintertab
        }

        getPrinterPrintPercent(printer: any) {
            const progress = printer.virtual_sdcard?.progress || 0;
            return Math.floor(progress * 100);
        }
    }
</script>

<style scoped>
    .map-container {
        position: relative;
        width: 100%;
        height: 600px;
    }

    .background-container {
        background-image: url('@/components/ui/NewBuilding v2.png');
        background-size: 100% 100%;
        background-repeat: no-repeat;
        background-position: left;
        width: 1000px;
        height: 500px;
        position: absolute;
    }

    .custom-width-switch {
        width: 200px;
    }

    .draggable {
        cursor: move;
        z-index: 1;
        background-image: url('@/components/ui/logo.png');
        background-size: 55% 55%;
        background-repeat: no-repeat;
        background-position: center;
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
    }

    /* Status counter styles */
    .printer-stats {
        font-size: 14px;
    }

    .status-counters {
        display: flex;
        gap: 15px;
        flex-wrap: wrap;
    }

    .status-counter {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 2px 8px;
        border-radius: 4px;
        background-color: rgba(0, 0, 0, 0.05);
    }

        .status-counter.printing {
            color: #1976d2;
        }

        .status-counter.ready {
            color: hsl(90, 100%, 32%);
        }

        .status-counter.complete {
            color: #1976d2;
        }

        .status-counter.error {
            color: #d32f2f;
        }

        .status-counter.disconnected {
            color: #757575;
        }

    @keyframes pulse {
        0%, 100% {
            opacity: 1;
        }

        50% {
            opacity: 0.4;
        }
    }

    .pulsing-text {
        animation: pulse 1.5s infinite;
    }

    /* ========= Grid Map view ========= */
    .grid-container {
        position: relative;
        width: 100%;
        overflow: auto;
    }

    .grid-background {
        position: relative;
    }

    .grid-lines {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 0;
    }

    .grid-printer {
        z-index: 1;
        box-sizing: border-box;
        padding: 4px;
    }

    .grid-printer.draggable {
        cursor: move;
    }

</style>
