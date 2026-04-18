import { motion, type HTMLMotionProps } from "framer-motion";
import { type ReactNode } from "react";

// Transição padrão para mudança de rotas
const transicaoRota = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as const },
};

interface PageTransitionProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
}

// Wrapper para animar entrada/saída de páginas
export function PageTransition({ children, className, ...props }: PageTransitionProps) {
  return (
    <motion.div className={className} {...transicaoRota} {...props}>
      {children}
    </motion.div>
  );
}

// Container que orquestra o stagger entre filhos
export const staggerContainer = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

// Item filho usado dentro do staggerContainer
export const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const },
  },
};
