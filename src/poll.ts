/**
 * Polling utilities for waiting on asynchronous operations
 */
import * as core from '@actions/core'
import { getService } from './api.js'
import type { DeployStatus } from './types.js'

/**
 * Terminal states that indicate the service will not become ready
 */
const TERMINAL_ERROR_STATES: DeployStatus[] = ['DELETED', 'UNSTABLE']

/**
 * Sleep for a specified number of milliseconds
 *
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Waits for a forked service to be ready
 *
 * @param projectId - The project ID
 * @param serviceId - The service ID to poll
 * @param apiKey - The API key for authentication
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 30 minutes)
 * @param intervalMs - Polling interval in milliseconds (default: 1 second)
 * @param logIntervalMs - Log status updates every N milliseconds (default: 10 seconds)
 * @returns The service when it's ready
 * @throws Error if timeout is reached or service enters an error state
 */
export async function waitForServiceReady(
  projectId: string,
  serviceId: string,
  apiKey: string,
  timeoutMs: number = 30 * 60 * 1000, // 30 minutes default
  intervalMs: number = 1 * 1000, // 1 second default
  logIntervalMs: number = 10 * 1000 // Log every 10 seconds
): Promise<void> {
  const startTime = Date.now()
  let nextLogTime = startTime + logIntervalMs

  core.info(
    `Waiting for service ${serviceId} to be ready (timeout: ${timeoutMs / 1000}s)...`
  )

  while (true) {
    const now = Date.now()
    const elapsed = Math.round((now - startTime) / 1000)

    // Check timeout
    if (now - startTime > timeoutMs) {
      throw new Error(
        `Timeout: Service ${serviceId} did not become ready within ${timeoutMs / 1000} seconds`
      )
    }

    try {
      const service = await getService(projectId, serviceId, apiKey)

      core.debug(
        `Service ${serviceId} status: ${service.status} (elapsed: ${elapsed}s)`
      )

      // Check if service is ready
      if (service.status === 'READY') {
        core.info(`Service ${serviceId} is ready! (took ${elapsed}s)`)
        return
      }

      // Check for terminal error states
      if (TERMINAL_ERROR_STATES.includes(service.status)) {
        throw new Error(
          `Service ${serviceId} entered terminal state: ${service.status}`
        )
      }

      // Log status at regular intervals based on elapsed time from start
      if (Date.now() >= nextLogTime) {
        core.info(
          `Service ${serviceId} status: ${service.status}. Still waiting... (elapsed: ${elapsed}s)`
        )
        nextLogTime += logIntervalMs
      }

      await sleep(intervalMs)
    } catch (error) {
      // If it's already our error, rethrow it
      if (error instanceof Error && error.message.includes('terminal state')) {
        throw error
      }
      if (error instanceof Error && error.message.includes('Timeout')) {
        throw error
      }

      // For API errors, log and retry (the service might be temporarily unavailable)
      core.warning(
        `Error checking service status: ${error instanceof Error ? error.message : String(error)}. Will retry...`
      )
      await sleep(intervalMs)
    }
  }
}
