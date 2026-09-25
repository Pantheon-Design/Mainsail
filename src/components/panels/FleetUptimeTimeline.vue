<template>
    <div class="uptime-row">
        <!-- header: status dot + name on the left, uptime % + state on the right -->
        <div class="uptime-head">
            <div class="uptime-head-left">
                <span class="uptime-dot" :class="'uptime-dot--' + currentState.kind"></span>
                <div>
                    <div class="uptime-title">{{ title }}</div>
                    <div v-if="subtitle" class="uptime-subtitle text--secondary">{{ subtitle }}</div>
                </div>
            </div>
            <div class="uptime-head-right">
                <span class="uptime-state" :class="'uptime-state--' + currentState.kind">{{ currentState.label }}</span>
                <span class="uptime-pct text--secondary">{{ overallLabel }}</span>
            </div>
        </div>

        <!-- the 90-day bar -->
        <div class="uptime-bars" @mouseleave="hoverIndex = -1">
            <div
                v-for="(day, i) in dayBuckets"
                :key="day.key"
                class="uptime-bar"
                :class="['uptime-bar--' + day.status, { 'uptime-bar--hover': hoverIndex === i }]"
                @mouseenter="hoverIndex = i"></div>

            <div
                v-if="hovered"
                class="uptime-tooltip elevation-6"
                :class="tooltipEdgeClass"
                :style="{ left: tooltipLeft }">
                <div class="uptime-tooltip-date">{{ hovered.label }}</div>
                <div class="uptime-tooltip-pct" :class="'uptime-state--' + hovered.status">
                    <template v-if="hovered.status === 'nodata'">No data yet</template>
                    <template v-else>{{ hovered.uptimePct }} uptime</template>
                </div>
                <div v-if="hovered.status !== 'nodata' && hovered.incidents.length === 0" class="uptime-tooltip-line text--secondary">
                    No downtime recorded
                </div>
                <div v-for="(inc, k) in hovered.incidents" :key="k" class="uptime-tooltip-line">
                    <span class="uptime-inc-dot" :class="'uptime-inc-dot--' + inc.severity"></span>
                    <span>{{ inc.label }}</span>
                    <span class="text--secondary">&nbsp;{{ inc.range }} · {{ inc.duration }}</span>
                </div>
            </div>
        </div>

        <div class="uptime-axis text--secondary">
            <span>{{ days }} days ago</span>
            <span>Today</span>
        </div>

        <!-- incident list, newest first -->
        <div v-if="incidentRows.length" class="uptime-incidents">
            <div
                v-for="(inc, k) in (showAllIncidents ? incidentRows : incidentRows.slice(0, 5))"
                :key="k"
                class="uptime-incident">
                <span class="uptime-inc-dot" :class="'uptime-inc-dot--' + inc.severity"></span>
                <span class="uptime-incident-label">{{ inc.label }}</span>
                <span class="text--secondary">{{ inc.when }}</span>
                <span class="uptime-incident-duration">{{ inc.duration }}</span>
            </div>
            <a v-if="incidentRows.length > 5" class="uptime-more" @click="showAllIncidents = !showAllIncidents">
                {{ showAllIncidents ? 'Show fewer' : `Show all ${incidentRows.length} incidents` }}
            </a>
        </div>
        <div v-else-if="hasData" class="uptime-incidents text--secondary caption">No incidents in the last {{ days }} days.</div>
        <div v-else class="uptime-incidents text--secondary caption">No uptime records yet — the daemon starts recording on its next start.</div>
    </div>
</template>

<script lang="ts">
/**
 * Status-page style uptime timeline (one component per daemon/site), laid out
 * like status.claude.com: a bar per day for the last N days, hover for that
 * day's uptime % and incidents, and an incident list underneath.
 *
 * Input is the raw material a fleet_daemon records about itself
 * (fleet_uptime_tracker.py): one *segment* per daemon process life
 * (started_at → last_seen_at, ended_at set on a clean stop) plus the
 * cloud-sync outages it noted. Everything visible is DERIVED here: downtime
 * is the gap between one segment's end and the next one's start, so the
 * daemon never has to write "I am down".
 */
import { Component, Prop, Vue } from 'vue-property-decorator'

export interface UptimeSegment {
    started_at: string
    last_seen_at: string
    ended_at: string | null
    end_reason: string | null
    host_name?: string | null
}

export interface SyncOutage {
    started_at: string
    ended_at: string
    error?: string | null
    /** Still failing at fetch time (the daemon only stores an outage once it recovers). */
    ongoing?: boolean
}

type DayStatus = 'ok' | 'minor' | 'major' | 'nodata'
type Severity = 'major' | 'minor'

