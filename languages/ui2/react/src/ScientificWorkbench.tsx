import * as React from "react"
import { ChevronDown, FlaskConical, Maximize2, Minimize2, RotateCcw, ScrollText, Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { JobRuntimeSnapshot, ScientificWorkbenchBridge, ScientificWorkbenchMountProps, Ui2Field, WorkbenchResultGroup, WorkbenchSection } from "@/types"

function NativeHost({ create, release, mounted, className }: { create: () => HTMLElement; release?: (node: HTMLElement) => void; mounted?: () => void; className?: string }) {
  const hostRef = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const node = create()
    host.replaceChildren(node)
    mounted?.()
    return () => {
      release?.(node)
      if (node.parentNode === host) host.removeChild(node)
    }
  }, [create, release, mounted])

  return <div className={className} ref={hostRef} />
}

function FieldGroup({ fields, bridge, role = "input", fitPlot = false }: { fields: Ui2Field[]; bridge: ScientificWorkbenchBridge; role?: "input" | "output"; fitPlot?: boolean }) {
  // View JSON is decoded into new arrays on every parent render.  Keep the
  // native group mounted while its declared field membership is unchanged.
  const fieldIds = fields.map((field) => field.id || "").join("\u0000")
  const plannedFields = React.useMemo(() => fields, [fieldIds])
  const create = React.useCallback(() => {
    const node = bridge.createFieldGroup(plannedFields, role)
    if (fitPlot) {
      // Dynamic outputs create their Plotly child later.  Mark the native field
      // root too, so those children inherit the allocated MMC pane size.
      node.setAttribute("data-plot-fit", "pane")
      const plot = node.matches('[data-output-type="plotly"]')
        ? node
        : node.querySelector<HTMLElement>('[data-output-type="plotly"]')
      plot?.setAttribute("data-plot-fit", "pane")
    }
    return node
  }, [bridge, plannedFields, fitPlot, role])
  const mounted = React.useCallback(() => {
    if (role === "input") bridge.fieldGroupMounted()
  }, [bridge, role])
  return (
    <NativeHost create={create} release={bridge.releaseField} mounted={mounted} className="ui2-workbench-field-group" />
  )
}

function fieldChoices(field?: Ui2Field): Array<{ label: string; value: string }> {
  if (!field?.values) return []
  const parts = String(field.values).split("~")
  const choices: Array<{ label: string; value: string }> = []
  for (let index = 0; index < parts.length; index += 2) {
    choices.push({
      label: parts[index] || parts[index + 1] || "",
      value: parts[index + 1] || parts[index] || "",
    })
  }
  return choices
}

function displayValue(value: unknown, field?: Ui2Field): string {
  if (value === true) return "On"
  if (value === false) return "Off"
  if (Array.isArray(value)) return value.map((item) => displayValue(item, field)).join(", ")
  if (value == null || value === "") return "—"
  const choice = fieldChoices(field).find((item) => item.value === String(value))
  if (choice) return choice.label
  return String(value)
}

function truthyRepeatValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => truthyRepeatValue(item))
  if (typeof value === "boolean") return value
  const text = String(value ?? "").trim().toLowerCase()
  return ["1", "true", "yes", "on", "checked"].includes(text)
}

function repeatAtomActive(atom: string, values: Record<string, unknown>): boolean {
  const trimmed = atom.trim()
  if (!trimmed) return true
  if (trimmed.startsWith("!")) return !repeatAtomActive(trimmed.slice(1), values)
  const [id, expected] = trimmed.split(":")
  const value = values[id]
  if (expected == null) return truthyRepeatValue(value)
  return String(value ?? "") === expected
}

function repeatExpressionActive(expression: unknown, values: Record<string, unknown>): boolean {
  const text = String(expression || "").trim()
  if (!text) return true
  return text
    .split("||")
    .some((orPart) => orPart.split("&&").every((andPart) => repeatAtomActive(andPart, values)))
}

function runtimeLogText(snapshot: JobRuntimeSnapshot): string {
  const topic = snapshot.channels.log?.run
  const appended = (topic?.items || []).map((item) => {
    if (item && typeof item === "object" && "text" in item) return String((item as { text?: unknown }).text || "")
    return String(item || "")
  }).join("")
  return appended || String(topic?.value || "")
}

