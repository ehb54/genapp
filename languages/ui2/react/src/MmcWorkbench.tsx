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
    const milestone = numberText(lastFrame?.milestonePercent)
    const trial = numberText(lastFrame?.trial)
    const parts = [`Running · structure snapshots ${frames.length}/10 available`]
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

function RunCue({ snapshot, onViewLog }: { snapshot: JobRuntimeSnapshot; onViewLog: () => void }) {
  const message = runCueMessage(snapshot)
  return (
    <Card className="ui2-mmc-run-cue-card">
      <CardContent>
        <div className="ui2-mmc-run-cue-row">
          <div aria-live="polite" className={`ui2-mmc-run-cue ui2-mmc-run-cue-${message.tone}`} role="status">
            {message.text}
          </div>
          <Button type="button" variant="outline" onClick={onViewLog}>
            View run log
          </Button>
        </div>
      </CardContent>
    </Card>
  )
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
}: {
  snapshot: JobRuntimeSnapshot
  title: string
  description?: string
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
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
            <span><ScrollText aria-hidden="true" size={17} /> {title}{lineCount ? ` (${lineCount} lines)` : ""}</span>
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
  const inputSections = view.inputs?.sections || []
  const advancedSection = view.inputs?.advanced
  const advancedFieldIds = advancedSection?.fields || []
  const summaryFieldIds = view.inputs?.submittedSummary?.fields || []
  const progressSection = view.results?.progress
  const resultTabs = view.results?.tabs || []
  const initialResult = resultTabs.find((tab) => tab.primary)?.id || resultTabs[0]?.id || ""
  const [activeResult, setActiveResult] = React.useState(initialResult)
  const [plotExpanded, setPlotExpanded] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [inputRailCollapsed, setInputRailCollapsed] = React.useState(false)
  const [runLogOpen, setRunLogOpen] = React.useState(Boolean(view.results?.runtimeLog?.defaultOpen))
  const fieldsById = React.useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields])
  const runtime = React.useSyncExternalStore(bridge.subscribeRuntime, bridge.runtimeSnapshot, bridge.runtimeSnapshot)
  const progressFields = (progressSection?.fields || []).map((id) => fieldsById.get(id)).filter(Boolean) as Ui2Field[]
  const activeTab = resultTabs.find((tab) => tab.id === activeResult)
  const assigned = new Set([
    ...inputSections.flatMap((section) => [...section.fields]),
    ...advancedFieldIds,
  ])
  const extraInputs = fields.filter((field) => field.role !== "output" && field.id && field.type !== "label" && !assigned.has(field.id))

  React.useEffect(() => {
    if (!resultTabs.some((tab) => tab.id === activeResult)) {
      setActiveResult(initialResult)
    }
  }, [activeResult, initialResult, resultTabs])

  React.useLayoutEffect(() => {
    bridge.syncValues()
  }, [bridge])

  React.useEffect(() => {
    const handleReattached = (event: Event) => {
      const detail = (event as CustomEvent).detail || {}
      if (detail.moduleId !== "monomer_monte_carlo") return
      setSubmitted({ values: detail.values || bridge.syncValues(), uuid: detail.uuid })
    }
    window.addEventListener("ui2:mmc-reattached", handleReattached)
    return () => window.removeEventListener("ui2:mmc-reattached", handleReattached)
  }, [bridge])

  React.useEffect(() => {
    if (!plotExpanded) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPlotExpanded(false)
    }
    document.body.classList.add("ui2-plot-expanded")
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.classList.remove("ui2-plot-expanded")
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [plotExpanded])

  React.useLayoutEffect(() => {
    window.requestAnimationFrame(() => bridge.resizeOutputs())
  }, [bridge, plotExpanded])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      const result = await bridge.submit(event.currentTarget)
      if (result.ok) {
        setSubmitted({ values: result.values || bridge.syncValues(), uuid: result.uuid })
        setInputRailCollapsed(false)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    bridge.reset(event.currentTarget)
    setSubmitted(null)
    setAdvancedOpen(false)
    setInputRailCollapsed(false)
  }

  const lifecycleState = String(runtime.lifecycle?.state || (submitting ? "submitting" : "editing"))
  const lifecycleMessage = String(runtime.lifecycle?.error || runtime.lifecycle?.message || lifecycleState)
  const hasRunContext = Boolean(submitted || runtime.run)

  return (
    <form
      className="ui2-mmc-react"
      id="ui2-form"
      onChange={() => bridge.syncValues()}
      onInput={() => bridge.syncValues()}
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

      <div className={`ui2-mmc-grid${inputRailCollapsed ? " ui2-mmc-grid-inputs-hidden" : ""}`}>
        {!inputRailCollapsed && <aside className="ui2-mmc-input-pane">
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

              {extraInputs.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Additional inputs</CardTitle></CardHeader>
                  <CardContent><FieldGroup bridge={bridge} fields={extraInputs} /></CardContent>
                </Card>
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

          {view.results?.runtimeLog && hasRunContext && (
            <RunCue snapshot={runtime} onViewLog={() => setRunLogOpen(true)} />
          )}

          {view.results?.runtimeLog && (
            <RunLog
              defaultOpen={view.results.runtimeLog.defaultOpen}
              description={view.results.runtimeLog.description}
              open={runLogOpen}
              onOpenChange={setRunLogOpen}
              snapshot={runtime}
              title={view.results.runtimeLog.title || "Run log"}
            />
          )}

          {plotExpanded && <div aria-hidden="true" className="ui2-mmc-result-backdrop" />}
          {resultTabs.length > 0 && (
            <Card
              aria-label={plotExpanded ? "Expanded output workspace" : undefined}
              aria-modal={plotExpanded ? true : undefined}
              className={`ui2-mmc-result-card ui2-mmc-workspace-card${plotExpanded ? " ui2-mmc-result-card-expanded ui2-mmc-workspace-card-expanded" : ""}`}
              role={plotExpanded ? "dialog" : undefined}
            >
              <CardContent>
                {plotExpanded ? (
                  <div className="ui2-mmc-expanded-workspace">
                    <div className="ui2-mmc-result-toolbar">
                      <div>
                        <CardTitle>Output workspace</CardTitle>
                        <CardDescription>Trajectory and structure outputs are shown together in expanded view.</CardDescription>
                      </div>
                      <Button
                        aria-expanded="true"
                        onClick={() => setPlotExpanded(false)}
                        type="button"
                        variant="outline"
                      >
                        <Minimize2 aria-hidden="true" size={16} />
                        Restore split view
                      </Button>
                    </div>
                    <div className="ui2-mmc-workspace-panels">
                      {resultTabs.map((tab: WorkbenchResultTab) => (
                        <section className="ui2-mmc-workspace-panel" key={tab.id}>
                          <h3>{tab.label}</h3>
                          <div className="ui2-mmc-workspace-panel-body">
                            {tab.outputs.map((id) => fieldsById.get(id)).filter(Boolean).map((field) => (
                              <FieldHost
                                bridge={bridge}
                                field={field as Ui2Field}
                                fitPlot={tab.fit === "pane" && field?.type === "plotly"}
                                key={field?.id}
                                role="output"
                              />
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Tabs className="ui2-mmc-result-tabs" value={activeResult} onValueChange={(value) => {
                    setActiveResult(value)
                    const selected = resultTabs.find((tab) => tab.id === value)
                    if (!selected?.expandable) setPlotExpanded(false)
                    window.setTimeout(bridge.resizeOutputs, 0)
                  }}>
                    <div className="ui2-mmc-result-toolbar">
                      <TabsList aria-label={`${module.label || "Module"} results`}>
                        {resultTabs.map((tab) => <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>)}
                      </TabsList>
                      {activeTab?.expandable && (
                        <Button
                          aria-expanded="false"
                          onClick={() => setPlotExpanded(true)}
                          type="button"
                          variant="outline"
                        >
                          <Maximize2 aria-hidden="true" size={16} />
                          Expand workspace
                        </Button>
                      )}
                    </div>
                    {resultTabs.map((tab: WorkbenchResultTab) => (
                      <TabsContent forceMount key={tab.id} value={tab.id} className="data-[state=inactive]:hidden">
                        {tab.outputs.map((id) => fieldsById.get(id)).filter(Boolean).map((field) => (
                          <FieldHost
                            bridge={bridge}
                            field={field as Ui2Field}
                            fitPlot={tab.fit === "pane" && field?.type === "plotly"}
                            key={field?.id}
                            role="output"
                          />
                        ))}
                      </TabsContent>
                    ))}
                  </Tabs>
                )}
              </CardContent>
            </Card>
          )}
        </main>
      </div>

    </form>
  )
}
