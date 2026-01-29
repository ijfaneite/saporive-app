import { AppError } from '@/lib/types';

export type Result<T, E = AppError> =
  | { success: true; value: T }
  | { success: false; error: E };

export const success = <T>(value: T): Result<T, never> => ({
  success: true,
  value,
});

export const failure = <E extends AppError>(error: E): Result<never, E> => ({
  success: false,
  error,
});

/**
 * A wrapper for the native fetch API that returns a Result object.
 * This handles network errors and non-ok HTTP responses.
 */
export async function safeFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Result<T, AppError>> {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      let errorBody: { detail?: string } = {};
      try {
        errorBody = await response.json();
      } catch (e) {
        // Response is not JSON or empty
        errorBody = { detail: response.statusText };
      }
      
      const errorMessage =
        errorBody.detail || `Request failed with status ${response.status}`;

      if (response.status === 401) {
        return failure(new AppError('Sesión expirada o no autorizada.', response.status, errorBody));
      }
      
      return failure(new AppError(errorMessage, response.status, errorBody));
    }

    // Handle cases with no content (e.g., 204 No Content)
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        return success(null as T);
    }

    const data = await response.json();
    return success(data as T);
  } catch (error) {
    if (error instanceof Error) {
        return failure(new AppError(`Error de red: ${error.message}`, 'NETWORK_ERROR', error));
    }
    return failure(new AppError('Ocurrió un error de red desconocido.', 'UNKNOWN_NETWORK_ERROR', error));
  }
}
