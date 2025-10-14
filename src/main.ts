import * as core from '@actions/core'
import { forkService, deleteService } from './api.js'
import { waitForServiceReady } from './poll.js'
import type { ForkStrategy, ForkServiceRequest } from './types.js'

/**
 * Maps the user-friendly forking strategy from action.yml to the API enum
 *
 * @param strategy - The strategy from action input (now, last-snapshot, timestamp)
 * @returns The API fork strategy enum
 */
function mapForkStrategy(strategy: string): ForkStrategy {
  switch (strategy.toLowerCase()) {
    case 'now':
      return 'NOW'
    case 'last-snapshot':
      return 'LAST_SNAPSHOT'
    case 'timestamp':
      return 'PITR'
    default:
      throw new Error(
        `Invalid forking strategy: ${strategy}. Must be one of: now, last-snapshot, timestamp`
      )
  }
}

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // Get inputs from action.yml
    const projectId: string = core.getInput('project_id', { required: true })
    const serviceId: string = core.getInput('service_id', { required: true })
    const apiKey: string = core.getInput('api_key', { required: true })
    const forkingStrategy: string = core.getInput('forking-strategy', {
      required: true
    })
    const timestamp: string = core.getInput('timestamp', { required: false })

    core.info(`Starting fork operation for service ${serviceId}...`)
    core.info(`Fork strategy: ${forkingStrategy}`)

    // Map the forking strategy to API enum
    const forkStrategy = mapForkStrategy(forkingStrategy)

    // Build the fork request
    const forkRequest: ForkServiceRequest = {
      fork_strategy: forkStrategy
    }

    // Add optional parameters if provided
    const name = core.getInput('name', { required: false })
    if (name) {
      forkRequest.name = name
    }

    const cpuMillisStr = core.getInput('cpu_millis', { required: false })
    if (cpuMillisStr) {
      const cpuMillis = parseInt(cpuMillisStr, 10)
      if (!isNaN(cpuMillis)) {
        forkRequest.cpu_millis = cpuMillis
      }
    }

    const memoryGbsStr = core.getInput('memory_gbs', { required: false })
    if (memoryGbsStr) {
      const memoryGbs = parseInt(memoryGbsStr, 10)
      if (!isNaN(memoryGbs)) {
        forkRequest.memory_gbs = memoryGbs
      }
    }

    const freeStr = core.getInput('free', { required: false })
    core.info(`DEBUG: free input value: "${freeStr}" (type: ${typeof freeStr})`)
    if (freeStr) {
      forkRequest.free = freeStr.toLowerCase() === 'true'
    }

    core.info(
      `DEBUG: Fork request body: ${JSON.stringify(forkRequest, null, 2)}`
    )

    // If using PITR strategy, timestamp is required
    if (forkStrategy === 'PITR') {
      if (!timestamp) {
        throw new Error(
          'timestamp input is required when using "timestamp" forking strategy'
        )
      }
      forkRequest.target_time = timestamp
      core.info(`Using target time: ${timestamp}`)
    } else if (timestamp) {
      // Warn if timestamp is provided but not using PITR
      core.warning(
        'timestamp input is ignored when not using "timestamp" forking strategy'
      )
    }

    // Call the fork API
    core.info('Calling fork service API...')
    const forkedService = await forkService(
      projectId,
      serviceId,
      forkRequest,
      apiKey
    )

    core.info(
      `Fork initiated successfully! New service ID: ${forkedService.service_id}`
    )
    core.info(`Initial status: ${forkedService.status}`)

    // Wait for the forked service to be ready
    core.info('Waiting for forked service to be ready...')
    await waitForServiceReady(projectId, forkedService.service_id, apiKey)

    // Set outputs for other workflow steps to use
    core.setOutput('service_id', forkedService.service_id)

    // Set connection information outputs
    if (forkedService.endpoint) {
      core.setOutput('host', forkedService.endpoint.host)
      core.setOutput('port', forkedService.endpoint.port.toString())
    }

    if (forkedService.initial_password) {
      // Mask the password in logs
      core.setSecret(forkedService.initial_password)
      core.setOutput('initial_password', forkedService.initial_password)
    }

    core.info(
      `Fork operation completed successfully! Forked service ID: ${forkedService.service_id}`
    )

    if (forkedService.endpoint) {
      core.info(
        `Connection: ${forkedService.endpoint.host}:${forkedService.endpoint.port}`
      )
    }

    // Save state for post-action cleanup
    const cleanup = core.getInput('cleanup', { required: false }) || 'false'
    if (cleanup.toLowerCase() === 'true') {
      core.saveState('forked_service_id', forkedService.service_id)
      core.saveState('project_id', projectId)
      core.saveState('api_key', apiKey)
      core.saveState('cleanup', 'true')
      core.info(
        'Cleanup is enabled. Service will be deleted after workflow completes.'
      )
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed(String(error))
    }
  }
}

/**
 * The post function for the action.
 * This runs after the workflow completes to clean up resources.
 *
 * @returns Resolves when cleanup is complete.
 */
export async function post(): Promise<void> {
  try {
    // Check if cleanup is enabled
    const cleanup = core.getState('cleanup')
    if (cleanup !== 'true') {
      core.info('Cleanup not enabled, skipping service deletion.')
      return
    }

    // Retrieve saved state
    const forkedServiceId = core.getState('forked_service_id')
    const projectId = core.getState('project_id')
    const apiKey = core.getState('api_key')

    if (!forkedServiceId || !projectId || !apiKey) {
      core.warning(
        'Missing required state for cleanup. Skipping service deletion.'
      )
      return
    }

    core.info(`Cleaning up forked service: ${forkedServiceId}`)

    // Delete the forked service
    await deleteService(projectId, forkedServiceId, apiKey)

    core.info(`Successfully deleted forked service: ${forkedServiceId}`)
  } catch (error) {
    // Don't fail the workflow if cleanup fails, just warn
    if (error instanceof Error) {
      core.warning(`Failed to cleanup forked service: ${error.message}`)
    } else {
      core.warning(`Failed to cleanup forked service: ${String(error)}`)
    }
  }
}
