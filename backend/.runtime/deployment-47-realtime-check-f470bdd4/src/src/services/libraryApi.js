import { apiClient } from "./apiClient";

function authConfig(accessToken) {
  if (!accessToken) {
    return undefined;
  }

  return {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}

export async function fetchMyLibrary(accessToken) {
  const response = await apiClient.get("/library/me", authConfig(accessToken));
  return response.data?.items || [];
}

export async function upsertLibraryEntry(payload, accessToken) {
  const response = await apiClient.post(
    "/library/entry",
    payload,
    authConfig(accessToken),
  );
  return response.data;
}

export async function deleteLibraryEntry(gameKey, accessToken) {
  await apiClient.delete(
    `/library/entry/${encodeURIComponent(gameKey)}`,
    authConfig(accessToken),
  );
}
