import * as React from "react"
import { ChevronDown, FlaskConical, Maximize2, Minimize2, RotateCcw, ScrollText, Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ChoiceCardPresentation, JobRuntimeSnapshot, ScientificWorkbenchBridge, ScientificWorkbenchMountProps, Ui2Field, WorkbenchActionReview, WorkbenchResultGroup, WorkbenchSection, WorkflowChoicePresentation } from "@/types"
import { runCueMessage, runtimeLogText } from "@/runCue"
import { resultsVisibility } from "@/resultsVisibility"

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

function FieldGroup({ fields, bridge, role = "input", fitPlot = false, outputLayout = "", plotPresentation, onValuesReady }: { fields: Ui2Field[]; bridge: ScientificWorkbenchBridge; role?: "input" | "output"; fitPlot?: boolean; outputLayout?: string; plotPresentation?: WorkbenchResultGroup["plotPresentation"]; onValuesReady?: (values: Record<string, unknown>) => void }) {
  // View JSON is decoded into new arrays on every parent render.  Keep the
  // native group mounted while its declared field membership is unchanged.
  const fieldIds = fields.map((field) => field.id || "").join("\u0000")
  const plannedFields = React.useMemo(() => fields, [fieldIds])
  const plotPresentationKey = JSON.stringify(plotPresentation || {})
  const create = React.useCallback(() => {
    const node = bridge.createFieldGroup(plannedFields, role)
    if (role === "output" && outputLayout) {
      node.dataset.outputLayout = outputLayout
    }
    if (role === "output" && plotPresentationKey !== "{}") {
      node.dataset.plotPresentation = plotPresentationKey
    }
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
  }, [bridge, plannedFields, fitPlot, outputLayout, plotPresentationKey, role])
  const mounted = React.useCallback(() => {
    if (role === "input") {
      bridge.fieldGroupMounted(onValuesReady)
    } else {
      bridge.outputGroupMounted()
    }
  }, [bridge, onValuesReady, role])
  return (
    <NativeHost create={create} release={bridge.releaseField} mounted={mounted} className="ui2-workbench-field-group" />
  )
}

