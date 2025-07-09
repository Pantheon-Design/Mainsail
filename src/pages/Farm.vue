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
        <v-btn @click="reconnectAllFleetPrinters" class="mb-4 mr-4">
            Reconnect All
        </v-btn>

        <!-- Refresh Printer List Button 
        <v-btn @click="refreshPrinterList" class="mb-4 mr-4">
            Refresh Printer List
        </v-btn>
        -->

        <!-- Add Printer Button 
        <v-btn v-if="isMapView" @click="openAddPrinterDialog" class="mb-4">
            WIP:Add Printer
        </v-btn>
        -->

        <!-- Display printer count -->
        <p>Total Printers: {{ Object.keys(fleetDaemonPrinters).length }}</p>

        <!-- Conditional Rendering of Views -->
        <div v-if="isMapView" class="map-container" @wheel="onScroll" @mousedown="startPan" @mousemove="onPan" @mouseup="endPan">
            <div class="background-container" :style="mapStyle">
                <div v-for="(printer, hostname) in fleetDaemonPrinters" :key="hostname"
                     :style="getStyle(printer)"
                     :class="{ 'draggable': isEditing }"
                     :data-printer-id="hostname"
                     @mousedown="isEditing ? startDrag($event, printer, hostname) : null"
                     @mouseover="showTooltip(printer, $event)"
                     @mouseleave="hideTooltip">
                    <div :style="spinningBorderStyle(printer)"></div>

                    <farm-printer-map-panel :printer="printer" :isEditing="isEditing"></farm-printer-map-panel>
                </div>

                <!-- Tooltip: Shows printer details on hover -->
                <div v-if="hoveredPrinter" class="tooltip" ref="tooltip" :style="tooltipStyle">
                    <p>{{ hoveredPrinter.socket.hostname }}: {{ hoveredPrinter.print_stats?.state || 'Unknown' }}</p>
                    <p>IsConnected: {{ hoveredPrinter.socket.isConnected }}</p>
                    <p>Filament: {{ hoveredPrinter.toolhead?.filament_type || 'N/A' }}</p>
                    <p>Nozzle: {{ hoveredPrinter.toolhead?.nozzle_size || 'N/A' }}</p>
                    <p>CurrentFile: {{ hoveredPrinter.current_file?.filename || 'None' }}</p>
                    <p>Progress: {{ getPrinterPrintPercent(hoveredPrinter) }}%</p>
                </div>
            </div>
        </div>

        <div v-else>
            <v-row>
                <v-col v-for="(printer, hostname) in fleetDaemonPrinters"
                       :key="hostname"
                       class="col-12 col-sm-6 col-md-4 pb-0">
                    <farm-printer-panel :hostname="hostname" :printer-data="printer" />
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
    import SettingsRemotePrintersTab from '@/components/settings/SettingsRemotePrintersTab.vue';
    import Vue from 'vue';

    @Component({
        components: {
            FarmPrinterPanel,
            FarmPrinterMapPanel,
            SettingsRemotePrintersTab,
        },
    })
    export default class PageFarm extends Mixins(BaseMixin) {
        isMapView = true;
        isEditing = false;
        fleetSocket: WebSocket | null = null;
        reconnectTimer: any = null;

        // Map view properties
        draggingPrinter: any = null;
        draggingHostname: string = '';
        offsetX: number = 0;
        offsetY: number = 0;
        positions: { [id: string]: { x: number, y: number } } = {};

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

        get fleetDaemonPrinters() {
            return this.$store.state.farm.fleetDaemonPrinters || {};
        }

        mounted() {
            this.connectWebSocket();
            // Load saved positions from remoteprinters config
            this.loadPrinterPositions();
        }

        beforeDestroy() {
            this.cleanup();
        }

        cleanup() {
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            if (this.fleetSocket) {
                this.fleetSocket.close();
                this.fleetSocket = null;
            }
        }

        connectWebSocket() {
            if (this.fleetSocket) {
                this.fleetSocket.close();
            }

            try {
                this.fleetSocket = new WebSocket('ws://pantheonfleet2.local:8090/ws');

                this.fleetSocket.onopen = () => {
                    Vue.$toast.success('Connected to Fleet Daemon');
                    // Clear any reconnect timer
                    if (this.reconnectTimer) {
                        clearTimeout(this.reconnectTimer);
                        this.reconnectTimer = null;
                    }
                };

                this.fleetSocket.onmessage = (event: MessageEvent) => {
                    try {
                        const message = JSON.parse(event.data);
                        if (message.removed && message.hostname) {
                            // Handle printer removal
                            this.$store.commit('farm/REMOVE_FLEET_DAEMON_PRINTER', message.hostname);
                            Vue.$toast.info(`Printer ${message.hostname} removed`);
                        } else if (message.hostname && message.update) {
                            // Handle printer update
                            const printerData = {
                                socket: {
                                    hostname: message.hostname,
                                    isConnected: true,
                                    webPort: 80,
                                    position: this.positions[message.hostname] || { x: 400, y: 400 }
                                },
                                ...message.update,
                                current_file: {
                                    filename: message.update?.print_stats?.filename ?? '',
                                },
                                _namespace: message.hostname // Add namespace for compatibility
                            };
                            //Vue.$toast.success('msg=' + JSON.stringify(message));

                            this.$store.commit('farm/SET_FLEET_DAEMON_PRINTER', {
                                hostname: message.hostname,
                                data: printerData
                            });
                        }
                    } catch (e) {
                        console.warn('Fleet daemon WS error:', e);
                    }
                };

                this.fleetSocket.onclose = () => {
                    console.warn('Fleet daemon WebSocket closed');
                    this.fleetSocket = null;
                    Vue.$toast.warning('Disconnected from Fleet Daemon');

                    // Attempt to reconnect after 5 seconds
                    this.reconnectTimer = setTimeout(() => {
                        this.connectWebSocket();
                    }, 5000);
                };

                this.fleetSocket.onerror = (error) => {
                    console.error('Fleet daemon WebSocket error:', error);
                    Vue.$toast.error('Fleet Daemon connection error');
                };

            } catch (e) {
                console.error('Failed to create WebSocket:', e);
                Vue.$toast.error('Failed to connect to Fleet Daemon');

                // Retry after 5 seconds
                this.reconnectTimer = setTimeout(() => {
                    this.connectWebSocket();
                }, 5000);
            }
        }

        loadPrinterPositions() {
            // Load positions from remoteprinters config if available
            const remotePrinters = this.$store.state.gui?.remoteprinters?.printers || {};
            Object.entries(remotePrinters).forEach(([id, printer]: [string, any]) => {
                if (printer.hostname && printer.position) {
                    this.positions[printer.hostname] = printer.position;
                }
            });
        }

        toggleEditMode() {
            this.isEditing = !this.isEditing;
        }

        refreshPrinterList() {
            fetch('http://pantheonfleet2.local:8090/refresh_printer_list', { method: 'POST' })
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

            // Run reconnect logic twice
            this._reconnectAllFleetPrinters();
            setTimeout(() => {
                this._reconnectAllFleetPrinters();
            }, 50); // Small delay to prevent websocket race
        }

        _reconnectAllFleetPrinters() {
            // First reconnect WebSocket
            this.cleanup();
            this.connectWebSocket();

            // Then trigger printer reconnect
            Vue.$toast.info('Reconnecting all printers...');

            fetch('http://pantheonfleet2.local:8090/reconnect_all', { method: 'POST' })
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
            const currentPos = this.positions[hostname] || { x: 400, y: 400 };

            this.offsetX = (event.clientX - (currentPos.x * this.scale + this.panX)) / this.scale;
            this.offsetY = (event.clientY - (currentPos.y * this.scale + this.panY)) / this.scale;

            document.addEventListener('mousemove', this.onDrag);
            document.addEventListener('mouseup', this.stopDrag);
        }

        onDrag(event: MouseEvent) {
            if (this.draggingPrinter && this.draggingHostname) {
                let x = (event.clientX - this.panX) / this.scale - this.offsetX;
                let y = (event.clientY - this.panY) / this.scale - this.offsetY;

                this.positions[this.draggingHostname] = { x, y };
                this.$forceUpdate(); // Force re-render
            }
        }

        stopDrag() {
            document.removeEventListener('mousemove', this.onDrag);
            document.removeEventListener('mouseup', this.stopDrag);

            if (this.draggingPrinter && this.draggingHostname) {
                // Save position to remoteprinters config
                const position = this.positions[this.draggingHostname];
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

            for (const [id, printer] of Object.entries(remotePrinters)) {
                if ((printer as any).hostname === hostname) {
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
                this.$store.dispatch('gui/remoteprinters/update', { id: printerId, values });
            }
        }

        getStyle(printer: any) {
            const hostname = printer.socket?.hostname || '';
            const position = this.positions[hostname] || { x: 400, y: 400 };
            const size = "25px";

            return {
                position: 'absolute',
                left: position.x + 'px',
                top: position.y + 'px',
                width: size,
                height: size,
                borderRadius: '50%',
                overflow: 'hidden',
                clipPath: 'circle(50%)',
                backgroundColor: 'transparent'
            };
        }

        spinningBorderStyle(printer: any) {
            let color = 'gray';
            const fleetDisconnected = printer.fleet_to_printer_ws === false;

            // Check both fleet daemon connection AND individual printer connection
            if (!this.fleetSocket || this.fleetSocket.readyState !== WebSocket.OPEN || !printer.socket?.isConnected|| fleetDisconnected) {
                return {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    border: "0.25em solid gray",
                    zIndex: 2,
                    pointerEvents: 'none',
                };
            }

            const state = printer.print_stats?.state;
            if (state) {
                if (state === 'error' || state === 'paused' || state === 'cancelled') {
                    color = 'red';
                } else if (state === 'printing') {
                    return {
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        background: `conic-gradient(transparent 0%, blue 10%, transparent 90%)`,
                        mask: "radial-gradient(farthest-side, transparent calc(100% - 0.3em), black calc(100% - 0.3em))",
                        animation: 'spin 2s linear infinite',
                        zIndex: 2,
                        pointerEvents: 'none',
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
                border: `0.25em solid ${color}`,
                zIndex: 2,
                pointerEvents: 'none',
            };
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

        // Tooltip methods
        showTooltip(printer: any, event: MouseEvent) {
            this.hoveredPrinter = printer;

            this.$nextTick(() => {
                const tooltipElement = this.$refs.tooltip as HTMLElement;
                if (!tooltipElement) return;

                const hostname = printer.socket?.hostname || '';
                const printerPosition = this.positions[hostname] || { x: 400, y: 400 };
                const screenWidth = window.innerWidth;
                const tooltipWidth = tooltipElement.offsetWidth;

                let tooltipLeft = printerPosition.x + 50;

                if (event.clientX + tooltipWidth > (screenWidth - 300)) {
                    tooltipLeft = printerPosition.x - tooltipWidth + 20;
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
        overflow: hidden;
        border: 1px solid #ccc;
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
</style>
