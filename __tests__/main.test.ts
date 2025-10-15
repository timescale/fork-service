/**
 * Unit tests for the action's main functionality, src/main.ts
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

// Mock the API module
const mockForkService = jest.fn()
const mockGetService = jest.fn()
const mockDeleteService = jest.fn()

jest.unstable_mockModule('../src/api.js', () => ({
  forkService: mockForkService,
  getService: mockGetService,
  deleteService: mockDeleteService
}))

// Mock the poll module
const mockWaitForServiceReady = jest.fn()

jest.unstable_mockModule('../src/poll.js', () => ({
  waitForServiceReady: mockWaitForServiceReady
}))

// Mock @actions/core
jest.unstable_mockModule('@actions/core', () => core)

// Import the module being tested after mocks are set up
const { run } = await import('../src/main.js')

describe('main.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Default mock implementations
    mockForkService.mockResolvedValue({
      service_id: 'forked-service-123',
      project_id: 'project-456',
      name: 'test-fork',
      region_code: 'us-east-1',
      status: 'QUEUED',
      endpoint: {
        host: 'test-fork.timescaledb.io',
        port: 5432
      },
      initial_password: 'test-password-123'
    })

    mockWaitForServiceReady.mockResolvedValue(undefined)
  })

  it('Successfully forks a service with "now" strategy', async () => {
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'project_id':
          return 'project-456'
        case 'service_id':
          return 'service-789'
        case 'api_key':
          return 'public-key:secret-key'
        case 'fork_strategy':
          return 'now'
        case 'target_time':
          return ''
        default:
          return ''
      }
    })

    await run()

    // Verify forkService was called with correct parameters
    expect(mockForkService).toHaveBeenCalledWith(
      'project-456',
      'service-789',
      { fork_strategy: 'NOW' },
      'public-key:secret-key'
    )

    // Verify waitForServiceReady was called
    expect(mockWaitForServiceReady).toHaveBeenCalledWith(
      'project-456',
      'forked-service-123',
      'public-key:secret-key'
    )

    // Verify all outputs were set
    expect(core.setOutput).toHaveBeenCalledWith(
      'service_id',
      'forked-service-123'
    )
    expect(core.setOutput).toHaveBeenCalledWith('name', 'test-fork')
    expect(core.setOutput).toHaveBeenCalledWith(
      'host',
      'test-fork.timescaledb.io'
    )
    expect(core.setOutput).toHaveBeenCalledWith('port', '5432')
    expect(core.setOutput).toHaveBeenCalledWith(
      'initial_password',
      'test-password-123'
    )

    // Verify no failures
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('Successfully forks a service with "last-snapshot" strategy', async () => {
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'project_id':
          return 'project-456'
        case 'service_id':
          return 'service-789'
        case 'api_key':
          return 'public-key:secret-key'
        case 'fork_strategy':
          return 'last-snapshot'
        case 'target_time':
          return ''
        default:
          return ''
      }
    })

    await run()

    // Verify forkService was called with LAST_SNAPSHOT strategy
    expect(mockForkService).toHaveBeenCalledWith(
      'project-456',
      'service-789',
      { fork_strategy: 'LAST_SNAPSHOT' },
      'public-key:secret-key'
    )

    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('Successfully forks a service with "timestamp" strategy and target_time', async () => {
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'project_id':
          return 'project-456'
        case 'service_id':
          return 'service-789'
        case 'api_key':
          return 'public-key:secret-key'
        case 'fork_strategy':
          return 'timestamp'
        case 'target_time':
          return '2025-10-01T15:29:00Z'
        default:
          return ''
      }
    })

    await run()

    // Verify forkService was called with PITR strategy and target_time
    expect(mockForkService).toHaveBeenCalledWith(
      'project-456',
      'service-789',
      {
        fork_strategy: 'PITR',
        target_time: '2025-10-01T15:29:00Z'
      },
      'public-key:secret-key'
    )

    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('Fails when target_time is missing for "timestamp" strategy', async () => {
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'project_id':
          return 'project-456'
        case 'service_id':
          return 'service-789'
        case 'api_key':
          return 'public-key:secret-key'
        case 'fork_strategy':
          return 'timestamp'
        case 'target_time':
          return ''
        default:
          return ''
      }
    })

    await run()

    // Verify action failed with appropriate error
    expect(core.setFailed).toHaveBeenCalledWith(
      'target_time input is required when using "timestamp" forking strategy'
    )

    // Verify forkService was not called
    expect(mockForkService).not.toHaveBeenCalled()
  })

  it('Fails when using invalid forking strategy', async () => {
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'project_id':
          return 'project-456'
        case 'service_id':
          return 'service-789'
        case 'api_key':
          return 'public-key:secret-key'
        case 'fork_strategy':
          return 'invalid-strategy'
        case 'target_time':
          return ''
        default:
          return ''
      }
    })

    await run()

    // Verify action failed
    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Invalid forking strategy')
    )

    // Verify forkService was not called
    expect(mockForkService).not.toHaveBeenCalled()
  })

  it('Fails when forkService API call fails', async () => {
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'project_id':
          return 'project-456'
        case 'service_id':
          return 'service-789'
        case 'api_key':
          return 'public-key:secret-key'
        case 'fork_strategy':
          return 'now'
        case 'target_time':
          return ''
        default:
          return ''
      }
    })

    // Mock API failure
    mockForkService.mockRejectedValue(new Error('API Error: Unauthorized'))

    await run()

    // Verify action failed with API error
    expect(core.setFailed).toHaveBeenCalledWith('API Error: Unauthorized')

    // Verify waitForServiceReady was not called
    expect(mockWaitForServiceReady).not.toHaveBeenCalled()
  })

  it('Fails when polling times out', async () => {
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'project_id':
          return 'project-456'
        case 'service_id':
          return 'service-789'
        case 'api_key':
          return 'public-key:secret-key'
        case 'fork_strategy':
          return 'now'
        case 'target_time':
          return ''
        default:
          return ''
      }
    })

    // Mock polling timeout
    mockWaitForServiceReady.mockRejectedValue(
      new Error('Timeout: Service did not become ready')
    )

    await run()

    // Verify action failed with timeout error
    expect(core.setFailed).toHaveBeenCalledWith(
      'Timeout: Service did not become ready'
    )
  })

  it('Warns when target_time is provided but not using timestamp strategy', async () => {
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'project_id':
          return 'project-456'
        case 'service_id':
          return 'service-789'
        case 'api_key':
          return 'public-key:secret-key'
        case 'fork_strategy':
          return 'now'
        case 'target_time':
          return '2025-10-01T15:29:00Z'
        default:
          return ''
      }
    })

    await run()

    // Verify warning was issued
    expect(core.warning).toHaveBeenCalledWith(
      'target_time input is ignored when not using "timestamp" forking strategy'
    )

    // Verify fork was still successful
    expect(core.setFailed).not.toHaveBeenCalled()
    expect(mockForkService).toHaveBeenCalledWith(
      'project-456',
      'service-789',
      { fork_strategy: 'NOW' }, // target_time should not be in the request
      'public-key:secret-key'
    )
  })

  it('Successfully forks a service with custom name', async () => {
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'project_id':
          return 'project-456'
        case 'service_id':
          return 'service-789'
        case 'api_key':
          return 'public-key:secret-key'
        case 'fork_strategy':
          return 'now'
        case 'name':
          return 'my-custom-fork-name'
        default:
          return ''
      }
    })

    await run()

    // Verify forkService was called with custom name
    expect(mockForkService).toHaveBeenCalledWith(
      'project-456',
      'service-789',
      {
        fork_strategy: 'NOW',
        name: 'my-custom-fork-name'
      },
      'public-key:secret-key'
    )

    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('Successfully forks a service with custom cpu_millis', async () => {
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'project_id':
          return 'project-456'
        case 'service_id':
          return 'service-789'
        case 'api_key':
          return 'public-key:secret-key'
        case 'fork_strategy':
          return 'now'
        case 'cpu_millis':
          return '2000'
        default:
          return ''
      }
    })

    await run()

    // Verify forkService was called with custom cpu_millis
    expect(mockForkService).toHaveBeenCalledWith(
      'project-456',
      'service-789',
      {
        fork_strategy: 'NOW',
        cpu_millis: '2000'
      },
      'public-key:secret-key'
    )

    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('Successfully forks a service with custom memory_gbs', async () => {
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'project_id':
          return 'project-456'
        case 'service_id':
          return 'service-789'
        case 'api_key':
          return 'public-key:secret-key'
        case 'fork_strategy':
          return 'now'
        case 'memory_gbs':
          return '8'
        default:
          return ''
      }
    })

    await run()

    // Verify forkService was called with custom memory_gbs
    expect(mockForkService).toHaveBeenCalledWith(
      'project-456',
      'service-789',
      {
        fork_strategy: 'NOW',
        memory_gbs: '8'
      },
      'public-key:secret-key'
    )

    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('Successfully forks a service with shared resources (free tier)', async () => {
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'project_id':
          return 'project-456'
        case 'service_id':
          return 'service-789'
        case 'api_key':
          return 'public-key:secret-key'
        case 'fork_strategy':
          return 'now'
        case 'cpu_millis':
          return 'shared'
        case 'memory_gbs':
          return 'shared'
        default:
          return ''
      }
    })

    await run()

    // Verify forkService was called with shared resources
    expect(mockForkService).toHaveBeenCalledWith(
      'project-456',
      'service-789',
      {
        fork_strategy: 'NOW',
        cpu_millis: 'shared',
        memory_gbs: 'shared'
      },
      'public-key:secret-key'
    )

    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('Successfully forks a service with all optional parameters', async () => {
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'project_id':
          return 'project-456'
        case 'service_id':
          return 'service-789'
        case 'api_key':
          return 'public-key:secret-key'
        case 'fork_strategy':
          return 'timestamp'
        case 'target_time':
          return '2025-10-01T15:29:00Z'
        case 'name':
          return 'complete-fork'
        case 'cpu_millis':
          return '4000'
        case 'memory_gbs':
          return '16'
        default:
          return ''
      }
    })

    await run()

    // Verify forkService was called with all parameters
    expect(mockForkService).toHaveBeenCalledWith(
      'project-456',
      'service-789',
      {
        fork_strategy: 'PITR',
        target_time: '2025-10-01T15:29:00Z',
        name: 'complete-fork',
        cpu_millis: '4000',
        memory_gbs: '16'
      },
      'public-key:secret-key'
    )

    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('Omits optional parameters when not provided', async () => {
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'project_id':
          return 'project-456'
        case 'service_id':
          return 'service-789'
        case 'api_key':
          return 'public-key:secret-key'
        case 'fork_strategy':
          return 'now'
        default:
          return ''
      }
    })

    await run()

    // Verify forkService was called with only required parameters
    // Optional parameters should not be present in the request object
    expect(mockForkService).toHaveBeenCalledWith(
      'project-456',
      'service-789',
      { fork_strategy: 'NOW' },
      'public-key:secret-key'
    )

    expect(core.setFailed).not.toHaveBeenCalled()
  })
})
