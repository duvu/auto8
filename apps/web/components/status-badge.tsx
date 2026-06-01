'use client';

const BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-gray-100 text-gray-700' },
  needs_review: { label: 'Needs Review', className: 'bg-gray-100 text-gray-700' },
  classified: { label: 'Classified', className: 'bg-blue-100 text-blue-700' },
  ready_for_quote: { label: 'Ready', className: 'bg-blue-100 text-blue-700' },
  quote_draft_created: { label: 'Draft', className: 'bg-amber-100 text-amber-700' },
  quote_submitted: { label: 'Submitted', className: 'bg-amber-100 text-amber-700' },
  pending_approval: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  sent: { label: 'Sent', className: 'bg-green-100 text-green-700' },
  customer_accepted: { label: 'Accepted', className: 'bg-green-100 text-green-700' },
  customer_rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  revision_requested: { label: 'Revision', className: 'bg-orange-100 text-orange-700' },
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600' },
  closed: { label: 'Closed', className: 'bg-gray-200 text-gray-600' },
};

export function StatusBadge({ status }: { status: string }) {
  const config = BADGE_CONFIG[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
