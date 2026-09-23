export interface Problem {
  code: string;
  message: string;
  correlation_id?: string;
}

// Bootstrap is a temporary foundation endpoint shape, not a v1 native-host
// contract. The authenticated workspace slice must replace it with validated
// canonical snapshot/error families rather than promoting it into contracts/v1.
export interface Bootstrap {
  schema_version: 1;
  state: "authenticated" | "authentication_required" | "daemon_unavailable";
  server_label: string;
  problem?: Problem;
}
