import * as React from "react"
import { ChevronDown, FlaskConical, Maximize2, Minimize2, RotateCcw, ScrollText, Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { JobRuntimeSnapshot, MmcBridge, MmcMountProps, Ui2Field, WorkbenchResultTab } from "@/types"

function NativeHost({ create, release, className }: { create: () => HTMLElement; release?: (node: HTMLElement) => void; className?: string }) {
  const hostRef = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const node = create()
    host.replaceChildren(node)
    return () => {
      release?.(node)
      if (node.parentNode === host) host.removeChild(node)
    }
  }, [create, release])

  return <div className={className} ref={hostRef} />
}

function FieldHost({ field, bridge, role = "input", fitPlot = false }: { field: Ui2Field; bridge: MmcBridge; role?: "input" | "output"; fitPlot?: boolean }) {
  const create = React.useCallback(() => {
    const node = bridge.createField(field, role)
    if (fitPlot) {
      node.querySelector<HTMLElement>('[data-output-type="plotly"]')?.setAttribute("data-plot-fit", "pane")
    }
    return node
  }, [bridge, field, fitPlot, role])
  return <NativeHost create={create} release={bridge.releaseField} className="ui2-mmc-native-field" />
}

function FieldGroup({ fields, bridge, role = "input" }: { fields: Ui2Field[]; bridge: MmcBridge; role?: "input" | "output" }) {
  return (
    <div className="ui2-mmc-field-group">
      {fields.map((field) => <FieldHost bridge={bridge} field={field} key={field.id} role={role} />)}
    </div>
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

function runtimeStructureFrames(snapshot: JobRuntimeSnapshot): Array<Record<string, unknown>> {
  const structureTopics = snapshot.channels.structure || {}
  return Object.values(structureTopics).flatMap((topic) => {
    const items = Array.isArray(topic?.items) ? topic.items : []
    return items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
  })
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
  const frames = runtimeStructureFrames(snapshot)
  const lastFrame = frames[frames.length - 1]
  const accepted = firstLogMatch(log, /accepted\s+(\d+\s+out\s+of\s+\d+)\s*:/i)
    || (
      numberText(progress.accepted) && numberText(progress.attempted)
        ? `${numberText(progress.accepted)} / ${numberText(progress.attempted)}`
        : null
    )
  const outputDir = firstLogMatch(log, /Configurations and statistics saved in\s+(.+?)\s+directory/i)
  const completed = /DIHEDRAL IS DONE/i.test(log) || Number(progress.fraction) >= 1
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
  if (frames.length) {
    const milestone = numberText(lastFrame?.milestone_percent ?? lastFrame?.milestonePercent)
    const trial = numberText(lastFrame?.trial)
    const frame_index = numberText(lastFrame?.frame_index ?? lastFrame?.frameIndex)
    const parts = [`Running · structure snapshot ${frame_index || frames.length} available`]
    if (milestone) parts.push(`latest snapshot ${milestone}%`)
    if (trial) parts.push(`trial ${trial}`)
    return { text: parts.join(" · "), tone: "normal" }
  }
  if (hasProgress) {
    return { text: "Running · live progress active · waiting for first structure snapshot", tone: "normal" }
  }
  const lineCount = log ? log.split(/\r?\n/).filter((line) => line.trim()).length : 0
  if (lineCount) return { text: `Running · run log active · ${lineCount} lines received`, tone: "normal" }
  return { text: "Starting job · waiting for first runtime message", tone: "normal" }
}

function SubmittedInputs({
  values,
  fields,
  summaryFieldIds,
  uuid,
  onEdit,
  onHide,
}: {
  values: Record<string, unknown>
  fields: Ui2Field[]
  summaryFieldIds: string[]
  uuid?: string
  onEdit: () => void
  onHide: () => void
}) {
  const [showAll, setShowAll] = React.useState(false)
  const fieldMap = React.useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields])
  const ids = showAll ? Object.keys(values) : summaryFieldIds.filter((id) => Object.prototype.hasOwnProperty.call(values, id))

  return (
    <Card className="ui2-mmc-submitted">
      <CardHeader>
        <div>
          <CardTitle>Submitted inputs</CardTitle>
          <CardDescription>{uuid ? `Run ${uuid}` : "Values associated with this run"}</CardDescription>
        </div>
        <span className="ui2-mmc-status-badge">Submitted</span>
      </CardHeader>
      <CardContent>
        <dl className="ui2-mmc-summary-list">
          {ids.map((id) => (
            <div key={id}>
              <dt>{fieldMap.get(id)?.label || id}</dt>
              <dd>{displayValue(values[id], fieldMap.get(id))}</dd>
            </div>
          ))}
        </dl>
        <div className="ui2-mmc-summary-actions">
          <Button type="button" variant="outline" onClick={() => setShowAll((current) => !current)}>
            {showAll ? "Show key inputs" : "Show all inputs"}
          </Button>
          <Button type="button" variant="outline" onClick={onHide}>Hide inputs</Button>
          <Button type="button" onClick={onEdit}>Edit for new run</Button>
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
      <Card className="ui2-mmc-log-card">
        <CollapsibleTrigger asChild>
          <button className="ui2-mmc-collapsible-trigger" type="button">
            <span className="ui2-mmc-log-trigger-text">
              <span className="ui2-mmc-log-title"><ScrollText aria-hidden="true" size={17} /> {title}{lineCount ? ` (${lineCount} lines)` : ""}</span>
              {cue && <span className={`ui2-mmc-log-cue ui2-mmc-log-cue-${cue.tone}`}>{cue.text}</span>}
            </span>
            <ChevronDown aria-hidden="true" className={isOpen ? "rotate-180" : ""} size={18} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent forceMount className="data-[state=closed]:hidden">
          <CardContent>
            {description && <p className="ui2-mmc-log-description">{description}</p>}
            <pre aria-live="off" className="ui2-mmc-run-log" role="log">
              {text || "Runtime messages will appear here."}
            </pre>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

export function MmcWorkbench({ module, fields, view, bridge, submitted: initialSubmitted }: MmcMountProps) {
  const [advancedOpen, setAdvancedOpen] = React.useState(false)
  const [submitted, setSubmitted] = React.useState<{ values: Record<string, unknown>; uuid?: string } | null>(initialSubmitted || null)
  const [liveValues, setLiveValues] = React.useState<Record<string, unknown>>(initialSubmitted?.values || {})
  const inputSections = view.inputs?.sections || []
  const advancedSection = view.inputs?.advanced
  const advancedFieldIds = advancedSection?.fields || []
  const summaryFieldIds = view.inputs?.submittedSummary?.fields || []
  const progressSection = view.results?.progress
  const resultTabs = view.results?.tabs || []
  const initialResult = resultTabs.find((tab) => tab.primary)?.id || resultTabs[0]?.id || ""
  const [activeResult, setActiveResult] = React.useState(initialResult)
  const [submitting, setSubmitting] = React.useState(false)
  const [inputRailCollapsed, setInputRailCollapsed] = React.useState(false)
  const [workspaceExpanded, setWorkspaceExpanded] = React.useState(false)
  const [runLogOpen, setRunLogOpen] = React.useState(Boolean(view.results?.runtimeLog?.defaultOpen))
  const resultCardRef = React.useRef<HTMLElement>(null)
  const fieldsById = React.useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields])
  const runtime = React.useSyncExternalStore(bridge.subscribeRuntime, bridge.runtimeSnapshot, bridge.runtimeSnapshot)
  const resultTabValues = submitted?.values || liveValues
  const visibleResultTabs = React.useMemo(
    () => resultTabs.filter((tab) => repeatExpressionActive(tab.repeat, resultTabValues)),
    [resultTabs, resultTabValues]
  )
  const progressFields = (progressSection?.fields || []).map((id) => fieldsById.get(id)).filter(Boolean) as Ui2Field[]
  const assigned = new Set([
    ...inputSections.flatMap((section) => [...section.fields]),
    ...advancedFieldIds,
  ])
  const extraInputs = fields.filter((field) => field.role !== "output" && field.id && field.type !== "label" && !assigned.has(field.id))

  React.useEffect(() => {
    if (!visibleResultTabs.some((tab) => tab.id === activeResult)) {
      setActiveResult(visibleResultTabs.find((tab) => tab.primary)?.id || visibleResultTabs[0]?.id || "")
    }
  }, [activeResult, visibleResultTabs])

  React.useLayoutEffect(() => {
    setLiveValues(bridge.syncValues())
  }, [bridge])

  const syncLiveValues = React.useCallback(() => {
    setLiveValues(bridge.syncValues())
  }, [bridge])

  React.useEffect(() => {
    const handleReattached = (event: Event) => {
      const detail = (event as CustomEvent).detail || {}
      if (detail.moduleId !== "monomer_monte_carlo") return
      const values = detail.values || bridge.syncValues()
      setLiveValues(values)
      setSubmitted({ values, uuid: detail.uuid })
    }
    window.addEventListener("ui2:mmc-reattached", handleReattached)
    return () => window.removeEventListener("ui2:mmc-reattached", handleReattached)
  }, [bridge])

  const scheduleOutputResize = React.useCallback(() => {
    window.requestAnimationFrame(() => bridge.resizeOutputs())
    window.setTimeout(bridge.resizeOutputs, 75)
    window.setTimeout(bridge.resizeOutputs, 250)
    window.setTimeout(bridge.resizeOutputs, 600)
  }, [bridge])

  React.useLayoutEffect(() => {
    scheduleOutputResize()
  }, [activeResult, inputRailCollapsed, runtime.lastSequence, scheduleOutputResize, workspaceExpanded])

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
        setSubmitted({ values, uuid: result.uuid })
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
    setSubmitted(null)
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

  const lifecycleState = String(runtime.lifecycle?.state || (submitting ? "submitting" : "editing"))
  const lifecycleMessage = String(runtime.lifecycle?.error || runtime.lifecycle?.message || lifecycleState)
  const hasRunContext = Boolean(submitted || runtime.run)
  const runCue = hasRunContext ? runCueMessage(runtime) : undefined

  return (
    <form
      className={`ui2-mmc-react${workspaceExpanded ? " ui2-mmc-react-workspace-expanded" : ""}`}
      id="ui2-form"
      onChange={syncLiveValues}
      onInput={syncLiveValues}
      onReset={handleReset}
      onSubmit={handleSubmit}
    >
      <header className="ui2-mmc-heading">
        <div>
          <span className="ui2-mmc-kicker"><FlaskConical aria-hidden="true" size={16} /> {view.heading?.kicker || "Scientific workbench"}</span>
          <h2>{module.label || "Monomer Monte Carlo"}</h2>
          {view.heading?.description && <p>{view.heading.description}</p>}
        </div>
      </header>

      <div className={`ui2-mmc-grid${inputRailCollapsed || workspaceExpanded ? " ui2-mmc-grid-inputs-hidden" : ""}`}>
        {!inputRailCollapsed && !workspaceExpanded && <aside className="ui2-mmc-input-pane">
          {submitted ? (
            <SubmittedInputs fields={fields} summaryFieldIds={summaryFieldIds} onEdit={() => {
              bridge.clearSubmitted()
              setSubmitted(null)
              setInputRailCollapsed(false)
            }} onHide={() => setInputRailCollapsed(true)} uuid={submitted.uuid} values={submitted.values} />
          ) : (
            <div className="ui2-mmc-input-scroll">
              {inputSections.map((section) => {
                const sectionFields = section.fields.map((id) => fieldsById.get(id)).filter(Boolean) as Ui2Field[]
                return (
                  <Card key={section.id}>
                    <CardHeader>
                      <div>
                        <CardTitle>{section.title}</CardTitle>
                        <CardDescription>{section.description}</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent><FieldGroup bridge={bridge} fields={sectionFields} /></CardContent>
                  </Card>
                )
              })}

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
                      <button className="ui2-mmc-collapsible-trigger" type="button">
                        <span><Settings2 aria-hidden="true" size={17} /> {advancedSection.title}</span>
                        <ChevronDown aria-hidden="true" className={advancedOpen ? "rotate-180" : ""} size={18} />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent forceMount className="data-[state=closed]:hidden">
                      <CardContent>
                        {advancedSection.description && <p className="ui2-mmc-section-description">{advancedSection.description}</p>}
                        <FieldGroup bridge={bridge} fields={advancedFieldIds.map((id) => fieldsById.get(id)).filter(Boolean) as Ui2Field[]} />
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}

            </div>
          )}

          {!submitted && (
            <div className="ui2-mmc-actions">
              <div className="ui2-mmc-action-buttons">
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
        </aside>}

        <main className="ui2-mmc-results-pane">
          {submitted && inputRailCollapsed && (
            <div className="ui2-mmc-show-inputs-row">
              <Button type="button" variant="outline" onClick={() => setInputRailCollapsed(false)}>
                Show submitted inputs
              </Button>
            </div>
          )}

          {progressSection && (
            <Card className="ui2-mmc-progress-card">
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

          {visibleResultTabs.length > 0 && (
            <Card className="ui2-mmc-result-card" ref={resultCardRef}>
              <CardContent>
                <Tabs
                  className="ui2-mmc-result-tabs"
                  onValueChange={(value) => {
                    setActiveResult(value)
                    window.setTimeout(scheduleOutputResize, 0)
                  }}
                  value={activeResult}
                >
                  <div className="ui2-mmc-result-toolbar">
                    <TabsList aria-label={`${module.label || "Module"} results`} className="ui2-mmc-result-tab-list">
                      {visibleResultTabs.map((tab) => <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>)}
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
                  {visibleResultTabs.map((tab: WorkbenchResultTab) => {
                    const tabFields = tab.outputs.map((id) => fieldsById.get(id)).filter(Boolean) as Ui2Field[]
                    const panelKind = tab.fit === "wide"
                      ? "wide"
                      : tabFields.some((field) => field.type === "plotly")
                      ? "plot"
                      : tabFields.some((field) => field.type === "ngl")
                        ? "structure"
                        : "other"
                    return (
                      <TabsContent
                        forceMount
                        key={tab.id}
                        value={tab.id}
                        className={workspaceExpanded
                          ? `ui2-mmc-expanded-panel ui2-mmc-result-panel-${panelKind}`
                          : "data-[state=inactive]:hidden"
                        }
                      >
                        {workspaceExpanded && <h3 className="ui2-mmc-result-panel-title">{tab.label}</h3>}
                        {tabFields.map((field) => (
                          <FieldHost
                            bridge={bridge}
                            field={field}
                            fitPlot={(tab.fit === "pane" || tab.fit === "wide") && field.type === "plotly"}
                            key={field.id}
                            role="output"
                          />
                        ))}
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
