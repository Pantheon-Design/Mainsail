/**
 * fleet_daemon purchase-order API shapes (fleet_po_api.py / fleet_po.py).
 * Field names mirror the daemon rows exactly.
 *
 * A PO has items (order lines); an item has parts (what we print). Linked jobs
 * map each gcode (job item) to the parts it produces (qty_per_run per plate).
 */
import { JobStatus, JobPriority } from '@/store/fleet/jobs/types'

export type PoStatus = 'draft' | 'open' | 'closed' | 'cancelled'
export const PO_STATUSES: PoStatus[] = ['draft', 'open', 'closed', 'cancelled']

export type PoWarningKind = 'part_unlinked' | 'item_no_parts' | 'item_untracked' | 'gcode_unlinked'
export type PoItemTracking = 'none' | 'partial' | 'full'

export const PO_ADDRESS_KEYS = [
    'name',
    'company',
    'address1',
    'address2',
    'city',
    'province',
    'zip',
    'country',
    'phone',
] as const
export type PoAddressKey = (typeof PO_ADDRESS_KEYS)[number]
export type PoAddress = Record<PoAddressKey, string | null>

export interface PoExtraction {
    raw?: any
    warnings?: string[]
    error?: string
}

/** One row of GET /pos */
export interface FleetPoListRow {
    id: number
    po_number: string | null
    status: PoStatus
    customer_id: number | null
    customer_name: string | null
    buyer_name: string | null
    order_date: string | null
    due_date: string | null
    currency: string | null
    total: number | null
    created_at: string
    updated_at: string
    confirmed_at: string | null
    items_count: number
    units_required: number
    jobs_count: number
    active_jobs: number
    units_complete: number
    parts_required: number
    parts_good: number
    /** 0..1 (good parts capped at required / required) */
    progress: number
    fulfilled: boolean
    /** number of warnings */
    warnings: number
}

/** detail.po — every fleet_po column plus the joined customer name. */
export interface FleetPo {
    id: number
    po_number: string | null
    customer_id: number | null
    customer_name: string | null
    buyer_name: string | null
    vendor_name: string | null
    status: PoStatus
    order_date: string | null
    due_date: string | null
    currency: string | null
    subtotal: number | null
    tax_total: number | null
    shipping_total: number | null
    total: number | null
    payment_terms: string | null
    bill_to: Partial<PoAddress> | null
    ship_to: Partial<PoAddress> | null
    notes: string | null
    operator_name: string | null
    extraction: PoExtraction | null
    extraction_model: string | null
    confirmed_at: string | null
    created_at: string
    updated_at: string
}

export interface FleetPoDocument {
    id: number
    filename: string
    content_type?: string
    size: number
    created_at: string
}

export interface PoPartByJob {
    job_id: number
    job_name: string | null
    job_status: JobStatus | null
    printed: number
    printing: number
    failed: number
    qc_failed: number
    good: number
    planned_open: number
}

export interface PoPartByGcode {
    job_item_id: number
    job_id: number
    gcode_filename: string | null
    qty_per_run: number
    printed: number
    printing: number
    failed: number
    qc_failed: number
    good: number
    planned_open: number
}

export interface PoPartByPrinter {
    printer_hostname: string
    printed: number
    printing: number
    qc_failed: number
    good: number
}

export interface FleetPoPart {
    id: number
    item_id: number
    name: string
    qty_per_item: number
    notes: string | null
    required: number
    tracked: boolean
    printed: number
    printing: number
    failed: number
    qc_failed: number
    good: number
    remaining: number
    surplus: number
    planned_open: number
    unscheduled: number
    by_job: PoPartByJob[]
    by_gcode: PoPartByGcode[]
    by_printer: PoPartByPrinter[]
}

export interface FleetPoItem {
    id: number
    po_id: number
    line_no: number | null
    sku: string | null
    description: string | null
    quantity: number
    uom: string | null
    unit_price: number | null
    line_total: number | null
    notes: string | null
    parts: FleetPoPart[]
    /** null when no part of the item is tracked */
    units_complete: number | null
    units_surplus: number
    tracking: PoItemTracking
    fulfilled: boolean
}

export interface PoGcodePartLink {
    part_id: number
    part_name: string | null
    qty_per_run: number
}

