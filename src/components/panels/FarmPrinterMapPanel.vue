<template>
    <farmPanel card-class="farmprinter-panel"
               :class="panelClass"
               :loading="printer.socket.isConnecting"
               :title="''">
        <v-hover v-if="!isEditing" :style="{
                 backgroundColor: 'transparent',
                 width: 500 + 'px',
                 height: 500 + 'px',
                 marginTop: -150 + 'px',
                 marginLeft: -150 + 'px',
                 }">
            <template #default="{ hover }">
                <div style="position: relative; width: 100%; height: 100vh;">
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-225%, -202%); width: 50px; height: 50px; background-color: #ffffff; text-align: center; color: #000000 ">
                        <span :style="{
                              userSelect: 'none' , // Prevent text selection
                              pointerEvents: 'none' , // Disable interaction
                              padding: '5px' ,
                              lineHeight: '1' ,
                              fontSize: displayFilamentType.length>
                            2 ? '6.5px' : '10px',  // Adjust font size based on length
                            fontWeight: 'bold',  // Make text bold
                            }">
                            {{ displayFilamentType }}
                        </span>

                        <v-fade-transition>
                            <v-overlay v-if="hover" absolute :z-index="4">
                                <v-btn color="transparent" @click="clickPrinter"
                                       style="width: 500px; height: 500px;">
                                    {{
                                printer.socket.isConnected
                                    ? ''
                                    : ''
                                    }}
                                </v-btn>
                            </v-overlay>
                        </v-fade-transition>

                    </div>
                </div>

            </template>
        </v-hover>
        <resize-observer @notify="handleResize" />
    </farmPanel>
</template>

<script lang="ts">
import { Component, Mixins, Prop, Ref, Vue } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import { FarmPrinterState } from '@/store/farm/printer/types'
import PantheonLogo from '@/components/ui/PantheonLogo.vue'
import FarmPanel from '@/components/ui/FarmPanel.vue'
import { mdiPrinter3d, mdiWebcam, mdiMenuDown, mdiWebcamOff, mdiFileOutline } from '@mdi/js'
import { Debounce } from 'vue-debounce-decorator'
import WebcamMixin from '@/components/mixins/webcam'
import WebcamWrapper from '@/components/webcams/WebcamWrapper.vue'
import { GuiWebcamStateWebcam } from '@/store/gui/webcams/types'
import ThemeMixin from '@/components/mixins/theme'
import { Watch } from 'vue-property-decorator'
import { displayFilamentType } from '@/components/panels/farmPrinterStatus'

@Component({
    components: {
        FarmPanel,
        'webcam-wrapper': WebcamWrapper,
        'pantheon-logo': PantheonLogo,
    },
})
export default class FarmPrinterPanel extends Mixins(BaseMixin, ThemeMixin, WebcamMixin) {
    mdiPrinter3d = mdiPrinter3d
    mdiWebcam = mdiWebcam
    mdiMenuDown = mdiMenuDown
    mdiWebcamOff = mdiWebcamOff
    mdiFileOutline = mdiFileOutline

    private imageHeight = 200

    @Prop({ type: Object, required: true }) declare printer: FarmPrinterState
    @Prop({ type: Boolean, required: true }) declare isEditing: boolean
    @Ref() declare readonly imageDiv: Vue

    get printerUrl() {
        const thisUrl = window.location.href.split('/')
        const protocol = thisUrl[0]

        let url = protocol + '//' + this.printer.socket.hostname
        if (80 !== this.printer.socket.webPort) url += ':' + this.printer.socket.webPort

        return url
    }

    get isCurrentPrinter() {
        return this.$store.getters['farm/' + this.printer._namespace + '/isCurrentPrinter']
    }

    get currentCamName() {
        return this.$store.getters['farm/' + this.printer._namespace + '/getSetting']('currentCamName', 'off')
    }

    set currentCamName(newVal) {
        this.$store.dispatch('farm/' + this.printer._namespace + '/setSettings', { currentCamName: newVal })
    }

    get printer_name() {
        return this.printer.socket.position
        //return this.$store.getters['farm/' + this.printer._namespace + '/getPrinterName']
    }

    get printer_status() {
        return this.$store.getters['farm/' + this.printer._namespace + '/getStatus']
    }

    get printer_current_filename() {
        return this.$store.getters['farm/' + this.printer._namespace + '/getCurrentFilename']
    }

    get printer_image() {
        if (this.currentWebcam) return this.sidebarBgImage

        return this.$store.getters['farm/' + this.printer._namespace + '/getImage'] ?? this.sidebarBgImage
    }

    get printer_logo() {
        return this.$store.getters['farm/' + this.printer._namespace + '/getLogo']
    }

    get printerLogoColor() {
        return this.$store.getters['farm/' + this.printer._namespace + '/getLogoColor']
    }

    get printer_position() {
        return this.$store.getters['farm/' + this.printer._namespace + '/getPosition']
    }

    get printer_preview() {
        return this.$store.getters['farm/' + this.printer._namespace + '/getPrinterPreview']
    }

    get showWebcamSwitch() {
        if (this.printer_webcams.length == 0) return false

        return this.printer.socket.isConnected
    }

    get printer_webcams(): GuiWebcamStateWebcam[] {
        return this.$store.getters['farm/' + this.printer._namespace + '/getPrinterWebcams']
    }

