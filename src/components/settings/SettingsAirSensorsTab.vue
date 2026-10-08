<template>
    <div>
        <v-card v-if="!form.bool" flat>
            <v-card-text>
                <h3 class="text-h5 mb-3">{{ $t('Settings.AirSensorsTab.AirSensors') }}</h3>
                <p class="mb-3 text-body-2">{{ $t('Settings.AirSensorsTab.Description') }}</p>
                <v-alert v-if="!canEdit" :icon="mdiAlertOutline" type="warning" text>
                    {{ $t('Settings.AirSensorsTab.UseConfigJson') }}
                </v-alert>
                <p v-if="!sensors.length" class="text--secondary mb-0">{{ $t('Settings.AirSensorsTab.NoSensors') }}</p>
                <div v-for="(sensor, index) in sensors" :key="sensor.id">
                    <v-divider v-if="index" class="my-2"></v-divider>
                    <settings-row :title="sensorTitle(sensor)" :sub-title="sensorSubtitle(sensor)">
                        <v-btn small outlined :disabled="!canEdit" @click="editSensor(sensor)">
                            <v-icon left small>{{ mdiPencil }}</v-icon>
                            {{ $t('Settings.Edit') }}
                        </v-btn>
                        <v-btn
                            small
                            outlined
                            class="ml-3 minwidth-0 px-2"
                            color="error"
                            :disabled="!canEdit"
                            @click="delSensor(sensor.id)">
                            <v-icon small>{{ mdiDelete }}</v-icon>
                        </v-btn>
                    </settings-row>
                </div>
            </v-card-text>
            <v-card-actions class="d-flex justify-end">
                <v-btn text color="primary" :disabled="!canEdit" @click="createSensor">
                    {{ $t('Settings.AirSensorsTab.AddSensor') }}
                </v-btn>
            </v-card-actions>
        </v-card>
        <v-card v-else flat>
            <v-card-title>
                {{
                    form.id !== null ? $t('Settings.AirSensorsTab.EditSensor') : $t('Settings.AirSensorsTab.AddSensor')
                }}
            </v-card-title>
            <v-card-text>
                <settings-row
                    :title="$t('Settings.AirSensorsTab.Hostname')"
                    :sub-title="$t('Settings.AirSensorsTab.HostnameDescription')">
                    <v-text-field
                        v-model="form.hostname"
                        placeholder="pandasensepro1"
                        :rules="[hostnameRule]"
                        hide-details="auto"
                        required
                        dense
                        outlined></v-text-field>
                </settings-row>
                <v-divider class="my-2"></v-divider>
                <settings-row
                    :title="$t('Settings.AirSensorsTab.Label')"
                    :sub-title="$t('Settings.AirSensorsTab.LabelDescription')">
                    <v-text-field v-model="form.label" hide-details="auto" dense outlined clearable></v-text-field>
                </settings-row>
                <v-divider class="my-2"></v-divider>
                <settings-row :title="$t('Settings.AirSensorsTab.Location')">
                    <v-select v-model="form.location" :items="locationItems" dense outlined hide-details="auto" />
                </settings-row>
                <v-divider class="my-2"></v-divider>
                <settings-row
                    :title="$t('Settings.AirSensorsTab.Range')"
                    :sub-title="
                        $t('Settings.AirSensorsTab.RangeDescription', { min: MIN_SENSOR_RANGE, max: MAX_SENSOR_RANGE })
                    ">
                    <v-text-field
                        v-model="form.sensorRange"
                        type="number"
                        :min="MIN_SENSOR_RANGE"
                        :max="MAX_SENSOR_RANGE"
                        step="1"
                        :rules="[rangeRule]"
                        hide-details="auto"
                        dense
                        outlined></v-text-field>
                </settings-row>
            </v-card-text>
            <v-card-actions class="d-flex justify-end">
                <v-btn text @click="form.bool = false">{{ $t('Settings.Cancel') }}</v-btn>
                <v-btn v-if="form.id === null" text color="primary" :disabled="!formValid" @click="storeSensor">
                    {{ $t('Settings.AirSensorsTab.AddSensor') }}
                </v-btn>
                <v-btn v-else text color="primary" :disabled="!formValid" @click="updateSensor">
                    {{ $t('Settings.AirSensorsTab.UpdateSensor') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import BaseMixin from '../mixins/base'
import SettingsRow from '@/components/settings/SettingsRow.vue'
import {
    AIR_SENSOR_PORT,
    AIR_SENSOR_PRINTER_MODEL,
    DEFAULT_SENSOR_RANGE,
    GuiRemoteprintersStatePrinter,
    MAX_SENSOR_RANGE,
    MIN_SENSOR_RANGE,
} from '@/store/gui/remoteprinters/types'
import { mdiDelete, mdiPencil, mdiAlertOutline } from '@mdi/js'
import Vue from 'vue'

interface AirSensorForm {
    bool: boolean
    id: string | null
    hostname: string
    label: string
    location: 'farm' | 'ground'
    /** raw input (string/number) until submit */
    sensorRange: string | number
}

/** IPv4 literal with octets 0-255. */
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
/** RFC-1123 hostname (labels of letters/digits/hyphens, dot separated; `.local` allowed). */
const HOSTNAME_RE = /^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/

/**
 * Air-quality sensors (BIGTREETECH Panda Sense Pro) live in the same roster as printers
 * (gui/remoteprinters, mirrored to fleet_daemon by /refresh_printer_list) but are registered
 * with deviceType 'air_sensor'. fleet_daemon subscribes to each sensor's own MQTT broker
 * (port 1883) and streams the readings to the Air Quality map; the port is never editable.
 */
@Component({
    components: { SettingsRow },
})
export default class SettingsAirSensorsTab extends Mixins(BaseMixin) {
    mdiPencil = mdiPencil
    mdiDelete = mdiDelete
    mdiAlertOutline = mdiAlertOutline

    readonly MIN_SENSOR_RANGE = MIN_SENSOR_RANGE
    readonly MAX_SENSOR_RANGE = MAX_SENSOR_RANGE

    readonly locationItems = [
        { text: 'Print Farm', value: 'farm' },
        { text: 'Ground Floor', value: 'ground' },
    ]

    private form: AirSensorForm = this.blankForm()

    blankForm(): AirSensorForm {
        return { bool: false, id: null, hostname: '', label: '', location: 'farm', sensorRange: DEFAULT_SENSOR_RANGE }
    }

    get sensors(): GuiRemoteprintersStatePrinter[] {
        const all: GuiRemoteprintersStatePrinter[] = this.$store.getters['gui/remoteprinters/getRemoteprinters'] ?? []
        return all.filter((p) => p.deviceType === 'air_sensor')
    }

    get canEdit() {
        return this.$store.state.instancesDB !== 'json'
    }

    get fleetDaemonUrl() {
        return this.$store.getters['gui/fleetDaemonUrl']
    }

    locationLabel(location?: 'farm' | 'ground') {
        return (location ?? 'farm') === 'ground' ? 'Ground Floor' : 'Print Farm'
    }

    sensorTitle(sensor: GuiRemoteprintersStatePrinter) {
        const label = (sensor.label ?? '').trim()
        return label ? `${label} (${sensor.hostname})` : sensor.hostname
    }

    sensorSubtitle(sensor: GuiRemoteprintersStatePrinter) {
        const range = this.$store.getters['gui/remoteprinters/getSensorRange'](sensor.hostname) as number
        return [this.locationLabel(sensor.location), this.$t('Settings.AirSensorsTab.RangeShort', { n: range })].join(
            ' · '
        )
    }

    parseRange(value: string | number | null | undefined): number | null {
        if (value === null || value === undefined || String(value).trim() === '') return null
        const n = Number(value)
        return Number.isInteger(n) && n >= MIN_SENSOR_RANGE && n <= MAX_SENSOR_RANGE ? n : null
    }

    rangeRule(value: string | number | null): boolean | string {
        return (
            this.parseRange(value) !== null ||
            (this.$t('Settings.AirSensorsTab.RangeInvalid', { min: MIN_SENSOR_RANGE, max: MAX_SENSOR_RANGE }) as string)
        )
    }

    isValidHostname(value: string): boolean {
        const v = (value ?? '').trim()
        if (!v || /^https?:/i.test(v) || v.includes('/') || v.includes(':')) return false
        return IPV4_RE.test(v) || HOSTNAME_RE.test(v)
    }

    hostnameRule(value: string): boolean | string {
        return this.isValidHostname(value) || (this.$t('Settings.AirSensorsTab.HostnameInvalid') as string)
    }

    get formValid(): boolean {
        return this.isValidHostname(this.form.hostname) && this.parseRange(this.form.sensorRange) !== null
    }

    /** Roster values shared by add and update. The port is the sensor's built-in broker, fixed. */
    get formValues() {
        const label = this.form.label.trim()
        return {
            hostname: this.form.hostname.trim(),
            port: AIR_SENSOR_PORT,
            printerModel: AIR_SENSOR_PRINTER_MODEL,
            location: this.form.location,
            deviceType: 'air_sensor' as const,
            label: label || null,
            sensorRange: this.parseRange(this.form.sensorRange) ?? DEFAULT_SENSOR_RANGE,
        }
    }

    createSensor() {
        this.form = { ...this.blankForm(), bool: true }
    }

    editSensor(sensor: GuiRemoteprintersStatePrinter) {
        this.form = {
            bool: true,
            id: sensor.id ?? null,
            hostname: sensor.hostname,
            label: sensor.label ?? '',
            location: sensor.location ?? 'farm',
            sensorRange: this.parseRange(sensor.sensorRange) ?? DEFAULT_SENSOR_RANGE,
        }
    }

    storeSensor() {
        if (!this.formValid) return
        this.$store.dispatch('gui/remoteprinters/store', {
            values: { ...this.formValues, position: { x: 500, y: 0 } },
        })
        this.form = this.blankForm()
        this.refreshDaemonRoster()
    }

    updateSensor() {
        if (!this.formValid) return
        this.$store.dispatch('gui/remoteprinters/update', { id: this.form.id, values: this.formValues })
        this.form = this.blankForm()
        this.refreshDaemonRoster()
    }

    delSensor(id: string) {
        this.$store.dispatch('gui/remoteprinters/delete', id)
        this.refreshDaemonRoster()
    }

    /** fleet_daemon re-reads the roster (printers, ovens and air sensors) from the Moonraker DB. */
    refreshDaemonRoster() {
        fetch(`${this.fleetDaemonUrl}/refresh_printer_list`, { method: 'POST' })
            .then((res) => {
                if (res.ok) Vue.$toast.success(this.$t('Settings.AirSensorsTab.RosterRefreshed') as string)
                else throw new Error('Failed to refresh air sensor list')
            })
            .catch((err) => {
                console.error(err)
                Vue.$toast.error(this.$t('Settings.AirSensorsTab.RosterRefreshFailed') as string)
            })
    }
}
</script>
