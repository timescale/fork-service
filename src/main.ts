import * as core from '@actions/core'
import { forkService } from './api.js'
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

    // Set output for other workflow steps to use
    core.setOutput('service_id', forkedService.service_id)

    core.info(
      `Fork operation completed successfully! Forked service ID: ${forkedService.service_id}`
    )
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed(String(error))
    }
  }
}
