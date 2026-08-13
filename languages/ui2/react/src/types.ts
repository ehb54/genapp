export type Ui2Field = {
  id?: string
  role?: string
  type?: string
  label?: string
  help?: string
  default?: unknown
  checked?: boolean | string
  repeat?: string
  [key: string]: unknown
}

export type Ui2Module = {
  moduleid?: string
  label?: string
  executable?: string
  fields?: Ui2Field[]
  [key: string]: unknown
}

export type WorkbenchSection = {
  id: string
  title: string
  description?: string
  fields?: string[]
  workflowChoices?: string[]
  collapsed?: boolean
  repeat?: string
  children?: WorkbenchSection[]
  layout?: "form" | "table" | "wide" | string
}

export type ChoiceCardPresentation = {
  control: "choice-cards"
  title?: string
  choices?: Record<string, {
    title?: string
    description?: string
    badge?: string
    repeat?: string
  }>
}

export type WorkflowChoicePresentation = {
  title?: string
  fields: string[]
  choices: Record<string, {
    title: string
    description?: string
    badge?: string
    matches: Record<string, unknown>
    values: Record<string, unknown>
  }>
}

export type WorkbenchResultGroup = {
  id: string
  label: string
  outputs: string[]
  primary?: boolean
  expandable?: boolean
  fit?: "pane" | string
  repeat?: string
  layout?: "auto" | "tabs" | "grid" | "comparison" | "gallery" | string
  plotPresentation?: {
    profile?: string
    traceRoles?: Record<string, { token?: "primary" | "reference" | "context" | "experimental" | "uncertainty" | "residual" | string; legend?: "show" | "hide" | string }>
  }
  visibility?: "declared" | "available"
}

// `tabs` was the first MMC view spelling.  Keep it as a view-compatible
// alias while new module views use the output-neutral `groups` name.
export type WorkbenchResultTab = WorkbenchResultGroup

export type WorkbenchView = {
  renderer?: string
  layout?: string
  heading?: {
    kicker?: string
    description?: string
  }
  inputs?: {
    sections?: WorkbenchSection[]
    advanced?: WorkbenchSection
    fieldPresentations?: Record<string, ChoiceCardPresentation>
    workflowChoices?: Record<string, WorkflowChoicePresentation>
    layout?: "standard" | "wide" | string
    submittedSummary?: {
      fields?: string[]
      expanded?: "all" | "active" | string
    }
  }
  actions?: {
    placement?: string
    submitLabel?: string
    resetLabel?: string
  }
  results?: {
    progress?: WorkbenchSection
    groups?: WorkbenchResultGroup[]
    tabs?: WorkbenchResultTab[]
    includeUnassignedOutputs?: boolean
    runtimeLog?: {
      title?: string
      description?: string
      collapsible?: boolean
      defaultOpen?: boolean
    }
  }
  [key: string]: unknown
}

export type JobEventTopic = {
  items?: unknown[]
  value?: unknown
  complete?: boolean
  operation?: string
  lastSequence?: number
  timestamp?: string
  legacy?: boolean
}

export type JobRuntimeSnapshot = {
  run: string
  module: string
  lastSequence: number
  missingSequences: number[]
  pendingSequences: number[]
  lifecycle: Record<string, unknown> | null
  channels: Record<string, Record<string, JobEventTopic>>
}

export type SubmitResult = {
  ok: boolean
  uuid?: string
  values?: Record<string, unknown>
  error?: string
}

export type TestScenarioVerification = {
  state: "not_run" | "running" | "passed" | "failed" | "unsupported" | string
  checks: Array<{ id: string; passed?: boolean; unsupported?: boolean }>
}

export type TestScenario = {
  id: string
  label: string
  provenance?: string[]
  maturity?: string
  inputs: Record<string, unknown>
  verification?: { schema_version: number; checks: Array<Record<string, unknown>> }
}

export type TestScenarioSnapshot = {
  available: boolean
  loading: boolean
  catalog: { scenarios?: TestScenario[] } | null
  selectedId: string
  verification: TestScenarioVerification
}

export type ScientificWorkbenchBridge = {
  createFieldGroup: (fields: Ui2Field[], role: "input" | "output") => HTMLElement
  releaseField: (field: HTMLElement) => void
  fieldGroupMounted: () => void
  syncValues: () => Record<string, unknown>
  setInputValue: (fieldId: string, value: unknown) => Record<string, unknown>
  setInputValues: (values: Record<string, unknown>) => Record<string, unknown>
  reset: (form: HTMLFormElement) => void
  returnToInputs: () => void
  submit: (form: HTMLFormElement) => Promise<SubmitResult>
  resizeOutputs: () => void
  viewReady: () => void
  runtimeSnapshot: () => JobRuntimeSnapshot
  subscribeRuntime: (listener: (snapshot: JobRuntimeSnapshot) => void) => () => void
  outputSnapshot: () => Record<string, unknown>
  subscribeOutputs: (listener: () => void) => () => void
  runContextSnapshot: () => SubmittedRunContext
  subscribeRunContext: (listener: () => void) => () => void
  testScenarioSnapshot: () => TestScenarioSnapshot
  subscribeTestScenarios: (listener: () => void) => () => void
  applyTestScenario: (id: string, form: HTMLFormElement) => SubmitResult
}

export type SubmittedRunContext = {
  values: Record<string, unknown>
  uuid?: string
  restoreError?: string
  restoreWarnings?: string[]
} | null

export type ScientificWorkbenchMountProps = {
  module: Ui2Module
  fields: Ui2Field[]
  view: WorkbenchView
  bridge: ScientificWorkbenchBridge
  submitted?: SubmittedRunContext
}

declare global {
  interface Window {
    GenAppUi2Workbench?: {
      mount: (root: HTMLElement, props: ScientificWorkbenchMountProps) => void
      unmount: (root: HTMLElement) => void
    }
  }
}
