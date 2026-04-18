import { Link } from "react-router-dom";
import {
  Search,
  Star,
  Library,
  MessageCircle,
  Gamepad2,
  Sword,
  Users,
  TreePine,
  Car,
  Flame,
  Ghost,
  ThumbsUp,
  TrendingUp,
  Clock,
  MapPin,
  Mail,
  ExternalLink,
  Lightbulb,
  Newspaper,
  ArrowRight,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "../components/Header";
import {
  getHomeContentApi,
  peekHomeContentApi,
  peekSearchGamesApi,
  searchGamesApi,
} from "../services/gamesApi";
import "./HomePage.css"; // Importing your standard CSS

const INITIAL_REVIEW_COUNT = 6;
const INITIAL_NEWS_COUNT = 10;
const REVIEW_BATCH_SIZE = 6;
const NEWS_BATCH_SIZE = 8;
const MAX_REVIEW_COUNT = 30;
const MAX_NEWS_COUNT = 40;

export default function HomePage() {
  const [liveGames, setLiveGames] = useState([]);
  const [genreImageMap, setGenreImageMap] = useState({});
  const [homeFeedReviews, setHomeFeedReviews] = useState([]);
  const [homeFeedNews, setHomeFeedNews] = useState([]);
  const [requestedReviewCount, setRequestedReviewCount] = useState(INITIAL_REVIEW_COUNT);
  const [requestedNewsCount, setRequestedNewsCount] = useState(INITIAL_NEWS_COUNT);
  const [feedLoading, setFeedLoading] = useState(false);
  const [_gamesLoading, setGamesLoading] = useState(true);
  const [gamesError, setGamesError] = useState("");
  const isMountedRef = useRef(true);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrolled = window.scrollY;
          document.documentElement.style.setProperty(
            "--scroll",
            `${scrolled * -0.5}px`,
          );
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initialize

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const loadHomeFeed = useCallback(async (reviewCount, newsCount, options = {}) => {
    const cachedHomeContent = options.forceRefresh
      ? null
      : peekHomeContentApi(reviewCount, newsCount);

    if (cachedHomeContent && isMountedRef.current) {
      setHomeFeedReviews(cachedHomeContent.reviews || []);
      setHomeFeedNews(cachedHomeContent.news || []);
    }

    try {
      if (isMountedRef.current && !cachedHomeContent) {
        setFeedLoading(true);
      }

      const homeContent = await getHomeContentApi(reviewCount, newsCount, {
        forceRefresh: options.forceRefresh,
      });
      if (isMountedRef.current) {
        setHomeFeedReviews(homeContent?.reviews || []);
        setHomeFeedNews(homeContent?.news || []);
      }
    } catch {
      if (isMountedRef.current && !cachedHomeContent) {
        setHomeFeedReviews([]);
        setHomeFeedNews([]);
      }
    } finally {
      if (isMountedRef.current) {
        setFeedLoading(false);
      }
    }
  }, []);

  const loadHomeGames = useCallback(async (
    reviewCount = INITIAL_REVIEW_COUNT,
    newsCount = INITIAL_NEWS_COUNT,
  ) => {
    const cachedGames = peekSearchGamesApi("", 40, 0);
    const hasCachedGames = Array.isArray(cachedGames);

    if (hasCachedGames && isMountedRef.current) {
      setLiveGames(cachedGames);
      setGamesLoading(false);
    }

    try {
      if (!hasCachedGames) {
        setGamesLoading(true);
      }
      setGamesError("");
      const games = await searchGamesApi("", 40);
      if (isMountedRef.current) {
        setLiveGames(games);
      }

      const genreNames = [
        "Action",
        "RPG",
        "Strategy",
        "Racing",
        "Indie",
        "Horror",
        "Adventure",
      ];

      const genreResults = await Promise.all(
        genreNames.map(async (genreName) => {
          const cachedGenreGames = peekSearchGamesApi(genreName, 12, 0);
          if (Array.isArray(cachedGenreGames)) {
            return [genreName, cachedGenreGames];
          }

          try {
            const genreGames = await searchGamesApi(genreName, 12);
            return [genreName, genreGames];
          } catch {
            return [genreName, []];
          }
        }),
      );

      if (isMountedRef.current) {
        const nextImageMap = {};
        const usedIds = new Set();

        for (const [genreName, genreGames] of genreResults) {
          const pickedGame = genreGames.find((game) => {
            if (!game?.coverImage) {
              return false;
            }
            if (usedIds.has(game.id)) {
              return false;
            }
            usedIds.add(game.id);
            return true;
          });

          if (pickedGame?.coverImage) {
            nextImageMap[genreName] = pickedGame.coverImage;
          }
        }

        setGenreImageMap(nextImageMap);
      }

      await loadHomeFeed(reviewCount, newsCount);

      setGamesError("");
    } catch (error) {
      console.error("Failed to load homepage games", error);
      if (isMountedRef.current) {
        setGamesError("Could not load game data. Make sure backend is running and try again.");
      }
    } finally {
      if (isMountedRef.current) {
        setGamesLoading(false);
      }
    }
  }, [loadHomeFeed]);

  const loadMoreReviews = async () => {
    const nextReviewCount = Math.min(
      requestedReviewCount + REVIEW_BATCH_SIZE,
      MAX_REVIEW_COUNT,
    );

    if (nextReviewCount === requestedReviewCount) {
      return;
    }

    setRequestedReviewCount(nextReviewCount);
    await loadHomeFeed(nextReviewCount, requestedNewsCount);
  };

  const loadMoreNews = async () => {
    const nextNewsCount = Math.min(requestedNewsCount + NEWS_BATCH_SIZE, MAX_NEWS_COUNT);

    if (nextNewsCount === requestedNewsCount) {
      return;
    }

    setRequestedNewsCount(nextNewsCount);
    await loadHomeFeed(requestedReviewCount, nextNewsCount);
  };

  const refreshLatestNews = async () => {
    await loadHomeFeed(requestedReviewCount, requestedNewsCount, {
      forceRefresh: true,
    });
  };

  useEffect(() => {
    isMountedRef.current = true;

    void loadHomeGames(INITIAL_REVIEW_COUNT, INITIAL_NEWS_COUNT);

    return () => {
      isMountedRef.current = false;
    };
  }, [loadHomeGames]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadHomeFeed(requestedReviewCount, requestedNewsCount);
    }, 30 * 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadHomeFeed, requestedReviewCount, requestedNewsCount]);

  const staticAvatar =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' fill='%2319233a'/%3E%3Ccircle cx='60' cy='45' r='18' fill='%239cb6df'/%3E%3Crect x='25' y='74' width='70' height='28' rx='14' fill='%239cb6df'/%3E%3C/svg%3E";

  const baseGames = liveGames.slice(0, 24);
  const featuredSource = baseGames.slice(0, 8);
  const reviewSource = baseGames.slice(4, 8);
  const discoverSource = baseGames.slice(8, 16);
  const newsSource = baseGames.slice(16, 20);

  const scoreToTen = (rating) => {
    if (typeof rating !== "number") {
      return 8.0;
    }
    const normalized = rating > 10 ? rating / 10 : rating;
    return Number(Math.max(6.5, Math.min(10, normalized)).toFixed(1));
  };

  const formatMetricValue = (value, fallback = "N/A") => {
    if (value === null || value === undefined) {
      return fallback;
    }

    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : fallback;
  };

  const normalizeCoverImage = (url) => {
    if (!url) {
      return staticAvatar;
    }

    return url
      .replace("/t_thumb/", "/t_cover_big/")
      .replace("/t_cover_small/", "/t_cover_big/");
  };

  const formatUnixTimeAgo = (unixTimestamp) => {
    const parsed = Number(unixTimestamp);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return "Recently";
    }

    const now = Math.floor(Date.now() / 1000);
    const diff = Math.max(0, now - parsed);

    if (diff < 3600) {
      const minutes = Math.max(1, Math.floor(diff / 60));
      return `${minutes} min ago`;
    }

    if (diff < 86400) {
      return `${Math.floor(diff / 3600)} hours ago`;
    }

    if (diff < 604800) {
      return `${Math.floor(diff / 86400)} days ago`;
    }

    return `${Math.floor(diff / 604800)} weeks ago`;
  };

  const getPrimaryGenre = (game) => game.genres?.[0] || "Adventure";

  const pickTag = (rating) => {
    const score = scoreToTen(rating);
    if (score >= 9.2) return "Top Rated";
    if (score >= 8.8) return "Trending";
    if (score >= 8.2) return "Popular";
    return "Featured";
  };

  const featuredGames = featuredSource.map((game) => ({
    id: game.id,
    slug: game.slug,
    title: game.name,
    image: game.coverImage,
    tag: pickTag(game.rating),
    genre: getPrimaryGenre(game),
  }));

  const getReviewTagMeta = (scoreDesc, votedUp) => {
    const normalized = String(scoreDesc || "").toLowerCase();

    if (normalized.includes("overwhelming") || normalized.includes("very positive")) {
      return { label: scoreDesc || "Very Positive", icon: TrendingUp };
    }
    if (normalized.includes("positive")) {
      return { label: scoreDesc || "Positive", icon: ThumbsUp };
    }
    if (normalized.includes("mixed")) {
      return { label: scoreDesc || "Mixed", icon: Clock };
    }

    return {
      label: votedUp ? "Recommended" : "Community Review",
      icon: votedUp ? Star : MessageCircle,
    };
  };

  const fallbackReviewTags = [
    { label: "Official Review", icon: TrendingUp },
    { label: "Most Upvotes", icon: ThumbsUp },
    { label: "Latest", icon: Clock },
    { label: "Community Pick", icon: Star },
  ];

  const fallbackReviews = reviewSource.map((game, index) => {
    const overallRating = scoreToTen(game.rating);
    const reviewTag = fallbackReviewTags[index % fallbackReviewTags.length];

    return {
      gameName: game.name.toUpperCase(),
      gameImage: game.coverImage,
      userName: `Reviewer ${index + 1}`,
      userAvatar: staticAvatar,
      scoreValue: overallRating.toFixed(1),
      scoreSuffix: "/10",
      tag: reviewTag.label,
      tagIcon: reviewTag.icon,
      helpfulCount: game.ratingCount || 1200 + index * 300,
      metrics: [
        { label: "Story", value: Number(Math.min(10, overallRating + 0.3).toFixed(1)) },
        { label: "Realism", value: Number(Math.max(6, overallRating - 0.4).toFixed(1)) },
        { label: "Controls", value: Number(Math.min(10, overallRating + 0.1).toFixed(1)) },
        { label: "Bugs", value: Number(Math.max(6, overallRating - 1.0).toFixed(1)) },
        { label: "Community", value: Number(Math.min(10, overallRating + 0.2).toFixed(1)) },
        { label: "Price", value: Number(Math.max(6, overallRating - 0.2).toFixed(1)) },
      ],
      review:
        game.description ||
        `${game.name} is making waves with strong player feedback and standout gameplay moments.`,
      readMoreUrl: game.externalUrl || null,
    };
  });

  const reviews = homeFeedReviews.length
    ? homeFeedReviews.map((review) => {
        const positiveRatio =
          review.total_reviews > 0
            ? Math.round((review.total_positive / review.total_reviews) * 100)
            : null;
        const reviewTag = getReviewTagMeta(review.score_desc, review.voted_up);
        const overallRating = positiveRatio !== null
          ? Number((positiveRatio / 10).toFixed(1))
          : 8.0;
        const cleanReviewText = String(review.review_text || "")
          .replace(/\s+/g, " ")
          .trim();

        return {
          gameName: String(review.game_name || "Unknown").toUpperCase(),
          gameImage: normalizeCoverImage(review.game_cover_image),
          userName: review.reviewer || "Steam User",
          userAvatar: staticAvatar,
          scoreValue: positiveRatio !== null ? String(positiveRatio) : overallRating.toFixed(1),
          scoreSuffix: positiveRatio !== null ? "% positive" : "/10",
          tag: reviewTag.label,
          tagIcon: reviewTag.icon,
          helpfulCount: review.votes_up || 0,
          metrics: [
            {
              label: "Sentiment",
              value: formatMetricValue(
                review.score_desc,
                review.voted_up ? "Recommended" : "Community",
              ),
            },
            {
              label: "Positive",
              value: positiveRatio !== null ? `${positiveRatio}%` : "N/A",
            },
            { label: "Helpful", value: formatMetricValue(review.votes_up, "0") },
            { label: "Funny", value: formatMetricValue(review.votes_funny, "0") },
            { label: "Total", value: formatMetricValue(review.total_reviews, "0") },
            { label: "Source", value: "Steam" },
          ],
          review: cleanReviewText || "Read the full review on Steam.",
          readMoreUrl: review.steam_url || null,
        };
      })
    : fallbackReviews;

  const canLoadMoreReviews =
    homeFeedReviews.length > 0
    && homeFeedReviews.length >= requestedReviewCount
    && requestedReviewCount < MAX_REVIEW_COUNT;

  const canLoadMoreNews =
    homeFeedNews.length > 0
    && homeFeedNews.length >= requestedNewsCount
    && requestedNewsCount < MAX_NEWS_COUNT;

  const discoverGames = discoverSource.map((game) => ({
    id: game.id,
    slug: game.slug,
    title: game.name,
    image: game.coverImage,
    genre: getPrimaryGenre(game),
  }));

  const genreDefs = [
    { name: "All Games", icon: Gamepad2, active: true },
    { name: "Action", icon: Sword },
    { name: "RPG", icon: Users },
    { name: "Strategy", icon: TreePine },
    { name: "Racing", icon: Car },
    { name: "Indie", icon: Flame },
    { name: "Horror", icon: Ghost },
    { name: "Adventure", icon: TreePine },
  ];

  const allGamesCover = baseGames[0]?.coverImage || staticAvatar;
  const genres = genreDefs.map((genreDef) => {
    if (genreDef.name === "All Games") {
      return { ...genreDef, image: allGamesCover };
    }

    const mappedGenreImage = genreImageMap[genreDef.name];
    if (mappedGenreImage) {
      return { ...genreDef, image: mappedGenreImage };
    }

    const match = baseGames.find((game) =>
      game.genres?.some((item) =>
        item.toLowerCase().includes(genreDef.name.toLowerCase()),
      ),
    );

    return {
      ...genreDef,
      image: match?.coverImage || allGamesCover,
    };
  });

  const fallbackNewsTemplates = [
    { tag: "TRENDING", time: "2 hours ago", style: "highlight" },
    { tag: "ANNOUNCEMENT", time: "5 hours ago", style: "normal" },
    { tag: "ESPORTS", time: "1 day ago", style: "normal" },
    { tag: "UPDATE", time: "1 day ago", style: "normal" },
  ];

  const fallbackNewsItems = newsSource.map((game, index) => {
    const template = fallbackNewsTemplates[index % fallbackNewsTemplates.length];
    return {
      image: game.coverImage,
      tag: template.tag,
      tagStyle: template.style,
      time: template.time,
      title: `${game.name} is dominating player watchlists this week`,
      description:
        game.description ||
        "Community discussions are growing fast as players discover new highlights and updates.",
      url: null,
    };
  });

  const newsItems = homeFeedNews.length
    ? homeFeedNews.map((item, index) => ({
        image: normalizeCoverImage(item.game_cover_image),
        tag: String(item.feed_label || "Steam News").toUpperCase(),
        tagStyle: index === 0 ? "highlight" : "normal",
        time: formatUnixTimeAgo(item.published_at),
        title: item.title,
        description: item.contents,
        url: item.url,
      }))
    : fallbackNewsItems;

  return (
    <div className="home-wrapper">
      {/* Gaming Background Effects - Smooth Parallax */}
      <div
        className="parallax-element"
        style={{ transform: "translate3d(0, var(--scroll, 0px), 0)" }}
      >
        {/* Base patterns */}
        <div className="bg-pattern-diagonal"></div>
        <div className="bg-pattern-hex"></div>

        {/* Glowing orbs (Inline positioning kept for specific layout) */}
        <div
          className="glow-orb"
          style={{
            top: "200px",
            left: "10%",
            background: "rgba(37, 99, 235, 0.08)",
          }}
        ></div>
        <div
          className="glow-orb"
          style={{
            top: "800px",
            right: "5%",
            background: "rgba(147, 51, 234, 0.08)",
          }}
        ></div>
        <div
          className="glow-orb"
          style={{
            top: "1400px",
            left: "20%",
            width: "400px",
            height: "400px",
            background: "rgba(8, 145, 178, 0.06)",
          }}
        ></div>
        <div
          className="glow-orb"
          style={{
            top: "2200px",
            right: "15%",
            width: "450px",
            height: "450px",
            background: "rgba(219, 39, 119, 0.07)",
          }}
        ></div>
        <div
          className="glow-orb"
          style={{
            top: "3000px",
            left: "30%",
            width: "550px",
            height: "550px",
            background: "rgba(79, 70, 229, 0.07)",
          }}
        ></div>
        <div
          className="glow-orb"
          style={{
            top: "3800px",
            right: "25%",
            width: "400px",
            height: "400px",
            background: "rgba(13, 148, 136, 0.06)",
          }}
        ></div>

        {/* Scanlines */}
        <div className="bg-pattern-scanlines"></div>

        {/* Cool Gaming Icons - SVGs */}
        <div className="bg-icon katana">
          <svg
            width="300"
            height="300"
            viewBox="0 0 300 300"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M145 20 L150 20 L155 200 L145 200 Z" fill="white" />
            <path
              d="M147 20 L153 20 L153 180 L147 180 Z"
              fill="white"
              opacity="0.5"
            />
            <rect x="130" y="195" width="40" height="12" rx="2" fill="white" />
            <rect x="125" y="202" width="50" height="6" rx="1" fill="white" />
            <rect x="140" y="208" width="20" height="50" rx="3" fill="white" />
            <line
              x1="140"
              y1="218"
              x2="160"
              y2="218"
              stroke="black"
              strokeWidth="1"
            />
            <line
              x1="140"
              y1="228"
              x2="160"
              y2="228"
              stroke="black"
              strokeWidth="1"
            />
            <line
              x1="140"
              y1="238"
              x2="160"
              y2="238"
              stroke="black"
              strokeWidth="1"
            />
            <line
              x1="140"
              y1="248"
              x2="160"
              y2="248"
              stroke="black"
              strokeWidth="1"
            />
            <circle cx="150" cy="265" r="8" fill="white" />
            <path
              d="M149 30 L151 30 L151 190 L149 190 Z"
              fill="white"
              opacity="0.8"
            />
          </svg>
        </div>

        <div className="bg-icon cyber-car">
          <svg
            width="400"
            height="200"
            viewBox="0 0 400 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M50 120 L90 100 L140 90 L220 90 L270 100 L350 120 L350 145 L320 155 L80 155 L50 145 Z"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <path
              d="M140 95 L155 75 L215 75 L230 95"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <path
              d="M235 95 L250 80 L280 85 L270 100"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <circle
              cx="110"
              cy="155"
              r="28"
              stroke="white"
              strokeWidth="4"
              fill="none"
            />
            <circle
              cx="110"
              cy="155"
              r="18"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <circle
              cx="290"
              cy="155"
              r="28"
              stroke="white"
              strokeWidth="4"
              fill="none"
            />
            <circle
              cx="290"
              cy="155"
              r="18"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M345 115 L360 115 L360 125 L345 125"
              stroke="white"
              strokeWidth="3"
              fill="white"
              opacity="0.5"
            />
            <path
              d="M50 115 L40 110 L40 130 L50 125"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <line
              x1="140"
              y1="100"
              x2="270"
              y2="100"
              stroke="white"
              strokeWidth="1"
              opacity="0.5"
            />
            <line
              x1="160"
              y1="110"
              x2="250"
              y2="110"
              stroke="white"
              strokeWidth="1"
              opacity="0.5"
            />
            <ellipse
              cx="200"
              cy="160"
              rx="100"
              ry="5"
              fill="white"
              opacity="0.3"
            />
          </svg>
        </div>

        <div className="bg-icon sniper">
          <svg
            width="380"
            height="140"
            viewBox="0 0 380 140"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="100"
              cy="50"
              r="20"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <circle
              cx="100"
              cy="50"
              r="15"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <line
              x1="100"
              y1="40"
              x2="100"
              y2="60"
              stroke="white"
              strokeWidth="1"
            />
            <line
              x1="90"
              y1="50"
              x2="110"
              y2="50"
              stroke="white"
              strokeWidth="1"
            />
            <rect
              x="115"
              y="45"
              width="200"
              height="10"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <rect
              x="120"
              y="42"
              width="180"
              height="16"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M315 45 L360 40 L360 60 L315 55"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <line
              x1="320"
              y1="45"
              x2="320"
              y2="55"
              stroke="white"
              strokeWidth="2"
            />
            <line
              x1="335"
              y1="42"
              x2="335"
              y2="58"
              stroke="white"
              strokeWidth="2"
            />
            <rect x="20" y="48" width="100" height="4" fill="white" />
            <rect
              x="10"
              y="46"
              width="15"
              height="8"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <line
              x1="15"
              y1="46"
              x2="15"
              y2="54"
              stroke="white"
              strokeWidth="1"
            />
            <line
              x1="20"
              y1="46"
              x2="20"
              y2="54"
              stroke="white"
              strokeWidth="1"
            />
            <rect
              x="180"
              y="55"
              width="25"
              height="35"
              rx="2"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <line
              x1="130"
              y1="43"
              x2="300"
              y2="43"
              stroke="white"
              strokeWidth="1"
              opacity="0.5"
            />
            <line
              x1="130"
              y1="57"
              x2="300"
              y2="57"
              stroke="white"
              strokeWidth="1"
              opacity="0.5"
            />
          </svg>
        </div>

        <div className="bg-icon creeper">
          <svg
            width="200"
            height="200"
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="20"
              y="20"
              width="160"
              height="160"
              stroke="white"
              strokeWidth="4"
              fill="none"
            />
            <line
              x1="20"
              y1="60"
              x2="180"
              y2="60"
              stroke="white"
              strokeWidth="2"
            />
            <line
              x1="20"
              y1="100"
              x2="180"
              y2="100"
              stroke="white"
              strokeWidth="2"
            />
            <line
              x1="20"
              y1="140"
              x2="180"
              y2="140"
              stroke="white"
              strokeWidth="2"
            />
            <line
              x1="60"
              y1="20"
              x2="60"
              y2="180"
              stroke="white"
              strokeWidth="2"
            />
            <line
              x1="100"
              y1="20"
              x2="100"
              y2="180"
              stroke="white"
              strokeWidth="2"
            />
            <line
              x1="140"
              y1="20"
              x2="140"
              y2="180"
              stroke="white"
              strokeWidth="2"
            />
            <rect x="60" y="60" width="20" height="20" fill="white" />
            <rect x="120" y="60" width="20" height="20" fill="white" />
            <rect x="80" y="100" width="40" height="20" fill="white" />
            <rect x="70" y="120" width="20" height="20" fill="white" />
            <rect x="110" y="120" width="20" height="20" fill="white" />
          </svg>
        </div>

        <div className="bg-icon potion">
          <svg
            width="160"
            height="280"
            viewBox="0 0 160 280"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M50 80 L50 220 C50 235 55 245 80 245 C105 245 110 235 110 220 L110 80"
              stroke="white"
              strokeWidth="4"
              fill="none"
            />
            <rect
              x="60"
              y="40"
              width="40"
              height="45"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <rect
              x="55"
              y="25"
              width="50"
              height="20"
              rx="3"
              stroke="white"
              strokeWidth="4"
              fill="none"
            />
            <rect
              x="55"
              y="120"
              width="50"
              height="80"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M80 135 L75 150 L82 150 L77 165"
              stroke="white"
              strokeWidth="3"
            />
            <path
              d="M52 180 Q80 185 108 180"
              stroke="white"
              strokeWidth="2"
              opacity="0.6"
            />
            <line
              x1="95"
              y1="90"
              x2="95"
              y2="210"
              stroke="white"
              strokeWidth="2"
              opacity="0.4"
            />
          </svg>
        </div>

        <div className="bg-icon trophy">
          <svg
            width="220"
            height="260"
            viewBox="0 0 220 260"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M50 50 L50 90 C50 115 70 130 90 135 L90 170 L75 170 L75 190 L145 190 L145 170 L130 170 L130 135 C150 130 170 115 170 90 L170 50 Z"
              stroke="white"
              strokeWidth="4"
              fill="none"
            />
            <path
              d="M50 60 L30 60 C30 90 40 100 50 105"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <path
              d="M170 60 L190 60 C190 90 180 100 170 105"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <ellipse
              cx="110"
              cy="50"
              rx="60"
              ry="8"
              stroke="white"
              strokeWidth="4"
              fill="none"
            />
            <rect
              x="65"
              y="190"
              width="90"
              height="20"
              rx="3"
              stroke="white"
              strokeWidth="4"
              fill="none"
            />
            <rect
              x="55"
              y="210"
              width="110"
              height="12"
              rx="2"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <path
              d="M110 75 L115 88 L128 88 L118 96 L122 109 L110 101 L98 109 L102 96 L92 88 L105 88 Z"
              fill="white"
            />
            <line
              x1="70"
              y1="60"
              x2="150"
              y2="60"
              stroke="white"
              strokeWidth="1"
              opacity="0.5"
            />
            <line
              x1="65"
              y1="80"
              x2="155"
              y2="80"
              stroke="white"
              strokeWidth="1"
              opacity="0.5"
            />
          </svg>
        </div>

        <div className="bg-icon combat-knife">
          <svg
            width="280"
            height="120"
            viewBox="0 0 280 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M20 60 L200 60 L260 40 L260 80 L200 60 Z"
              stroke="white"
              strokeWidth="4"
              fill="none"
            />
            <path
              d="M200 55 L240 45 L240 75 L200 65"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M200 58 L210 55 L210 65 L220 62 L220 72 L230 69 L230 79"
              stroke="white"
              strokeWidth="2"
            />
            <ellipse
              cx="20"
              cy="60"
              rx="8"
              ry="20"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <rect
              x="5"
              y="50"
              width="20"
              height="20"
              rx="2"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <line
              x1="7"
              y1="54"
              x2="23"
              y2="54"
              stroke="white"
              strokeWidth="1"
            />
            <line
              x1="7"
              y1="58"
              x2="23"
              y2="58"
              stroke="white"
              strokeWidth="1"
            />
            <line
              x1="7"
              y1="62"
              x2="23"
              y2="62"
              stroke="white"
              strokeWidth="1"
            />
            <line
              x1="7"
              y1="66"
              x2="23"
              y2="66"
              stroke="white"
              strokeWidth="1"
            />
            <line
              x1="40"
              y1="60"
              x2="180"
              y2="60"
              stroke="white"
              strokeWidth="1"
              opacity="0.5"
            />
          </svg>
        </div>

        <div className="bg-icon controller-pro">
          <svg
            width="320"
            height="200"
            viewBox="0 0 320 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M160 40 C100 40 50 70 50 110 C50 125 58 140 75 148 L68 175 C65 185 70 200 82 207 L95 214 C102 218 112 214 116 207 L138 160 H182 L204 207 C208 214 218 218 225 214 L238 207 C250 200 255 185 252 175 L245 148 C262 140 270 125 270 110 C270 70 220 40 160 40 Z"
              stroke="white"
              strokeWidth="4"
              fill="none"
            />
            <rect x="85" y="95" width="28" height="8" rx="2" fill="white" />
            <rect x="95" y="85" width="8" height="28" rx="2" fill="white" />
            <circle cx="225" cy="95" r="9" fill="white" />
            <circle cx="245" cy="110" r="9" fill="white" />
            <circle cx="205" cy="110" r="9" fill="white" />
            <circle cx="225" cy="125" r="9" fill="white" />
            <circle
              cx="120"
              cy="135"
              r="18"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <circle cx="120" cy="135" r="10" fill="white" />
            <circle
              cx="200"
              cy="145"
              r="18"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <circle cx="200" cy="145" r="10" fill="white" />
            <rect
              x="60"
              y="30"
              width="40"
              height="8"
              rx="2"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <rect
              x="220"
              y="30"
              width="40"
              height="8"
              rx="2"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <line
              x1="160"
              y1="45"
              x2="160"
              y2="60"
              stroke="white"
              strokeWidth="1"
              opacity="0.5"
            />
          </svg>
        </div>

        <div className="bg-icon space-helmet">
          <svg
            width="240"
            height="240"
            viewBox="0 0 240 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="120"
              cy="120"
              r="80"
              stroke="white"
              strokeWidth="4"
              fill="none"
            />
            <circle
              cx="120"
              cy="120"
              r="70"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <ellipse
              cx="120"
              cy="110"
              rx="55"
              ry="45"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <ellipse
              cx="110"
              cy="100"
              rx="20"
              ry="15"
              stroke="white"
              strokeWidth="2"
              opacity="0.6"
            />
            <ellipse
              cx="120"
              cy="200"
              rx="50"
              ry="15"
              stroke="white"
              strokeWidth="4"
              fill="none"
            />
            <ellipse
              cx="120"
              cy="200"
              rx="45"
              ry="12"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M50 140 Q30 160 40 200"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <path
              d="M190 140 Q210 160 200 200"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <line
              x1="120"
              y1="40"
              x2="120"
              y2="55"
              stroke="white"
              strokeWidth="2"
            />
            <circle cx="120" cy="35" r="5" fill="white" />
          </svg>
        </div>

        <div className="bg-icon battle-axe">
          <svg
            width="200"
            height="240"
            viewBox="0 0 200 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M80 40 L120 40 L140 70 L120 100 L80 100 L60 70 Z"
              stroke="white"
              strokeWidth="4"
              fill="none"
            />
            <path
              d="M85 50 L115 50 L130 70 L115 90 L85 90 L70 70 Z"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <rect x="95" y="95" width="10" height="130" rx="2" fill="white" />
            <line
              x1="97"
              y1="110"
              x2="103"
              y2="110"
              stroke="black"
              strokeWidth="1"
            />
            <line
              x1="97"
              y1="130"
              x2="103"
              y2="130"
              stroke="black"
              strokeWidth="1"
            />
            <line
              x1="97"
              y1="150"
              x2="103"
              y2="150"
              stroke="black"
              strokeWidth="1"
            />
            <line
              x1="97"
              y1="170"
              x2="103"
              y2="170"
              stroke="black"
              strokeWidth="1"
            />
            <circle cx="100" cy="230" r="8" fill="white" />
          </svg>
        </div>

        <div className="bg-icon shield">
          <svg
            width="200"
            height="240"
            viewBox="0 0 200 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M100 20 L160 50 L160 140 C160 180 130 220 100 220 C70 220 40 180 40 140 L40 50 Z"
              stroke="white"
              strokeWidth="4"
              fill="none"
            />
            <path
              d="M100 35 L150 60 L150 135 C150 170 125 200 100 200 C75 200 50 170 50 135 L50 60 Z"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M100 80 L110 100 L130 100 L115 112 L120 132 L100 120 L80 132 L85 112 L70 100 L90 100 Z"
              fill="white"
            />
            <line
              x1="100"
              y1="35"
              x2="100"
              y2="200"
              stroke="white"
              strokeWidth="1"
              opacity="0.5"
            />
          </svg>
        </div>

        <div className="bg-icon grenade">
          <svg
            width="140"
            height="180"
            viewBox="0 0 140 180"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="70"
              cy="30"
              r="8"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <path d="M70 22 L70 10" stroke="white" strokeWidth="3" />
            <path
              d="M75 30 L95 25 L95 50"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <ellipse
              cx="70"
              cy="100"
              rx="40"
              ry="50"
              stroke="white"
              strokeWidth="4"
              fill="none"
            />
            <ellipse
              cx="70"
              cy="100"
              rx="32"
              ry="42"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <line
              x1="30"
              y1="100"
              x2="110"
              y2="100"
              stroke="white"
              strokeWidth="2"
            />
            <line
              x1="70"
              y1="50"
              x2="70"
              y2="150"
              stroke="white"
              strokeWidth="2"
            />
            <rect
              x="60"
              y="40"
              width="20"
              height="15"
              rx="2"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
          </svg>
        </div>

        <div className="bg-icon crosshair">
          <svg
            width="180"
            height="180"
            viewBox="0 0 180 180"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="90"
              cy="90"
              r="70"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <circle
              cx="90"
              cy="90"
              r="50"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <circle
              cx="90"
              cy="90"
              r="30"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <circle
              cx="90"
              cy="90"
              r="10"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <line
              x1="90"
              y1="10"
              x2="90"
              y2="40"
              stroke="white"
              strokeWidth="3"
            />
            <line
              x1="90"
              y1="140"
              x2="90"
              y2="170"
              stroke="white"
              strokeWidth="3"
            />
            <line
              x1="10"
              y1="90"
              x2="40"
              y2="90"
              stroke="white"
              strokeWidth="3"
            />
            <line
              x1="140"
              y1="90"
              x2="170"
              y2="90"
              stroke="white"
              strokeWidth="3"
            />
            <circle cx="90" cy="90" r="3" fill="white" />
          </svg>
        </div>

        <div className="bg-icon skull">
          <svg
            width="160"
            height="180"
            viewBox="0 0 160 180"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <ellipse
              cx="80"
              cy="70"
              rx="50"
              ry="55"
              stroke="white"
              strokeWidth="4"
              fill="none"
            />
            <ellipse cx="60" cy="60" rx="15" ry="20" fill="white" />
            <ellipse cx="100" cy="60" rx="15" ry="20" fill="white" />
            <path
              d="M70 85 L80 95 L90 85"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <path
              d="M40 100 L40 120 C40 130 50 140 80 140 C110 140 120 130 120 120 L120 100"
              stroke="white"
              strokeWidth="4"
              fill="none"
            />
            <line
              x1="50"
              y1="120"
              x2="50"
              y2="130"
              stroke="white"
              strokeWidth="2"
            />
            <line
              x1="65"
              y1="120"
              x2="65"
              y2="135"
              stroke="white"
              strokeWidth="2"
            />
            <line
              x1="80"
              y1="120"
              x2="80"
              y2="135"
              stroke="white"
              strokeWidth="2"
            />
            <line
              x1="95"
              y1="120"
              x2="95"
              y2="135"
              stroke="white"
              strokeWidth="2"
            />
            <line
              x1="110"
              y1="120"
              x2="110"
              y2="130"
              stroke="white"
              strokeWidth="2"
            />
          </svg>
        </div>

        <div className="bg-icon rocket">
          <svg
            width="200"
            height="280"
            viewBox="0 0 200 280"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M100 20 L130 80 L70 80 Z"
              stroke="white"
              strokeWidth="4"
              fill="none"
            />
            <rect
              x="75"
              y="80"
              width="50"
              height="140"
              stroke="white"
              strokeWidth="4"
              fill="none"
            />
            <circle
              cx="100"
              cy="120"
              r="15"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <circle
              cx="100"
              cy="120"
              r="10"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M75 220 L40 250 L40 220 Z"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <path
              d="M125 220 L160 250 L160 220 Z"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <path
              d="M80 220 L80 260 L90 250 L100 265 L110 250 L120 260 L120 220"
              stroke="white"
              strokeWidth="3"
              fill="none"
            />
            <line
              x1="80"
              y1="100"
              x2="120"
              y2="100"
              stroke="white"
              strokeWidth="2"
              opacity="0.5"
            />
            <line
              x1="80"
              y1="160"
              x2="120"
              y2="160"
              stroke="white"
              strokeWidth="2"
              opacity="0.5"
            />
          </svg>
        </div>

        <div className="corner-accent top-left"></div>
        <div className="corner-accent top-right"></div>
      </div>

      <Header />

      {gamesError && (
        <div className="main-content" style={{ paddingTop: "1rem", paddingBottom: 0 }}>
          <div className="browse-empty-state">
            <p>{gamesError}</p>
            <button
              type="button"
              className="btn-explore"
              onClick={() => void loadHomeGames(requestedReviewCount, requestedNewsCount)}
            >
              Retry
            </button>
          </div>
        </div>
      )}



      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-video-wrap" aria-hidden="true">
            <iframe
              className="hero-video"
              src="https://www.youtube-nocookie.com/embed/RMNjO-rFGX4?autoplay=1&mute=1&controls=0&loop=1&playlist=RMNjO-rFGX4&playsinline=1&rel=0&modestbranding=1&disablekb=1&iv_load_policy=3"
              title="Game Insights hero background video"
              allow="autoplay; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              tabIndex="-1"
              loading="eager"
            />
          </div>
          <div className="hero-gradient-overlay"></div>
          <div className="hero-noise-overlay"></div>
          <div className="hero-text-container">
            <div className="hero-text-content">
              <span className="badge-trending">LIVE NOW</span>
              <h2 className="hero-title">Discover Latest Games In Motion</h2>
              <p className="hero-subtitle">
                Explore the hottest titles and discover your next obsession.
              </p>
              <div className="hero-cta-row">
                <Link to="/browse" className="hero-btn-primary">
                  Explore Now
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className="hero-wave-transition">
          <svg
            className="wave-svg"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1440 60"
            preserveAspectRatio="none"
          >
            <path
              d="M0,30 C360,0 720,60 1080,30 C1260,15 1350,0 1440,0 L1440,60 L0,60 Z"
              fill="#000000"
              fillOpacity="1"
            />
          </svg>
        </div>
      </section>

      {/* Main Content */}
      <main className="main-content">
        {/* Top Feature Cards */}
        <div className="feature-cards-grid">
          <Link to="/browse" className="feature-card">
            <img
              src="https://images.unsplash.com/photo-1704793602349-f56b6ddaa2c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aWRlbyUyMGdhbWUlMjBkaXNjb3ZlcnklMjBzZWFyY2glMjBleHBsb3JlfGVufDF8fHx8MTc3NDg2NTIzNXww&ixlib=rb-4.1.0&q=80&w=1080"
              alt="Discover"
              className="feature-bg"
              loading="lazy"
            />
            <div className="feature-overlay"></div>
            <div className="feature-content">
              <div className="feature-icon-wrapper">
                <Search className="feature-icon" />
              </div>
              <h3>DISCOVER</h3>
            </div>
          </Link>
          <Link to="/profile" className="feature-card">
            <img
              src="https://images.unsplash.com/photo-1717548381519-10ee59c67150?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnYW1lJTIwcmF0aW5nJTIwc3RhcnMlMjByZXZpZXd8ZW58MXx8fHwxNzc0ODY1MjM2fDA&ixlib=rb-4.1.0&q=80&w=1080"
              alt="Rate"
              className="feature-bg"
              loading="lazy"
            />
            <div className="feature-overlay"></div>
            <div className="feature-content">
              <div className="feature-icon-wrapper">
                <Star className="feature-icon" />
              </div>
              <h3>RATE</h3>
            </div>
          </Link>
          <Link to="/library" className="feature-card">
            <img
              src="https://images.unsplash.com/photo-1542345545-4c4884cc406a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnYW1lJTIwbGlicmFyeSUyMGNvbGxlY3Rpb24lMjBzaGVsZnxlbnwxfHx8fDE3NzQ3ODQzMTR8MA&ixlib=rb-4.1.0&q=80&w=1080"
              alt="Library"
              className="feature-bg"
              loading="lazy"
            />
            <div className="feature-overlay"></div>
            <div className="feature-content">
              <div className="feature-icon-wrapper">
                <Library className="feature-icon" />
              </div>
              <h3>LIBRARY</h3>
            </div>
          </Link>
          <Link to="/community-chat" className="feature-card">
            <img
              src="https://images.unsplash.com/photo-1761223956832-a1e341babb92?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnYW1pbmclMjBjaGF0JTIwZGlzY29yZCUyMGNvbW11bml0eXxlbnwxfHx8fDE3NzQ4NjUyMzV8MA&ixlib=rb-4.1.0&q=80&w=1080"
              alt="Chat"
              className="feature-bg"
              loading="lazy"
            />
            <div className="feature-overlay"></div>
            <div className="feature-content">
              <div className="feature-icon-wrapper">
                <MessageCircle className="feature-icon" />
              </div>
              <h3>CHAT</h3>
            </div>
          </Link>
        </div>

        {/* Browse by Genre */}
        <section className="section-block">
          <h2 className="section-title">BROWSE BY GENRE</h2>
          <div className="genre-grid">
            {genres.map((genre) => {
              const Icon = genre.icon;
              return (
                <Link
                  key={genre.name}
                  to={
                    genre.name === "All Games"
                      ? "/browse"
                      : `/browse?genre=${encodeURIComponent(genre.name)}`
                  }
                  className={`genre-card ${genre.active ? "active" : ""}`}
                >
                  <div className="genre-image-wrapper">
                    <img
                      src={genre.image}
                      alt={genre.name}
                      className="genre-image"
                      loading="lazy"
                    />
                  </div>
                  <div className="genre-overlay"></div>
                  <div className="genre-content">
                    <Icon className="genre-icon-small" />
                    <h3>{genre.name}</h3>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Featured Games */}
        <section className="section-block">
          <div className="section-header">
            <Flame className="section-icon text-white" />
            <h2 className="section-title mb-0">FEATURED GAMES</h2>
          </div>
          <div className="game-grid">
            {featuredGames.map((game) => (
              <Link key={game.title} to={`/game/${game.slug || game.id}`} className="game-card">
                <div className="game-image-wrapper">
                  <img
                    src={game.image}
                    alt={game.title}
                    className="game-image"
                    loading="lazy"
                  />
                </div>
                <div className="game-tag-wrapper">
                  <span className="game-tag">{game.tag}</span>
                </div>
                <div className="game-info">
                  <p className="game-genre">{game.genre}</p>
                  <h3 className="game-title">{game.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Community Reviews Section */}
        <section className="section-block">
          <div className="section-header">
            <MessageCircle className="section-icon text-white" />
            <h2 className="section-title mb-0">COMMUNITY REVIEWS & RATINGS</h2>
          </div>
          <p className="section-subtitle">
            What gamers are saying about the top titles
          </p>

          <div className="reviews-carousel">
            {reviews.map((review, index) => {
              const TagIcon = review.tagIcon;
              return (
                <div key={index} className="review-card">
                  <div className="review-bg-wrapper">
                    <img
                      src={review.gameImage}
                      alt={review.gameName}
                      className="review-bg"
                      loading="lazy"
                    />
                    <div className="review-overlay"></div>
                  </div>

                  <div className="review-content">
                    <div className="review-header">
                      <h3 className="review-game-name">{review.gameName}</h3>
                      <div className="review-user-info">
                        <div className="user-profile">
                          <img
                            src={review.userAvatar}
                            alt={review.userName}
                            className="user-avatar"
                            loading="lazy"
                          />
                          <div>
                            <p className="user-name">{review.userName}</p>
                            <div className="user-tag">
                              <TagIcon className="tag-icon" />
                              <span>{review.tag}</span>
                            </div>
                          </div>
                        </div>
                        <div className="review-score">
                          <div className="score-value">
                            {review.scoreValue}
                          </div>
                          <div className="score-max">{review.scoreSuffix}</div>
                        </div>
                      </div>
                    </div>

                    <div className="detailed-ratings">
                      {review.metrics.map((metric) => (
                        <div key={`${review.gameName}-${metric.label}`} className="rating-item">
                          <span className="rating-label">{metric.label}:</span>
                          <span className="rating-val">{metric.value}</span>
                        </div>
                      ))}
                    </div>

                    <p className="review-text">{review.review}</p>

                    <div className="review-footer">
                      <div className="helpful-count">
                        <ThumbsUp className="helpful-icon" />
                        <span>{review.helpfulCount}</span>
                      </div>
                      {review.readMoreUrl ? (
                        <a
                          href={review.readMoreUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-read-more"
                        >
                          READ MORE
                        </a>
                      ) : (
                        <button type="button" className="btn-read-more">READ MORE</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="reviews-actions">
            <button
              type="button"
              className="btn-see-more"
              onClick={() => void loadMoreReviews()}
              disabled={feedLoading || !canLoadMoreReviews}
            >
              {feedLoading
                ? "LOADING..."
                : canLoadMoreReviews
                  ? "SEE MORE REVIEWS"
                  : "ALL REVIEWS LOADED"}
              <ArrowRight className="action-icon" />
            </button>
          </div>
        </section>

        {/* Discover More Games Section */}
        <section className="section-block">
          <div className="section-header-flex">
            <h2 className="section-title mb-0">DISCOVER MORE</h2>
            <Link to="/browse" className="btn-view-all">View All →</Link>
          </div>

          <div className="discover-grid">
            {discoverGames.map((game) => (
              <Link key={game.title} to={`/game/${game.slug || game.id}`} className="discover-card">
                <div className="discover-image-wrapper">
                  <img
                    src={game.image}
                    alt={game.title}
                    className="discover-image"
                    loading="lazy"
                  />
                </div>
                <div className="discover-info">
                  <p className="discover-genre">{game.genre}</p>
                  <h3 className="discover-title">{game.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Fun Facts Section */}
        <section className="section-block">
          <div className="section-header">
            <Lightbulb className="section-icon text-white" />
            <h2 className="section-title mb-0">GAMING FUN FACTS</h2>
          </div>

          <div className="facts-grid">
            {/* Minecraft Fact */}
            <div className="fact-card fact-purple">
              <svg
                className="fact-bg-svg"
                viewBox="0 0 200 200"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Sword SVG content kept inline to avoid excessive CSS, acts purely as decoration */}
                <rect x="85" y="20" width="10" height="10" fill="#8B5CF6" />
                <rect x="85" y="30" width="10" height="10" fill="#8B5CF6" />
                <rect x="75" y="40" width="10" height="10" fill="#8B5CF6" />
                <rect x="85" y="40" width="10" height="10" fill="#A78BFA" />
                <rect x="95" y="40" width="10" height="10" fill="#8B5CF6" />
                <rect x="75" y="50" width="10" height="10" fill="#8B5CF6" />
                <rect x="85" y="50" width="10" height="10" fill="#A78BFA" />
                <rect x="95" y="50" width="10" height="10" fill="#8B5CF6" />
                <rect x="85" y="60" width="10" height="10" fill="#8B5CF6" />
                <rect x="85" y="70" width="10" height="10" fill="#8B5CF6" />
                <rect x="85" y="80" width="10" height="10" fill="#8B5CF6" />
                <rect x="85" y="90" width="10" height="10" fill="#A78BFA" />
                <rect x="85" y="100" width="10" height="10" fill="#8B5CF6" />
                <rect x="85" y="110" width="10" height="10" fill="#8B5CF6" />
                <rect x="65" y="120" width="10" height="10" fill="#D4D4D8" />
                <rect x="75" y="120" width="10" height="10" fill="#E4E4E7" />
                <rect x="85" y="120" width="10" height="10" fill="#F4F4F5" />
                <rect x="95" y="120" width="10" height="10" fill="#E4E4E7" />
                <rect x="105" y="120" width="10" height="10" fill="#D4D4D8" />
                <rect x="75" y="130" width="10" height="10" fill="#78350F" />
                <rect x="85" y="130" width="10" height="10" fill="#92400E" />
                <rect x="95" y="130" width="10" height="10" fill="#78350F" />
                <rect x="75" y="140" width="10" height="10" fill="#92400E" />
                <rect x="85" y="140" width="10" height="10" fill="#78350F" />
                <rect x="95" y="140" width="10" height="10" fill="#92400E" />
                <rect x="75" y="150" width="10" height="10" fill="#78350F" />
                <rect x="85" y="150" width="10" height="10" fill="#92400E" />
                <rect x="95" y="150" width="10" height="10" fill="#78350F" />
                <rect x="75" y="160" width="10" height="10" fill="#F59E0B" />
                <rect x="85" y="160" width="10" height="10" fill="#FBBF24" />
                <rect x="95" y="160" width="10" height="10" fill="#F59E0B" />
              </svg>
              <div className="fact-icon-container fact-icon-purple">
                <Gamepad2 className="fact-icon" />
              </div>
              <h3 className="fact-title">MINECRAFT RECORD</h3>
              <p className="fact-desc">
                Minecraft is the best-selling video game of all time with over
                300 million copies sold worldwide, surpassing even Tetris!
              </p>
            </div>

            {/* GTA V Fact */}
            <div className="fact-card fact-green">
              <svg
                className="fact-bg-svg"
                viewBox="0 0 200 200"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="30"
                  y="80"
                  width="120"
                  height="40"
                  rx="8"
                  fill="#EF4444"
                />
                <rect
                  x="40"
                  y="70"
                  width="90"
                  height="30"
                  rx="6"
                  fill="#DC2626"
                />
                <path
                  d="M 60 70 L 75 55 L 110 55 L 120 70 Z"
                  fill="#3B82F6"
                  opacity="0.6"
                />
                <rect
                  x="50"
                  y="85"
                  width="25"
                  height="20"
                  rx="2"
                  fill="#1E40AF"
                  opacity="0.5"
                />
                <rect
                  x="105"
                  y="85"
                  width="25"
                  height="20"
                  rx="2"
                  fill="#1E40AF"
                  opacity="0.5"
                />
                <circle cx="55" cy="125" r="18" fill="#1F2937" />
                <circle cx="55" cy="125" r="12" fill="#4B5563" />
                <circle cx="55" cy="125" r="6" fill="#9CA3AF" />
                <circle cx="125" cy="125" r="18" fill="#1F2937" />
                <circle cx="125" cy="125" r="12" fill="#4B5563" />
                <circle cx="125" cy="125" r="6" fill="#9CA3AF" />
                <rect
                  x="145"
                  y="95"
                  width="8"
                  height="12"
                  rx="2"
                  fill="#FBBF24"
                />
                <rect
                  x="145"
                  y="85"
                  width="8"
                  height="8"
                  rx="1"
                  fill="#F59E0B"
                />
                <rect x="140" y="75" width="4" height="20" fill="#DC2626" />
                <rect
                  x="135"
                  y="72"
                  width="14"
                  height="4"
                  rx="1"
                  fill="#B91C1C"
                />
                <line
                  x1="10"
                  y1="90"
                  x2="25"
                  y2="90"
                  stroke="#10B981"
                  strokeWidth="3"
                  opacity="0.7"
                />
                <line
                  x1="5"
                  y1="100"
                  x2="23"
                  y2="100"
                  stroke="#10B981"
                  strokeWidth="3"
                  opacity="0.7"
                />
                <line
                  x1="8"
                  y1="110"
                  x2="26"
                  y2="110"
                  stroke="#10B981"
                  strokeWidth="3"
                  opacity="0.7"
                />
              </svg>
              <div className="fact-icon-container fact-icon-green">
                <Users className="fact-icon" />
              </div>
              <h3 className="fact-title">GTA V DEVELOPMENT</h3>
              <p className="fact-desc">
                Grand Theft Auto V had a development budget of $265 million,
                making it one of the most expensive games ever created!
              </p>
            </div>

            {/* Witcher 3 Fact */}
            <div className="fact-card fact-yellow">
              <svg
                className="fact-bg-svg"
                viewBox="0 0 200 200"
                xmlns="http://www.w3.org/2000/svg"
              >
                <line
                  x1="140"
                  y1="30"
                  x2="60"
                  y2="150"
                  stroke="#8B4513"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                <line
                  x1="138"
                  y1="35"
                  x2="62"
                  y2="145"
                  stroke="#A0522D"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  d="M 140 20 L 145 30 L 156 32 L 147 40 L 150 52 L 140 46 L 130 52 L 133 40 L 124 32 L 135 30 Z"
                  fill="#FBBF24"
                />
                <path
                  d="M 140 20 L 145 30 L 156 32 L 147 40 L 150 52 L 140 46 L 130 52 L 133 40 L 124 32 L 135 30 Z"
                  fill="#FDE047"
                  opacity="0.6"
                />
                <circle cx="160" cy="25" r="3" fill="#FCD34D" />
                <circle cx="125" cy="18" r="2.5" fill="#FDE047" />
                <circle cx="148" cy="10" r="2" fill="#FBBF24" />
                <circle cx="165" cy="40" r="2.5" fill="#FCD34D" />
                <circle cx="118" cy="35" r="2" fill="#FDE047" />
                <circle cx="130" cy="50" r="2" fill="#A855F7" opacity="0.6" />
                <circle cx="120" cy="70" r="2.5" fill="#C084FC" opacity="0.6" />
                <circle cx="110" cy="90" r="2" fill="#A855F7" opacity="0.6" />
                <circle
                  cx="100"
                  cy="110"
                  r="2.5"
                  fill="#C084FC"
                  opacity="0.6"
                />
                <circle cx="90" cy="130" r="2" fill="#A855F7" opacity="0.6" />
                <ellipse
                  cx="65"
                  cy="145"
                  rx="8"
                  ry="4"
                  fill="#F59E0B"
                  transform="rotate(-45 65 145)"
                />
              </svg>
              <div className="fact-icon-container fact-icon-yellow">
                <Flame className="fact-icon" />
              </div>
              <h3 className="fact-title">WITCHER 3 CONTENT</h3>
              <p className="fact-desc">
                The Witcher 3 has over 450,000 words of dialogue - that's longer
                than all three Lord of the Rings books combined!
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="section-block">
          <div className="cta-container">
            {/* Animated Background Graphics for CTA */}
            <div className="cta-graphics-wrapper">
              <div className="cta-grid-pattern"></div>
              <div className="cta-blob top-left delay-0"></div>
              <div className="cta-blob bottom-right delay-1"></div>
              <div className="cta-blob middle-left delay-half"></div>

              <svg className="cta-shape spin-slow" viewBox="0 0 100 100">
                <polygon points="50,10 90,90 10,90" fill="black" />
              </svg>
              <svg className="cta-shape spin-fast" viewBox="0 0 100 100">
                <rect
                  x="20"
                  y="20"
                  width="60"
                  height="60"
                  fill="black"
                  transform="rotate(45 50 50)"
                />
              </svg>

              <div className="cta-icon-float top-right-icon">
                <Gamepad2 className="h-24 w-24" />
              </div>
              <div className="cta-icon-float bottom-left-icon">
                <Star className="h-20 w-20" />
              </div>

              <div className="cta-sparkle top-sparkle delay-0"></div>
              <div className="cta-sparkle bottom-sparkle delay-half"></div>
              <div className="cta-sparkle middle-sparkle delay-1"></div>
            </div>

            <div className="cta-content">
              <div className="cta-star-header">
                <div className="cta-line"></div>
                <Star className="cta-star-icon" />
                <div className="cta-line"></div>
              </div>

              <h2 className="cta-title">
                READY TO EXPLORE THE GAMING UNIVERSE?
              </h2>
              <p className="cta-desc">
                Join thousands of gamers and start discovering your next
                favorite game today.
              </p>

              <div className="cta-actions">
                <Link to="/browse" className="btn-cta-primary">
                  <span>
                    BROWSE GAMES <ArrowRight className="cta-arrow" />
                  </span>
                </Link>
                <Link to="/login" className="btn-cta-secondary">
                  <span>
                    JOIN COMMUNITY <Users className="cta-users" />
                  </span>
                </Link>
              </div>

              <div className="cta-stats">
                <div className="stat-pill">
                  <p>50K+ Games</p>
                </div>
                <div className="stat-pill">
                  <p>2M+ Gamers</p>
                </div>
                <div className="stat-pill">
                  <p>100K+ Reviews</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Gaming News Section */}
        <section className="section-block">
          <div className="section-header">
            <Newspaper className="section-icon text-white" />
            <h2 className="section-title mb-0">LATEST GAMING NEWS</h2>
          </div>

          <div className="news-grid">
            {newsItems.map((newsItem, index) => {
              const isExternalNews = Boolean(newsItem.url);

              if (isExternalNews) {
                return (
                  <a
                    key={`${newsItem.title}-${index}`}
                    className="news-card"
                    href={newsItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className="news-layout">
                      <div className="news-image-wrapper">
                        <img
                          src={newsItem.image}
                          alt={newsItem.title}
                          className="news-image"
                          loading="lazy"
                        />
                      </div>
                      <div className="news-info">
                        <div className="news-meta">
                          <span className={`news-tag ${newsItem.tagStyle}`}>
                            {newsItem.tag}
                          </span>
                          <span className="news-time">{newsItem.time}</span>
                        </div>
                        <h3 className="news-title">{newsItem.title}</h3>
                        <p className="news-desc">{newsItem.description}</p>
                      </div>
                    </div>
                  </a>
                );
              }

              return (
                <div key={`${newsItem.title}-${index}`} className="news-card">
                  <div className="news-layout">
                    <div className="news-image-wrapper">
                      <img
                        src={newsItem.image}
                        alt={newsItem.title}
                        className="news-image"
                        loading="lazy"
                      />
                    </div>
                    <div className="news-info">
                      <div className="news-meta">
                        <span className={`news-tag ${newsItem.tagStyle}`}>
                          {newsItem.tag}
                        </span>
                        <span className="news-time">{newsItem.time}</span>
                      </div>
                      <h3 className="news-title">{newsItem.title}</h3>
                      <p className="news-desc">{newsItem.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="news-actions">
            <button
              type="button"
              className="btn-see-more"
              onClick={() => void loadMoreNews()}
              disabled={feedLoading || !canLoadMoreNews}
            >
              {feedLoading
                ? "LOADING..."
                : canLoadMoreNews
                  ? "LOAD MORE NEWS"
                  : "ALL NEWS LOADED"}
              <ArrowRight className="action-icon" />
            </button>

            <button
              type="button"
              className="btn-news-refresh"
              onClick={() => void refreshLatestNews()}
              disabled={feedLoading}
            >
              {feedLoading ? "REFRESHING..." : "REFRESH LATEST NEWS"}
            </button>
          </div>
        </section>
      </main>

      {/* Massive Professional Footer */}
      <footer className="footer-area">
        <div className="footer-container">
          <div className="footer-grid">
            {/* Company Info */}
            <div className="footer-column">
              <div className="footer-brand">
                <div className="logo-mark" aria-hidden="true">
                  <svg
                    viewBox="0 0 48 48"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M24 2L42 13V35L24 46L6 35V13L24 2Z"
                      fill="white"
                      stroke="white"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M17 20H15V22H13V24H15V26H17V24H19V22H17V20Z"
                      fill="black"
                    />
                    <circle cx="30" cy="22" r="1.5" fill="black" />
                    <circle cx="33" cy="25" r="1.5" fill="black" />
                    <circle cx="27" cy="25" r="1.5" fill="black" />
                    <circle cx="30" cy="28" r="1.5" fill="black" />
                  </svg>
                </div>
                <h3 className="footer-brand-title">GAME INSIGHTS</h3>
              </div>
              <p className="footer-desc">
                Your ultimate gaming community platform. Discover, track, and
                discuss the best games with millions of players worldwide.
              </p>
              <div className="footer-contact">
                <p>
                  <MapPin className="contact-icon" /> Nagpur, India
                </p>
                <p>
                  <Mail className="contact-icon" /> contact@gameinsights.com
                </p>
              </div>
            </div>

            {/* Quick Links */}
            <div className="footer-column">
              <h4 className="footer-heading">Quick Links</h4>
              <ul className="footer-links">
                <li>
                  <Link to="/">Home</Link>
                </li>
                <li>
                  <Link to="/browse">Games</Link>
                </li>
                <li>
                  <Link to="/library">My Library</Link>
                </li>
                <li>
                  <Link to="/profile">My Profile</Link>
                </li>
                <li>
                  <Link to="/community-chat">Community</Link>
                </li>
              </ul>
            </div>

            {/* Resources */}
            <div className="footer-column">
              <h4 className="footer-heading">Resources</h4>
              <ul className="footer-links">
                <li>
                  <a
                    href="https://www.igdb.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="contact-icon" /> IGDB Database
                  </a>
                </li>
                <li>
                  <a
                    href="https://store.steampowered.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="contact-icon" /> Steam Store
                  </a>
                </li>
                <li>
                  <a href="#">API Documentation</a>
                </li>
                <li>
                  <a href="#">Developer Portal</a>
                </li>
                <li>
                  <a href="#">Help Center</a>
                </li>
              </ul>
            </div>

            {/* Legal & Social */}
            <div className="footer-column">
              <h4 className="footer-heading">Legal & Social</h4>
              <ul className="footer-links mb-spaced">
                <li>
                  <a href="#">About Us</a>
                </li>
                <li>
                  <a href="#">Privacy Policy</a>
                </li>
                <li>
                  <a href="#">Terms of Service</a>
                </li>
                <li>
                  <a href="#">Cookie Policy</a>
                </li>
              </ul>
              <div className="social-icons">
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-icon"
                  aria-label="Facebook"
                >
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
                <a
                  href="https://x.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-icon"
                  aria-label="X"
                >
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                  </svg>
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-icon"
                  aria-label="Instagram"
                >
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
                  </svg>
                </a>
                <a
                  href="https://pinterest.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-icon"
                  aria-label="Pinterest"
                >
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="footer-bottom">
            <div className="footer-bottom-flex">
              <p>&copy; 2026 Game Insights. All rights reserved.</p>
              <p className="footer-bottom-text">
                Powered by IGDB Database • Integrated with Steam Platform
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