interface Interval {
    start: number
    end: number
    kind: 'down' | 'sync'
    reason: string | null
    ongoing: boolean
}

interface DayBucket {
    key: string
    label: string
    status: DayStatus
    uptimePct: string
    incidents: { label: string; range: string; duration: string; severity: Severity }[]
}

const DAY_MS = 86_400_000
/** Daemon downtime at least this long counts as a major outage (red); shorter gaps
 *  (a deploy restart) and cloud-sync interruptions render as degraded (yellow). */
const MAJOR_DOWN_MS = 5 * 60_000
/** Gaps shorter than this are timestamp jitter, not a restart. */
const MIN_GAP_MS = 1_000

function fmtDuration(ms: number): string {
    const s = Math.max(0, Math.round(ms / 1000))
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m ${s % 60}s`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ${String(m % 60).padStart(2, '0')}m`
    const d = Math.floor(h / 24)
    return `${d}d ${h % 24}h`
}

function fmtTime(ms: number): string {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtDateTime(ms: number): string {
    return new Date(ms).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

@Component
export default class FleetUptimeTimeline extends Vue {
    @Prop({ type: String, required: true }) declare readonly title: string
    @Prop({ type: String, default: '' }) declare readonly subtitle: string
    /** Whether the daemon is reachable right now (fresh heartbeat). */
    @Prop({ type: Boolean, default: false }) declare readonly online: boolean
    /** Server clock at fetch time (ISO). All timestamps are compared against it. */
    @Prop({ type: String, required: true }) declare readonly now: string
    @Prop({ type: Array, default: () => [] }) declare readonly segments: UptimeSegment[]
    @Prop({ type: Array, default: () => [] }) declare readonly outages: SyncOutage[]
    @Prop({ type: Number, default: 90 }) declare readonly days: number
    /** Treat cloud-sync outages as full downtime (the "Cloud sync" row) instead of degraded. */
    @Prop({ type: Boolean, default: false }) declare readonly outagesAreDowntime: boolean

    hoverIndex = -1
    showAllIncidents = false

    get nowMs(): number {
        const t = Date.parse(this.now)
        return Number.isFinite(t) ? t : Date.now()
    }

    /** Merged intervals during which the daemon was alive. */
    get upIntervals(): { start: number; end: number; reason: string | null }[] {
        const segs = [...this.segments]
            .map((s) => ({
                start: Date.parse(s.started_at),
                end: s.ended_at ? Date.parse(s.ended_at) : Date.parse(s.last_seen_at),
                reason: s.end_reason ?? null,
                open: !s.ended_at,
            }))
            .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end))
            .sort((a, b) => a.start - b.start)
        if (segs.length && this.online) {
            // Live segment: the heartbeat is fresh, so it extends to "now".
            const last = segs[segs.length - 1]
            if (last.open) last.end = Math.max(last.end, this.nowMs)
        }
        // Never let a segment run past the server clock (clock skew guard).
        for (const s of segs) s.end = Math.min(Math.max(s.end, s.start), this.nowMs)

        const merged: { start: number; end: number; reason: string | null }[] = []
        for (const s of segs) {
            const prev = merged[merged.length - 1]
            if (prev && s.start <= prev.end + MIN_GAP_MS) {
                prev.end = Math.max(prev.end, s.end)
                prev.reason = s.reason
            } else {
                merged.push({ start: s.start, end: s.end, reason: s.reason })
            }
        }
        return merged
    }

    get firstSeen(): number | null {
        return this.upIntervals.length ? this.upIntervals[0].start : null
    }

    get hasData(): boolean {
        return this.firstSeen !== null
    }

    /** Start of the evaluated window: never before the first record. */
    get windowStart(): number {
        const horizon = this.nowMs - this.days * DAY_MS
        return this.firstSeen === null ? this.nowMs : Math.max(horizon, this.firstSeen)
    }

    /** Downtime = complement of the up-intervals; sync outages appended as their own kind. */
    get incidents(): Interval[] {
        const out: Interval[] = []
        const ups = this.upIntervals
        for (let i = 0; i < ups.length; i++) {
            const gapStart = ups[i].end
            const gapEnd = i + 1 < ups.length ? ups[i + 1].start : this.nowMs
            if (gapEnd - gapStart > MIN_GAP_MS) {
                // A trailing gap only exists while the daemon is offline: that incident is still open.
                const ongoing = i + 1 >= ups.length
                out.push({ start: gapStart, end: gapEnd, kind: 'down', reason: ups[i].reason, ongoing })
            }
        }
        for (const o of this.outages) {
            const start = Date.parse(o.started_at)
            const end = o.ongoing ? this.nowMs : Date.parse(o.ended_at)
            if (!Number.isFinite(start) || !Number.isFinite(end) || end - start <= MIN_GAP_MS) continue
            out.push({ start, end: Math.min(end, this.nowMs), kind: 'sync', reason: o.error ?? null, ongoing: !!o.ongoing })
        }
        return out.sort((a, b) => a.start - b.start)
    }

    severityOf(inc: Interval, durationMs: number): Severity {
        if (inc.kind === 'sync' && !this.outagesAreDowntime) return 'minor'
        return durationMs >= MAJOR_DOWN_MS ? 'major' : 'minor'
    }

    incidentLabel(inc: Interval): string {
        if (inc.kind === 'sync') return 'Cloud sync interrupted'
        if (inc.ongoing) return inc.reason === 'shutdown' ? 'Stopped' : 'Unreachable'
        return inc.reason === 'shutdown' ? 'Stopped (clean shutdown)' : 'Down (crash or power loss)'
    }

    get dayBuckets(): DayBucket[] {
        const buckets: DayBucket[] = []
        const today = new Date(this.nowMs)
        today.setHours(0, 0, 0, 0)
        for (let i = this.days - 1; i >= 0; i--) {
            const dayStart = new Date(today.getTime())
            dayStart.setDate(today.getDate() - i)
            const startMs = dayStart.getTime()
            const endMs = Math.min(startMs + DAY_MS, this.nowMs)
            const label = dayStart.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
            const key = dayStart.toISOString().slice(0, 10)

            if (this.firstSeen === null || endMs <= this.firstSeen) {
                buckets.push({ key, label, status: 'nodata', uptimePct: '', incidents: [] })
                continue
            }
            const winStart = Math.max(startMs, this.firstSeen)
            const winLen = Math.max(1, endMs - winStart)
            let downMs = 0
            let worst: DayStatus = 'ok'
            const list: DayBucket['incidents'] = []
            for (const inc of this.incidents) {
                const s = Math.max(inc.start, winStart)
                const e = Math.min(inc.end, endMs)
                if (e <= s) continue
                const dur = e - s
                const total = inc.end - inc.start
                const counts = inc.kind === 'down' || this.outagesAreDowntime
                if (counts) downMs += dur
                const sev = this.severityOf(inc, total)
                if (sev === 'major') worst = 'major'
                else if (worst !== 'major') worst = 'minor'
                list.push({
                    label: this.incidentLabel(inc),
                    range: `${fmtTime(s)}–${inc.ongoing && e >= this.nowMs ? 'now' : fmtTime(e)}`,
                    duration: fmtDuration(dur),
                    severity: sev,
                })
            }
            const pct = Math.max(0, 1 - downMs / winLen) * 100
            buckets.push({
                key,
                label,
                status: worst,
                uptimePct: pct >= 99.995 ? '100%' : `${pct.toFixed(2)}%`,
                incidents: list,
            })
        }
        return buckets
    }

    get overallPct(): number | null {
        if (!this.hasData) return null
        const winLen = Math.max(1, this.nowMs - this.windowStart)
        let downMs = 0
        for (const inc of this.incidents) {
            if (inc.kind === 'sync' && !this.outagesAreDowntime) continue
            const s = Math.max(inc.start, this.windowStart)
            const e = Math.min(inc.end, this.nowMs)
            if (e > s) downMs += e - s
        }
        return Math.max(0, 1 - downMs / winLen) * 100
    }

    get overallLabel(): string {
        if (this.overallPct === null) return '— uptime'
        const p = this.overallPct
        return `${p >= 99.995 ? '100' : p.toFixed(2)}% uptime`
    }

    get currentState(): { kind: DayStatus; label: string } {
        if (!this.hasData) return { kind: 'nodata', label: 'No data' }
        const last = this.incidents.length ? this.incidents[this.incidents.length - 1] : null
        if (this.online) {
            // Up, but a sync outage may still be open (the "Cloud sync" row).
            if (last && last.kind === 'sync' && last.ongoing) {
                return this.outagesAreDowntime
                    ? { kind: 'major', label: `Interrupted since ${fmtDateTime(last.start)}` }
                    : { kind: 'minor', label: 'Cloud sync degraded' }
            }
            return { kind: 'ok', label: 'Operational' }
        }
        if (last && last.kind === 'down' && last.ongoing) {
            return { kind: 'major', label: `${this.incidentLabel(last)} since ${fmtDateTime(last.start)}` }
        }
        return { kind: 'major', label: 'Offline' }
    }

    /** Incidents within the window, newest first, for the list under the bar. */
    get incidentRows(): { label: string; when: string; duration: string; severity: Severity }[] {
        return this.incidents
            .filter((inc) => inc.end > this.windowStart)
            .map((inc) => {
                const dur = inc.end - inc.start
                return {
                    label: this.incidentLabel(inc),
                    when: `${fmtDateTime(inc.start)} → ${inc.ongoing ? 'now' : fmtDateTime(inc.end)}`,
                    duration: fmtDuration(dur),
                    severity: this.severityOf(inc, dur),
                }
            })
            .reverse()
    }

    get hovered(): DayBucket | null {
        return this.hoverIndex >= 0 ? this.dayBuckets[this.hoverIndex] ?? null : null
    }

    get tooltipLeft(): string {
        return `${((this.hoverIndex + 0.5) / this.days) * 100}%`
    }

    get tooltipEdgeClass(): string {
        const frac = (this.hoverIndex + 0.5) / this.days
        if (frac < 0.15) return 'uptime-tooltip--left'
        if (frac > 0.85) return 'uptime-tooltip--right'
        return ''
    }
}
</script>