    get currentWebcam(): GuiWebcamStateWebcam | null {
        const currentCam = this.printer_webcams?.find(
            (webcam: GuiWebcamStateWebcam) => webcam.name === this.currentCamName
        )
        if (currentCam) return currentCam

        return null
    }

    get panelClass(): string[] {
        let output = []

        if (!this.printer.socket.isConnected && !this.printer.socket.isConnecting) output.push('disabledPrinter')
        //console.log(output)
        return output
    }

    clickPrinter() {
        const hostname = this.printer.socket?.hostname ?? '(unknown hostname)'
        const namespace = this.printer._namespace

        // Full FarmPrinterState for this printer (live moonraker data lives here)
        console.groupCollapsed(`[FleetPrinter] ${hostname} (${namespace})`)
        console.log('printer (full FarmPrinterState):', this.printer)
        console.log('socket:', this.printer.socket)
        console.log('print_stats:', this.printer.print_stats)
        console.log('virtual_sdcard:', this.printer.virtual_sdcard)
        console.log('toolhead:', this.printer.toolhead)
        console.log('webhooks:', this.printer.webhooks)
        console.log('current_file:', (this.printer as any).current_file)
        console.log('fleet_to_printer_ws:', (this.printer as any).fleet_to_printer_ws)

        // Cross-reference: matching entry from the fleet daemon printers map in the store
        const fleetDaemonPrinters = this.$store.state.farm?.fleetDaemonPrinters || {}
        const fleetDaemonEntry =
            fleetDaemonPrinters[hostname] ||
            Object.values(fleetDaemonPrinters).find(
                (p: any) => p?.socket?.hostname?.toLowerCase() === hostname.toLowerCase()
            )
        console.log('fleetDaemonPrinters entry:', fleetDaemonEntry)

        // Cross-reference: configured remote printer record (position, model, port, etc.)
        const remotePrinters = this.$store.state.gui?.remoteprinters?.printers || {}
        const remotePrinterEntry = Object.entries(remotePrinters).find(
            ([, p]: [string, any]) => p?.hostname?.toLowerCase() === hostname.toLowerCase()
        )
        console.log('remoteprinters config entry:', remotePrinterEntry?.[1])

        // Store getters for this printer namespace
        console.log('getters/getStatus:', this.$store.getters['farm/' + namespace + '/getStatus'])
        console.log('getters/getCurrentFilename:', this.$store.getters['farm/' + namespace + '/getCurrentFilename'])
        console.log('getters/getPosition:', this.$store.getters['farm/' + namespace + '/getPosition'])
        console.log('getters/getPrinterWebcams:', this.$store.getters['farm/' + namespace + '/getPrinterWebcams'])
        console.groupEnd()
    }

    mounted() {
        this.calcImageHeight()
    }

    getPrinterUrl() {
        const thisUrl = window.location.href.split('/')
        const protocol = thisUrl[0]

        let url = protocol + '//' + this.printer.socket.hostname
        if (80 !== this.printer.socket.webPort) url += ':' + this.printer.socket.webPort

        return url
    }

    calcImageHeight() {
        if (this.imageDiv?.$el?.clientWidth) {
            this.imageHeight = Math.round((this.imageDiv.$el.clientWidth / 3) * 2)
            return
        }

        this.imageHeight = 200
    }

    getLastPrintedFilamentType() {
        //this.$toast.error('1')
        this.$store.dispatch('farm/' + this.printer._namespace + '/getFilamentType', { id: this.printer._namespace }, { root: true })
    }

    @Debounce(200)
    handleResize() {
        this.$nextTick(() => {
            this.calcImageHeight()
        })
    }

    //printer?.data?.toolhead?.estimated_print_time
    //('printer.current_file.filament_type')
    @Watch('printer.current_file.filament_type')
    onFilamentChange(newFilament: string, oldFilament: string) {
        //console.log(`Hostname changed from ${oldFilament} to ${newFilament}`);
        if (!newFilament || newFilament.trim() === '') { return; }
        //console.log(`changing the host name`);
        this.printer.socket.lastPrintedFilament = newFilament
        this.handleFilamentChange();
    }
    handleFilamentChange() {
        const values = {
            hostname: this.printer.socket.hostname,
            port: this.printer.socket.port,
            position: { x: this.printer.socket.position?.x, y: this.printer.socket.position?.y }
        }
        //this.$store.dispatch('gui/remoteprinters/updateOnDrag', { id: this.printer._namespace, values })
        this.getLastPrintedFilamentType()
    }

    get displayFilamentType(): string {
        return displayFilamentType((this.printer as any)?.toolhead?.filament_type)
    }


}
</script>

<style scoped>
    .v-card.disabledPrinter {
        opacity: 0.3;
        filter: grayscale(70%);
    }

    .webcamContainer,
    .webcamContainer .vue-load-image,
    .webcamContainer > div,
    .webcamContainer img {
        position: absolute !important;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
    }

    .webcamContainer img {
        height: 100%;
    }

    .webcamContainer .webcamFpsOutput {
        display: none;
    }

    .v-overlay {
        top: 48px;
    }

    ::v-deep .farmprinter-panel {
        position: relative;
    }

    .hover-style {
        background-color: transparent;
        width: 200px;
        height: 100px;
        align-items: center; /* Note: align-items only works in flexbox containers */
    }

    .justbackgroundcolor {
        background-color: blue;
    }
</style>
