import { apiClient, getCachedGetData } from "./apiClient";

const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='800' viewBox='0 0 600 800'%3E%3Crect width='600' height='800' fill='%23121824'/%3E%3Ctext x='50%25' y='50%25' fill='%23cbd5e1' font-size='28' text-anchor='middle' dominant-baseline='middle'%3ENo Cover%3C/text%3E%3C/svg%3E";

function improveIgdbCover(url) {
  if (!url) {
    return FALLBACK_IMAGE;
  }

  // Use a larger IGDB image size for sharper posters.
  return url
    .replace("/t_thumb/", "/t_cover_big/")
    .replace("/t_cover_small/", "/t_cover_big/");
}

function toGameModel(raw) {
  return {
    id: raw.id,
    slug: raw.slug || String(raw.id),
    key: raw.slug || String(raw.id),
    name: raw.name,
    coverImage: improveIgdbCover(raw.cover_image),
    steamUrl: raw.steam_url || null,
    steamAppId: raw.steam_app_id || null,
    genres: raw.genres || [],
    releaseDate: raw.release_date || "Unknown",
    rating: typeof raw.rating === "number" ? raw.rating : null,
    ratingCount: raw.rating_count || 0,
    description: raw.description || "No description available yet.",
    externalUrl: raw.external_url || null,
    developer: raw.developer || null,
    publisher: raw.publisher || null,
    platforms: raw.platforms || [],
    gameModes: raw.game_modes || [],
    themes: raw.themes || [],
    perspectives: raw.perspectives || [],
    screenshots: raw.screenshots || [],
    artworks: raw.artworks || [],
    videos: raw.videos || [],
  };
}

export async function searchGamesApi(query = "", limit = 24, offset = 0) {
  const params = { q: query, limit, offset };
  const response = await apiClient.get("/games/search", { params });

  const items = response.data?.items || [];
  return items.map(toGameModel);
}

export function peekSearchGamesApi(query = "", limit = 24, offset = 0) {
  const params = { q: query, limit, offset };
  const cached = getCachedGetData("/games/search", params);

  if (!cached?.items || !Array.isArray(cached.items)) {
    return null;
  }

  return cached.items.map(toGameModel);
}

export async function getGameDetailsApi(gameIdentifier) {
  const response = await apiClient.get(
    `/games/${encodeURIComponent(gameIdentifier)}`,
  );
  return toGameModel(response.data);
}

export function peekGameDetailsApi(gameIdentifier) {
  const cached = getCachedGetData(`/games/${encodeURIComponent(gameIdentifier)}`);
  if (!cached || typeof cached !== "object") {
    return null;
  }

  return toGameModel(cached);
}

export async function getHomeContentApi(reviewCount = 4, newsCount = 4, options = {}) {
  const response = await apiClient.get("/games/home-content", {
    params: {
      review_count: reviewCount,
      news_count: newsCount,
    },
    cacheMode: options.forceRefresh ? "force-refresh" : undefined,
  });

  return response.data || { reviews: [], news: [] };
}

export function peekHomeContentApi(reviewCount = 4, newsCount = 4) {
  const cached = getCachedGetData("/games/home-content", {
    review_count: reviewCount,
    news_count: newsCount,
  });

  if (!cached || typeof cached !== "object") {
    return null;
  }

  return {
    reviews: Array.isArray(cached.reviews) ? cached.reviews : [],
    news: Array.isArray(cached.news) ? cached.news : [],
  };
}

export async function getGameReviewsApi(gameIdentifier, limit = 20) {
  const response = await apiClient.get(
    `/games/${encodeURIComponent(gameIdentifier)}/reviews`,
    {
      params: { limit },
    },
  );

  return response.data || null;
}
