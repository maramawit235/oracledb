export interface TablespaceMetric {
  name: string;
  used_pct: number;
  free_mb: number;
  total_mb: number;
}

export interface WaitEventMetric {
  event_name: string;
  wait_count: number;
  total_wait_time_ms: number;
}

export interface BlockedSessionMetric {
  blocked_sid: number;
  blocking_sid: number;
  wait_event: string;
  sec_in_wait: number;
}

export interface RuleResultData {
  rule_id: string;
  rule_name: string;
  metric_type: string;
  current_value: number;
  unit: string;
  warning_threshold: number;
  critical_threshold: number;
  weight: number;
  severity: "OK" | "WARNING" | "CRITICAL";
  recommendation: string;
  message: string;
}

export interface HealthReportData {
  health_score: number;
  status: "HEALTHY" | "DEGRADED" | "CRITICAL";
  evaluated_at: string;
  total_rules: number;
  warning_count: number;
  critical_count: number;
  rule_results: RuleResultData[];
  provider_mode?: string;
  active_provider?: string;
  scenario?: string;
}

export interface VerificationRow {
  label: string;
  direct_sql: number;
  exporter_text: number;
  promql_api: number;
  app_provider: number;
  tolerance: number;
  status: "PASS" | "FAIL";
}

export interface ProjectFile {
  name: string;
  path: string;
  type: string;
  category: string;
  content: string;
}
