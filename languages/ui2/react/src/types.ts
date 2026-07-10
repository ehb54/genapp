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

export type SubmitResult = {
  ok: boolean
  uuid?: string
  values?: Record<string, unknown>
  error?: string
}

export type MmcBridge = {
  createField: (field: Ui2Field, role: "input" | "output") => HTMLElement
  createActionBar: () => HTMLElement
  syncValues: () => Record<string, unknown>
  reset: (form: HTMLFormElement) => void
  clearSubmitted: () => void
  submit: (form: HTMLFormElement) => Promise<SubmitResult>
  resizeOutputs: () => void
}

export type MmcMountProps = {
  module: Ui2Module
  fields: Ui2Field[]
  bridge: MmcBridge
  submitted?: {
    values: Record<string, unknown>
    uuid?: string
  } | null
}

declare global {
  interface Window {
    GenAppUi2Mmc?: {
      mount: (root: HTMLElement, props: MmcMountProps) => void
      unmount: (root: HTMLElement) => void
    }
  }
}
