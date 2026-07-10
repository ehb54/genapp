import * as React from "react"

import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("rounded-xl border border-[var(--ui2-border)] bg-[var(--ui2-panel)] shadow-sm", className)} {...props} />
}

function CardHeader({ className, ...props }: React.ComponentProps<"header">) {
  return <header className={cn("flex items-start justify-between gap-3 border-b border-[var(--ui2-border)] px-5 py-4", className)} {...props} />
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-base font-semibold tracking-tight text-[var(--ui2-text)]", className)} {...props} />
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("mt-1 text-sm text-[var(--ui2-muted)]", className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />
}

export { Card, CardContent, CardDescription, CardHeader, CardTitle }
