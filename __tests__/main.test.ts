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
      status: 'QUEUED'
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
        case 'forking-strategy':
          return 'now'
        case 'timestamp':
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

    // Verify output was set
    expect(core.setOutput).toHaveBeenCalledWith(
      'service_id',
      'forked-service-123'
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
        case 'forking-strategy':
          return 'last-snapshot'
        case 'timestamp':
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
        case 'forking-strategy':
          return 'timestamp'
        case 'timestamp':
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

  it('Fails when timestamp is missing for "timestamp" strategy', async () => {
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'project_id':
          return 'project-456'
        case 'service_id':
          return 'service-789'
        case 'api_key':
          return 'public-key:secret-key'
        case 'forking-strategy':
          return 'timestamp'
        case 'timestamp':
          return ''
        default:
          return ''
      }
    })

    await run()

    // Verify action failed with appropriate error
    expect(core.setFailed).toHaveBeenCalledWith(
      'timestamp input is required when using "timestamp" forking strategy'
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
        case 'forking-strategy':
          return 'invalid-strategy'
        case 'timestamp':
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
        case 'forking-strategy':
          return 'now'
        case 'timestamp':
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
        case 'forking-strategy':
          return 'now'
        case 'timestamp':
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

  it('Warns when timestamp is provided but not using timestamp strategy', async () => {
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'project_id':
          return 'project-456'
        case 'service_id':
          return 'service-789'
        case 'api_key':
          return 'public-key:secret-key'
        case 'forking-strategy':
          return 'now'
        case 'timestamp':
          return '2025-10-01T15:29:00Z'
        default:
          return ''
      }
    })

    await run()

    // Verify warning was issued
    expect(core.warning).toHaveBeenCalledWith(
      'timestamp input is ignored when not using "timestamp" forking strategy'
    )

    // Verify fork was still successful
    expect(core.setFailed).not.toHaveBeenCalled()
    expect(mockForkService).toHaveBeenCalledWith(
      'project-456',
      'service-789',
      { fork_strategy: 'NOW' }, // timestamp should not be in the request
      'public-key:secret-key'
    )
  })
})
