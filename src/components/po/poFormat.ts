/**
 * Pure helpers shared by the purchase-order screens: status colours, the PO
 * part options for gcode -> part editors, run suggestions, the stacked part
 * bar and human-readable timeline text.
 */
import {
    FleetPoDetail,
    FleetPoItem,
    FleetPoPart,
    FleetPoTimelineEntry,
    PartLinkPayload,
    PoStatus,
} from '@/store/fleet/purchaseOrders/types'

/** Amber used for every "not linked" highlight. */
export const PO_WARN_COLOR = 'amber darken-2'

export function poStatusColor(s: PoStatus | string): string {
    return { draft: 'blue-grey', open: 'blue', closed: 'green', cancelled: 'red' }[s] ?? 'grey'
}

export function itemLabel(it: Pick<FleetPoItem, 'line_no' | 'sku' | 'description' | 'id'>): string {
    const line = it.line_no != null ? `#${it.line_no} ` : ''
    return `${line}${it.sku || it.description || 'Item ' + it.id}`
}

export interface PoPartOption {
    part_id: number
    name: string
    item_id: number
    item_label: string
    required: number
    good: number
    unscheduled: number
    tracked: boolean
}

export function poPartOptions(detail: FleetPoDetail | null): PoPartOption[] {
    if (!detail) return []
    const out: PoPartOption[] = []
    for (const it of detail.items) {
        for (const p of it.parts) {
            out.push({
                part_id: p.id,
                name: p.name,
                item_id: it.id,
                item_label: itemLabel(it),
                required: p.required,
                good: p.good,
                unscheduled: p.unscheduled,
                tracked: p.tracked,
            })
        }
    }
    return out
}

/** v-select items: one header per PO item, then its parts. */
export function partSelectItems(options: PoPartOption[]): any[] {
    const out: any[] = []
    let lastItem: number | null = null
    for (const o of options) {
        if (o.item_id !== lastItem) {
            out.push({ header: o.item_label })
            lastItem = o.item_id
        }
        out.push({ text: o.name, value: o.part_id, subtitle: `${o.good} / ${o.required} good` })
    }
    return out
}

/** Runs needed to cover the largest unscheduled need among the linked parts. */
export function suggestRuns(links: PartLinkPayload[], options: PoPartOption[]): number {
    let best = 0
    for (const l of links) {
        const o = options.find((p) => p.part_id === l.part_id)
        if (!o) continue
        const per = Math.max(1, Number(l.qty_per_run) || 1)
        best = Math.max(best, Math.ceil(Math.max(0, o.unscheduled) / per))
    }
    return best
}

/** Only complete rows (part chosen, qty > 0), deduplicated by part. */
export function cleanLinks(links: PartLinkPayload[]): PartLinkPayload[] {
    const seen = new Set<number>()
    const out: PartLinkPayload[] = []
    for (const l of links) {
        if (!l.part_id || seen.has(l.part_id)) continue
        seen.add(l.part_id)
        out.push({ part_id: l.part_id, qty_per_run: Math.max(1, Math.floor(Number(l.qty_per_run) || 1)) })
    }
    return out
}

export interface PartBar {
    good: number
    qcFailed: number
    printing: number
    remaining: number
    /** true when good output exceeds the requirement */
    surplus: boolean
}

/** Stacked bar percentages for one part: good / QC failed / printing / remaining. */
export function partBar(p: FleetPoPart): PartBar {
    const total = Math.max(p.required, p.good + p.qc_failed + p.printing, 1)
    const pct = (n: number) => (100 * Math.max(0, n)) / total
    return {
        good: pct(p.good),
        qcFailed: pct(p.qc_failed),
        printing: pct(p.printing),
        remaining: pct(Math.max(0, p.required - p.good - p.printing)),
        surplus: p.surplus > 0,
    }
}

export function baseName(path: string | null | undefined): string {
    if (!path) return '—'
    return path.split('/').pop() ?? path
}

function fmtVal(v: any): string {
    if (v === null || v === undefined || v === '') return '—'
    if (typeof v === 'object') {
        const parts = Object.values(v).filter((x) => x !== null && x !== '')
        return parts.length ? parts.join(', ') : '—'
    }
    return String(v)
}

function changesText(changes: Record<string, [any, any]> | undefined): string {
    if (!changes) return ''
    return Object.entries(changes)
        .map(([f, [a, b]]) => `${f.replace(/_/g, ' ')} ${fmtVal(a)} → ${fmtVal(b)}`)
        .join('; ')
}

function partsText(parts: { part_name?: string | null; qty?: number; qty_per_run?: number; part_id?: number }[]) {
    if (!parts || parts.length === 0) return 'no PO part'
    return parts.map((p) => `${p.qty ?? p.qty_per_run ?? 1}× ${p.part_name ?? 'part #' + p.part_id}`).join(', ')
}

export interface TimelineView {
    icon: string
    color: string
    text: string
}

/**
 * Human-readable one-liner per timeline entry. `icon` is a key the dialog maps
 * to an @mdi/js path (keeps this module free of icon imports).
 */
