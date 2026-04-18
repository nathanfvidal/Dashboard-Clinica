import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * Input de hora forçado em formato 24h (HH:MM).
 * - Adiciona lang="pt-BR" para evitar AM/PM em locales US.
 * - Esconde os spinners nativos do WebKit (setas ↑↓) que poluíam o visual.
 * - Usa step=60 (1 minuto) e fonte tabular pra alinhamento.
 */
export const TimeInput24 = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, ...props }, ref) => {
  return (
    <Input
      ref={ref}
      type="time"
      lang="pt-BR"
      step={60}
      className={cn("time-input-24 tabular-nums", className)}
      {...props}
    />
  );
});
TimeInput24.displayName = "TimeInput24";
