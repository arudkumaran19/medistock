import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Shield,
  ShieldAlert,
  Database,
  Activity,
  Sparkles,
  Download,
  RefreshCw,
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Lock,
  Layers,
  Calendar,
} from 'lucide-react';
import { exportAuditLogsCsv, getAuditLogs, getAuditStats } from '@/services/auditApi';
import type { AuditLogQuery, SystemAuditLog } from '@/types/audit';

export function AuditConsolePage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [fromUtc, setFromUtc] = useState('');
  const [toUtc, setToUtc] = useState('');
  const [selectedLog, setSelectedLog] = useState<SystemAuditLog | null>(null);
  const [exporting, setExporting] = useState(false);

  const query: AuditLogQuery = useMemo(
    () => ({
      page,
      pageSize,
      search: search.trim() || undefined,
      action: actionFilter || undefined,
      resourceType: resourceFilter || undefined,
      outcome: outcomeFilter || undefined,
      fromUtc: fromUtc ? new Date(fromUtc).toISOString() : undefined,
      toUtc: toUtc ? new Date(toUtc).toISOString() : undefined,
      sortBy: 'Timestamp',
      sortOrder: 'desc',
    }),
    [page, pageSize, search, actionFilter, resourceFilter, outcomeFilter, fromUtc, toUtc],
  );

  const {
    data: logsData,
    isLoading: logsLoading,
    isError: logsError,
    refetch,
  } = useQuery({
    queryKey: ['admin-audit-logs', query],
    queryFn: () => getAuditLogs(query),
  });

  const { data: statsData } = useQuery({
    queryKey: ['admin-audit-stats'],
    queryFn: getAuditStats,
    refetchInterval: 30000,
  });

  async function handleExportCsv() {
    try {
      setExporting(true);
      const blob = await exportAuditLogsCsv(query);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `medistock-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);
    } catch (err) {
      console.error('Failed to export audit CSV', err);
    } finally {
      setExporting(false);
    }
  }

  function handleResetFilters() {
    setSearch('');
    setActionFilter('');
    setResourceFilter('');
    setOutcomeFilter('');
    setFromUtc('');
    setToUtc('');
    setPage(1);
  }

  const items = logsData?.items ?? [];
  const total = logsData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function getOutcomeBadge(outcome: string) {
    const norm = outcome.toUpperCase();
    if (norm === 'SUCCESS') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            fontSize: '11px',
            fontWeight: 600,
            borderRadius: '999px',
            background: 'var(--color-success-50, #f0fdf4)',
            color: 'var(--color-success-700, #15803d)',
            border: '1px solid var(--color-success-200, #bbf7d0)',
          }}
        >
          <CheckCircle2 size={12} />
          SUCCESS
        </span>
      );
    }
    if (norm === 'DENIED' || norm === 'FAILURE') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            fontSize: '11px',
            fontWeight: 600,
            borderRadius: '999px',
            background: 'var(--color-danger-50, #fef2f2)',
            color: 'var(--color-danger-700, #b91c1c)',
            border: '1px solid var(--color-danger-200, #fecaca)',
          }}
        >
          <XCircle size={12} />
          {norm}
        </span>
      );
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          fontSize: '11px',
          fontWeight: 600,
          borderRadius: '999px',
          background: 'var(--color-warning-50, #fffbeb)',
          color: 'var(--color-warning-700, #b45309)',
          border: '1px solid var(--color-warning-200, #fde68a)',
        }}
      >
        <AlertTriangle size={12} />
        {outcome}
      </span>
    );
  }

  function formatUtcDate(dateStr: string) {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          paddingBottom: 20,
          borderBottom: '1px solid var(--border-default, #e2e8f0)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                borderRadius: 999,
                background: '#0f172a',
                color: '#ffffff',
              }}
            >
              <Lock size={11} /> Admin Security
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.04em',
                borderRadius: 999,
                background: 'var(--color-primary-50, #f0fdfa)',
                color: 'var(--color-primary-700, #0f766e)',
                border: '1px solid var(--color-primary-200, #99f6e4)',
              }}
            >
              <Shield size={11} /> Immutable Audit Log
            </span>
          </div>
          <h1 className="page-title" style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
            Enterprise Audit & Governance Console
          </h1>
          <p className="page-subtitle" style={{ fontSize: 13, color: 'var(--text-secondary, #64748b)', marginTop: 4, maxWidth: 840 }}>
            System-wide operational and security events including authentication, RBAC authorization, inventory mutations,
            shortage alert lifecycle verification, transfers, and AI coordinator tool execution.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              background: '#ffffff',
              border: '1px solid var(--border-strong, #cbd5e1)',
              borderRadius: 8,
              color: 'var(--text-primary, #1e293b)',
              cursor: exporting ? 'not-allowed' : 'pointer',
              boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.05))',
            }}
          >
            <Download size={14} />
            {exporting ? 'Generating Export...' : 'Export Audit CSV'}
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              background: '#ffffff',
              border: '1px solid var(--border-strong, #cbd5e1)',
              borderRadius: 8,
              color: 'var(--text-primary, #1e293b)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.05))',
            }}
            title="Refresh logs"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      {statsData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
          <div
            className="card"
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              borderLeft: '4px solid var(--color-slate-800, #1e293b)',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: 'var(--color-slate-100, #f1f5f9)',
                color: 'var(--color-slate-800, #1e293b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Activity size={18} />
            </div>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Audited Events
              </span>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginTop: 2 }}>
                {statsData.totalEvents.toLocaleString()}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary, #94a3b8)' }}>System-wide persistence</span>
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              borderLeft: '4px solid var(--color-danger-600, #dc2626)',
              background: 'rgba(254, 242, 242, 0.4)',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: 'var(--color-danger-100, #fee2e2)',
                color: 'var(--color-danger-700, #b91c1c)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ShieldAlert size={18} />
            </div>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-danger-700, #b91c1c)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Security Denials
              </span>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-danger-700, #b91c1c)', marginTop: 2 }}>
                {statsData.securityDenials.toLocaleString()}
              </div>
              <span style={{ fontSize: 11, color: 'var(--color-danger-600, #dc2626)' }}>RBAC & unverified attempts</span>
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              borderLeft: '4px solid var(--color-primary-600, #0d9488)',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: 'var(--color-primary-50, #f0fdfa)',
                color: 'var(--color-primary-700, #0f766e)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Database size={18} />
            </div>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Inventory Mutations
              </span>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginTop: 2 }}>
                {statsData.mutationsCount.toLocaleString()}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary, #94a3b8)' }}>Stock balances & batches</span>
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              borderLeft: '4px solid var(--color-info-600, #2563eb)',
              background: 'rgba(239, 246, 255, 0.4)',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: 'var(--color-info-100, #dbeafe)',
                color: 'var(--color-info-700, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Layers size={18} />
            </div>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-info-700, #1d4ed8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Shortage Workflows
              </span>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-info-700, #1d4ed8)', marginTop: 2 }}>
                {statsData.shortageWorkflowEvents.toLocaleString()}
              </div>
              <span style={{ fontSize: 11, color: 'var(--color-info-600, #2563eb)' }}>Alerts, scans & resolutions</span>
            </div>
          </div>

          <div
            className="card"
            onClick={() => {
              setResourceFilter(resourceFilter === 'AI_COORDINATOR' ? '' : 'AI_COORDINATOR');
              setPage(1);
            }}
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              borderLeft: '4px solid var(--color-ai-600, #4f46e5)',
              background: resourceFilter === 'AI_COORDINATOR' ? 'rgba(224, 231, 255, 0.7)' : 'rgba(238, 242, 255, 0.4)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              outline: resourceFilter === 'AI_COORDINATOR' ? '2px solid #4f46e5' : 'none',
            }}
            title="Click to filter by AI Coordinator events"
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: 'var(--color-ai-100, #e0e7ff)',
                color: 'var(--color-ai-700, #4338ca)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-ai-700, #4338ca)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                AI Coordinator Events
              </span>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-ai-700, #4338ca)', marginTop: 2 }}>
                {statsData.aiCoordinatorEvents.toLocaleString()}
              </div>
              <span style={{ fontSize: 11, color: 'var(--color-ai-600, #4f46e5)' }}>
                {resourceFilter === 'AI_COORDINATOR' ? 'Filtering Active (Click to reset)' : 'Agent & tool invocations (Click to filter)'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar Card */}
      <div
        className="card"
        style={{
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid var(--border-default, #e2e8f0)',
          boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.05))',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: 4 }}>
              Search Details / Correlation ID
            </label>
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary, #94a3b8)',
                }}
              />
              <input
                type="text"
                placeholder="Search actor, reason, correlation ID..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="form-input"
                style={{
                  paddingLeft: 32,
                  fontSize: 13,
                  height: 38,
                  borderRadius: 6,
                  border: '1px solid var(--border-strong, #cbd5e1)',
                }}
              />
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: 4 }}>
              Action Category
            </label>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="form-select"
              style={{
                fontSize: 13,
                height: 38,
                borderRadius: 6,
                border: '1px solid var(--border-strong, #cbd5e1)',
                background: '#ffffff',
              }}
            >
              <option value="">All Actions</option>
              <option value="USER_LOGIN_SUCCESS">Login Success</option>
              <option value="USER_LOGIN_FAILED">Login Failed</option>
              <option value="AI_COORDINATOR_CHAT_SUBMITTED">AI: Chat Submitted</option>
              <option value="AI_COORDINATOR_INTENT_CLASSIFIED">AI: Intent Classified</option>
              <option value="AI_COORDINATOR_TOOL_INVOKED">AI: Tool/Agent Invoked</option>
              <option value="AI_COORDINATOR_APPROVAL_REQUESTED">AI: Approval Requested</option>
              <option value="AI_COORDINATOR_ACTION_EXECUTED">AI: Action Executed</option>
              <option value="AI_COORDINATOR_APPROVAL_REJECTED">AI: Approval Rejected</option>
              <option value="AI_COORDINATOR_WORKFLOW_COMPLETED">AI: Workflow Completed</option>
              <option value="AI_COORDINATOR_WORKFLOW_FAILED">AI: Workflow Failed</option>
              <option value="AI_COORDINATOR_ACCESS_DENIED">AI: Access Denied</option>
              <option value="ADMIN_CONVERSATION_AUDIT_ACCESS">AI: Admin Audit Session Access</option>
              <option value="SHORTAGE_ALERT_RAISED">Shortage Raised</option>
              <option value="SHORTAGE_ALERT_RESOLVED">Shortage Resolved (Verified)</option>
              <option value="SHORTAGE_RESOLVE_FAILED">Shortage Resolve Failed</option>
              <option value="SHORTAGE_TRANSFER_LINKED">Shortage Transfer Linked</option>
              <option value="SHORTAGE_PO_LINKED">Shortage PO Linked</option>
              <option value="SHORTAGE_SCAN_EXECUTED">Shortage Scan Executed</option>
              <option value="AUDIT_LOG_VIEWED">Audit Log Viewed</option>
              <option value="AUDIT_LOG_EXPORTED">Audit Log Exported</option>
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: 4 }}>
              Resource Type / Agent
            </label>
            <select
              value={resourceFilter}
              onChange={(e) => {
                setResourceFilter(e.target.value);
                setPage(1);
              }}
              className="form-select"
              style={{
                fontSize: 13,
                height: 38,
                borderRadius: 6,
                border: '1px solid var(--border-strong, #cbd5e1)',
                background: '#ffffff',
              }}
            >
              <option value="">All Resources</option>
              <option value="AI_COORDINATOR">AI Coordinator & Agents</option>
              <option value="ShortageAlert">ShortageAlert</option>
              <option value="User">User</option>
              <option value="Auth">Auth</option>
              <option value="SystemAuditLog">SystemAuditLog</option>
              <option value="TransferRequest">TransferRequest</option>
              <option value="PurchaseOrder">PurchaseOrder</option>
              <option value="InventoryBalance">InventoryBalance</option>
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: 4 }}>
              Outcome
            </label>
            <select
              value={outcomeFilter}
              onChange={(e) => {
                setOutcomeFilter(e.target.value);
                setPage(1);
              }}
              className="form-select"
              style={{
                fontSize: 13,
                height: 38,
                borderRadius: 6,
                border: '1px solid var(--border-strong, #cbd5e1)',
                background: '#ffffff',
              }}
            >
              <option value="">All Outcomes</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILURE">FAILURE</option>
              <option value="DENIED">DENIED</option>
            </select>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--border-default, #f1f5f9)',
            fontSize: 12,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-secondary, #64748b)', fontWeight: 500 }}>From:</span>
              <input
                type="date"
                value={fromUtc}
                onChange={(e) => {
                  setFromUtc(e.target.value);
                  setPage(1);
                }}
                className="form-input"
                style={{ padding: '4px 8px', fontSize: 12, height: 30, borderRadius: 6, border: '1px solid #cbd5e1', width: 135 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-secondary, #64748b)', fontWeight: 500 }}>To:</span>
              <input
                type="date"
                value={toUtc}
                onChange={(e) => {
                  setToUtc(e.target.value);
                  setPage(1);
                }}
                className="form-input"
                style={{ padding: '4px 8px', fontSize: 12, height: 30, borderRadius: 6, border: '1px solid #cbd5e1', width: 135 }}
              />
            </div>

            {(search || actionFilter || resourceFilter || outcomeFilter || fromUtc || toUtc) && (
              <button
                type="button"
                onClick={handleResetFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary-700, #0f766e)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: 12,
                }}
              >
                Clear all filters
              </button>
            )}
          </div>

          <div style={{ color: 'var(--text-secondary, #64748b)', fontSize: 12 }}>
            Showing <strong style={{ color: 'var(--text-primary, #0f172a)' }}>{items.length}</strong> of{' '}
            <strong style={{ color: 'var(--text-primary, #0f172a)' }}>{total}</strong> audited events
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div
        className="table-container"
        style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid var(--border-default, #e2e8f0)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.05))',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead style={{ background: 'var(--color-slate-50, #f8fafc)', borderBottom: '1px solid var(--border-default, #e2e8f0)' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #475569)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Timestamp (UTC)
                </th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #475569)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Action & Context
                </th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #475569)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Actor & Authority
                </th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #475569)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Resource Target
                </th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #475569)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Outcome
                </th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #475569)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Correlation ID
                </th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #475569)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {logsLoading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-secondary, #64748b)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                      <RefreshCw size={16} className="animate-spin" />
                      Loading verified audit records...
                    </div>
                  </td>
                </tr>
              ) : logsError ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--color-danger-700, #b91c1c)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={24} color="#dc2626" />
                      <span style={{ fontWeight: 600, fontSize: 14 }}>Error loading audit logs.</span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)' }}>
                        Ensure your session is authenticated with Administrator role privileges.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-secondary, #64748b)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <FileText size={24} color="#94a3b8" />
                      <span style={{ fontWeight: 600 }}>No matching audit records found.</span>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary, #94a3b8)' }}>
                        Try clearing or expanding search and date filters.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((log) => (
                  <tr
                    key={log.id}
                    style={{
                      borderBottom: '1px solid var(--border-default, #f1f5f9)',
                      transition: 'background 120ms ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>
                      {formatUtcDate(log.timestamp)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                        {log.action}
                      </span>
                      {log.reason && (
                        <span
                          style={{
                            display: 'block',
                            fontSize: 11,
                            color: 'var(--text-secondary, #64748b)',
                            marginTop: 2,
                            maxWidth: 320,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={log.reason}
                        >
                          {log.reason}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary, #1e293b)' }}>{log.actorEmail ?? 'System Authority'}</div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          fontFamily: 'var(--font-mono, monospace)',
                          color: log.actorRole === 'Administrator' || log.actorRole === 'ADMIN' ? 'var(--color-purple-700, #7e22ce)' : '#64748b',
                        }}
                      >
                        [{log.actorRole ?? 'System'}]
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>{log.resourceType}</div>
                      {log.resourceId && (
                        <div
                          style={{
                            fontSize: 10,
                            fontFamily: 'var(--font-mono, monospace)',
                            color: 'var(--text-secondary, #64748b)',
                            maxWidth: 140,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={log.resourceId}
                        >
                          {log.resourceId}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>{getOutcomeBadge(log.outcome)}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: '#64748b' }}>
                      <span title={log.correlationId ?? ''}>
                        {log.correlationId ? log.correlationId.slice(0, 14) + '...' : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        style={{
                          padding: '5px 12px',
                          fontSize: 11,
                          fontWeight: 600,
                          background: '#ffffff',
                          border: '1px solid var(--border-strong, #cbd5e1)',
                          borderRadius: 6,
                          color: 'var(--text-primary, #1e293b)',
                          cursor: 'pointer',
                        }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            background: 'var(--color-slate-50, #f8fafc)',
            borderTop: '1px solid var(--border-default, #e2e8f0)',
            fontSize: 12,
            color: 'var(--text-secondary, #475569)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="form-select"
              style={{ padding: '4px 8px', fontSize: 12, height: 28, borderRadius: 6, border: '1px solid #cbd5e1', background: '#ffffff' }}
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  color: page <= 1 ? '#94a3b8' : '#1e293b',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  color: page >= totalPages ? '#94a3b8' : '#1e293b',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Event Detail Inspection Modal */}
      {selectedLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            padding: 16,
          }}
          onClick={() => setSelectedLog(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              width: 720,
              maxWidth: '92vw',
              maxHeight: '90vh',
              border: '1px solid var(--border-default, #e2e8f0)',
              boxShadow: 'var(--shadow-2xl, 0 25px 50px -12px rgba(0,0,0,0.25))',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                background: 'var(--color-slate-50, #f8fafc)',
                borderBottom: '1px solid var(--border-default, #e2e8f0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>
                  EVENT ID: {selectedLog.id}
                </span>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginTop: 2 }}>
                  {selectedLog.action}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary, #64748b)',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 6,
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, fontSize: 12 }}>
                <div>
                  <span style={{ color: 'var(--text-secondary, #64748b)', display: 'block', marginBottom: 2 }}>Actor Email</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>{selectedLog.actorEmail ?? 'System Authority'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary, #64748b)', display: 'block', marginBottom: 2 }}>Effective Role</span>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                    {selectedLog.actorRole ?? 'System'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary, #64748b)', display: 'block', marginBottom: 2 }}>Target Resource</span>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-primary, #0f172a)' }}>
                    {selectedLog.resourceType} {selectedLog.resourceId ? `(${selectedLog.resourceId})` : ''}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary, #64748b)', display: 'block', marginBottom: 2 }}>Outcome</span>
                  <div>{getOutcomeBadge(selectedLog.outcome)}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary, #64748b)', display: 'block', marginBottom: 2 }}>Correlation ID</span>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: '#475569', wordBreak: 'break-all' }}>
                    {selectedLog.correlationId ?? 'None'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary, #64748b)', display: 'block', marginBottom: 2 }}>Timestamp (UTC)</span>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', color: '#475569' }}>
                    {formatUtcDate(selectedLog.timestamp)}
                  </span>
                </div>
              </div>

              {selectedLog.reason && (
                <div
                  style={{
                    padding: 12,
                    background: 'var(--color-slate-50, #f8fafc)',
                    border: '1px solid var(--border-default, #e2e8f0)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontWeight: 700, color: 'var(--text-primary, #0f172a)', display: 'block', marginBottom: 4 }}>
                    Reason / Rationale Context:
                  </span>
                  <p style={{ color: 'var(--text-secondary, #475569)', margin: 0 }}>{selectedLog.reason}</p>
                </div>
              )}

              {selectedLog.detailsJson && (
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #0f172a)', display: 'block', marginBottom: 6 }}>
                    Event Payload (Sanitized)
                  </span>
                  <pre
                    style={{
                      padding: 14,
                      background: '#0f172a',
                      color: '#34d399',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 11,
                      borderRadius: 8,
                      overflowX: 'auto',
                      maxHeight: 220,
                    }}
                  >
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedLog.detailsJson), null, 2);
                      } catch {
                        return selectedLog.detailsJson;
                      }
                    })()}
                  </pre>
                </div>
              )}

              {selectedLog.beforeStateJson && (
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #0f172a)', display: 'block', marginBottom: 6 }}>
                    Pre-Mutation State
                  </span>
                  <pre
                    style={{
                      padding: 14,
                      background: '#1c1917',
                      color: '#fde047',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 11,
                      borderRadius: 8,
                      overflowX: 'auto',
                      maxHeight: 180,
                    }}
                  >
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedLog.beforeStateJson), null, 2);
                      } catch {
                        return selectedLog.beforeStateJson;
                      }
                    })()}
                  </pre>
                </div>
              )}

              {selectedLog.afterStateJson && (
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #0f172a)', display: 'block', marginBottom: 6 }}>
                    Post-Mutation State
                  </span>
                  <pre
                    style={{
                      padding: 14,
                      background: '#0f172a',
                      color: '#38bdf8',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 11,
                      borderRadius: 8,
                      overflowX: 'auto',
                      maxHeight: 180,
                    }}
                  >
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedLog.afterStateJson), null, 2);
                      } catch {
                        return selectedLog.afterStateJson;
                      }
                    })()}
                  </pre>
                </div>
              )}

              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--color-primary-50, #f0fdfa)',
                  border: '1px solid var(--color-primary-200, #99f6e4)',
                  borderRadius: 8,
                  fontSize: 11,
                  color: 'var(--color-primary-800, #115e59)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontWeight: 600 }}>GxP Verified Immutable Audit Record</span>
                <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10 }}>SHA-256 Non-Repudiation Guaranteed</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border-default, #e2e8f0)',
                background: 'var(--color-slate-50, #f8fafc)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="btn btn-secondary"
                style={{
                  padding: '8px 18px',
                  fontSize: 12,
                  fontWeight: 600,
                  background: '#0f172a',
                  color: '#ffffff',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditConsolePage;