export interface FleetPoGcode {
    job_item_id: number
    job_id: number
    gcode_filename: string | null
    /** runs per copy */
    quantity: number
    success: number
    active: number
    failed: number
    qc_failed: number
    parts: PoGcodePartLink[]
}

export interface FleetPoJob {
    id: number
    name: string
    status: JobStatus
    quantity: number
    priority: JobPriority
    due_date: string | null
    created_at?: string
    started_at?: string | null
    finished_at?: string | null
    operator_name?: string | null
    runs_total: number
    runs_done: number
    runs_active: number
    runs_failed: number
    unlinked_gcodes: number
    gcodes: FleetPoGcode[]
}

export interface FleetPoWarning {
    kind: PoWarningKind
    item_id?: number
    part_id?: number
    job_id?: number
    job_item_id?: number
    message: string
}

export interface FleetPoTotals {
    items: number
    units_required: number
    units_complete: number
    parts_required: number
    parts_good: number
    progress: number
    fulfilled: boolean
    active_jobs: number
    warnings: number
}

export interface FleetPoDetail {
    po: FleetPo
    documents: FleetPoDocument[]
    items: FleetPoItem[]
    jobs: FleetPoJob[]
    gcodes: FleetPoGcode[]
    totals: FleetPoTotals
    warnings: FleetPoWarning[]
    /** Only on POST /pos/extract */
    duplicate_of?: { id: number; po_number: string | null; status: PoStatus }[]
    extraction_error?: string | null
}

export interface FleetPoConfig {
    extraction_available: boolean
    model: string | null
    max_pdf_mb: number
}

export type PoTimelineKind =
    | 'created'
    | 'extracted'
    | 'extraction_failed'
    | 'edited'
    | 'confirmed'
    | 'status'
    | 'item_added'
    | 'item_edited'
    | 'item_removed'
    | 'part_added'
    | 'part_edited'
    | 'part_removed'
    | 'job_linked'
    | 'job_unlinked'
    | 'links_changed'
    | 'job_status'
    | 'job_ended'
    | 'job_edited'
    | 'job_deleted'
    | 'gcode_added'
    | 'run_started'
    | 'run_success'
    | 'run_failed'
    | 'run_cancelled'
    | 'qc_failed'

export interface FleetPoTimelineEntry {
    at: string
    kind: PoTimelineKind | string
    source: 'po' | 'run'
    operator_name?: string | null
    job_id?: number | null
    payload?: any
    run_id?: number
    job_name?: string | null
    gcode_filename?: string | null
    printer_hostname?: string | null
    run_source?: string | null
    parts?: { part_id: number; part_name: string | null; qty: number }[]
    error?: string | null
    qc_inspector?: string | null
}

// -- Request payloads -----------------------------------------------------------

export interface PartLinkPayload {
    part_id: number
    /** parts of this PO part per plate (run) */
    qty_per_run: number
}

export interface PoItemPayload {
    line_no?: number | null
    sku?: string | null
    description?: string | null
    quantity?: number
    uom?: string | null
    unit_price?: number | null
    line_total?: number | null
    notes?: string | null
    operator_name?: string | null
}

export interface PoUpdatePayload {
    po_number?: string | null
    /** <= 0 clears */
    customer_id?: number | null
    buyer_name?: string | null
    vendor_name?: string | null
    /** YYYY-MM-DD; '' clears */
    order_date?: string | null
    due_date?: string | null
    currency?: string | null
    subtotal?: number | null
    tax_total?: number | null
    shipping_total?: number | null
    total?: number | null
    payment_terms?: string | null
    bill_to?: Partial<PoAddress> | null
    ship_to?: Partial<PoAddress> | null
    notes?: string | null
    operator_name?: string | null
}

export interface PoCreatePayload extends PoUpdatePayload {
    items?: PoItemPayload[]
}

export interface PoListFilters {
    status?: PoStatus
    customer_id?: number
    q?: string
    include_closed?: boolean
    limit?: number
}

export interface FleetPurchaseOrdersState {
    list: FleetPoListRow[]
    current: FleetPoDetail | null
    loading: boolean
    includeClosed: boolean
    config: FleetPoConfig | null
}
