import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * Input de data com locale PT-BR.
 * Mantém o valor no formato ISO (YYYY-MM-DD) que o <input type="date"> usa
 * internamente, mas exibe o placeholder/picker em português brasileiro.
 */
export const DateInputBR = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, ...props }, ref) => {
  return (
    <Input
      ref={ref}
      type="date"
      lang="pt-BR"
      className={cn("date-input-br tabular-nums", className)}
      {...props}
    />
  );
});
DateInputBR.displayName = "DateInputBR";
