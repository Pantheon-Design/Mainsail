import Vue from 'vue'
import { MutationTree } from 'vuex'
import { FleetSpoolsState, FleetVendor, FleetFilament, FleetSpool } from './types'
import { getDefaultState } from './index'

export const mutations: MutationTree<FleetSpoolsState> = {
    reset(state) {
        Object.assign(state, getDefaultState())
    },

    setLoading(state, loading: boolean) {
        Vue.set(state, 'loading', loading)
    },

    setVendors(state, vendors: FleetVendor[]) {
        Vue.set(state, 'vendors', vendors)
    },

    setFilaments(state, filaments: FleetFilament[]) {
        Vue.set(state, 'filaments', filaments)
    },

    setSpools(state, spools: FleetSpool[]) {
        Vue.set(state, 'spools', spools)
    },

    addVendor(state, vendor: FleetVendor) {
        state.vendors.push(vendor)
    },

    updateVendor(state, updated: FleetVendor) {
        const idx = state.vendors.findIndex((v) => v.id === updated.id)
        if (idx !== -1) Vue.set(state.vendors, idx, updated)
    },

    removeVendor(state, id: number) {
        const idx = state.vendors.findIndex((v) => v.id === id)
        if (idx !== -1) state.vendors.splice(idx, 1)
    },

    addFilament(state, filament: FleetFilament) {
        state.filaments.push(filament)
    },

    updateFilament(state, updated: FleetFilament) {
        const idx = state.filaments.findIndex((f) => f.id === updated.id)
        if (idx !== -1) Vue.set(state.filaments, idx, updated)
    },

    removeFilament(state, id: number) {
        const idx = state.filaments.findIndex((f) => f.id === id)
        if (idx !== -1) state.filaments.splice(idx, 1)
    },

    addSpool(state, spool: FleetSpool) {
        state.spools.unshift(spool)
    },

    updateSpool(state, updated: FleetSpool) {
        const idx = state.spools.findIndex((s) => s.id === updated.id)
        if (idx !== -1) Vue.set(state.spools, idx, updated)
    },

    removeSpool(state, id: number) {
        const idx = state.spools.findIndex((s) => s.id === id)
        if (idx !== -1) state.spools.splice(idx, 1)
    },
}
