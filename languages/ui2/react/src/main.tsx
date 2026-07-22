import { createRoot, type Root } from "react-dom/client"

import { ScientificWorkbench } from "@/ScientificWorkbench"
import type { ScientificWorkbenchMountProps } from "@/types"
import "@/index.css"

const roots = new WeakMap<HTMLElement, Root>()

window.GenAppUi2Workbench = {
  mount(root, props: ScientificWorkbenchMountProps) {
    window.GenAppUi2Workbench?.unmount(root)
    const reactRoot = createRoot(root)
    roots.set(root, reactRoot)
    reactRoot.render(<ScientificWorkbench {...props} />)
  },
  unmount(root) {
    const reactRoot = roots.get(root)
    if (reactRoot) {
      reactRoot.unmount()
      roots.delete(root)
    }
  },
}

window.dispatchEvent(new CustomEvent("ui2-react-ready"))
