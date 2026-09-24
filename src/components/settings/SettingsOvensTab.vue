<template>
    <div>
        <v-card v-if="!form.bool" flat>
            <v-card-text>
                <h3 class="text-h5 mb-3">{{ $t('Settings.OvensTab.Ovens') }}</h3>
                <p class="mb-3 text-body-2">{{ $t('Settings.OvensTab.Description') }}</p>
                <v-alert v-if="!canEdit" :icon="mdiAlertOutline" type="warning" text>
                    {{ $t('Settings.OvensTab.UseConfigJson') }}
                </v-alert>
                <p v-if="!ovens.length" class="text--secondary mb-0">{{ $t('Settings.OvensTab.NoOvens') }}</p>
                <div v-for="(oven, index) in ovens" :key="oven.id">
                    <v-divider v-if="index" class="my-2"></v-divider>
                    <settings-row :title="formatOvenName(oven)" :sub-title="ovenSubtitle(oven)">
                        <v-btn small outlined :disabled="!canEdit" @click="editOven(oven)">
                            <v-icon left small>{{ mdiPencil }}</v-icon>
                            {{ $t('Settings.Edit') }}
                        </v-btn>
                        <v-btn
                            small
                            outlined
                            class="ml-3 minwidth-0 px-2"
                            color="error"
                            :disabled="!canEdit"
                            @click="delOven(oven.id)">
                            <v-icon small>{{ mdiDelete }}</v-icon>
                        </v-btn>
                    </settings-row>
                </div>
            </v-card-text>
            <v-card-actions class="d-flex justify-end">
                <v-btn text color="primary" :disabled="!canEdit" @click="createOven">
                    {{ $t('Settings.OvensTab.AddOven') }}
                </v-btn>
            </v-card-actions>
        </v-card>
        <v-card v-else flat>
            <v-card-title>
                {{ form.id !== null ? $t('Settings.OvensTab.EditOven') : $t('Settings.OvensTab.AddOven') }}
            </v-card-title>
            <v-card-text>
                <settings-row
                    :title="$t('Settings.OvensTab.Hostname')"
                    :sub-title="$t('Settings.OvensTab.HostnameDescription')">
                    <v-text-field
                        v-model="form.hostname"
                        :rules="[
                            (v) => !!v || 'Hostname is required',
                            (v) => !v.startsWith('http:') || 'invalid hostname/IP',
                            (v) => !v.startsWith('https:') || 'invalid hostname/IP',
                        ]"
                        hide-details="auto"
                        required
                        dense
                        outlined></v-text-field>
                </settings-row>
                <v-divider class="my-2"></v-divider>
                <settings-row :title="$t('Settings.OvensTab.Port')">
                    <v-text-field
                        v-model="form.port"
                        :rules="[(v) => !!v || 'Port is required']"
                        hide-details="auto"
                        required
                        dense
                        outlined></v-text-field>
                </settings-row>
                <v-divider class="my-2"></v-divider>
                <settings-row :title="$t('Settings.OvensTab.Location')">
                    <v-select v-model="form.location" :items="locationItems" dense outlined hide-details="auto" />
                </settings-row>
                <v-divider class="my-2"></v-divider>
                <!-- Soft capacity shown as count/max on the map marker; nothing blocks loading more -->
                <settings-row
                    :title="$t('Settings.OvensTab.MaxSpools')"
                    :sub-title="$t('Settings.OvensTab.MaxSpoolsDescription')">
                    <v-text-field
                        v-model="form.maxSpools"
                        type="number"
                        min="1"
                        step="1"
                        :rules="[maxSpoolsRule]"
                        hide-details="auto"
                        dense
                        outlined
                        clearable></v-text-field>
                </settings-row>
            </v-card-text>
            <v-card-actions class="d-flex justify-end">
                <v-btn text @click="form.bool = false">{{ $t('Settings.Cancel') }}</v-btn>
                <v-btn v-if="form.id === null" text color="primary" @click="storeOven">
                    {{ $t('Settings.OvensTab.AddOven') }}
                </v-btn>
                <v-btn v-else text color="primary" @click="updateOven">
                    {{ $t('Settings.OvensTab.UpdateOven') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import BaseMixin from '../mixins/base'
import SettingsRow from '@/components/settings/SettingsRow.vue'
import { GuiRemoteprintersStatePrinter, OVEN_PRINTER_MODEL } from '@/store/gui/remoteprinters/types'
import { mdiDelete, mdiPencil, mdiAlertOutline } from '@mdi/js'
import Vue from 'vue'

interface OvenForm {
    bool: boolean
    id: string | null
    hostname: string
    port: number
    location: 'farm' | 'ground'
    /** raw input (string/number/null) until submit */
    maxSpools: string | number | null
}

/**
 * Ovens (filament dryers) live in the same roster as printers (gui/remoteprinters, mirrored to
 * fleet_daemon by /refresh_printer_list) but are registered with deviceType 'oven'. This tab
 * shows only those entries; the Printers tab shows only printers.
 */
@Component({
    components: { SettingsRow },
})
export default class SettingsOvensTab extends Mixins(BaseMixin) {
    mdiPencil = mdiPencil
    mdiDelete = mdiDelete
    mdiAlertOutline = mdiAlertOutline

    readonly locationItems = [
        { text: 'Print Farm', value: 'farm' },
        { text: 'Ground Floor', value: 'ground' },
    ]

    private form: OvenForm = this.blankForm()

    blankForm(): OvenForm {
        return { bool: false, id: null, hostname: '', port: 7125, location: 'farm', maxSpools: null }
    }

    get ovens(): GuiRemoteprintersStatePrinter[] {
        const all: GuiRemoteprintersStatePrinter[] = this.$store.getters['gui/remoteprinters/getRemoteprinters'] ?? []
        return all.filter((p) => p.deviceType === 'oven')
    }

    get canEdit() {
        return this.$store.state.instancesDB !== 'json'
    }

    get fleetDaemonUrl() {
        return this.$store.getters['gui/fleetDaemonUrl']
    }

    formatOvenName(oven: GuiRemoteprintersStatePrinter) {
        return oven.hostname + (oven.port !== 80 ? ':' + oven.port : '')
    }

    locationLabel(location?: 'farm' | 'ground') {
        return (location ?? 'farm') === 'ground' ? 'Ground Floor' : 'Print Farm'
    }

    ovenSubtitle(oven: GuiRemoteprintersStatePrinter) {
        const parts = [this.locationLabel(oven.location)]
        const max = this.parseMaxSpools(oven.maxSpools)
        if (max !== null) parts.push(this.$t('Settings.OvensTab.MaxSpoolsShort', { n: max }) as string)
        return parts.join(' · ')
    }

    parseMaxSpools(value: string | number | null | undefined): number | null {
        if (value === null || value === undefined || String(value).trim() === '') return null
        const n = Number(value)
        return Number.isInteger(n) && n >= 1 ? n : null
    }

    maxSpoolsRule(value: string | number | null): boolean | string {
        if (value === null || value === undefined || String(value).trim() === '') return true
        return this.parseMaxSpools(value) !== null || (this.$t('Settings.OvensTab.MaxSpoolsInvalid') as string)
    }

    /** Roster values shared by add and update. `maxSpools: undefined` clears a stale value on update. */
    get formValues() {
        return {
            hostname: this.form.hostname.trim(),
            port: this.form.port,
            printerModel: OVEN_PRINTER_MODEL,
            location: this.form.location,
            deviceType: 'oven' as const,
            maxSpools: this.parseMaxSpools(this.form.maxSpools) ?? undefined,
        }
    }

    createOven() {
        this.form = { ...this.blankForm(), bool: true }
    }

    editOven(oven: GuiRemoteprintersStatePrinter) {
        this.form = {
            bool: true,
            id: oven.id ?? null,
            hostname: oven.hostname,
            port: oven.port,
            location: oven.location ?? 'farm',
            maxSpools: this.parseMaxSpools(oven.maxSpools),
        }
    }

    storeOven() {
        this.$store.dispatch('gui/remoteprinters/store', {
            values: { ...this.formValues, position: { x: 500, y: 0 } },
        })
        this.form = this.blankForm()
        this.refreshDaemonRoster()
    }

    updateOven() {
        this.$store.dispatch('gui/remoteprinters/update', { id: this.form.id, values: this.formValues })
        this.form = this.blankForm()
        this.refreshDaemonRoster()
    }

    delOven(id: string) {
        this.$store.dispatch('gui/remoteprinters/delete', id)
        this.refreshDaemonRoster()
    }

    /** fleet_daemon re-reads the roster (printers and ovens) from the Moonraker DB. */
    refreshDaemonRoster() {
        fetch(`${this.fleetDaemonUrl}/refresh_printer_list`, { method: 'POST' })
            .then((res) => {
                if (res.ok) Vue.$toast.success(this.$t('Settings.OvensTab.RosterRefreshed') as string)
                else throw new Error('Failed to refresh oven list')
            })
            .catch((err) => {
                console.error(err)
                Vue.$toast.error(this.$t('Settings.OvensTab.RosterRefreshFailed') as string)
            })
    }
}
</script>
