import * as React from "react"
import { ChevronDown, FlaskConical, Maximize2, Minimize2, Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { MmcBridge, MmcMountProps, Ui2Field } from "@/types"

const inputSections = [
  {
    id: "run-files",
    title: "Run and files",
    description: "Name the run and select its coordinate files.",
    fields: ["run_name", "pdbfile", "dcdfile"],
  },
  {
    id: "sampling",
    title: "Sampling",
    description: "Set Monte Carlo attempts, temperature, and molecule type.",
    fields: ["trials", "goback", "temp", "moltype_list_box"],
  },
  {
    id: "flexible-regions",
    title: "Flexible regions",
    description: "Describe the residues and torsion ranges to sample.",
    fields: ["numranges", "reslow", "dtheta", "residue_alignment"],
  },
  {
    id: "overlap",
    title: "Overlap",
    description: "Choose the collision basis and its optional cutoff.",
    fields: ["overlap_list_box", "basis", "cutoff"],
  },
] as const

const advancedFieldIds = [
  "advanced_input",
  "lowrg",
  "highrg",
  "directedmc",
  "zflag_check_box",
  "zcutoff",
  "cflag_check_box",
  "confile",
]

const summaryFieldIds = [
  "run_name",
  "pdbfile",
  "dcdfile",
  "trials",
  "temp",
  "moltype_list_box",
  "numranges",
  "reslow",
  "overlap_list_box",
  "advanced_input",
]

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

function displayValue(value: unknown): string {
  if (value === true) return "On"
  if (value === false) return "Off"
  if (Array.isArray(value)) return value.map(displayValue).join(", ")
  if (value == null || value === "") return "—"
  return String(value)
}

function SubmittedInputs({
  values,
  fields,
  uuid,
  onEdit,
}: {
  values: Record<string, unknown>
  fields: Ui2Field[]
  uuid?: string
  onEdit: () => void
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
              <dd>{displayValue(values[id])}</dd>
            </div>
          ))}
        </dl>
        <div className="ui2-mmc-summary-actions">
          <Button type="button" variant="outline" onClick={() => setShowAll((current) => !current)}>
            {showAll ? "Show key inputs" : "Show all inputs"}
          </Button>
          <Button type="button" onClick={onEdit}>Edit for new run</Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function MmcWorkbench({ module, fields, bridge, submitted: initialSubmitted }: MmcMountProps) {
  const [advancedOpen, setAdvancedOpen] = React.useState(false)
  const [submitted, setSubmitted] = React.useState<{ values: Record<string, unknown>; uuid?: string } | null>(initialSubmitted || null)
  const [activeResult, setActiveResult] = React.useState("plot")
  const [plotExpanded, setPlotExpanded] = React.useState(false)
  const fieldsById = React.useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields])
  const outputFields = fields.filter((field) => field.role === "output")
  const progressFields = outputFields.filter((field) => field.id === "progress_output" || field.id === "progress_html")
  const plotField = fieldsById.get("plotout4_stream")
  const structureField = fieldsById.get("structure_ngl")
  const assigned = new Set([
    "module_header",
    "advanced_input_header",
    ...inputSections.flatMap((section) => [...section.fields]),
    ...advancedFieldIds,
  ])
  const extraInputs = fields.filter((field) => field.role !== "output" && field.id && !assigned.has(field.id))

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
    const result = await bridge.submit(event.currentTarget)
    if (result.ok) {
      setSubmitted({ values: result.values || bridge.syncValues(), uuid: result.uuid })
    }
  }

  const handleReset = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    bridge.reset(event.currentTarget)
    setSubmitted(null)
    setAdvancedOpen(false)
  }

  const actionCreate = React.useCallback(() => bridge.createActionBar(), [bridge])

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
          <span className="ui2-mmc-kicker"><FlaskConical aria-hidden="true" size={16} /> React workbench</span>
          <h2>{module.label || "Monomer Monte Carlo"}</h2>
          <p>Configure sampling, follow progress, and inspect trajectory and structure results without leaving the workspace.</p>
        </div>
      </header>

      <div className="ui2-mmc-grid">
        <aside className="ui2-mmc-input-pane">
          {submitted ? (
            <SubmittedInputs fields={fields} onEdit={() => {
              bridge.clearSubmitted()
              setSubmitted(null)
            }} uuid={submitted.uuid} values={submitted.values} />
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

              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <button className="ui2-mmc-collapsible-trigger" type="button">
                      <span><Settings2 aria-hidden="true" size={17} /> Advanced input</span>
                      <ChevronDown aria-hidden="true" className={advancedOpen ? "rotate-180" : ""} size={18} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent forceMount className="data-[state=closed]:hidden">
                    <CardContent>
                      <FieldGroup bridge={bridge} fields={advancedFieldIds.map((id) => fieldsById.get(id)).filter(Boolean) as Ui2Field[]} />
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {extraInputs.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Additional inputs</CardTitle></CardHeader>
                  <CardContent><FieldGroup bridge={bridge} fields={extraInputs} /></CardContent>
                </Card>
              )}
            </div>
          )}

          <div className={submitted ? "ui2-mmc-actions-hidden" : "ui2-mmc-actions"}>
            <NativeHost create={actionCreate} />
          </div>
        </aside>

        <main className="ui2-mmc-results-pane">
          <Card className="ui2-mmc-progress-card">
            <CardHeader>
              <div>
                <CardTitle>Run progress</CardTitle>
                <CardDescription>Status remains visible while results update.</CardDescription>
              </div>
            </CardHeader>
            <CardContent><FieldGroup bridge={bridge} fields={progressFields} role="output" /></CardContent>
          </Card>

          {plotExpanded && <div aria-hidden="true" className="ui2-mmc-result-backdrop" />}
          <Card
            aria-label={plotExpanded ? "Expanded Monomer Monte Carlo trajectory plot" : undefined}
            aria-modal={plotExpanded ? true : undefined}
            className={`ui2-mmc-result-card${plotExpanded ? " ui2-mmc-result-card-expanded" : ""}`}
            role={plotExpanded ? "dialog" : undefined}
          >
            <CardContent>
              <Tabs className="ui2-mmc-result-tabs" value={activeResult} onValueChange={(value) => {
                setActiveResult(value)
                if (value !== "plot") setPlotExpanded(false)
                window.setTimeout(bridge.resizeOutputs, 0)
              }}>
                <div className="ui2-mmc-result-toolbar">
                  <TabsList aria-label="MMC results">
                    <TabsTrigger value="plot">Trajectory plot</TabsTrigger>
                    <TabsTrigger value="structure">Structure</TabsTrigger>
                  </TabsList>
                  {activeResult === "plot" && (
                    <Button
                      aria-expanded={plotExpanded}
                      onClick={() => setPlotExpanded((current) => !current)}
                      type="button"
                      variant="outline"
                    >
                      {plotExpanded ? <Minimize2 aria-hidden="true" size={16} /> : <Maximize2 aria-hidden="true" size={16} />}
                      {plotExpanded ? "Close expanded plot" : "Expand plot"}
                    </Button>
                  )}
                </div>
                <TabsContent forceMount value="plot" className="data-[state=inactive]:hidden">
                  {plotField && <FieldHost bridge={bridge} field={plotField} fitPlot role="output" />}
                </TabsContent>
                <TabsContent forceMount value="structure" className="data-[state=inactive]:hidden">
                  {structureField && <FieldHost bridge={bridge} field={structureField} role="output" />}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </main>
      </div>

    </form>
  )
}
