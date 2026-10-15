<template>
    <v-alert
        v-if="blocked"
        :type="forced ? 'warning' : 'error'"
        dense
        text
        :icon="mdiNas"
        class="fleet-nas-banner"
        :class="{ 'mx-4 mb-2': !flush }">
        <div class="d-flex align-center flex-wrap">
            <div class="flex-grow-1 mr-2">
                <strong>NAS offline</strong>
                <template v-if="!forced">
                    — Fleet cannot start jobs: auto dispatch is off until the NAS is back.
                    Running prints are not affected.
                </template>
                <template v-else>
                    — forced dispatch is on
                    {{ forced.mode === 'until_online' ? 'until the NAS is back' : 'for one scheduler pass' }}:
                    jobs start only on printers that already hold the file; printers without it are skipped.
                </template>
                <span v-if="since" class="text--secondary"> Since {{ since }}.</span>
            </div>
            <template v-if="showActions">
                <v-btn
                    v-if="!forced"
                    small
                    outlined
                    color="error"
                    class="mr-2 my-1"
                    :loading="busy === 'once'"
                    :disabled="busy !== null"
                    title="Bypass the NAS gate for the next scheduler pass only"
                    @click="set('once')">
                    <v-icon small left>{{ mdiPlay }}</v-icon> Force dispatch once
                </v-btn>
                <v-btn
                    v-if="!forced || forced.mode === 'once'"
                    small
                    outlined
                    color="error"
                    class="mr-2 my-1"
                    :loading="busy === 'until_online'"
                    :disabled="busy !== null"
                    title="Keep bypassing the NAS gate; switches itself off when the NAS is back"
                    @click="set('until_online')">
                    <v-icon small left>{{ mdiFastForward }}</v-icon> Force until NAS is back
                </v-btn>
                <v-btn
                    v-if="forced"
                    small
                    text
                    class="my-1"
                    :loading="busy === 'off'"
                    :disabled="busy !== null"
                    @click="set('off')">
                    <v-icon small left>{{ mdiStop }}</v-icon> Turn forced dispatch off
                </v-btn>
            </template>
        </div>
    </v-alert>
</template>

<script lang="ts">
/**
 * "NAS offline — Fleet cannot start jobs" banner shared by the Fleet Map page,
 * the Jobs tab and the Workers tab. Reads the scheduler gate from the store
 * (GET /scheduler/status + the `scheduler_status` WS event). With
 * `show-actions` it carries the force-dispatch controls
 * (POST /scheduler/force_dispatch): "once" = next scheduler pass only,
 * "until_online" = until the mount is back, when the daemon clears it itself.
 */
import Vue from 'vue'
import Component from 'vue-class-component'
import { Prop } from 'vue-property-decorator'
import { mdiFastForward, mdiNas, mdiPlay, mdiStop } from '@mdi/js'
import { FleetForceDispatch, FleetSchedulerStatus } from '@/store/fleet/jobs/types'
import { nasDispatchBlocked } from '@/components/panels/fleetWorkerAttention'

type Mode = 'once' | 'until_online' | 'off'

@Component
export default class FleetNasBanner extends Vue {
    mdiFastForward = mdiFastForward
    mdiNas = mdiNas
    mdiPlay = mdiPlay
    mdiStop = mdiStop

    /** Show the force-dispatch buttons (Jobs / Workers tabs only). */
    @Prop({ type: Boolean, default: false }) readonly showActions!: boolean
    /** Drop the card-internal margins (page-level use). */
    @Prop({ type: Boolean, default: false }) readonly flush!: boolean

    busy: Mode | null = null

    get scheduler(): FleetSchedulerStatus | null {
        return this.$store.getters['fleet/workers/getSchedulerStatus']
    }

    get blocked(): boolean {
        return nasDispatchBlocked(this.scheduler)
    }

    get forced(): FleetForceDispatch | null {
        return this.scheduler?.force_dispatch ?? null
    }

    get since(): string {
        const ts = this.scheduler?.storage_changed_at
        if (!ts) return ''
        const d = new Date(ts * 1000)
        const sameDay = d.toDateString() === new Date().toDateString()
        return sameDay ? d.toLocaleTimeString() : d.toLocaleString()
    }

    async set(mode: Mode) {
        this.busy = mode
        try {
            await this.$store.dispatch('fleet/workers/setForceDispatch', mode)
            const msg =
                mode === 'off'
                    ? 'Forced dispatch switched off'
                    : mode === 'once'
                    ? 'Forcing one scheduler pass with the NAS offline'
                    : 'Forcing dispatch until the NAS is back'
            this.$toast?.info?.(msg)
        } catch (e: any) {
            this.$toast?.error?.(`Force dispatch failed: ${e?.message ?? e}`)
        } finally {
            this.busy = null
        }
    }
}
</script>

<style scoped>
.fleet-nas-banner {
    margin-top: 0;
}
</style>
