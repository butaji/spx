/**
 * Wraps an async function with exponential backoff for 429 rate limits.
 * Respects the Retry-After header from Spotify.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    onRetry?: (attempt: number, delayMs: number, reason: string) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 3, onRetry } = options;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      // Only retry on 429 or 5xx errors
      const status = error?.statusCode || error?.status || error?.response?.status;
      const retryAfter = error?.headers?.['Retry-After'] || error?.response?.headers?.['Retry-After'];
      
      const isRateLimited = status === 429;
      const isServerError = status >= 500 && status < 600;
      
      if (!isRateLimited && !isServerError) {
        throw error; // Don't retry non-retryable errors
      }
      
      if (attempt === maxRetries) {
        throw error; // Max retries reached
      }
      
      // Calculate delay
      let delayMs: number;
      if (retryAfter) {
        // Respect Retry-After header (seconds)
        delayMs = parseInt(retryAfter, 10) * 1000;
        if (isNaN(delayMs)) {
          // Could be HTTP-date format - fallback to exponential
          delayMs = Math.min(1000 * Math.pow(2, attempt), 16000);
        }
      } else {
        // Exponential backoff: 1s, 2s, 4s, 8s, ...
        delayMs = Math.min(1000 * Math.pow(2, attempt), 16000);
      }
      
      const reason = isRateLimited ? '429 Rate limited' : `${status} Server error`;
      onRetry?.(attempt + 1, delayMs, reason);
      console.warn(`[Retry] ${reason}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw new Error('Unexpected retry exhaustion');
}
