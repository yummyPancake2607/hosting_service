import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Heart,
  Play,
  CheckCircle,
  ExternalLink,
  ArrowLeft,
  Star,
  Calendar,
  Building2,
  Monitor,
  Sparkles,
  Clapperboard,
  X,
  Users,
  MessageCircle,
} from "lucide-react";
import { useUser } from "../components/context/UserContent";
import { Header } from "../components/Header";
import {
  getGameDetailsApi,
  getGameReviewsApi,
  peekGameDetailsApi,
} from "../services/gamesApi";
import { fetchCommunities, joinCommunity } from "../services/communitiesApi";
import { supabase } from "../lib/supabase";
import "./GameDetailsPage.css";

const normalizeCommunityKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const formatReviewTimestamp = (unixTimestamp) => {
  const parsed = Number(unixTimestamp);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "Recently";
  }

  return new Date(parsed * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export default function GameDetailsPage() {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const { isSignedIn, getGameStatus, addToWishlist, setCurrentlyPlaying, setCompleted } = useUser();
  const [showDateModal, setShowDateModal] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [game, setGame] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [topCommunities, setTopCommunities] = useState([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(false);
  const [communitiesError, setCommunitiesError] = useState("");
  const [communityActionLoadingId, setCommunityActionLoadingId] = useState(null);
  const [gameReviews, setGameReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState("");
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [reviewsSummary, setReviewsSummary] = useState({
    scoreDesc: "",
    totalPositive: 0,
    totalNegative: 0,
    totalReviews: 0,
    steamUrl: null,
  });

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadGame = async () => {
      if (!gameId) return;

      const cachedGame = peekGameDetailsApi(gameId);
      const hasCachedGame = Boolean(cachedGame);

      if (hasCachedGame && isMounted) {
        setGame(cachedGame);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }

      try {
        const gameData = await getGameDetailsApi(gameId);
        if (isMounted) setGame(gameData);
      } catch {
        if (isMounted && !hasCachedGame) {
          setGame(null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadGame();
    return () => {
      isMounted = false;
    };
  }, [gameId]);

  useEffect(() => {
    let isMounted = true;

    const loadTopCommunities = async () => {
      if (!game) {
        setTopCommunities([]);
        setCommunitiesLoading(false);
        setCommunitiesError("");
        return;
      }

      setCommunitiesLoading(true);
      setCommunitiesError("");

      try {
        const accessToken = isSignedIn ? await getAccessToken() : undefined;
        const items = await fetchCommunities("", accessToken);

        const normalizedGameSlug = normalizeCommunityKey(game.slug || gameId);
        const normalizedGameName = normalizeCommunityKey(game.name);
        const normalizedGameId = normalizeCommunityKey(game.id);

        const matches = items
          .filter((community) => {
            const normalizedCommunityKey = normalizeCommunityKey(community.game_key);
            const normalizedCommunityName = normalizeCommunityKey(community.game_name);

            return (
              normalizedCommunityKey === normalizedGameSlug ||
              normalizedCommunityKey === normalizedGameId ||
              normalizedCommunityName === normalizedGameName ||
              normalizedCommunityName.includes(normalizedGameName)
            );
          })
          .sort((a, b) => (b.members_count || 0) - (a.members_count || 0))
          .slice(0, 5);

        if (isMounted) {
          setTopCommunities(matches);
        }
      } catch {
        if (isMounted) {
          setTopCommunities([]);
          setCommunitiesError("Could not load communities for this game right now.");
        }
      } finally {
        if (isMounted) {
          setCommunitiesLoading(false);
        }
      }
    };

    void loadTopCommunities();

    return () => {
      isMounted = false;
    };
  }, [game, gameId, isSignedIn, getAccessToken]);

  useEffect(() => {
    let isMounted = true;

    const resetReviewsState = (steamUrl = null) => {
      setGameReviews([]);
      setReviewsSummary({
        scoreDesc: "",
        totalPositive: 0,
        totalNegative: 0,
        totalReviews: 0,
        steamUrl,
      });
      setReviewsError("");
      setReviewsLoading(false);
    };

    const loadGameReviews = async () => {
      if (!game) {
        resetReviewsState();
        return;
      }

      setShowAllReviews(false);

      if (!game.steamAppId) {
        resetReviewsState(game.steamUrl || null);
        return;
      }

      setReviewsLoading(true);
      setReviewsError("");

      try {
        const gameIdentifier = game.slug || game.id || gameId;
        const payload = await getGameReviewsApi(gameIdentifier, 30);

        if (!isMounted) {
          return;
        }

        const items = Array.isArray(payload?.reviews) ? payload.reviews : [];
        setGameReviews(items);
        setReviewsSummary({
          scoreDesc: payload?.score_desc || "",
          totalPositive: payload?.total_positive || 0,
          totalNegative: payload?.total_negative || 0,
          totalReviews: payload?.total_reviews || items.length,
          steamUrl: payload?.steam_url || game.steamUrl || null,
        });
      } catch {
        if (!isMounted) {
          return;
        }

        setGameReviews([]);
        setReviewsSummary({
          scoreDesc: "",
          totalPositive: 0,
          totalNegative: 0,
          totalReviews: 0,
          steamUrl: game.steamUrl || null,
        });
        setReviewsError("Could not load real Steam reviews right now.");
      } finally {
        if (isMounted) {
          setReviewsLoading(false);
        }
      }
    };

    void loadGameReviews();

    return () => {
      isMounted = false;
    };
  }, [game, gameId]);

  const handleCommunityAction = async (community) => {
    if (!community) {
      return;
    }

    if (!isSignedIn) {
      navigate("/login");
      return;
    }

    if (community.is_joined || community.is_owner) {
      navigate(`/community-chat?communityId=${community.id}`);
      return;
    }

    setCommunityActionLoadingId(community.id);
    setCommunitiesError("");

    try {
      const accessToken = await getAccessToken();
      await joinCommunity(community.id, accessToken);

      setTopCommunities((previous) =>
        previous.map((item) =>
          item.id === community.id
            ? {
                ...item,
                is_joined: true,
                members_count: (item.members_count || 0) + 1,
              }
            : item,
        ),
      );

      navigate(`/community-chat?communityId=${community.id}`);
    } catch {
      setCommunitiesError("Could not join this community right now.");
    } finally {
      setCommunityActionLoadingId(null);
    }
  };

  const gameKey = game?.slug || (game?.id ? String(game.id) : gameId);
  const gameStatus = gameKey ? getGameStatus(gameKey) : undefined;
  const steamSearchUrl = game?.name
    ? `https://store.steampowered.com/search/?term=${encodeURIComponent(game.name)}`
    : "https://store.steampowered.com";
  const visibleGameReviews = showAllReviews ? gameReviews : gameReviews.slice(0, 4);
  const numericGameRating = typeof game?.rating === "number" ? game.rating : 0;
  const gameRatingCount = typeof game?.ratingCount === "number" ? game.ratingCount : 0;
  const steamPositivePercent = reviewsSummary.totalReviews > 0
    ? Math.round((reviewsSummary.totalPositive / reviewsSummary.totalReviews) * 100)
    : null;
  const displayedRatingValue = steamPositivePercent !== null
    ? `${steamPositivePercent}%`
    : typeof game?.rating === "number"
      ? game.rating.toFixed(1)
      : "N/A";
  const displayedRatingCount = steamPositivePercent !== null
    ? `(${reviewsSummary.totalReviews} Steam reviews)`
    : `(${gameRatingCount} ratings)`;
  const displayedStars = steamPositivePercent !== null
    ? Math.round(steamPositivePercent / 20)
    : Math.floor(numericGameRating / 2);

  const heroBackground = useMemo(() => {
    if (!game) return null;
    return game.artworks?.[0] || game.screenshots?.[0] || game.coverImage;
  }, [game]);

  if (isLoading) {
    return (
      <div className="detail-page">
        <Header />
        <main className="detail-container">Loading game details...</main>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="not-found-screen">
        <div className="text-center">
          <h1 className="not-found-title">Game Not Found</h1>
          <Link to="/browse" className="back-home-link">
            Back to Browse
          </Link>
        </div>
      </div>
    );
  }

  const handleDateSubmit = () => {
    if (startDate && endDate && gameKey) {
      setCompleted(gameKey, startDate, endDate, game);
      setShowDateModal(false);
      setStartDate("");
      setEndDate("");
    }
  };

  const handleSkipDates = () => {
    if (gameKey) {
      setCompleted(gameKey, "", "", game);
      setShowDateModal(false);
      setStartDate("");
      setEndDate("");
    }
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/browse");
  };

  return (
    <div className="detail-page">
      <Header />
      <section
        className="detail-hero"
        style={heroBackground ? { backgroundImage: `url(${heroBackground})` } : undefined}
      >
        <div className="detail-hero-overlay" />
      </section>

      <main className="detail-container detail-elevated">
        <button type="button" className="btn-back-nav" onClick={handleGoBack}>
          <ArrowLeft className="icon-small" />
          Back
        </button>

        <div className="detail-grid">
          <aside className="detail-sidebar">
            <div className="sticky-sidebar">
              <img src={game.coverImage} alt={game.name} className="detail-poster" />
              <div className="action-stack">
                <button
                  onClick={() => gameKey && addToWishlist(gameKey, game)}
                  className={`btn-action ${gameStatus?.status === "wishlist" ? "active-wishlist" : ""}`}
                >
                  <Heart className={`icon-small ${gameStatus?.status === "wishlist" ? "fill-current" : ""}`} />
                  {gameStatus?.status === "wishlist" ? "In Wishlist" : "Add to Wishlist"}
                </button>

                <button
                  onClick={() => gameKey && setCurrentlyPlaying(gameKey, game)}
                  className={`btn-action ${gameStatus?.status === "playing" ? "active-playing" : ""}`}
                >
                  <Play className="icon-small" />
                  {gameStatus?.status === "playing" ? "Currently Playing" : "Set as Playing"}
                </button>

                <button
                  onClick={() => setShowDateModal(true)}
                  className={`btn-action ${gameStatus?.status === "completed" ? "active-completed" : ""}`}
                >
                  <CheckCircle className="icon-small" />
                  {gameStatus?.status === "completed" ? "Completed" : "Mark Completed"}
                </button>

                <a
                  href={game.steamUrl || steamSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-steam"
                >
                  <ExternalLink className="icon-small" /> Open Steam Page
                </a>
              </div>
            </div>
          </aside>

          <section className="detail-content">
            <div className="content-block">
              <h1 className="game-main-title">{game.name}</h1>
              <div className="genre-tag-list">
                {(game.genres || []).map((genre) => (
                  <span key={genre} className="genre-pill">
                    {genre}
                  </span>
                ))}
              </div>
              <p className="release-info">Released: {game.releaseDate}</p>
              <p className="description-text">{game.description}</p>
            </div>

            <div className="card-panel">
              <h2 className="panel-title">Ratings</h2>
              <div className="rating-summary-row">
                <div className="overall-score">{displayedRatingValue}</div>
                <div className="stars-row">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`star-icon ${i < displayedStars ? "star-filled" : ""}`}
                    />
                  ))}
                </div>
                <div className="review-count">{displayedRatingCount}</div>
              </div>
              {steamPositivePercent !== null && (
                <p className="rating-source-label">
                  Source: Steam {reviewsSummary.scoreDesc ? `(${reviewsSummary.scoreDesc})` : ""}
                </p>
              )}
            </div>

            <div className="card-panel">
              <h2 className="panel-title">
                <MessageCircle className="icon-small" /> Real Player Reviews
              </h2>

              {reviewsLoading && (
                <p className="community-empty-text">Loading real Steam reviews...</p>
              )}

              {!reviewsLoading && reviewsError && (
                <p className="community-empty-text">{reviewsError}</p>
              )}

              {!reviewsLoading && !reviewsError && gameReviews.length === 0 && (
                <p className="community-empty-text">
                  No Steam comments were found for this game yet.
                </p>
              )}

              {!reviewsLoading && !reviewsError && gameReviews.length > 0 && (
                <>
                  <div className="game-review-summary">
                    <span>{reviewsSummary.scoreDesc || "Steam sentiment"}</span>
                    <span>{reviewsSummary.totalPositive} positive</span>
                    <span>{reviewsSummary.totalNegative} negative</span>
                    <span>{reviewsSummary.totalReviews} total</span>
                  </div>

                  <div className="game-reviews-list">
                    {visibleGameReviews.map((review, index) => (
                      <article key={`${review.review_id || "review"}-${index}`} className="game-review-item">
                        <div className="game-review-head">
                          <span className={`game-review-pill ${review.voted_up ? "positive" : "mixed"}`}>
                            {review.voted_up ? "Recommended" : "Mixed"}
                          </span>
                          <span className="game-review-meta">
                            {typeof review.playtime_hours === "number"
                              ? `${review.playtime_hours} hrs played`
                              : "Playtime unknown"}
                            {" • "}
                            {formatReviewTimestamp(review.posted_at)}
                          </span>
                        </div>

                        <p className="game-review-text">{review.review_text}</p>

                        <div className="game-review-foot">
                          <span>Helpful: {review.votes_up || 0}</span>
                          <span>Funny: {review.votes_funny || 0}</span>
                          <span>{review.language || "English"}</span>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="game-review-actions">
                    {gameReviews.length > 4 && (
                      <button
                        type="button"
                        className="btn-join-pill btn-review-toggle"
                        onClick={() => setShowAllReviews((previous) => !previous)}
                      >
                        {showAllReviews
                          ? "Show fewer comments"
                          : `View all comments (${gameReviews.length})`}
                      </button>
                    )}

                    <a
                      href={reviewsSummary.steamUrl || game.steamUrl || steamSearchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-steam-review-link"
                    >
                      Open all Steam comments
                    </a>
                  </div>
                </>
              )}
            </div>

            <div className="card-panel">
              <h2 className="panel-title">Details</h2>
              <div className="bars-list">
                <div className="bar-group">
                  <div className="bar-labels">
                    <span><Building2 className="icon-tiny" /> Developer</span>
                    <span className="bar-value">{game.developer || "Unknown"}</span>
                  </div>
                </div>
                <div className="bar-group">
                  <div className="bar-labels">
                    <span><Building2 className="icon-tiny" /> Publisher</span>
                    <span className="bar-value">{game.publisher || "Unknown"}</span>
                  </div>
                </div>
                <div className="bar-group">
                  <div className="bar-labels">
                    <span><Monitor className="icon-tiny" /> Platforms</span>
                    <span className="bar-value">{(game.platforms || []).join(", ") || "Unknown"}</span>
                  </div>
                </div>
                <div className="bar-group">
                  <div className="bar-labels">
                    <span><Sparkles className="icon-tiny" /> Modes</span>
                    <span className="bar-value">{(game.gameModes || []).join(", ") || "Unknown"}</span>
                  </div>
                </div>
                <div className="bar-group">
                  <div className="bar-labels">
                    <span><Sparkles className="icon-tiny" /> Themes</span>
                    <span className="bar-value">{(game.themes || []).join(", ") || "Unknown"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-panel">
              <h2 className="panel-title">
                <Users className="icon-small" /> Popular Communities
              </h2>

              {communitiesLoading && (
                <p className="community-empty-text">Loading communities...</p>
              )}

              {!communitiesLoading && communitiesError && (
                <p className="community-empty-text">{communitiesError}</p>
              )}

              {!communitiesLoading && !communitiesError && topCommunities.length === 0 && (
                <p className="community-empty-text">
                  No communities found for this game yet.
                </p>
              )}

              {!communitiesLoading && !communitiesError && topCommunities.length > 0 && (
                <div className="community-link-stack">
                  {topCommunities.map((community) => (
                    <div key={community.id} className="community-mini-card">
                      <div>
                        <p className="community-mini-name">{community.name}</p>
                        <p className="community-mini-desc">
                          {community.description || "Join this community to chat with other players."}
                        </p>
                        <div className="community-mini-meta">
                          <Users className="icon-tiny" />
                          <span>{community.members_count} members</span>
                          <span className="community-dot">•</span>
                          <span>Host: {community.owner_name || "Unknown"}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-join-pill"
                        onClick={() => void handleCommunityAction(community)}
                        disabled={communityActionLoadingId === community.id}
                      >
                        <MessageCircle className="icon-tiny" />
                        {communityActionLoadingId === community.id
                          ? "Joining..."
                          : community.is_joined || community.is_owner
                            ? "Open Chat"
                            : "Join & Open Chat"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(game.screenshots?.length > 0 || game.videos?.length > 0) && (
              <div className="card-panel">
                <h2 className="panel-title">Media</h2>
                {game.videos?.length > 0 && (
                  <a href={game.videos[0]} target="_blank" rel="noopener noreferrer" className="btn-trailer">
                    <Clapperboard className="icon-small" /> Watch Trailer
                  </a>
                )}
                {game.screenshots?.length > 0 && (
                  <div className="media-grid" style={{ marginTop: "1rem" }}>
                    {game.screenshots.slice(0, 4).map((shot) => (
                      <a key={shot} href={shot} target="_blank" rel="noopener noreferrer" className="media-thumb">
                        <img src={shot} alt="Screenshot" className="media-thumb-image" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      {showDateModal && (
        <div className="modal-overlay">
          <div className="modal-content-small">
            <div className="modal-header">
              <h3 className="modal-title-text">Mark as Completed</h3>
              <button onClick={() => setShowDateModal(false)} className="btn-close-modal">
                <X />
              </button>
            </div>
            <div className="modal-body-stack">
              <div className="date-input-group">
                <label className="date-label">
                  <Calendar className="icon-tiny" /> Start Date
                </label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="date-field" />
              </div>
              <div className="date-input-group">
                <label className="date-label">
                  <Calendar className="icon-tiny" /> End Date
                </label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="date-field" />
              </div>
              <button onClick={handleDateSubmit} disabled={!startDate || !endDate} className="btn-submit-modal">
                Confirm
              </button>
              <button onClick={handleSkipDates} className="btn-skip-modal">
                Skip Dates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
