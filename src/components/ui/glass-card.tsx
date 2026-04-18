import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * GlassCard — superfície translúcida com blur (estilo macOS Sonoma / iOS 17).
 * Use para cards de destaque, painéis flutuantes e dialogs.
 *
 * variants:
 *  - default  → glass-card (blur 20px, opacidade média)
 *  - panel    → glass-panel (blur 28px, mais opaco — bom pra dialogs)
 *  - subtle   → glass-subtle (blur 12px, leve — bom pra rows internas)
 *
 * hover: aplica lift sutil + glow primary na borda.
 * spotlight: efeito radial que segue o cursor (estilo Vercel/Linear). Desativa em
 *            telas de toque automaticamente via media query (hover: hover).
 */
export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "panel" | "subtle";
  hover?: boolean;
  spotlight?: boolean;
  asChild?: boolean;
}

const variantClass = {
  default: "glass-card",
  panel: "glass-panel",
  subtle: "glass-subtle",
} as const;

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "default", hover = false, spotlight = false, children, onMouseMove, ...props }, ref) => {
    // Atualiza variáveis CSS --x / --y com a posição do mouse relativa ao card.
    // Usa requestAnimationFrame para evitar sobrecarga em movimentos rápidos.
    const rafRef = React.useRef<number | null>(null);
    const handleMouseMove = React.useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (spotlight) {
          const target = e.currentTarget;
          const rect = target.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          rafRef.current = requestAnimationFrame(() => {
            target.style.setProperty("--spotlight-x", `${x}px`);
            target.style.setProperty("--spotlight-y", `${y}px`);
          });
        }
        onMouseMove?.(e);
      },
      [spotlight, onMouseMove],
    );

    React.useEffect(() => {
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }, []);

    return (
      <div
        ref={ref}
        className={cn(
          variantClass[variant],
          hover && "glass-hover",
          spotlight && "glass-spotlight",
          "text-card-foreground",
          className,
        )}
        onMouseMove={handleMouseMove}
        {...props}
      >
        {children}
      </div>
    );
  },
);
GlassCard.displayName = "GlassCard";

export const GlassCardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6 pb-4", className)} {...props} />
  ),
);
GlassCardHeader.displayName = "GlassCardHeader";

export const GlassCardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-lg font-semibold leading-tight tracking-tight", className)}
      {...props}
    />
  ),
);
GlassCardTitle.displayName = "GlassCardTitle";

export const GlassCardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
GlassCardDescription.displayName = "GlassCardDescription";

export const GlassCardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  ),
);
GlassCardContent.displayName = "GlassCardContent";
