/**
 * Detects keyboard-wedge barcode/QR scanner input that does NOT send a trailing
 * Enter, and auto-submits it.
 *
 * A scanner "types" its payload as a burst of characters only a few
 * milliseconds apart. A human typist leaves far larger gaps between keys.
 * We count characters that arrive with less than `maxGapMs` between them; once
 * that burst is at least `minChars` long and the input has been quiet for
 * `settleMs`, `submit()` is called. Manual typing never builds a long enough
 * burst, so it is never auto-submitted (the user still presses Enter).
 *
 * Scanners that DO send Enter still work: the Enter handler fires first, clears
 * the buffer, and the pending burst timer becomes a harmless no-op.
 *
 * Usage (Vue class component):
 *   created() { this.scanBurst = new ScanBurstDetector(() => this.processScan()) }
 *   <input v-model="buf" @input="scanBurst.onInput($event.target.value)" @keydown.enter="processScan">
 *   processScan() { this.scanBurst.reset(); ... }
 */
export interface ScanBurstOptions {
    /** Burst must contain more than this many characters to auto-submit (default: 5 → 6+ chars). */
    minChars?: number
    /** Max ms between two characters for them to count as the same burst (default 40). */
    maxGapMs?: number
    /** Quiet time after the last burst character before submitting (default 120). */
    settleMs?: number
}

export class ScanBurstDetector {
    private readonly minChars: number
    private readonly maxGapMs: number
    private readonly settleMs: number
    private readonly submit: () => void

    private lastLen = 0
    private lastTime = 0
    private burstChars = 0
    private timer: ReturnType<typeof setTimeout> | null = null

    constructor(submit: () => void, opts: ScanBurstOptions = {}) {
        this.submit = submit
        this.minChars = (opts.minChars ?? 5) + 1
        this.maxGapMs = opts.maxGapMs ?? 40
        this.settleMs = opts.settleMs ?? 120
    }

    /** Call on every input event with the current full value of the field. */
    onInput(value: string | null | undefined): void {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
        const len = (value ?? '').length
        const added = len - this.lastLen

        if (now - this.lastTime > this.maxGapMs) this.burstChars = 0
        // Deletions / clears break the burst; only appended chars count
        this.burstChars = added > 0 ? this.burstChars + added : 0

        this.lastLen = len
        this.lastTime = now
        this.clearTimer()

        if (this.burstChars >= this.minChars && len >= this.minChars) {
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
        this.lastTime = 0
        this.burstChars = 0
    }

    private clearTimer(): void {
        if (this.timer) {
            clearTimeout(this.timer)
            this.timer = null
        }
    }
}