function ChoiceCards({ field, presentation, bridge, values, onValuesReady }: {
  field: Ui2Field
  presentation: ChoiceCardPresentation
  bridge: ScientificWorkbenchBridge
  values: Record<string, unknown>
  onValuesReady?: (values: Record<string, unknown>) => void
}) {
  const choices = fieldChoices(field)
  const selected = String(values[field.id || ""] ?? field.default ?? choices[0]?.value ?? "")
  const label = presentation.title || field.label || "Choose an option"

  return (
    <fieldset className="ui2-choice-cards">
      <legend>{label}</legend>
      <FieldGroup bridge={bridge} fields={[field]} onValuesReady={onValuesReady} />
      <div className="ui2-choice-cards-grid">
        {choices.filter((choice) => repeatExpressionActive(presentation.choices?.[choice.value]?.repeat, values)).map((choice) => {
          const details = presentation.choices?.[choice.value] || {}
          const id = `${field.id}-${choice.value}`
          return (
            <label className={`ui2-choice-card${selected === choice.value ? " ui2-choice-card-selected" : ""}`} htmlFor={id} key={choice.value}>
              <input
                checked={selected === choice.value}
                id={id}
                name={`${field.id}-choice-cards`}
                onChange={() => bridge.setInputValue(field.id || "", choice.value)}
                type="radio"
                value={choice.value}
              />
              <span className="ui2-choice-card-content">
                <span className="ui2-choice-card-title">{details.title || choice.label}</span>
                {details.badge && <span className="ui2-choice-card-badge">{details.badge}</span>}
                {details.description && <span className="ui2-choice-card-description">{details.description}</span>}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function sameValue(left: unknown, right: unknown) {
  return String(left ?? "") === String(right ?? "")
}

function WorkflowChoices({ presentation, fields, bridge, values, onValuesReady }: {
  presentation: WorkflowChoicePresentation
  fields: Ui2Field[]
  bridge: ScientificWorkbenchBridge
  values: Record<string, unknown>
  onValuesReady?: (values: Record<string, unknown>) => void
}) {
  const choices = (presentation.order || Object.keys(presentation.choices || {}))
    .map((choiceId) => [choiceId, presentation.choices?.[choiceId]] as const)
    .filter(([, choice]) => Boolean(choice)) as Array<[string, NonNullable<WorkflowChoicePresentation["choices"][string]>]>
  const selected = choices.find(([, choice]) => Object.entries(choice.matches || {}).every(([fieldId, value]) => sameValue(values[fieldId], value)))?.[0] || ""
  const label = presentation.title || "Choose a workflow"

  return (
    <fieldset className="ui2-workflow-choices">
      <legend>{label}</legend>
      <FieldGroup bridge={bridge} fields={fields} onValuesReady={onValuesReady} />
      <div className="ui2-choice-cards-grid">
        {choices.map(([choiceId, choice]) => {
          const id = `workflow-${choiceId}`
          return (
            <label className={`ui2-choice-card${selected === choiceId ? " ui2-choice-card-selected" : ""}`} htmlFor={id} key={choiceId}>
              <input
                checked={selected === choiceId}
                id={id}
                name="workflow-choices"
                onChange={() => bridge.setInputValues(choice.values)}
                type="radio"
                value={choiceId}
              />
              <span className="ui2-choice-card-content">
                <span className="ui2-choice-card-title">{choice.title}</span>
                {choice.badge && <span className="ui2-choice-card-badge">{choice.badge}</span>}
                {choice.description && <span className="ui2-choice-card-description">{choice.description}</span>}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
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

function sectionFieldIds(section: WorkbenchSection): string[] {
  return [
    ...(section.fields || []),
    ...((section.children || []).flatMap((child) => sectionFieldIds(child))),
  ]
}

function sectionWorkflowChoiceIds(section: WorkbenchSection): string[] {
  return [
    ...(section.workflowChoices || []),
    ...((section.children || []).flatMap((child) => sectionWorkflowChoiceIds(child))),
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
  expandedMode,
  uuid,
  restoreError,
  restoreWarnings = [],
  onEdit,
  onHide,
  title = "Submitted inputs",
  description,
  badge = "Submitted",
  continueLabel,
}: {
  values: Record<string, unknown>
  fields: Ui2Field[]
  summaryFieldIds: string[]
  expandedMode?: string
  uuid?: string
  restoreError?: string
  restoreWarnings?: string[]
  onEdit: () => void
  onHide?: () => void
  title?: string
  description?: string
  badge?: string
  continueLabel?: string
}) {
  const [showAll, setShowAll] = React.useState(false)
  const fieldMap = React.useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields])
  const allIds = fields
    .filter((field) => field.id && field.role !== "output" && field.type !== "label"
      && Object.prototype.hasOwnProperty.call(values, field.id))
    .filter((field) => expandedMode !== "active" || repeatExpressionActive(field.repeat, values))
    .map((field) => field.id as string)
  const ids = showAll
    ? allIds
    : summaryFieldIds.filter((id) => Object.prototype.hasOwnProperty.call(values, id))

  return (
    <Card className="ui2-workbench-submitted">
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description || (uuid ? `Run ${uuid}` : "Values associated with this run")}</CardDescription>
        </div>
        <span className="ui2-workbench-status-badge">{badge}</span>
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
            {showAll ? "Show key inputs" : expandedMode === "active" ? `Show active inputs (${allIds.length})` : "Show all inputs"}
          </Button>
          {onHide && <Button type="button" variant="outline" onClick={onHide}>Hide inputs</Button>}
          <Button disabled={Boolean(restoreError)} type="button" onClick={onEdit}>{continueLabel || "Edit inputs"}</Button>
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
  const [liveValues, setLiveValues] = React.useState<Record<string, unknown>>(
    () => initialSubmitted?.values || bridge.syncValues()
  )
  const inputSections = view.inputs?.sections || []
  const advancedSection = view.inputs?.advanced
  const fieldPresentations = view.inputs?.fieldPresentations || {}
  const workflowChoices = view.inputs?.workflowChoices || {}
  const wideInputLayout = view.inputs?.layout === "wide"
  const advancedFieldIds = advancedSection?.fields || []
  const summaryFieldIds = view.inputs?.submittedSummary?.fields || []
  const actionReviews = view.inputs?.actionReviews || {}
  const progressSection = view.results?.progress
  // Existing MMC views use `tabs`; new views use generic result groups.
  const resultGroups = view.results?.groups || view.results?.tabs || []
  const initialResult = resultGroups.find((group) => group.primary)?.id || resultGroups[0]?.id || ""
  const [activeResult, setActiveResult] = React.useState(initialResult)
  const [actionReview, setActionReview] = React.useState<{ definition: WorkbenchActionReview; values: Record<string, unknown> } | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [inputRailCollapsed, setInputRailCollapsed] = React.useState(false)
  const [inputEditOpen, setInputEditOpen] = React.useState(false)
  const [workspaceExpanded, setWorkspaceExpanded] = React.useState(false)
  const [runLogOpen, setRunLogOpen] = React.useState(Boolean(view.results?.runtimeLog?.defaultOpen))
  const [scenarioChoice, setScenarioChoice] = React.useState("")
  const resultCardRef = React.useRef<HTMLElement>(null)
  const fieldsById = React.useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields])
  const runtime = React.useSyncExternalStore(bridge.subscribeRuntime, bridge.runtimeSnapshot, bridge.runtimeSnapshot)
  const runtimeOutputs = React.useSyncExternalStore(bridge.subscribeOutputs, bridge.outputSnapshot, bridge.outputSnapshot)
  const submitted = React.useSyncExternalStore(bridge.subscribeRunContext, bridge.runContextSnapshot, bridge.runContextSnapshot)
  const testScenarios = React.useSyncExternalStore(bridge.subscribeTestScenarios, bridge.testScenarioSnapshot, bridge.testScenarioSnapshot)
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
    ...inputSections.flatMap((section) => sectionWorkflowChoiceIds(section).flatMap((id) => workflowChoices[id]?.fields || [])),
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

  React.useEffect(() => {
    // A pre-submit action may reveal one declared result group after it
    // supplies the group’s output.  The view declares the allowed targets.
    const focusResult = (event: Event) => {
      const id = String((event as CustomEvent<{ id?: unknown }>).detail?.id || "")
      if (resultGroups.some((group) => group.id === id)) setActiveResult(id)
    }
    window.addEventListener("ui2-focus-result", focusResult)
    return () => window.removeEventListener("ui2-focus-result", focusResult)
  }, [resultGroups])

  React.useEffect(() => {
    const reviewInputs = (event: Event) => {
      const id = String((event as CustomEvent<{ id?: unknown }>).detail?.id || "")
      const definition = actionReviews[id]
      if (!definition || !resultGroups.some((group) => group.id === definition.result)) return
      setActionReview({ definition, values: bridge.syncValues() })
      setActiveResult(definition.result)
      setInputRailCollapsed(false)
      setWorkspaceExpanded(false)
    }
    window.addEventListener("ui2-review-inputs", reviewInputs)
    return () => window.removeEventListener("ui2-review-inputs", reviewInputs)
  }, [actionReviews, bridge, resultGroups])

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

  React.useEffect(() => {
    if (submitted) setActionReview(null)
  }, [submitted])

  React.useEffect(() => {
    // A newly submitted or reattached run starts in its compact submitted
    // layout.  Opening the editor below is a reversible local view choice.
    setInputEditOpen(false)
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
        setInputEditOpen(false)
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
    setActionReview(null)
    setInputEditOpen(true)
    setInputRailCollapsed(false)
    setWorkspaceExpanded(false)
  }

  const loadTestScenario = (id: string) => {
    const form = document.getElementById("ui2-form") as HTMLFormElement | null
    if (!form || !id) return
    const result = bridge.applyTestScenario(id, form)
    if (result.ok) {
      setLiveValues(result.values || bridge.syncValues())
      setInputEditOpen(true)
      setInputRailCollapsed(false)
    }
  }

  const toggleWorkspaceExpanded = () => {
    setWorkspaceExpanded((current) => {
      if (current) setInputRailCollapsed(false)
      return !current
    })
  }

  const editInputs = React.useCallback(() => {
    setInputEditOpen(true)
    setInputRailCollapsed(false)
    setWorkspaceExpanded(false)
  }, [])

  const showSubmittedInputs = React.useCallback(() => {
    setInputEditOpen(false)
    setInputRailCollapsed(false)
    setWorkspaceExpanded(false)
  }, [])

  const lifecycleState = String(runtime.lifecycle?.state || (submitting ? "submitting" : "editing"))
  const lifecycleMessage = String(runtime.lifecycle?.error || runtime.lifecycle?.message || lifecycleState)
  const hasRunContext = Boolean(submitted || runtime.run)
  const hasAvailableOutput = Object.values(runtimeOutputs).some(Boolean)
  const { showResultsPane, showRunStatus } = resultsVisibility({
    submitting,
    hasRunContext,
    hasAvailableOutput,
    hasActionReview: Boolean(actionReview),
    hasScenarioReview: Boolean(testScenarios.selectedId),
  })
  const runCue = hasRunContext ? runCueMessage(runtime) : undefined
  const renderInputSection = (section: WorkbenchSection, depth = 0): React.ReactNode => {
    if (!repeatExpressionActive(section.repeat, liveValues)) return null
    const sectionFields = (section.fields || []).map((id) => fieldsById.get(id)).filter(Boolean) as Ui2Field[]
    const sectionWorkflowChoices = (section.workflowChoices || []).map((id) => [id, workflowChoices[id]] as const).filter(([, presentation]) => Boolean(presentation))
    return (
      <Card className={depth > 0 ? "ui2-workbench-input-subsection" : undefined} key={section.id}>
        <CardHeader>
          <div>
            <CardTitle>{section.title}</CardTitle>
            {section.description && <CardDescription>{section.description}</CardDescription>}
          </div>
        </CardHeader>
        <CardContent>
          {sectionFields.filter((field) => !fieldPresentations[field.id || ""]).length > 0 && <FieldGroup bridge={bridge} fields={sectionFields.filter((field) => !fieldPresentations[field.id || ""])} onValuesReady={syncLiveValues} />}
          {sectionFields.filter((field) => fieldPresentations[field.id || ""] && repeatExpressionActive(field.repeat, liveValues)).map((field) => (
            <ChoiceCards bridge={bridge} field={field} key={field.id} onValuesReady={syncLiveValues} presentation={fieldPresentations[field.id || ""]} values={liveValues} />
          ))}
          {sectionWorkflowChoices.map(([id, presentation]) => (
            <WorkflowChoices bridge={bridge} fields={presentation.fields.map((fieldId) => fieldsById.get(fieldId)).filter(Boolean) as Ui2Field[]} key={id} onValuesReady={syncLiveValues} presentation={presentation} values={liveValues} />
          ))}
          {(section.children || []).map((child) => renderInputSection(child, depth + 1))}
        </CardContent>
      </Card>
    )
  }

  return (
    <form
      className={`ui2-workbench-react${!submitted || inputEditOpen ? " ui2-workbench-react-editing" : ""}${workspaceExpanded ? " ui2-workbench-react-workspace-expanded" : ""}`}
      id="ui2-form"
      onChange={syncLiveValues}
      onInput={syncLiveValues}
      onReset={handleReset}
      onSubmit={handleSubmit}
    >
      <header className="ui2-workbench-heading">
        <div>
          <span className="ui2-workbench-kicker"><FlaskConical aria-hidden="true" size={16} /> {view.heading?.kicker || "Scientific workbench"}</span>
          <h2>{module.label || "Scientific workbench"}</h2>
          {view.heading?.description && <p>{view.heading.description}</p>}
        </div>
      </header>

      <div className={`ui2-workbench-grid${inputRailCollapsed || workspaceExpanded ? " ui2-workbench-grid-inputs-hidden" : ""}${!showResultsPane ? " ui2-workbench-grid-configuration-only" : ""}${wideInputLayout && (!submitted || inputEditOpen) ? " ui2-workbench-grid-inputs-wide" : ""}`}>
        <aside className="ui2-workbench-input-pane" hidden={inputRailCollapsed || workspaceExpanded}>
          {!actionReview && submitted && !inputEditOpen && (
            <SubmittedInputs expandedMode={view.inputs?.submittedSummary?.expanded} fields={fields} summaryFieldIds={summaryFieldIds} onEdit={editInputs} onHide={() => setInputRailCollapsed(true)} restoreError={submitted.restoreError} restoreWarnings={submitted.restoreWarnings} uuid={submitted.uuid} values={submitted.values} />
          )}
          {actionReview && (
            <SubmittedInputs
              badge={actionReview.definition.badge || "Review"}
              continueLabel={actionReview.definition.continueLabel || "Continue setup"}
              description={actionReview.definition.description || "Values used to create the displayed result"}
              expandedMode={actionReview.definition.expanded}
              fields={fields}
              onEdit={() => setActionReview(null)}
              summaryFieldIds={actionReview.definition.fields || []}
              title={actionReview.definition.title || "Inputs used for this review"}
              values={actionReview.values}
            />
          )}
          <div className="ui2-workbench-input-scroll" hidden={(Boolean(submitted) && !inputEditOpen) || Boolean(actionReview)}>
              {testScenarios.available && testScenarios.catalog?.scenarios && (
                <Card className="ui2-workbench-test-scenarios">
                  <CardHeader>
                    <CardTitle>Test scenario</CardTitle>
                    <CardDescription>Loads inputs only; review them before running.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <select aria-label="Test scenario" value={scenarioChoice} onChange={(event) => setScenarioChoice(event.target.value)}>
                      <option value="">Select a documented or test case</option>
                      {testScenarios.catalog.scenarios.map((scenario) => (
                        <option key={scenario.id} value={scenario.id}>{scenario.label}</option>
                      ))}
                    </select>
                    <Button disabled={!scenarioChoice} onClick={() => loadTestScenario(scenarioChoice)} type="button" variant="outline">
                      Load scenario
                    </Button>
                    {testScenarios.selectedId && (
                      <p className="ui2-help">
                        {testScenarios.catalog.scenarios.find((scenario) => scenario.id === testScenarios.selectedId)?.maturity || "draft"}
                        {" · "}
                        {(testScenarios.catalog.scenarios.find((scenario) => scenario.id === testScenarios.selectedId)?.provenance || []).join(", ") || "source pending"}
                      </p>
                    )}
                    {testScenarios.verification.state !== "not_run" && (
                      <p className={`ui2-test-scenario-verification ui2-test-scenario-${testScenarios.verification.state}`}>
                        Verification: {testScenarios.verification.state}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
              {inputSections.map((section) => renderInputSection(section))}

              {extraInputs.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Additional inputs</CardTitle></CardHeader>
                  <CardContent><FieldGroup bridge={bridge} fields={extraInputs} onValuesReady={syncLiveValues} /></CardContent>
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
                        <FieldGroup bridge={bridge} fields={advancedFieldIds.map((id) => fieldsById.get(id)).filter(Boolean) as Ui2Field[]} onValuesReady={syncLiveValues} />
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}

          </div>

          {(!submitted || inputEditOpen) && (
            <div className="ui2-workbench-actions">
              <div className="ui2-workbench-action-buttons">
                <Button disabled={submitting} type="submit">
                  {submitting ? "Submitting…" : view.actions?.submitLabel || "Run"}
                </Button>
                <Button disabled={submitting} type="reset" variant="outline">
                  <RotateCcw aria-hidden="true" size={16} /> {view.actions?.resetLabel || "Reset inputs"}
                </Button>
                {submitted && inputEditOpen && (
                  <Button disabled={submitting} onClick={showSubmittedInputs} type="button" variant="outline">
                    Show submitted inputs
                  </Button>
                )}
              </div>
              <div aria-live="polite" className="ui2-submit-status" id="ui2-submit-status" role="status">
                {lifecycleState === "editing" ? "" : lifecycleMessage}
              </div>
            </div>
          )}
        </aside>

        {showResultsPane && <main className="ui2-workbench-results-pane">
          {submitted && inputRailCollapsed && (
            <div className="ui2-workbench-show-inputs-row">
              <Button type="button" variant="outline" onClick={showSubmittedInputs}>
                Show submitted inputs
              </Button>
            </div>
          )}

          {testScenarios.selectedId && (
            <Card className="ui2-workbench-test-scenarios">
              <CardHeader>
                <div>
                  <CardTitle>Scenario verification</CardTitle>
                  <CardDescription>Checks durable final outputs for the selected test scenario.</CardDescription>
                </div>
                <span className={`ui2-workbench-status-badge ui2-test-scenario-${testScenarios.verification.state}`}>
                  {testScenarios.verification.state}
                </span>
              </CardHeader>
              <CardContent>
                {testScenarios.verification.checks.length > 0
                  ? testScenarios.verification.checks.map((check) => <p key={check.id}>{check.id}: {check.passed ? "passed" : check.unsupported ? "unsupported" : "failed"}</p>)
                  : <p>Verification will run after the job reaches a terminal state.</p>}
              </CardContent>
            </Card>
          )}

          {showRunStatus && progressSection && (
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

          {showRunStatus && view.results?.runtimeLog && (
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
                          outputLayout={group.layout || ""}
                          plotPresentation={group.plotPresentation}
                          role="output"
                        />
                        {actionReview?.definition.result === group.id && actionReview.definition.confirmation && (
                          <p className="ui2-workbench-action-review-confirmation" role="status">{actionReview.definition.confirmation}</p>
                        )}
                      </TabsContent>
                    )
                  })}
                </Tabs>
              </CardContent>
            </Card>
          )}
        </main>}
      </div>

    </form>
  )
}
