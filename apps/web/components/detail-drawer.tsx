'use client';
import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function DetailDrawer({ isOpen, onClose, title, children, footer }: DetailDrawerProps) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (typeof window === 'undefined') return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      {/* Drawer panel — bottom sheet on mobile, side drawer on md+ */}
      <div
        className={`fixed z-50 flex flex-col bg-white shadow-2xl transition-transform duration-200
          inset-x-0 bottom-0 top-auto rounded-t-xl rounded-b-none max-h-[90vh]
          md:inset-y-0 md:right-0 md:left-auto md:top-0 md:bottom-0 md:w-[480px] md:rounded-none md:max-h-none
          ${isOpen ? 'translate-y-0 md:translate-x-0 md:translate-y-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb] flex-shrink-0">
          <h2 className="text-base font-semibold text-[#111827] truncate">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-[#6b7280]" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-[#e5e7eb] flex-shrink-0">{footer}</div>
        )}
      </div>
    </>,
    document.body
  );
}