export function timelineView(e: FleetPoTimelineEntry, partName?: (id: number) => string | null): TimelineView {
    const p = e.payload ?? {}
    const job = e.job_name ?? p.job_name ?? (e.job_id ? `#${e.job_id}` : '')
    const runCtx = `(job ${job}, gcode ${baseName(e.gcode_filename)})`
    const named = (links: any[]) =>
        (links ?? []).map((l: any) => ({ ...l, part_name: l.part_name ?? partName?.(l.part_id) ?? null }))
    switch (e.kind) {
        case 'created':
            return {
                icon: 'create',
                color: 'blue-grey',
                text: p.source === 'pdf' ? `Created from ${p.filename ?? 'PDF'}` : 'Created manually',
            }
        case 'extracted':
            return {
                icon: 'extract',
                color: 'purple',
                text: `Read from PDF (${p.model ?? 'Claude'}): PO ${p.po_number ?? '?'}, ${p.items ?? 0} item(s)${
                    p.warnings?.length ? `, ${p.warnings.length} warning(s)` : ''
                }`,
            }
        case 'extraction_failed':
            return { icon: 'error', color: 'error', text: `PDF reading failed: ${p.error ?? 'unknown error'}` }
        case 'edited':
            return { icon: 'edit', color: 'grey', text: `Edited: ${changesText(p.changes)}` }
        case 'confirmed':
            return { icon: 'confirm', color: 'green', text: `Confirmed PO ${p.po_number ?? ''}` }
        case 'status':
            return { icon: 'status', color: 'blue', text: `Status ${p.from} → ${p.to}` }
        case 'item_added':
            return {
                icon: 'add',
                color: 'grey',
                text: `Item added: ${p.sku || p.description || '#' + p.item_id} × ${p.quantity ?? '?'}`,
            }
        case 'item_edited':
            return {
                icon: 'edit',
                color: 'grey',
                text: `Item ${p.sku || '#' + p.item_id} edited: ${changesText(p.changes)}`,
            }
        case 'item_removed':
            return { icon: 'remove', color: 'grey', text: `Item removed: ${p.sku || p.description || '#' + p.item_id}` }
        case 'part_added':
            return { icon: 'add', color: 'grey', text: `Part added: ${p.name} (${p.qty_per_item ?? 1} per item)` }
        case 'part_edited':
            return { icon: 'edit', color: 'grey', text: `Part ${p.name} edited: ${changesText(p.changes)}` }
        case 'part_removed':
            return { icon: 'remove', color: 'grey', text: `Part removed: ${p.name}` }
        case 'job_linked':
            return {
                icon: 'link',
                color: 'blue',
                text: p.created ? `Job ${job} created for this PO` : `Job ${job} linked`,
            }
        case 'job_unlinked':
            return { icon: 'unlink', color: 'orange', text: `Job ${job} unlinked` }
        case 'links_changed': {
            const gs = (p.gcodes ?? []) as any[]
            const txt = gs
                .map((g) => `${g.gcode_filename ? baseName(g.gcode_filename) : 'gcode #' + g.job_item_id}: ${partsText(named(g.parts))}`)
                .join('; ')
            return { icon: 'link', color: 'blue-grey', text: `Gcode parts changed (job ${job})${txt ? ': ' + txt : ''}` }
        }
        case 'job_status':
            return { icon: 'status', color: 'blue', text: `Job ${job}: ${p.from ?? '?'} → ${p.to ?? '?'}` }
        case 'job_ended':
            return {
                icon: 'end',
                color: 'orange',
                text: `Job ${job} ended early (${p.cancelled_runs ?? 0} queued run(s) cancelled, ${
                    p.printing_runs ?? 0
                } still printing)`,
            }
        case 'job_edited':
            return {
                icon: 'edit',
                color: 'grey',
                text: `Job ${job} edited${p.copies != null ? `: copies → ${p.copies}` : ''}`,
            }
        case 'job_deleted':
            return { icon: 'remove', color: 'error', text: `Job ${job} deleted` }
        case 'gcode_added':
            return {
                icon: 'add',
                color: 'grey',
                text: `Gcode ${baseName(p.gcode_filename)} added to job ${job} (${p.runs ?? 1} run(s)/copy): ${partsText(
                    named(p.parts)
                )}`,
            }
        case 'run_started':
            return {
                icon: 'print',
                color: 'blue',
                text: `Run started on ${e.printer_hostname ?? '?'}: ${partsText(e.parts ?? [])} ${runCtx}`,
            }
        case 'run_success': {
            const gained = (e.parts ?? []).map((x) => `+${x.qty} ${x.part_name ?? 'part #' + x.part_id}`).join(', ')
            return {
                icon: 'success',
                color: 'green',
                text: `Run on ${e.printer_hostname ?? '?'} succeeded: ${gained || 'no PO part'} ${runCtx}`,
            }
        }
        case 'run_failed':
            return {
                icon: 'error',
                color: 'error',
                text: `Run on ${e.printer_hostname ?? '?'} failed${e.error ? ': ' + e.error : ''} ${runCtx}`,
            }
        case 'run_cancelled':
            return { icon: 'cancel', color: 'orange', text: `Run on ${e.printer_hostname ?? '?'} cancelled ${runCtx}` }
        case 'qc_failed':
            return {
                icon: 'qc',
                color: 'error',
                text: `QC failed${e.qc_inspector ? ' (' + e.qc_inspector + ')' : ''} on ${
                    e.printer_hostname ?? '?'
                }: ${partsText(e.parts ?? [])} ${runCtx}`,
            }
        default:
            return { icon: 'other', color: 'grey', text: String(e.kind).replace(/_/g, ' ') }
    }
}