function runtimeProgressValue(snapshot: JobRuntimeSnapshot): Record<string, unknown> {
  const topic = snapshot.channels.progress?.run
  const value = topic?.value
  return value && typeof value === "object" ? value as Record<string, unknown> : {}
}

function numberText(value: unknown): string | null {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? String(numeric) : null
}

function firstLogMatch(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern)
  return match?.[1]?.trim() || null
}

function runCueMessage(snapshot: JobRuntimeSnapshot): { text: string; tone: "normal" | "warning" } {
  const log = runtimeLogText(snapshot)
  const progress = runtimeProgressValue(snapshot)
  const accepted = firstLogMatch(log, /accepted\s+(\d+\s+out\s+of\s+\d+)\s*:/i)
    || (
      numberText(progress.accepted) && numberText(progress.attempted)
        ? `${numberText(progress.accepted)} / ${numberText(progress.attempted)}`
        : null
    )
  const outputDir = firstLogMatch(log, /Configurations and statistics saved in\s+(.+?)\s+directory/i)
  const completed = Number(progress.fraction) >= 1 || /(?:is done|completed successfully|run complete)/i.test(log)
  const hasException = /(?:unhandled exception|traceback|error:|exception)/i.test(log)
  const hasProgress = Object.keys(progress).length > 0
  if (hasException && !completed) {
    return { text: "Needs attention · driver reported an exception", tone: "warning" }
  }
  if (completed) {
    const parts = ["Run completed"]
    if (accepted) parts.push(`accepted ${accepted}`)
    if (outputDir) parts.push(`outputs saved in ${outputDir}`)
    return { text: parts.join(" · "), tone: "normal" }
  }
  if (!hasProgress && !log && !snapshot.run) {
    return { text: "Starting job · waiting for first runtime message", tone: "normal" }
  }
  if (!hasProgress && !log) {
    return { text: "Starting job · runtime stream connecting", tone: "normal" }
  }
  if (hasProgress) {
    return { text: "Running · live progress active", tone: "normal" }
  }
  const lineCount = log ? log.split(/\r?\n/).filter((line) => line.trim()).length : 0
  if (lineCount) return { text: `Running · run log active · ${lineCount} lines received`, tone: "normal" }
  return { text: "Starting job · waiting for first runtime message", tone: "normal" }
}

function sectionFieldIds(section: WorkbenchSection): string[] {
  return [
    ...(section.fields || []),
    ...((section.children || []).flatMap((child) => sectionFieldIds(child))),
  ]
}

function outputHasContent(value: unknown): boolean {
  if (value == null || value === "") return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === "object" && "items" in (value as Record<string, unknown>)) {
    const items = (value as { items?: unknown }).items
    return !Array.isArray(items) || items.length > 0
  }
  return true
}

