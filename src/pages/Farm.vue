<template>
    <div>
        <v-switch v-model="isMapView"
                  :label="isMapView ? 'Switch to List View' : 'Switch to Map View'"
                  class="mb-4 custom-width-switch" />

        <v-btn v-if="isMapView" @click="toggleEditMode" class="mb-4 mr-4">
            {{ isEditing ? 'Save' : 'Edit' }}
        </v-btn>

        <v-btn v-if="isMapView" @click="reconnectAllPrinters" class="mb-4 mr-4">
            Reconnect All
        </v-btn>

        <v-btn v-if="isMapView" @click="openAddPrinterDialog" class="mb-4">
            WIP:Add Printer
        </v-btn>

        <div v-if="isMapView">
            <p>Total (map): {{ Object.keys(printers).length }}</p>
            <p>Toggle: {{ isMapView }}</p>
            <div class="background-container">
                <!-- map implementation here -->
            </div>
        </div>
        <div v-else>
            <p>Total (list): {{ Object.keys(fleetDaemonPrinters).length }}</p>
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

        get printers() {
            return this.$store.getters['farm/getPrinters'] || {};
        }

        get fleetDaemonPrinters() {
            return this.$store.state.farm.fleetDaemonPrinters || {};
        }

        mounted() {
            this.fleetSocket = new WebSocket('ws://pantheonfleet2.local:8090/ws');
            Vue.$toast.success('1');
            this.fleetSocket.onmessage = (event: MessageEvent) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.hostname && message.update) {
                        this.$store.commit('farm/SET_FLEET_DAEMON_PRINTERS', {
                            [message.hostname]: {
                                socket: {
                                    hostname: message.hostname,
                                    isConnected: true,
                                    webPort: 80,
                                },
                                ...message.update, // ⬅ flatten everything into the top level
                                current_file: {
                                    filename: message.update?.print_stats?.filename ?? '',
                                },
                            },
                        });
                    }
                    //Vue.$toast.success('msg=' + JSON.stringify(message));
                } catch (e) {
                    console.warn('Fleet daemon WS error:', e);
                    Vue.$toast.error('3');
                }
            };

            this.fleetSocket.onclose = () => {
                console.warn('Fleet daemon WebSocket closed');
                this.fleetSocket = null;
                Vue.$toast.error('5');
            };
        }

        beforeDestroy() {
            if (this.fleetSocket) {
                this.fleetSocket.close();
                this.fleetSocket = null;
            }
        }

        toggleEditMode() {
            this.isEditing = !this.isEditing;
        }

        reconnectAllPrinters() {
            const printersArray = Object.values(this.printers);
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
            settingsMenu.showSettings = true;
        }
    }
</script>

<style scoped>
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
</style>
