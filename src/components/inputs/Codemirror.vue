<template>
    <div class="vue-codemirror">
        <div ref="codemirror" v-observe-visibility="visibilityChanged"></div>
    </div>
</template>

<script lang="ts">
// Inspired by these repo: https://github.com/surmon-china/vue-codemirror

import { Component, Mixins, Prop, Watch } from 'vue-property-decorator'
import BaseMixin from '../mixins/base'
import { basicSetup } from 'codemirror'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { vscodeDark } from '@uiw/codemirror-theme-vscode'
import { StreamLanguage, syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { klipper_config } from '@/plugins/StreamParserKlipperConfig'
import { gcode } from '@/plugins/StreamParserGcode'
import { indentWithTab } from '@codemirror/commands'
import { json } from '@codemirror/lang-json'
import { css } from '@codemirror/lang-css'
import { yaml } from '@codemirror/lang-yaml'
import { indentUnit } from '@codemirror/language'

// Custom YAML highlighting - keys vs values
const yamlHighlightStyle = HighlightStyle.define([
    // Keys - light blue
    { tag: tags.definition(tags.propertyName), color: '#9cdcfe' },
    // Values - orange (plain/unquoted values)
    { tag: tags.content, color: '#ce9178' },
    // Comments - green
    { tag: tags.lineComment, color: '#6a9955' },
])

@Component
export default class Codemirror extends Mixins(BaseMixin) {
    private content = ''
    private codemirror: null | EditorView = null
    private cminstance: null | EditorView = null

    declare $refs: {
        codemirror: HTMLElement
    }

    @Prop({ required: false, default: '' })
    declare readonly code: string

    @Prop({ required: false, default: '' })
    declare value: string

    @Prop({ required: false, default: 'codemirror' })
    declare readonly name: string

    @Prop({ required: false, default: '' })
    declare readonly fileExtension: string

    @Watch('value')
    valueChanged(newVal: string) {
        const cm_value = this.cminstance?.state?.doc.toString()
        if (newVal !== cm_value) {
            this.setCmValue(newVal)
        }
    }

    mounted(): void {
        this.initialize()
    }

    beforeDestroy() {
        this.destroy()
    }

    destroy() {
        this.cminstance?.destroy()
    }

    initialize() {
        this.codemirror = new EditorView({
            parent: this.$refs.codemirror,
        })
        this.cminstance = this.codemirror

        this.$nextTick(() => {
            this.setCmValue(this.code || this.value || this.content)

            this.$emit('ready', this.codemirror)
        })
    }

    setCmValue(content: string) {
        this.cminstance?.setState(EditorState.create({ doc: content, extensions: this.cmExtensions }))
    }

    get cmExtensions() {
        const isYaml = ['yml', 'yaml'].includes(this.fileExtension)

        const extensions = [
            EditorView.theme({}, { dark: true }),
            basicSetup,
            indentUnit.of(' '.repeat(this.tabSize)),
            keymap.of([indentWithTab]),
            EditorView.updateListener.of((update) => {
                this.content = update.state?.doc.toString()
                if (this.$emit) {
                    this.$emit('input', this.content)
                }
            }),
        ]

        // For YAML, use custom highlighting instead of vscodeDark
        if (isYaml) {
            extensions.push(yaml())
            extensions.push(syntaxHighlighting(yamlHighlightStyle))
            // Add dark background theme for YAML
            extensions.push(EditorView.theme({
                '&': { backgroundColor: '#1e1e1e' },
                '.cm-content': { caretColor: '#fff' },
                '.cm-gutters': { backgroundColor: '#1e1e1e', borderRight: '1px solid #333' },
                '.cm-activeLineGutter': { backgroundColor: '#2a2a2a' },
                '.cm-activeLine': { backgroundColor: '#2a2a2a' },
            }, { dark: true }))
        } else {
            extensions.push(vscodeDark)

            if (['cfg', 'conf'].includes(this.fileExtension)) extensions.push(StreamLanguage.define(klipper_config))
            else if (['gcode'].includes(this.fileExtension)) extensions.push(StreamLanguage.define(gcode))
            else if (['json'].includes(this.fileExtension)) extensions.push(json())
            else if (['css', 'scss', 'sass'].includes(this.fileExtension)) extensions.push(css())
        }

        return extensions
    }

    visibilityChanged(isVisible: boolean) {
        if (isVisible) this.cminstance?.focus()
    }

    get tabSize() {
        return this.$store.state.gui.editor.tabSize || 2
    }
}
</script>
