import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Variante visual do botão de confirmação. */
  variant?: "destructive" | "default";
  /** Texto exibido no botão enquanto a ação está pendente. */
  pendingLabel?: string;
  /** Indica que a ação está em andamento (desabilita os botões). */
  pending?: boolean;
  onConfirm: () => void;
}

/**
 * Diálogo de confirmação estilizado, padroniza a substituição de confirm() nativo.
 * Mantém o visual glass/blur do design system.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "destructive",
  pendingLabel,
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-border/40 bg-popover/85 backdrop-blur-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg tracking-tight">{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-sm text-muted-foreground">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={pending}
            className="h-10 border-border/50 bg-background/40"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => {
              // Evita fechar antes da mutation rodar — quem chama controla o open
              e.preventDefault();
              onConfirm();
            }}
            className={cn(
              "h-10 px-6",
              variant === "destructive" &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            )}
          >
            {pending && pendingLabel ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
