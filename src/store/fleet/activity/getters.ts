import { GetterTree } from 'vuex'
import { FleetActivityLane, FleetActivityRecord, FleetActivityState } from './types'
import { ActivityEvent, ActivityTier } from '@/components/timeline/types'
import { getDefaultLane } from './index'
import i18n from '@/plugins/i18n'

function isoToSeconds(value: string | null | undefined): number {
    if (!value) return 0
    const ms = Date.parse(value)
    return Number.isFinite(ms) ? ms / 1000 : 0
}

/**
 * details.nozzle_health as the printer recorded it, or one synthesised from
 * the daemon's flattened columns (source 'daemon' = estimated from the last
 * daily service-tracker snapshot because the printer's fork predates the
 * snapshot).
 */
function withNozzleHealth(record: FleetActivityRecord): Record<string, any> | null {
    const details = record.details ?? null
    if (details && details.nozzle_health) return details
    const source = record.nozzle_health_source
    if (!source || source === 'none' || record.nozzle_health_pct == null) return details

    return {
        ...(details ?? {}),
        nozzle_health: {
            nozzle_life: record.nozzle_life ?? null,
            remaining_nozzle_life: record.remaining_nozzle_life ?? null,
            health_pct: record.nozzle_health_pct,
            nozzle_size: record.nozzle_size ?? null,
            nozzle_type: record.nozzle_type ?? null,
            source,
        },
    }
}

/** Normalise a daemon row to the shared ActivityEvent shape. */
export function toActivityEvent(record: FleetActivityRecord): ActivityEvent {
    return {
        id: record.id,
        seq: record.printer_seq,
        ts: isoToSeconds(record.ts),
        recorded_at: isoToSeconds(record.recorded_at),
        updated_at: record.updated_at,
        type: record.type,
        tier: (record.tier === 2 ? 2 : 1) as ActivityTier,
        source: record.source ?? 'system',
        client: record.client,
        ip: record.ip,
        summary: record.summary ?? '',
        details: withNozzleHealth(record),
        job_id: record.moonraker_job_id,
        filename: record.filename,
        deleted: record.deleted,
        printer_hostname: record.printer_hostname,
    }
}

export const getters: GetterTree<FleetActivityState, any> = {
    getLane:
        (state) =>
        (printer: string): FleetActivityLane =>
            state.lanes[printer] ?? getDefaultLane(),

    /** Non-deleted events of one lane, newest first, in the shared ActivityEvent shape. */
    getLaneEvents:
        (state) =>
        (printer: string): ActivityEvent[] =>
            (state.lanes[printer]?.records ?? [])
                .filter((r) => !r.deleted)
                .map(toActivityEvent)
                .sort((a, b) => b.ts - a.ts),

    isAnyLaneLoading(state): boolean {
        return Object.values(state.lanes).some((lane) => lane.loading)
    },

    getTypeItems(state): { text: string; value: string }[] {
        return state.types.map((entry) => {
            const key = `Timeline.Types.${entry.type}`
            const label = i18n.te(key) ? i18n.t(key).toString() : entry.type
            return { text: `${label} (${entry.count})`, value: entry.type }
        })
    },

    getPrinterHostnames(state): string[] {
        return state.printers.map((p) => p.printer_hostname)
    },
}
