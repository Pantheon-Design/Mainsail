import Vue from 'vue'
import { MutationTree } from 'vuex'
import {
    FleetActivityLane,
    FleetActivityPrinterCount,
    FleetActivityRecord,
    FleetActivityState,
    FleetActivityTypeCount,
} from './types'
import { getDefaultLane, getDefaultState } from './index'

function ensureLane(state: FleetActivityState, printer: string): FleetActivityLane {
    if (!state.lanes[printer]) Vue.set(state.lanes, printer, getDefaultLane())
    return state.lanes[printer]
}

export const mutations: MutationTree<FleetActivityState> = {
    reset(state) {
        Object.assign(state, getDefaultState())
    },

    resetLanes(state) {
        Vue.set(state, 'lanes', {})
    },

    setLaneLoading(state, payload: { printer: string; loading: boolean }) {
        const lane = ensureLane(state, payload.printer)
        Vue.set(lane, 'loading', payload.loading)
    },

    setLaneLoadingMore(state, payload: { printer: string; loading: boolean }) {
        const lane = ensureLane(state, payload.printer)
        Vue.set(lane, 'loadingMore', payload.loading)
    },

    setLaneRecords(state, payload: { printer: string; records: FleetActivityRecord[]; total: number }) {
        const lane = ensureLane(state, payload.printer)
        Vue.set(lane, 'records', payload.records)
        Vue.set(lane, 'total', payload.total)
        Vue.set(lane, 'hasMore', payload.records.length < payload.total)
    },

    appendLaneRecords(state, payload: { printer: string; records: FleetActivityRecord[]; total: number }) {
        const lane = ensureLane(state, payload.printer)
        const existing = new Set(lane.records.map((r) => r.id))
        const novel = payload.records.filter((r) => !existing.has(r.id))
        const records = [...lane.records, ...novel]
        Vue.set(lane, 'records', records)
        Vue.set(lane, 'total', payload.total)
        // A page that added nothing new means the server has nothing further for us.
        Vue.set(lane, 'hasMore', novel.length > 0 && records.length < payload.total)
    },

    setTypes(state, types: FleetActivityTypeCount[]) {
        Vue.set(state, 'types', types)
    },

    setPrinters(state, printers: FleetActivityPrinterCount[]) {
        Vue.set(state, 'printers', printers)
    },
}