function SubmittedInputs({
  values,
  fields,
  summaryFieldIds,
  uuid,
  restoreError,
  restoreWarnings = [],
  onEdit,
  onHide,
}: {
  values: Record<string, unknown>
  fields: Ui2Field[]
  summaryFieldIds: string[]
  uuid?: string
  restoreError?: string
  restoreWarnings?: string[]
  onEdit: () => void
  onHide: () => void
}) {
  const [showAll, setShowAll] = React.useState(false)
  const fieldMap = React.useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields])
  const ids = showAll
    ? fields
      .filter((field) => field.id && field.role !== "output" && field.type !== "label"
        && Object.prototype.hasOwnProperty.call(values, field.id))
      .map((field) => field.id as string)
    : summaryFieldIds.filter((id) => Object.prototype.hasOwnProperty.call(values, id))

  return (
    <Card className="ui2-workbench-submitted">
      <CardHeader>
        <div>
          <CardTitle>Submitted inputs</CardTitle>
          <CardDescription>{uuid ? `Run ${uuid}` : "Values associated with this run"}</CardDescription>
        </div>
        <span className="ui2-workbench-status-badge">Submitted</span>
      </CardHeader>
      <CardContent>
        {restoreError && <p className="ui2-workbench-restore-error" role="alert">{restoreError}</p>}
        {restoreWarnings.length > 0 && (
          <div className="ui2-workbench-restore-warning" role="alert">
            <p>Some local files must be selected again before submitting a new run.</p>
            <ul>{restoreWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </div>
        )}
        {!restoreError && (
          <dl className="ui2-workbench-summary-list">
            {ids.map((id) => (
              <div key={id}>
                <dt>{fieldMap.get(id)?.label || id}</dt>
                <dd>{displayValue(values[id], fieldMap.get(id))}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="ui2-workbench-summary-actions">
          <Button disabled={Boolean(restoreError)} type="button" variant="outline" onClick={() => setShowAll((current) => !current)}>
            {showAll ? "Show key inputs" : "Show all inputs"}
          </Button>
          <Button type="button" variant="outline" onClick={onHide}>Hide inputs</Button>
          <Button disabled={Boolean(restoreError)} type="button" onClick={onEdit}>Return to inputs</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function RunLog({
  snapshot,
  title,
  description,
  defaultOpen = false,
  open,
  onOpenChange,
  cue,
}: {
  snapshot: JobRuntimeSnapshot
  title: string
  description?: string
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  cue?: { text: string; tone: "normal" | "warning" }
}) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const isOpen = open ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const text = runtimeLogText(snapshot)
  const lineCount = text ? text.split(/\r?\n/).length : 0

  return (
    <Collapsible open={isOpen} onOpenChange={setOpen}>
      <Card className="ui2-workbench-log-card">
        <CollapsibleTrigger asChild>
          <button className="ui2-workbench-collapsible-trigger" type="button">
            <span className="ui2-workbench-log-trigger-text">
              <span className="ui2-workbench-log-title"><ScrollText aria-hidden="true" size={17} /> {title}{lineCount ? ` (${lineCount} lines)` : ""}</span>
              {cue && <span className={`ui2-workbench-log-cue ui2-workbench-log-cue-${cue.tone}`}>{cue.text}</span>}
            </span>
            <ChevronDown aria-hidden="true" className={isOpen ? "rotate-180" : ""} size={18} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent forceMount className="data-[state=closed]:hidden">
          <CardContent>
            {description && <p className="ui2-workbench-log-description">{description}</p>}
            <pre aria-live="off" className="ui2-workbench-run-log" role="log">
              {text || "Runtime messages will appear here."}
            </pre>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

export function ScientificWorkbench({ module, fields, view, bridge, submitted: initialSubmitted }: ScientificWorkbenchMountProps) {
  const [advancedOpen, setAdvancedOpen] = React.useState(false)
  const [liveValues, setLiveValues] = React.useState<Record<string, unknown>>(initialSubmitted?.values || {})
  const inputSections = view.inputs?.sections || []
  const advancedSection = view.inputs?.advanced
  const advancedFieldIds = advancedSection?.fields || []
  const summaryFieldIds = view.inputs?.submittedSummary?.fields || []
  const progressSection = view.results?.progress
  // Existing MMC views use `tabs`; new views use generic result groups.
  const resultGroups = view.results?.groups || view.results?.tabs || []
  const initialResult = resultGroups.find((group) => group.primary)?.id || resultGroups[0]?.id || ""
  const [activeResult, setActiveResult] = React.useState(initialResult)
  const [submitting, setSubmitting] = React.useState(false)
  const [inputRailCollapsed, setInputRailCollapsed] = React.useState(false)
  const [workspaceExpanded, setWorkspaceExpanded] = React.useState(false)
  const [runLogOpen, setRunLogOpen] = React.useState(Boolean(view.results?.runtimeLog?.defaultOpen))
  const resultCardRef = React.useRef<HTMLElement>(null)
  const fieldsById = React.useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields])
  const runtime = React.useSyncExternalStore(bridge.subscribeRuntime, bridge.runtimeSnapshot, bridge.runtimeSnapshot)
  const runtimeOutputs = React.useSyncExternalStore(bridge.subscribeOutputs, bridge.outputSnapshot, bridge.outputSnapshot)
  const submitted = React.useSyncExternalStore(bridge.subscribeRunContext, bridge.runContextSnapshot, bridge.runContextSnapshot)
  const resultGroupValues = submitted?.values || liveValues
  const visibleResultGroups = React.useMemo(
    () => resultGroups.filter((group) => {
      if (!repeatExpressionActive(group.repeat, resultGroupValues)) return false
      if (group.visibility !== "available") return true
      // Result-pane membership is structural state.  It must not depend on the
      // high-rate job-event snapshot used by the log and live native widgets;
      // doing so makes React reconcile the imperative Plotly/NGL host tree for
      // every streamed event.  Core publishes this small, per-output
      // availability snapshot only when an output first becomes available.
      return group.outputs.some((id) => outputHasContent(runtimeOutputs[id]))
    }),
    [resultGroups, resultGroupValues, runtimeOutputs]
  )
  const progressFields = (progressSection?.fields || []).map((id) => fieldsById.get(id)).filter(Boolean) as Ui2Field[]
  const assigned = new Set([
    ...inputSections.flatMap((section) => sectionFieldIds(section)),
    ...advancedFieldIds,
  ])
  const extraInputs = fields.filter((field) => field.role !== "output" && field.id && field.type !== "label" && !assigned.has(field.id))
  const assignedOutputs = new Set([
    ...(progressSection?.fields || []),
    ...resultGroups.flatMap((group) => group.outputs),
  ])
  const unassignedOutputs = view.results?.includeUnassignedOutputs
    ? fields.filter((field) => field.role === "output" && field.id && !assignedOutputs.has(field.id)
      && outputHasContent(runtimeOutputs[field.id]))
    : []
  const visibleOutputGroups = unassignedOutputs.length > 0
    ? [...visibleResultGroups, { id: "additional-results", label: "Additional results", outputs: unassignedOutputs.map((field) => field.id as string), visibility: "available" as const }]
    : visibleResultGroups

  React.useEffect(() => {
    if (!visibleOutputGroups.some((group) => group.id === activeResult)) {
      setActiveResult(visibleOutputGroups.find((group) => group.primary)?.id || visibleOutputGroups[0]?.id || "")
    }
  }, [activeResult, visibleOutputGroups])

  React.useLayoutEffect(() => {
    setLiveValues(bridge.syncValues())
  }, [bridge])

  React.useLayoutEffect(() => {
    // NativeHost mounts the existing UI2 field/output widgets in layout
    // effects.  Notify core on the following frame, after those hosts exist,
    // so reattachment can restore input and durable job state safely.
    const frame = window.requestAnimationFrame(() => bridge.viewReady())
    return () => window.cancelAnimationFrame(frame)
  }, [bridge])

  const syncLiveValues = React.useCallback(() => {
    setLiveValues(bridge.syncValues())
  }, [bridge])

  React.useEffect(() => {
    if (submitted?.values) setLiveValues(submitted.values)
  }, [submitted])

  const pendingOutputResizeRef = React.useRef<number | null>(null)
  const pendingOutputResizeTimerRef = React.useRef<number | null>(null)

  const scheduleOutputResize = React.useCallback((remainingPulses = 2) => {
    // Plotly and NGL both read their host box at resize time.  Tabs,
    // expanded-workspace switches, reattach restoration, and browser layout
    // can settle over more than one frame, so send a short pulse train rather
    // than one early resize that may catch a hidden or intermediate pane.
    if (pendingOutputResizeRef.current !== null) return
    pendingOutputResizeRef.current = window.requestAnimationFrame(() => {
      pendingOutputResizeRef.current = null
      bridge.resizeOutputs()
      if (remainingPulses > 0) {
        pendingOutputResizeTimerRef.current = window.setTimeout(() => {
          pendingOutputResizeTimerRef.current = null
          scheduleOutputResize(remainingPulses - 1)
        }, remainingPulses === 2 ? 80 : 180)
      }
    })
  }, [bridge])

  React.useEffect(() => () => {
    if (pendingOutputResizeRef.current !== null) {
      window.cancelAnimationFrame(pendingOutputResizeRef.current)
    }
    if (pendingOutputResizeTimerRef.current !== null) {
      window.clearTimeout(pendingOutputResizeTimerRef.current)
    }
  }, [])

  React.useLayoutEffect(() => {
    scheduleOutputResize()
  }, [activeResult, inputRailCollapsed, scheduleOutputResize, submitted, workspaceExpanded])

  React.useLayoutEffect(() => {
    const target = resultCardRef.current
    if (!target || typeof ResizeObserver !== "function") return
    let width = 0
    let height = 0
    const observer = new ResizeObserver((entries) => {
      const rect = entries?.[0]?.contentRect
      if (!rect || Math.abs(rect.width - width) < 1 && Math.abs(rect.height - height) < 1) return
      width = rect.width
      height = rect.height
      scheduleOutputResize()
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [scheduleOutputResize])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      const result = await bridge.submit(event.currentTarget)
      if (result.ok) {
        const values = result.values || bridge.syncValues()
        setLiveValues(values)
        setInputRailCollapsed(false)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    bridge.reset(event.currentTarget)
    setLiveValues(bridge.syncValues())
    setAdvancedOpen(false)
    setInputRailCollapsed(false)
    setWorkspaceExpanded(false)
  }

  const toggleWorkspaceExpanded = () => {
    setWorkspaceExpanded((current) => {
      if (current) setInputRailCollapsed(false)
      return !current
    })
  }

  const returnToInputs = React.useCallback(() => {
    bridge.returnToInputs()
    setInputRailCollapsed(false)
    setWorkspaceExpanded(false)
  }, [bridge])

  const lifecycleState = String(runtime.lifecycle?.state || (submitting ? "submitting" : "editing"))
  const lifecycleMessage = String(runtime.lifecycle?.error || runtime.lifecycle?.message || lifecycleState)
  const hasRunContext = Boolean(submitted || runtime.run)
  const runCue = hasRunContext ? runCueMessage(runtime) : undefined
  const renderInputSection = (section: WorkbenchSection, depth = 0): React.ReactNode => {
    if (!repeatExpressionActive(section.repeat, liveValues)) return null
    const sectionFields = (section.fields || []).map((id) => fieldsById.get(id)).filter(Boolean) as Ui2Field[]
    return (
      <Card className={depth > 0 ? "ui2-workbench-input-subsection" : undefined} key={section.id}>
        <CardHeader>
          <div>
            <CardTitle>{section.title}</CardTitle>
            {section.description && <CardDescription>{section.description}</CardDescription>}
          </div>
        </CardHeader>
        <CardContent>
          {sectionFields.length > 0 && <FieldGroup bridge={bridge} fields={sectionFields} />}
          {(section.children || []).map((child) => renderInputSection(child, depth + 1))}
        </CardContent>
      </Card>
    )
  }

  return (
    <form
      className={`ui2-workbench-react${submitted ? "" : " ui2-workbench-react-editing"}${workspaceExpanded ? " ui2-workbench-react-workspace-expanded" : ""}`}
      id="ui2-form"
      onChange={syncLiveValues}
      onInput={syncLiveValues}
      onReset={handleReset}
      onSubmit={handleSubmit}
    >
      <header className="ui2-workbench-heading">
        <div>
          <span className="ui2-workbench-kicker"><FlaskConical aria-hidden="true" size={16} /> {view.heading?.kicker || "Scientific workbench"}</span>
          <h2>{module.label || "Monomer Monte Carlo"}</h2>
          {view.heading?.description && <p>{view.heading.description}</p>}
        </div>
      </header>

      <div className={`ui2-workbench-grid${inputRailCollapsed || workspaceExpanded ? " ui2-workbench-grid-inputs-hidden" : ""}`}>
        <aside className="ui2-workbench-input-pane" hidden={inputRailCollapsed || workspaceExpanded}>
          {submitted && (
            <SubmittedInputs fields={fields} summaryFieldIds={summaryFieldIds} onEdit={returnToInputs} onHide={() => setInputRailCollapsed(true)} restoreError={submitted.restoreError} restoreWarnings={submitted.restoreWarnings} uuid={submitted.uuid} values={submitted.values} />
          )}
          <div className="ui2-workbench-input-scroll" hidden={Boolean(submitted)}>
              {inputSections.map((section) => renderInputSection(section))}

              {extraInputs.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Additional inputs</CardTitle></CardHeader>
                  <CardContent><FieldGroup bridge={bridge} fields={extraInputs} /></CardContent>
                </Card>
              )}

              {advancedSection && (
                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <button className="ui2-workbench-collapsible-trigger" type="button">
                        <span><Settings2 aria-hidden="true" size={17} /> {advancedSection.title}</span>
                        <ChevronDown aria-hidden="true" className={advancedOpen ? "rotate-180" : ""} size={18} />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent forceMount className="data-[state=closed]:hidden">
                      <CardContent>
                        {advancedSection.description && <p className="ui2-workbench-section-description">{advancedSection.description}</p>}
                        <FieldGroup bridge={bridge} fields={advancedFieldIds.map((id) => fieldsById.get(id)).filter(Boolean) as Ui2Field[]} />
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}

          </div>

          {!submitted && (
            <div className="ui2-workbench-actions">
              <div className="ui2-workbench-action-buttons">
                <Button disabled={submitting} type="submit">
                  {submitting ? "Submitting…" : view.actions?.submitLabel || "Run"}
                </Button>
                <Button disabled={submitting} type="reset" variant="outline">
                  <RotateCcw aria-hidden="true" size={16} /> {view.actions?.resetLabel || "Reset inputs"}
                </Button>
              </div>
              <div aria-live="polite" className="ui2-submit-status" id="ui2-submit-status" role="status">
                {lifecycleState === "editing" ? "Not submitted" : lifecycleMessage}
              </div>
            </div>
          )}
        </aside>

        <main className="ui2-workbench-results-pane">
          {submitted && inputRailCollapsed && (
            <div className="ui2-workbench-show-inputs-row">
              <Button type="button" variant="outline" onClick={() => setInputRailCollapsed(false)}>
                Show submitted inputs
              </Button>
            </div>
          )}

          {progressSection && (
            <Card className="ui2-workbench-progress-card">
              <CardHeader>
                <div>
                  <CardTitle>{progressSection.title}</CardTitle>
                  {progressSection.description && <CardDescription>{progressSection.description}</CardDescription>}
                </div>
              </CardHeader>
              <CardContent><FieldGroup bridge={bridge} fields={progressFields} role="output" /></CardContent>
            </Card>
          )}

          {view.results?.runtimeLog && (
            <RunLog
              cue={runCue}
              defaultOpen={view.results.runtimeLog.defaultOpen}
              description={view.results.runtimeLog.description}
              open={runLogOpen}
              onOpenChange={setRunLogOpen}
              snapshot={runtime}
              title={view.results.runtimeLog.title || "Run log"}
            />
          )}

          {visibleOutputGroups.length > 0 && (
            <Card className="ui2-workbench-result-card" ref={resultCardRef}>
              <CardContent>
                <Tabs
                  className="ui2-workbench-result-tabs"
                  onValueChange={(value) => {
                    setActiveResult(value)
                    window.setTimeout(scheduleOutputResize, 0)
                  }}
                  value={activeResult}
                >
                  <div className="ui2-workbench-result-toolbar">
                    <TabsList aria-label={`${module.label || "Module"} results`} className="ui2-workbench-result-tab-list">
                      {visibleOutputGroups.map((group) => <TabsTrigger key={group.id} value={group.id}>{group.label}</TabsTrigger>)}
                    </TabsList>
                    <Button
                      aria-pressed={workspaceExpanded}
                      onClick={toggleWorkspaceExpanded}
                      type="button"
                      variant="outline"
                    >
                      {workspaceExpanded ? <Minimize2 aria-hidden="true" size={16} /> : <Maximize2 aria-hidden="true" size={16} />}
                      {workspaceExpanded ? "Restore split view" : "Expand workspace"}
                    </Button>
                    {submitted && (
                      <Button disabled={Boolean(submitted.restoreError)} onClick={returnToInputs} type="button">
                        Return to inputs
                      </Button>
                    )}
                  </div>
                  {visibleOutputGroups.map((group: WorkbenchResultGroup) => {
                    const groupFields = group.outputs.map((id) => fieldsById.get(id)).filter(Boolean) as Ui2Field[]
                    const panelKind = group.fit === "wide" || group.layout === "gallery"
                      ? "wide"
                      : groupFields.some((field) => field.type === "plotly")
                      ? "plot"
                      : groupFields.some((field) => field.type === "ngl" || field.type === "atomicstructure")
                        ? "structure"
                        : "other"
                    return (
                      <TabsContent
                        forceMount
                        key={group.id}
                        value={group.id}
                        className={workspaceExpanded
                          ? `ui2-workbench-expanded-panel ui2-workbench-result-panel-${panelKind}`
                          : "data-[state=inactive]:hidden"
                        }
                      >
                        {workspaceExpanded && <h3 className="ui2-workbench-result-panel-title">{group.label}</h3>}
                        <FieldGroup
                          bridge={bridge}
                          fields={groupFields}
                          fitPlot={(group.fit === "pane" || group.fit === "wide") && groupFields.some((field) => field.type === "plotly")}
                          role="output"
                        />
                      </TabsContent>
                    )
                  })}
                </Tabs>
              </CardContent>
            </Card>
          )}
        </main>
      </div>

    </form>
  )
}
