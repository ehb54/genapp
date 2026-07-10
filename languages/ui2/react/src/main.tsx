import { createRoot, type Root } from "react-dom/client"

import { MmcWorkbench } from "@/MmcWorkbench"
import type { MmcMountProps } from "@/types"
import "@/index.css"

const roots = new WeakMap<HTMLElement, Root>()

window.GenAppUi2Mmc = {
  mount(root, props: MmcMountProps) {
    window.GenAppUi2Mmc?.unmount(root)
    const reactRoot = createRoot(root)
    roots.set(root, reactRoot)
    reactRoot.render(<MmcWorkbench {...props} />)
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
