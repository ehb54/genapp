import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

function Progress({ className, value = 0, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-[var(--ui2-panel-strong)]", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full bg-[var(--ui2-accent)] transition-transform duration-300"
        style={{ transform: `translateX(-${100 - Math.max(0, Math.min(100, Number(value) || 0))}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
