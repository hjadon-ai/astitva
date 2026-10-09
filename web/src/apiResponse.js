// Keep HTML error pages (for example, an older server's missing route) out of JSON parsing errors shown to users.
export async function readApiJson(response, path) {
  try {
    return await response.json();
  } catch {
    const bodyGoals = path.startsWith('/api/diet/body-goals');
    const error = new Error(bodyGoals && response.status === 404
      ? 'Body & Goals needs the updated server. Restart the local server, then reload saved data.'
      : 'The API returned an unreadable response. Check that the server is running and the API address is correct, then retry.');
    error.status = response.status;
    error.code = 'INVALID_API_RESPONSE';
    throw error;
  }
}
