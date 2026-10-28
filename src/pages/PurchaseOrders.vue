<template>
    <v-container fluid class="pa-4">
        <v-alert v-if="loadError" type="error" dense dismissible class="mb-4" @input="loadError = ''">
            {{ loadError }}
        </v-alert>
        <po-list-panel ref="poPanel" />
    </v-container>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import { Watch } from 'vue-property-decorator'
import PoListPanel from '@/components/panels/PoListPanel.vue'
import { fleetDaemonEvents } from '@/plugins/fleetDaemonClient'
import { FleetPoDetail } from '@/store/fleet/purchaseOrders/types'

@Component({ components: { PoListPanel } })
export default class PurchaseOrders extends Vue {
    loadError = ''
    private refreshTimer: ReturnType<typeof setTimeout> | null = null
    private pollTimer: ReturnType<typeof setInterval> | null = null
    private polling = false

    /** Fallback poll period (ms). WS events refresh immediately; this only covers missed events. */
    static readonly POLL_MS = 10000

    async mounted() {
        await this.loadAll()
        fleetDaemonEvents.$on('pos_updated', this.onUpdated)
        // Runs finishing change PO fulfillment without a pos_updated event.
        fleetDaemonEvents.$on('jobs_updated', this.onUpdated)
        document.addEventListener('visibilitychange', this.onVisibility)
        this.pollTimer = setInterval(this.poll, PurchaseOrders.POLL_MS)
        this.checkOpenPo()
    }

    beforeDestroy() {
        fleetDaemonEvents.$off('pos_updated', this.onUpdated)
        fleetDaemonEvents.$off('jobs_updated', this.onUpdated)
        document.removeEventListener('visibilitychange', this.onVisibility)
        if (this.refreshTimer) clearTimeout(this.refreshTimer)
        if (this.pollTimer) clearInterval(this.pollTimer)
    }

    onVisibility() {
        if (document.visibilityState === 'visible') this.poll()
    }

    get current(): FleetPoDetail | null {
        return this.$store.getters['fleet/purchaseOrders/getCurrent']
    }

    async refresh() {
        await Promise.allSettled([
            this.$store.dispatch('fleet/purchaseOrders/loadList'),
            this.current
                ? this.$store.dispatch('fleet/purchaseOrders/loadPo', this.current.po.id)
                : Promise.resolve(),
        ])
    }

    async poll() {
        if (this.polling || document.visibilityState !== 'visible') return
        this.polling = true
        try {
            await this.refresh()
        } finally {
            this.polling = false
        }
    }

    async loadAll() {
        const errors: string[] = []
        await Promise.allSettled([
            this.$store.dispatch('fleet/purchaseOrders/loadList').catch((e: Error) => errors.push(e.message)),
            this.$store.dispatch('fleet/purchaseOrders/loadConfig').catch(() => {}),
            this.$store.dispatch('fleet/customers/loadCustomers').catch((e: Error) => errors.push(e.message)),
        ])
        if (errors.length > 0) this.loadError = [...new Set(errors)].join(' | ')
    }

    /** Debounced: one PO edit or a dispatch step can broadcast several events. */
    onUpdated() {
        if (this.refreshTimer) clearTimeout(this.refreshTimer)
        this.refreshTimer = setTimeout(() => {
            this.refreshTimer = null
            this.refresh()
        }, 500)
    }

    @Watch('$route')
    onRouteChange() {
        this.checkOpenPo()
    }

    checkOpenPo() {
        const id = parseInt(String(this.$route.query.openPo ?? ''), 10)
        if (!isNaN(id) && id > 0) {
            this.$nextTick(() => {
                const panel = this.$refs.poPanel as any
                if (panel && typeof panel.openDetails === 'function') panel.openDetails(id)
                this.$router.replace({ path: '/purchase-orders' }).catch(() => {})
            })
        }
    }
}
</script>