<style scoped>
.uptime-row {
    padding: 14px 16px 10px;
    border-radius: 6px;
    background: rgba(128, 128, 128, 0.06);
}
.uptime-row + .uptime-row {
    margin-top: 12px;
}
.uptime-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
}
.uptime-head-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
}
.uptime-head-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    white-space: nowrap;
}
.uptime-title {
    font-weight: 600;
    font-size: 15px;
    line-height: 1.2;
}
.uptime-subtitle {
    font-size: 12px;
    margin-top: 2px;
}
.uptime-state {
    font-weight: 600;
    font-size: 13px;
}
.uptime-pct {
    font-size: 12px;
}
.uptime-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex: 0 0 10px;
}
.uptime-dot--ok,
.uptime-state--ok,
.uptime-inc-dot--ok {
    color: #2eb872;
}
.uptime-dot--ok {
    background: #2eb872;
    box-shadow: 0 0 0 3px rgba(46, 184, 114, 0.22);
}
.uptime-dot--minor {
    background: #f5a623;
}
.uptime-state--minor,
.uptime-inc-dot--minor {
    color: #f5a623;
}
.uptime-dot--major {
    background: #e5484d;
    box-shadow: 0 0 0 3px rgba(229, 72, 77, 0.22);
}
.uptime-state--major,
.uptime-inc-dot--major {
    color: #e5484d;
}
.uptime-dot--nodata {
    background: rgba(128, 128, 128, 0.5);
}
.uptime-state--nodata {
    color: rgba(128, 128, 128, 0.9);
}

