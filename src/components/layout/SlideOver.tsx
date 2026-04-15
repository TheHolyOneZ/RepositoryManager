import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
}

export const SlideOver: React.FC<SlideOverProps> = ({
  open,
  onClose,
  title,
  children,
  width = "480px",
}) => {
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="glass-modal-backdrop fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed top-0 right-0 h-full z-50 flex flex-col"
            style={{
              width,
              background: "rgba(9,11,22,0.97)",
              backdropFilter: "blur(28px) saturate(160%)",
              WebkitBackdropFilter: "blur(28px) saturate(160%)",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "-24px 0 60px rgba(0,0,0,0.50), -1px 0 0 rgba(255,255,255,0.04)",
            }}
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 38, mass: 0.8 }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
              {title && (
                <h3 className="text-[0.9375rem] font-semibold text-[#E8EAF0] tracking-tight">
                  {title}
                </h3>
              )}
              <button
                onClick={onClose}
                className="ml-auto p-1.5 rounded-lg text-[#4A5166] hover:text-[#E8EAF0] hover:bg-white/[0.06] transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
