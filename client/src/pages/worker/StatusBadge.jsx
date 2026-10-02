import Badge from '../../components/ui/Badge.jsx';

const statusMeta = {
  segregated: { label: 'Segregated', variant: 'good', icon: '✓' },
  mixed: { label: 'Mixed', variant: 'warn', icon: '!' },
  rejected: { label: 'Rejected', variant: 'bad', icon: '×' },
};

export function statusLabel(status) {
  return statusMeta[status]?.label || 'Unknown status';
}

export function statusVariant(status) {
  return statusMeta[status]?.variant || 'neutral';
}

export default function StatusBadge({ status }) {
  const meta = statusMeta[status] || { label: 'Unknown status', variant: 'neutral', icon: '?' };
  return <Badge variant={meta.variant}><span aria-hidden="true">{meta.icon}</span>&nbsp;{meta.label}</Badge>;
}