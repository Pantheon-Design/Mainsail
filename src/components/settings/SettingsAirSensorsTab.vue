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
                    :title="$t('Settings.AirSensorsTab.Vendor')"
                    :sub-title="$t(`Settings.AirSensorsTab.VendorDescription.${form.vendor}`)">
                    <v-select v-model="form.vendor" :items="vendorItems" dense outlined hide-details="auto" />
                </settings-row>
                <template v-if="form.vendor !== 'pandasense'">
                    <v-divider class="my-2"></v-divider>
                    <settings-row
                        :title="$t('Settings.AirSensorsTab.Serial')"
                        :sub-title="$t(`Settings.AirSensorsTab.SerialDescription.${form.vendor}`)">
                        <v-text-field
                            v-model="form.serial"
                            :placeholder="form.vendor === 'airgradient' ? 'a0f262dc4620' : ''"
                            :rules="[serialRule]"
                            hide-details="auto"
                            required
                            dense
                            outlined></v-text-field>
                    </settings-row>
                </template>
                <v-divider class="my-2"></v-divider>
                <settings-row
                    :title="$t('Settings.AirSensorsTab.Hostname')"
                    :sub-title="$t(`Settings.AirSensorsTab.HostnameDescription.${form.vendor}`)">
                    <v-text-field
                        v-model="form.hostname"
                        :placeholder="hostnamePlaceholder"
                        :rules="[hostnameRule]"
                        hide-details="auto"
                        :required="form.vendor !== 'airgradient'"
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
    AIR_SENSOR_PRINTER_MODEL,
    AIR_SENSOR_VENDOR_LABELS,
    AIR_SENSOR_VENDOR_PORTS,
    AIR_SENSOR_VENDORS,
    AirSensorVendor,
    airSensorVendor,
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
    vendor: AirSensorVendor
    serial: string
    hostname: string
    label: string
    location: 'farm' | 'ground'
    /** raw input (string/number) until submit */
    sensorRange: string | number
}

/** IPv4 literal with octets 0-255. */
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
/**
 * Hostname labels of letters/digits/hyphens, dot separated (`.local` allowed). Underscores are
 * accepted because AirGradient monitors announce themselves as `airgradient_<serial>.local`.
 */
const HOSTNAME_RE = /^[A-Za-z0-9]([A-Za-z0-9_-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9_-]{0,61}[A-Za-z0-9])?)*$/
/** AirGradient serial: 12 hex digits (the label / mDNS name shows it lower-case). */
const AIRGRADIENT_SERIAL_RE = /^[0-9a-f]{12}$/i
/** Dyson serial, e.g. `AB1-US-ABC1234A`. */
const DYSON_SERIAL_RE = /^[A-Z0-9]{2,4}(-[A-Z0-9]{2,10}){1,3}$/i

/**
 * Air-quality sensors live in the same roster as printers (gui/remoteprinters, mirrored to
 * fleet_daemon by /refresh_printer_list) but are registered with deviceType 'air_sensor' and a
 * `sensorVendor` that picks the daemon's collector: Panda Sense Pro (its own MQTT broker),
 * AirGradient ONE (read-only HTTP poll, serial checked on every read) or Dyson purifier (local
 * MQTT; the credential is set up on the daemon host with fleet_air_dyson_setup.py and is never
 * stored here). The port follows the vendor and is never editable.
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

    readonly vendorItems = AIR_SENSOR_VENDORS.map((value) => ({ text: AIR_SENSOR_VENDOR_LABELS[value], value }))

    private form: AirSensorForm = this.blankForm()

    blankForm(): AirSensorForm {
        return {
            bool: false,
            id: null,
            vendor: 'airgradient',
            serial: '',
            hostname: '',
            label: '',
            location: 'farm',
            sensorRange: DEFAULT_SENSOR_RANGE,
        }
    }

    get hostnamePlaceholder(): string {
        if (this.form.vendor === 'pandasense') return 'pandasensepro1'
        if (this.form.vendor === 'dyson') return '192.168.1.50'
        return this.agHostname(this.form.serial) || 'airgradient_a0f262dc4620'
    }

    /** mDNS name an AirGradient monitor announces for its serial, '' for an invalid serial. */
    agHostname(serial: string): string {
        const s = (serial ?? '').trim().toLowerCase()
        return AIRGRADIENT_SERIAL_RE.test(s) ? `airgradient_${s}` : ''
    }

    normalisedSerial(): string | null {
        const s = (this.form.serial ?? '').trim()
        if (this.form.vendor === 'airgradient') return AIRGRADIENT_SERIAL_RE.test(s) ? s.toLowerCase() : null
        if (this.form.vendor === 'dyson') return DYSON_SERIAL_RE.test(s) ? s.toUpperCase() : null
        return null
    }

    serialRule(): boolean | string {
        return (
            this.normalisedSerial() !== null ||
            (this.$t(`Settings.AirSensorsTab.SerialInvalid.${this.form.vendor}`) as string)
        )
    }

    /** Hostname to store: as typed, or `airgradient_<serial>` when an AirGradient entry leaves it blank. */
    resolvedHostname(): string {
        const typed = (this.form.hostname ?? '').trim()
        if (typed || this.form.vendor !== 'airgradient') return typed
        return this.agHostname(this.form.serial)
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
        return [
            AIR_SENSOR_VENDOR_LABELS[airSensorVendor(sensor)],
            this.locationLabel(sensor.location),
            this.$t('Settings.AirSensorsTab.RangeShort', { n: range }),
        ].join(' · ')
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
        // AirGradient: blank means the serial's own mDNS name.
        if (this.form.vendor === 'airgradient' && !(value ?? '').trim()) return true
        return this.isValidHostname(value) || (this.$t('Settings.AirSensorsTab.HostnameInvalid') as string)
    }

    get formValid(): boolean {
        if (this.form.vendor !== 'pandasense' && this.normalisedSerial() === null) return false
        return this.isValidHostname(this.resolvedHostname()) && this.parseRange(this.form.sensorRange) !== null
    }

    /** Roster values shared by add and update. The port follows the vendor and is fixed. */
    get formValues() {
        const label = this.form.label.trim()
        const vendor = this.form.vendor
        return {
            hostname: this.resolvedHostname(),
            port: AIR_SENSOR_VENDOR_PORTS[vendor],
            printerModel: AIR_SENSOR_PRINTER_MODEL,
            location: this.form.location,
            deviceType: 'air_sensor' as const,
            label: label || null,
            sensorRange: this.parseRange(this.form.sensorRange) ?? DEFAULT_SENSOR_RANGE,
            sensorVendor: vendor,
            sensorSerial: vendor === 'pandasense' ? null : this.normalisedSerial(),
        }
    }

    createSensor() {
        this.form = { ...this.blankForm(), bool: true }
    }

    editSensor(sensor: GuiRemoteprintersStatePrinter) {
        const vendor = airSensorVendor(sensor)
        this.form = {
            bool: true,
            id: sensor.id ?? null,
            vendor,
            serial: sensor.sensorSerial ?? '',
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
