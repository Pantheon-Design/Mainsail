<template>
    <v-dialog :value="bool" :max-width="450" @click:outside="closeDialog" @keydown.esc="closeDialog">
        <v-card>
            <v-card-title class="text-h5">
                <v-icon color="error" class="mr-2">{{ mdiWrench }}</v-icon>
                {{ $t('App.Maintenance.BlockTitle') }}
            </v-card-title>
            <v-card-text>
                <p class="mb-2 font-weight-bold">{{ $t('App.Maintenance.BlockText') }}</p>
                <p class="mb-0">{{ $t('App.Maintenance.BlockHint') }}</p>
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn text @click="closeDialog">{{ $t('App.Maintenance.Close') }}</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import { mdiWrench } from '@mdi/js'

/**
 * Shown instead of the start-print / prime dialogs while Moonraker reports
 * machine_state.is_maintenance === 1. Maintenance mode is toggled only on the
 * printer's KlipperScreen; Moonraker refuses print starts while it is on.
 */
@Component
export default class MaintenanceBlockDialog extends Vue {
    mdiWrench = mdiWrench

    @Prop({ type: Boolean, default: false }) readonly bool!: boolean

    closeDialog() {
        this.$emit('closeDialog')
    }
}
</script>
