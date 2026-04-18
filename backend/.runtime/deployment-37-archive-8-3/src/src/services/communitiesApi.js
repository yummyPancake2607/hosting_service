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

export async function fetchCommunities(search, accessToken) {
  const response = await apiClient.get("/communities", {
    ...authConfig(accessToken),
    params: {
      search: search || "",
    },
  });

  return response.data?.items || [];
}

export async function createCommunity(payload, accessToken) {
  const response = await apiClient.post("/communities", payload, authConfig(accessToken));
  return response.data;
}

export async function joinCommunity(communityId, accessToken) {
  const response = await apiClient.post(
    `/communities/${communityId}/join`,
    {},
    authConfig(accessToken),
  );
  return response.data;
}

export async function leaveCommunity(communityId, accessToken) {
  const response = await apiClient.post(
    `/communities/${communityId}/leave`,
    {},
    authConfig(accessToken),
  );
  return response.data;
}

export async function deleteCommunity(communityId, accessToken) {
  const response = await apiClient.delete(
    `/communities/${communityId}`,
    authConfig(accessToken),
  );
  return response.data;
}

export async function fetchCommunityMembers(communityId, accessToken) {
  const response = await apiClient.get(
    `/communities/${communityId}/members`,
    authConfig(accessToken),
  );
  return response.data?.items || [];
}

export async function kickCommunityMember(communityId, userId, reason, accessToken) {
  const response = await apiClient.post(
    `/communities/${communityId}/kick`,
    {
      user_id: userId,
      reason: reason || null,
    },
    authConfig(accessToken),
  );
  return response.data;
}
