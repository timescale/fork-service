/**
 * API client for TigerData Cloud API
 */
import type { ForkServiceRequest, Service, ApiError } from './types.js'

const API_BASE_URL = 'https://console.cloud.timescale.com/public/api/v1'

/**
 * Creates the Authorization header for API requests
 * The API key should be in format "publicKey:secretKey"
 * It is Base64 encoded and sent with the Basic scheme
 *
 * @param apiKey - The API key in format "publicKey:secretKey"
 * @returns The Authorization header value
 */
export function createAuthHeader(apiKey: string): string {
  const encoded = Buffer.from(apiKey).toString('base64')
  return `Basic ${encoded}`
}

/**
 * Makes an authenticated API request
 *
 * @param endpoint - The API endpoint (relative to base URL)
 * @param apiKey - The API key for authentication
 * @param options - Additional fetch options
 * @returns The response data
 * @throws Error if the request fails
 */
async function makeRequest<T>(
  endpoint: string,
  apiKey: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const method = options.method || 'GET'
  const headers = {
    Authorization: createAuthHeader(apiKey),
    'Content-Type': 'application/json',
    ...options.headers
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      headers
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Network request failed for ${method} ${url}: ${errorMessage}. ` +
        `Please check your network connection and verify the API endpoint is accessible.`
    )
  }

  // Handle non-2xx responses
  if (!response.ok) {
    let errorMessage = `API request failed: ${method} ${url} returned ${response.status} ${response.statusText}`

    // Read the response body once as text
    try {
      const responseText = await response.text()
      if (responseText) {
        // Try to parse as JSON
        try {
          const errorData = JSON.parse(responseText) as ApiError
          if (errorData.message) {
            errorMessage = `API Error (${errorData.code || response.status}): ${errorData.message}`
          }
        } catch {
          // Not JSON, include the raw text
          errorMessage += `\nResponse: ${responseText.substring(0, 500)}`
        }
      }
    } catch {
      // If we can't read the response, use the default message
    }

    throw new Error(errorMessage)
  }

  // Read response body as text first
  const responseText = await response.text()

  // Handle empty responses (202/204 typically)
  if (!responseText) {
    return {} as T
  }

  // Parse as JSON
  return JSON.parse(responseText) as T
}

/**
 * Forks a service
 *
 * @param projectId - The project ID
 * @param serviceId - The service ID to fork
 * @param request - The fork request parameters
 * @param apiKey - The API key for authentication
 * @returns The newly created service
 */
export async function forkService(
  projectId: string,
  serviceId: string,
  request: ForkServiceRequest,
  apiKey: string
): Promise<Service> {
  const endpoint = `/projects/${projectId}/services/${serviceId}/forkService`

  return makeRequest<Service>(endpoint, apiKey, {
    method: 'POST',
    body: JSON.stringify(request)
  })
}

/**
 * Gets the status of a service
 *
 * @param projectId - The project ID
 * @param serviceId - The service ID to check
 * @param apiKey - The API key for authentication
 * @returns The service details
 */
export async function getService(
  projectId: string,
  serviceId: string,
  apiKey: string
): Promise<Service> {
  const endpoint = `/projects/${projectId}/services/${serviceId}`

  return makeRequest<Service>(endpoint, apiKey, {
    method: 'GET'
  })
}
