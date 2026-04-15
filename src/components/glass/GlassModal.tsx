import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface GlassModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showClose?: boolean;
}

const sizeClass = {
  sm:   "max-w-sm",
  md:   "max-w-md",
  lg:   "max-w-lg",
  xl:   "max-w-2xl",
  full: "max-w-4xl",
};

export const GlassModal: React.FC<GlassModalProps> = ({
  open, onClose, title, children, size = "md", showClose = true,
}) => {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
        >
          <motion.div className="absolute inset-0 glass-modal-backdrop" onClick={onClose} />
          <motion.div
            className={`relative z-10 w-full ${sizeClass[size]} glass-elevated max-h-[85vh] flex flex-col`}
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 480, damping: 32 }}
          >
            {(title || showClose) && (
              <div className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.07] px-5 py-4">
                {title && (
                  <h2 className="text-[0.9375rem] font-semibold tracking-tight text-[#E8EAF0]">{title}</h2>
                )}
                {showClose && (
                  <button
                    onClick={onClose}
                    className="ml-auto rounded-lg p-1.5 text-[#4A5166] transition-colors hover:bg-white/[0.06] hover:text-[#E8EAF0]"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-5">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