.uptime-bars {
    position: relative;
    display: flex;
    gap: 3px;
    height: 34px;
}
.uptime-bar {
    flex: 1 1 0;
    min-width: 2px;
    border-radius: 2px;
    transition: transform 0.08s ease, opacity 0.08s ease;
    cursor: default;
}
.uptime-bar--ok {
    background: #2eb872;
}
.uptime-bar--minor {
    background: #f5a623;
}
.uptime-bar--major {
    background: #e5484d;
}
.uptime-bar--nodata {
    background: rgba(128, 128, 128, 0.28);
}
.uptime-bar--hover {
    transform: scaleY(1.12);
    opacity: 0.85;
}
.uptime-axis {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    margin-top: 6px;
}

.uptime-tooltip {
    position: absolute;
    bottom: calc(100% + 8px);
    transform: translateX(-50%);
    min-width: 220px;
    max-width: 320px;
    padding: 8px 10px;
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.4;
    z-index: 5;
    pointer-events: none;
    background: var(--v-tooltip-base, #2b2b2b);
    color: #fff;
}
.theme--light .uptime-tooltip {
    background: #fff;
    color: rgba(0, 0, 0, 0.87);
    border: 1px solid rgba(0, 0, 0, 0.08);
}
.theme--dark .uptime-tooltip {
    background: #2b2b2b;
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.08);
}
.uptime-tooltip--left {
    transform: translateX(-8%);
}
.uptime-tooltip--right {
    transform: translateX(-92%);
}
.uptime-tooltip-date {
    font-weight: 600;
}
.uptime-tooltip-pct {
    font-weight: 600;
    margin-bottom: 4px;
}
.uptime-tooltip-line {
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
}

.uptime-inc-dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex: 0 0 7px;
    background: currentColor;
}
.uptime-incidents {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(128, 128, 128, 0.18);
    font-size: 12.5px;
}
.uptime-incident {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
}
.uptime-incident-label {
    font-weight: 500;
}
.uptime-incident-duration {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
}
.uptime-more {
    display: inline-block;
    margin-top: 4px;
    font-size: 12px;
    cursor: pointer;
}
</style>
