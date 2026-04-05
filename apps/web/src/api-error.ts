type ApiErrorResponse = {
  error: {
    message: string;
  };
};

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false;
  }

  const errorValue = value.error;

  return (
    typeof errorValue === 'object' &&
    errorValue !== null &&
    'message' in errorValue &&
    typeof errorValue.message === 'string'
  );
}

export async function readApiErrorMessage(
  response: Response,
  fallbackMessage: string,
) {
  try {
    const responseBody = (await response.json()) as unknown;

    if (isApiErrorResponse(responseBody)) {
      return responseBody.error.message;
    }
  } catch {
    return fallbackMessage;
  }

  return fallbackMessage;
}
