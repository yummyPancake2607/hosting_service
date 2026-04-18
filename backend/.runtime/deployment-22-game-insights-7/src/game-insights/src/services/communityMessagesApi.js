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

export async function fetchCommunityMessages(communityId, accessToken) {
  const response = await apiClient.get(
    `/communities/${communityId}/messages`,
    authConfig(accessToken),
  );
  return response.data?.items || [];
}

export async function postCommunityMessage(communityId, content, accessToken) {
  const response = await apiClient.post(
    `/communities/${communityId}/messages`,
    { content },
    authConfig(accessToken),
  );
  return response.data;
}
