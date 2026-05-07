<template>
    <v-snackbar
        v-model="visible"
        :color="color"
        :timeout="timeout"
        bottom
        right
        fixed>
        <div class="d-flex align-center">
            <v-icon left>{{ icon }}</v-icon>
            <span>{{ message }}</span>
        </div>
        <template #action="{ attrs }">
            <v-btn icon v-bind="attrs" @click="dismiss">
                <v-icon>{{ mdiClose }}</v-icon>
            </v-btn>
        </template>
    </v-snackbar>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import { fleetDaemonEvents } from '@/plugins/fleetDaemonClient'
import {
    mdiClose,
    mdiInformationOutline,
    mdiCheckCircleOutline,
    mdiAlertOutline,
    mdiAlertCircleOutline,
} from '@mdi/js'

interface ToastPayload {
    level: 'info' | 'warning' | 'error' | 'success'
    message: string
    key?: string | null
}

@Component({})
export default class TheFleetToast extends Mixins(BaseMixin) {
    mdiClose = mdiClose

    visible = false
    level: ToastPayload['level'] = 'info'
    message = ''
    currentKey: string | null = null

    created() {
        fleetDaemonEvents.$on('toast', this.onToast)
    }

    beforeDestroy() {
        fleetDaemonEvents.$off('toast', this.onToast)
    }

    onToast(payload: ToastPayload) {
        if (!payload || typeof payload.message !== 'string') return
        this.level = payload.level ?? 'info'
        this.message = payload.message
        this.currentKey = payload.key ?? null
        // Force-toggle so v-snackbar restarts its timer when an existing
        // toast with the same key is replaced by a new one (e.g. the
        // "NAS restored" success replacing the "NAS down" warning).
        this.visible = false
        this.$nextTick(() => {
            this.visible = true
        })
    }

    dismiss() {
        this.visible = false
    }

    get color(): string {
        switch (this.level) {
            case 'success': return 'success'
            case 'warning': return 'warning'
            case 'error':   return 'error'
            default:        return 'info'
        }
    }

    get icon(): string {
        switch (this.level) {
            case 'success': return mdiCheckCircleOutline
            case 'warning': return mdiAlertOutline
            case 'error':   return mdiAlertCircleOutline
            default:        return mdiInformationOutline
        }
    }

    // Warnings/errors stick until manually dismissed or replaced — they
    // represent a persistent state worth keeping visible (e.g. NAS outage).
    // Info/success auto-dismiss so they don't linger after they're noticed.
    get timeout(): number {
        if (this.level === 'warning' || this.level === 'error') return -1
        return 6000
    }
}
</script>
