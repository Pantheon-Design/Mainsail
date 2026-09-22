/**
 * Detects keyboard-wedge barcode/QR scanner input that does NOT send a trailing
 * Enter, and auto-submits it.
 *
 * A scanner "types" its payload as a burst. We count characters appended
 * within a sliding window of `windowMs` (default 1 s). Once more than
 * `minChars` characters (default 5) have arrived inside that window, the
 * detector is armed and submits the whole buffer as soon as the input has
 * been quiet for `settleMs`. Deleting or clearing the field disarms it.
 * A person typing slowly never gets more than 5 characters into one second,
 * so they still press Enter themselves.
 *
 * Scanners that DO send Enter still work: the Enter handler fires first, clears
 * the buffer and calls `reset()`, so the pending timer never submits.
 *
 * Usage (Vue class component):
 *   created() { this.scanBurst = new ScanBurstDetector(() => this.processScan()) }
 *   <input v-model="buf" @input="scanBurst.onInput($event.target.value)" @keydown.enter="processScan">
 *   processScan() { this.scanBurst.reset(); ... }
 */
export interface ScanBurstOptions {
    /** More than this many characters inside the window arms auto-submit (default 5 → 6+ chars). */
    minChars?: number
    /** Sliding window in which the characters must arrive (default 1000 ms). */
    windowMs?: number
    /** Quiet time after the last character before submitting (default 300 ms). */
    settleMs?: number
}

export class ScanBurstDetector {
    private readonly minChars: number
    private readonly windowMs: number
    private readonly settleMs: number
    private readonly submit: () => void

    private lastLen = 0
    private arrivals: Array<{ t: number; n: number }> = []
    private armed = false
    private timer: ReturnType<typeof setTimeout> | null = null

    constructor(submit: () => void, opts: ScanBurstOptions = {}) {
        this.submit = submit
        this.minChars = (opts.minChars ?? 5) + 1
        this.windowMs = opts.windowMs ?? 1000
        this.settleMs = opts.settleMs ?? 300
    }

    /** Call on every input event with the current full value of the field. */
    onInput(value: string | null | undefined): void {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
        const len = (value ?? '').length
        const added = len - this.lastLen
        this.lastLen = len
        this.clearTimer()

        if (added <= 0) {
            // Deletion or clear: the user is editing by hand, disarm
            this.arrivals = []
            this.armed = false
            return
        }

        this.arrivals.push({ t: now, n: added })
        const cutoff = now - this.windowMs
        this.arrivals = this.arrivals.filter((a) => a.t >= cutoff)
        const inWindow = this.arrivals.reduce((sum, a) => sum + a.n, 0)
        if (inWindow >= this.minChars) this.armed = true

        if (this.armed && len >= this.minChars) {
            this.timer = setTimeout(() => {
                this.timer = null
                this.reset()
                this.submit()
            }, this.settleMs)
        }
    }

    /** Forget the current burst (call when the buffer is consumed or cleared). */
    reset(): void {
        this.clearTimer()
        this.lastLen = 0
        this.arrivals = []
        this.armed = false
    }

    private clearTimer(): void {
        if (this.timer) {
            clearTimeout(this.timer)
            this.timer = null
        }
    }
}
