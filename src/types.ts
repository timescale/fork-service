/**
 * TypeScript types for TigerData API
 * Based on the OpenAPI specification
 */

/**
 * Fork strategy types
 */
export type ForkStrategy = 'LAST_SNAPSHOT' | 'NOW' | 'PITR'

/**
 * Service deployment status
 */
export type DeployStatus =
  | 'QUEUED'
  | 'DELETING'
  | 'CONFIGURING'
  | 'READY'
  | 'DELETED'
  | 'UNSTABLE'
  | 'PAUSING'
  | 'PAUSED'
  | 'RESUMING'
  | 'UPGRADING'
  | 'OPTIMIZING'

/**
 * Request body for forking a service
 */
export interface ForkServiceRequest {
  fork_strategy: ForkStrategy
  name?: string
  cpu_millis?: string
  memory_gbs?: string
  target_time?: string
}

/**
 * Endpoint information
 */
export interface Endpoint {
  host: string
  port: number
}

/**
 * Service response from API
 */
export interface Service {
  service_id: string
  project_id: string
  name: string
  region_code: string
  created?: string
  initial_password?: string
  paused?: boolean
  status: DeployStatus
  endpoint?: Endpoint
  [key: string]: unknown
}

/**
 * API Error response
 */
export interface ApiError {
  code: string
  message: string
}
