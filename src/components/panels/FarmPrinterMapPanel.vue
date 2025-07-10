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
        this.$toast.success(JSON.stringify(this.printer, null, 2));
        this.$toast.success(this.$store.state.gui?.remoteprinters?.printers);
        /*
        if (this.printer.socket.isConnected) {
            //this.$store.dispatch('changePrinter', { printer: this.printer._namespace })
            window.open(this.getPrinterUrl());
        }
        else this.$store.dispatch('farm/' + this.printer._namespace + '/reconnect')
        */
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
        const filament = this.printer?.toolhead?.filament_type;

        // Return abbreviations for known types
        switch (filament) {
            case "PA-CF":
                return "CN";
            case "PA-GF":
                return "GN";
            case "PETG-CF":
                return "CP";
            case "TPU":
                return "FL";
        }

        // For unknown or long custom names: first 2 + "..." + last char
        if (filament && filament.length > 4) {
            return `${filament.slice(0, 2)}...${filament.slice(-1)}`;
        }

        // Otherwise return as-is (short custom names, null, etc.)
        return filament || "";
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
