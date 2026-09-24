/**
 * Scanner Lite entry point (scan.html).
 *
 * Deliberately minimal: Vue + Vuetify + the fleet Vuex modules + the three
 * scanning mode components (QC, Add Spool, Add Part, Macros). No Moonraker websocket, no router, no i18n, no
 * charts, no printer state — the full Mainsail boot is what makes the scanner
 * phone lag.
 */
import 'regenerator-runtime'
import Vue from 'vue'
import vuetify from '@/plugins/vuetify'
import { createScanStore } from './store'
import ScanApp from './ScanApp.vue'

Vue.config.productionTip = false

const store = createScanStore()

new Vue({
    vuetify,
    store,
    render: (h) => h(ScanApp),
}).$mount('#app')
