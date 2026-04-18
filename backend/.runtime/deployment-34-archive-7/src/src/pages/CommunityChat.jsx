import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Header } from "../components/Header";
import { useUser } from "../components/context/UserContent";
import { allGamesWorldwide } from "../app/data/allGameslist";
import { gamePosters, getGamePoster, getGameColor } from "../app/data/gamePosters";
import { supabase } from "../lib/supabase";
import {
  createCommunity,
  deleteCommunity,
  fetchCommunities,
  fetchCommunityMembers,
  joinCommunity,
  kickCommunityMember,
  leaveCommunity,
} from "../services/communitiesApi";
import {
  fetchCommunityMessages,
  postCommunityMessage,
} from "../services/communityMessagesApi";
import { getGameDetailsApi, searchGamesApi } from "../services/gamesApi";
import "./CommunityChat.css";

// Helper to get user avatar initials
const getAvatarInitials = (name) => {
  return name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
};

// Helper to format time
const formatTime = (date) => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  } else if (d.toDateString() === yesterday.toDateString()) {
    return "Yesterday " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  } else {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
};

const escapeSvgText = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildPosterFallback = (title, color) => {
  const normalizedTitle = (title || "Game Community").trim();
  const words = normalizedTitle.split(/\s+/).filter(Boolean);
  let lineOne = "";
  let lineTwo = "";

  words.forEach((word) => {
    if ((lineOne + " " + word).trim().length <= 18) {
      lineOne = (lineOne + " " + word).trim();
      return;
    }

    if ((lineTwo + " " + word).trim().length <= 20) {
      lineTwo = (lineTwo + " " + word).trim();
    }
  });

  const safeLineOne = escapeSvgText(lineOne || normalizedTitle.slice(0, 18));
  const safeLineTwo = escapeSvgText(lineTwo || normalizedTitle.slice(18, 38));
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f1116" />
          <stop offset="100%" stop-color="#05070d" />
        </linearGradient>
        <radialGradient id="glow" cx="25%" cy="20%" r="80%">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>
      </defs>
      <rect width="400" height="600" fill="url(#bg)" />
      <rect x="16" y="16" width="368" height="568" rx="22" fill="none" stroke="${color}" stroke-width="2" opacity="0.45" />
      <rect x="24" y="24" width="352" height="552" rx="18" fill="url(#glow)" />
      <circle cx="335" cy="120" r="86" fill="${color}" opacity="0.20" />
      <circle cx="65" cy="515" r="108" fill="${color}" opacity="0.16" />
      <rect x="36" y="246" width="328" height="120" rx="14" fill="#000000" opacity="0.35" />
      <text x="44" y="293" fill="#ffffff" font-size="32" font-family="Arial, sans-serif" font-weight="700">${safeLineOne}</text>
      <text x="44" y="327" fill="#e5e7eb" font-size="24" font-family="Arial, sans-serif" font-weight="600">${safeLineTwo}</text>
      <text x="44" y="356" fill="#a3a3ad" font-size="13" font-family="Arial, sans-serif">Community poster fallback</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const applyPosterFallback = (event, title, color) => {
  const target = event.currentTarget;
  if (target.dataset.fallbackApplied === "true") {
    return;
  }

  const fallbackSrc = buildPosterFallback(title, color);
  target.dataset.fallbackApplied = "true";
  target.src = fallbackSrc;

  // Keep card background and img in sync so poster area never appears blank.
  const posterContainer = target.closest(".card-poster");
  if (posterContainer) {
    posterContainer.style.backgroundImage = `url(${fallbackSrc})`;
  }
};

const normalizePosterKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const isRealCoverImage = (url) =>
  typeof url === "string" && url.length > 0 && !url.startsWith("data:image/svg+xml");

const resolveCommunityPoster = (community, coverMap = {}) => {
  const rawKey = String(community?.game_key || "");
  const normalizedKey = normalizePosterKey(rawKey);
  const normalizedName = normalizePosterKey(community?.game_name || "");

  if (coverMap[normalizedName]) {
    return coverMap[normalizedName];
  }

  if (gamePosters[rawKey]) {
    return gamePosters[rawKey];
  }

  if (gamePosters[normalizedKey]) {
    return gamePosters[normalizedKey];
  }

  if (gamePosters[normalizedName]) {
    return gamePosters[normalizedName];
  }

  return getGamePoster(normalizedName || normalizedKey || rawKey);
};

const INITIAL_CREATE_FORM_STATE = {
  name: "",
  description: "",
  gameKey: "",
};

const resolveCreateGamePoster = (game) => {
  if (isRealCoverImage(game?.coverImage)) {
    return game.coverImage;
  }

  return buildPosterFallback(
    game?.name || "Game",
    getGameColor(String(game?.id || game?.name || "game")),
  );
};

const getCreateGameMeta = (game) => {
  const chunks = [];

  if (game?.year) {
    chunks.push(String(game.year));
  }

  if (Array.isArray(game?.genres) && game.genres.length > 0) {
    chunks.push(game.genres.slice(0, 2).join(", "));
  }

  if (game?.source === "api") {
    chunks.push("Live search");
  }

  return chunks.join(" | ");
};

const toYear = (releaseDate) => {
  if (!releaseDate || typeof releaseDate !== "string") {
    return null;
  }

  const year = Number(releaseDate.slice(0, 4));
  return Number.isFinite(year) ? year : null;
};

export default function CommunityChat() {
  const { isSignedIn } = useUser();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [communities, setCommunities] = useState([]);
  const [communityCoverMap, setCommunityCoverMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");

  // Search filters
  const [sortBy, setSortBy] = useState("popular"); // popular, new, members
  const [filterGenre, setFilterGenre] = useState("all");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [formState, setFormState] = useState(INITIAL_CREATE_FORM_STATE);
  const [createGameQuery, setCreateGameQuery] = useState("");
  const [createGameRemoteResults, setCreateGameRemoteResults] = useState([]);
  const [createGameLoading, setCreateGameLoading] = useState(false);
  const [createGameDropdownOpen, setCreateGameDropdownOpen] = useState(false);
  const [createGameActiveIndex, setCreateGameActiveIndex] = useState(-1);
  const [selectedCreateGame, setSelectedCreateGame] = useState(null);

  const [membersOpenFor, setMembersOpenFor] = useState(null);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState("");
  const [deleteCommunityLoadingId, setDeleteCommunityLoadingId] = useState(null);
  const [activeChatCommunityId, setActiveChatCommunityId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatText, setChatText] = useState("");

  const messagesEndRef = useRef(null);
  const requestedCommunityCoversRef = useRef(new Set());
  const createGamePickerRef = useRef(null);

  const requestedCommunityId = useMemo(() => {
    const rawCommunityId = searchParams.get("communityId");
    if (!rawCommunityId) {
      return null;
    }

    const parsedId = Number(rawCommunityId);
    return Number.isFinite(parsedId) ? parsedId : null;
  }, [searchParams]);

  const gameOptions = useMemo(
    () =>
      allGamesWorldwide
        .map((game) => ({
          id: String(game.id),
          name: game.name,
          genres: game.genres || [],
          year: game.year || null,
          source: "local",
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const createGameResults = useMemo(() => {
    const merged = [];
    const seen = new Set();

    createGameRemoteResults.forEach((game) => {
      const dedupeKey = normalizePosterKey(game?.name || game?.id);
      if (!dedupeKey || seen.has(dedupeKey)) {
        return;
      }

      seen.add(dedupeKey);
      merged.push({ ...game, id: String(game.id) });
    });

    return merged.slice(0, 30);
  }, [createGameRemoteResults]);

  const resetCreateForm = useCallback(() => {
    setFormState(INITIAL_CREATE_FORM_STATE);
    setCreateGameQuery("");
    setCreateGameRemoteResults([]);
    setCreateGameLoading(false);
    setCreateGameDropdownOpen(false);
    setCreateGameActiveIndex(-1);
    setSelectedCreateGame(null);
  }, []);

  const onSelectCreateGame = useCallback((game) => {
    const safeId = String(game.id);
    setSelectedCreateGame({ ...game, id: safeId });
    setCreateGameQuery(game.name);
    setFormState((prev) => ({ ...prev, gameKey: safeId }));
    setCreateGameDropdownOpen(false);
    setCreateGameActiveIndex(-1);
    setCreateError("");
  }, []);

  useEffect(() => {
    if (!showCreateForm) {
      resetCreateForm();
      setCreateError("");
    }
  }, [showCreateForm, resetCreateForm]);

  useEffect(() => {
    if (!showCreateForm) {
      return;
    }

    const handlePointerDown = (event) => {
      if (!createGamePickerRef.current?.contains(event.target)) {
        setCreateGameDropdownOpen(false);
        setCreateGameActiveIndex(-1);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [showCreateForm]);

  useEffect(() => {
    if (!showCreateForm) {
      return;
    }

    const trimmedQuery = createGameQuery.trim();
    if (trimmedQuery.length < 2) {
      setCreateGameRemoteResults([]);
      setCreateGameLoading(false);
      return;
    }

    let canceled = false;
    const timer = window.setTimeout(async () => {
      setCreateGameLoading(true);

      try {
        const results = await searchGamesApi(trimmedQuery, 16, 0);
        if (canceled) {
          return;
        }

        setCreateGameRemoteResults(
          results
            .filter((game) => game?.name)
            .map((game) => ({
              id: String(game.key || game.id),
              name: game.name,
              genres: Array.isArray(game.genres) ? game.genres : [],
              year: toYear(game.releaseDate),
              coverImage: game.coverImage,
              source: "api",
            })),
        );
      } catch {
        if (!canceled) {
          setCreateGameRemoteResults([]);
        }
      } finally {
        if (!canceled) {
          setCreateGameLoading(false);
        }
      }
    }, 250);

    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [createGameQuery, showCreateForm]);

  useEffect(() => {
    setCreateGameActiveIndex(-1);
  }, [createGameQuery, createGameResults.length]);

  // Get unique genres from all games
  const allGenres = useMemo(() => {
    const genres = new Set();
    gameOptions.forEach((game) => {
      game.genres?.forEach((g) => genres.add(g));
    });
    return Array.from(genres).sort();
  }, [gameOptions]);

  // Filter communities based on search, genre, and sorting
  const filteredCommunities = useMemo(() => {
    let filtered = [...communities];

    // Filter by search term
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((c) =>
        c.name.toLowerCase().includes(searchLower) ||
        c.game_name.toLowerCase().includes(searchLower) ||
        c.description?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by genre
    if (filterGenre !== "all") {
      filtered = filtered.filter((c) => {
        const game = gameOptions.find((g) => g.id === c.game_key);
        return game?.genres?.includes(filterGenre);
      });
    }

    // Sort
    switch (sortBy) {
      case "new":
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case "members":
        filtered.sort((a, b) => b.members_count - a.members_count);
        break;
      case "popular":
      default:
        filtered.sort((a, b) => b.members_count - a.members_count);
    }

    return filtered;
  }, [communities, search, filterGenre, sortBy, gameOptions]);

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token;
  }, []);

  const loadCommunities = useCallback(
    async (query) => {
      setLoading(true);
      setPageError("");

      try {
        const accessToken = isSignedIn ? await getAccessToken() : undefined;
        const items = await fetchCommunities(query, accessToken);
        setCommunities(items);
      } catch {
        setPageError("Could not load communities. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [getAccessToken, isSignedIn],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCommunities(search);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadCommunities, search]);

  useEffect(() => {
    const uniqueNames = Array.from(
      new Set(
        communities
          .map((community) => community.game_name)
          .filter(Boolean)
          .map((name) => normalizePosterKey(name)),
      ),
    );

    const missingCoverKeys = uniqueNames.filter(
      (key) => !communityCoverMap[key] && !requestedCommunityCoversRef.current.has(key),
    );

    if (missingCoverKeys.length === 0) {
      return;
    }

    let canceled = false;

    const loadCommunityCovers = async () => {
      const fetchedEntries = await Promise.all(
        missingCoverKeys.map(async (normalizedGameName) => {
          requestedCommunityCoversRef.current.add(normalizedGameName);

          const communityMatch = communities.find(
            (community) => normalizePosterKey(community.game_name) === normalizedGameName,
          );
          const queryName = communityMatch?.game_name;
          const queryKey = communityMatch?.game_key;

          if (!queryName && !queryKey) {
            return [normalizedGameName, null];
          }

          try {
            if (queryKey) {
              try {
                const details = await getGameDetailsApi(queryKey);
                if (isRealCoverImage(details?.coverImage)) {
                  return [normalizedGameName, details.coverImage];
                }
              } catch {
                // Ignore and continue with search-based fallback.
              }
            }

            const searchQueries = [queryName, queryKey].filter(Boolean);

            for (const searchQuery of searchQueries) {
              const results = await searchGamesApi(searchQuery, 12, 0);
              const firstWithRealCover = results.find((game) =>
                isRealCoverImage(game?.coverImage),
              );

              if (firstWithRealCover?.coverImage) {
                return [normalizedGameName, firstWithRealCover.coverImage];
              }
            }

            return [normalizedGameName, null];
          } catch {
            return [normalizedGameName, null];
          }
        }),
      );

      if (canceled) {
        return;
      }

      setCommunityCoverMap((previous) => {
        const next = { ...previous };
        fetchedEntries.forEach(([key, cover]) => {
          if (cover) {
            next[key] = cover;
          }
        });
        return next;
      });
    };

    void loadCommunityCovers();

    return () => {
      canceled = true;
    };
  }, [communities, communityCoverMap]);

  const onCreateCommunity = async (event) => {
    event.preventDefault();
    setCreateError("");

    const chosenGame =
      selectedCreateGame && String(selectedCreateGame.id) === String(formState.gameKey)
        ? selectedCreateGame
        : gameOptions.find((game) => game.id === formState.gameKey);

    if (!chosenGame) {
      setCreateError("Please select the game this community belongs to.");
      return;
    }

    if (formState.name.trim().length < 3) {
      setCreateError("Community name must be at least 3 characters.");
      return;
    }

    setCreateLoading(true);
    try {
      const accessToken = await getAccessToken();
      await createCommunity(
        {
          name: formState.name.trim(),
          description: formState.description.trim(),
          game_key: String(chosenGame.id),
          game_name: chosenGame.name,
        },
        accessToken,
      );

      resetCreateForm();
      setShowCreateForm(false);
      await loadCommunities(search);
    } catch {
      setCreateError("Could not create community. Please try again.");
    } finally {
      setCreateLoading(false);
    }
  };

  const onJoin = async (communityId) => {
    try {
      const accessToken = await getAccessToken();
      await joinCommunity(communityId, accessToken);
      await loadCommunities(search);
    } catch {
      setPageError("Could not join this community right now.");
    }
  };

  const onLeave = async (communityId) => {
    try {
      const accessToken = await getAccessToken();
      await leaveCommunity(communityId, accessToken);
      if (membersOpenFor === communityId) {
        setMembersOpenFor(null);
        setMembers([]);
      }
      if (activeChatCommunityId === communityId) {
        setActiveChatCommunityId(null);
        setChatMessages([]);
        setChatText("");
      }
      await loadCommunities(search);
    } catch {
      setPageError("Could not leave this community right now.");
    }
  };

  const onOpenMembers = async (communityId) => {
    setMembersOpenFor(communityId);
    setMembersLoading(true);
    setMembersError("");

    try {
      const accessToken = await getAccessToken();
      const items = await fetchCommunityMembers(communityId, accessToken);
      setMembers(items);
    } catch {
      setMembersError("Could not load members. Only owners can view this list.");
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  const loadChatMessages = useCallback(
    async (communityId) => {
      setChatLoading(true);
      setChatError("");

      try {
        const accessToken = await getAccessToken();
        const items = await fetchCommunityMessages(communityId, accessToken);
        setChatMessages(items);
      } catch {
        setChatError("Could not load chat messages.");
        setChatMessages([]);
      } finally {
        setChatLoading(false);
      }
    },
    [getAccessToken],
  );

  useEffect(() => {
    if (!requestedCommunityId || communities.length === 0) {
      return;
    }

    const targetCommunity = communities.find((community) => community.id === requestedCommunityId);
    if (!targetCommunity) {
      return;
    }

    if (!targetCommunity.is_joined && !targetCommunity.is_owner) {
      if (isSignedIn) {
        setPageError("Join this community first to open its chat.");
      }
      return;
    }

    if (activeChatCommunityId === requestedCommunityId) {
      return;
    }

    setActiveChatCommunityId(requestedCommunityId);
    setChatText("");
    void loadChatMessages(requestedCommunityId);
  }, [requestedCommunityId, communities, activeChatCommunityId, isSignedIn, loadChatMessages]);

  const openChat = async (communityId) => {
    setActiveChatCommunityId(communityId);
    setChatText("");
    await loadChatMessages(communityId);
  };

  const sendChatMessage = async (communityId) => {
    const content = chatText.trim();
    if (!content) {
      return;
    }

    try {
      const accessToken = await getAccessToken();
      const savedMessage = await postCommunityMessage(communityId, content, accessToken);
      setChatMessages((prev) => [...prev, savedMessage]);
      setChatText("");
    } catch {
      setChatError("Could not send your message.");
    }
  };

  const onKick = async (communityId, userId) => {
    const reason = window.prompt("Reason for removal (optional):", "spam or abusive language");

    try {
      const accessToken = await getAccessToken();
      await kickCommunityMember(communityId, userId, reason || null, accessToken);
      await onOpenMembers(communityId);
      await loadCommunities(search);
    } catch {
      setMembersError("Could not remove this user.");
    }
  };

  const onDeleteCommunity = async (community) => {
    if (!community?.is_owner) {
      return;
    }

    const isConfirmed = window.confirm(
      `Delete "${community.name}" community? This will permanently remove all members and messages.`,
    );

    if (!isConfirmed) {
      return;
    }

    setDeleteCommunityLoadingId(community.id);
    setMembersError("");

    try {
      const accessToken = await getAccessToken();
      await deleteCommunity(community.id, accessToken);

      if (activeChatCommunityId === community.id) {
        setActiveChatCommunityId(null);
        setChatMessages([]);
        setChatText("");
      }

      setMembersOpenFor(null);
      setMembers([]);
      await loadCommunities(search);
    } catch {
      setMembersError("Could not delete community right now.");
    } finally {
      setDeleteCommunityLoadingId(null);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const activeCommunity = communities.find((c) => c.id === activeChatCommunityId);
  const joinedCommunities = communities.filter((c) => c.is_joined || c.is_owner);
  const managedCommunity = communities.find((c) => c.id === membersOpenFor);

  if (activeChatCommunityId && activeCommunity) {
    return (
      <div className="discord-wrapper">
        <Header />
        <div className="discord-container">
          {/* Sidebar - Server List */}
          <aside className="discord-sidebar">
            <div className="server-list">
              <button
                className="server-icon nav-back"
                onClick={() => setActiveChatCommunityId(null)}
                title="All Communities"
              >
                All
              </button>
              <div className="server-divider"></div>
              {joinedCommunities.map((community) => (
                  <button
                    key={community.id}
                    className={`server-icon ${activeChatCommunityId === community.id ? "active" : ""}`}
                    onClick={() => openChat(community.id)}
                    title={community.name}
                  >
                    {community.name.slice(0, 2).toUpperCase()}
                  </button>
                ))}
              {isSignedIn && joinedCommunities.length > 0 && (
                <button
                  className="server-icon browse-communities"
                  onClick={() => setActiveChatCommunityId(null)}
                  title="Browse more communities"
                >
                  Browse
                </button>
              )}
            </div>
          </aside>

          {/* Main Chat Area */}
          <main className="discord-main">
            {/* Chat Header */}
            <div className="discord-header">
              <div className="header-content">
                <h2 className="channel-name"># {activeCommunity.name}</h2>
                <p className="channel-topic">
                  {activeCommunity.description || "Community discussion"}
                </p>
              </div>
              <div className="header-actions">
                <span className="header-meta">{activeCommunity.game_name}</span>
                <span className="header-meta">{activeCommunity.members_count} members</span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => onOpenMembers(activeChatCommunityId)}
                  title="Members"
                >
                  Members
                </button>
                <button
                  type="button"
                  className="icon-button close-btn"
                  onClick={() => setActiveChatCommunityId(null)}
                  title="Close chat"
                >
                  Back
                </button>
              </div>
            </div>

            <div className="discord-content">
              <section className="discord-chat-column">
                {/* Messages Area */}
                <div className="discord-messages">
                  {chatLoading && <p className="loading-text">Loading messages...</p>}
                  {chatError && <p className="error-message">{chatError}</p>}

                  {!chatLoading && chatMessages.length === 0 && (
                    <div className="empty-state">
                      <div className="empty-icon">#</div>
                      <h3>Welcome to {activeCommunity.name}</h3>
                      <p>Be the first to start the conversation.</p>
                    </div>
                  )}

                  {chatMessages.map((message, index) => {
                    const prevMessage = index > 0 ? chatMessages[index - 1] : null;
                    const sameAuthor =
                      prevMessage && prevMessage.display_name === message.display_name;
                    const showAvatar = !sameAuthor || false;

                    return (
                      <div
                        key={message.id}
                        className={`message-group ${sameAuthor ? "compact" : ""} ${
                          message.is_system ? "system-message" : ""
                        }`}
                      >
                        {showAvatar && (
                          <div className="message-avatar">
                            <div className="avatar">{getAvatarInitials(message.display_name)}</div>
                          </div>
                        )}
                        <div className="message-content">
                          {!sameAuthor && (
                            <div className="message-header">
                              <span className="username">{message.display_name}</span>
                              <span className="timestamp">
                                {formatTime(message.created_at)}
                              </span>
                            </div>
                          )}
                          <p className="message-text">{message.content}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Input */}
                {isSignedIn ? (
                  <div className="chat-input-area">
                    <textarea
                      className="chat-input"
                      placeholder={`Message #${activeCommunity.name}`}
                      value={chatText}
                      onChange={(event) => setChatText(event.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendChatMessage(activeChatCommunityId);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="send-button"
                      onClick={() => void sendChatMessage(activeChatCommunityId)}
                      disabled={!chatText.trim()}
                    >
                      Send
                    </button>
                  </div>
                ) : (
                  <div className="login-prompt">
                    <p>Sign in to participate in chat</p>
                    <Link to="/login" className="login-link">
                      Sign In
                    </Link>
                  </div>
                )}
              </section>

              <aside className="community-context-panel">
                <div className="context-hero">
                  <p className="context-label">Community Game</p>
                  <h3 className="context-title">{activeCommunity.game_name}</h3>
                  <p className="context-subtitle">Poster and details for this community</p>
                </div>

                <div className="context-split">
                  <div className="context-poster-wrap">
                    <img
                      src={resolveCommunityPoster(activeCommunity, communityCoverMap)}
                      alt={`${activeCommunity.game_name} poster`}
                      className="context-poster"
                      loading="eager"
                      decoding="async"
                      onError={(event) =>
                        applyPosterFallback(
                          event,
                          activeCommunity.game_name,
                          getGameColor(activeCommunity.game_key),
                        )
                      }
                    />
                  </div>

                  <div className="context-details">
                    <p className="context-label">Community</p>
                    <h4 className="context-community-name">{activeCommunity.name}</h4>

                    <p className="context-description">
                      {activeCommunity.description || "No description added yet."}
                    </p>

                    <ul className="context-stats" aria-label="Community stats">
                      <li>
                        <span>Members</span>
                        <strong>{activeCommunity.members_count}</strong>
                      </li>
                      <li>
                        <span>Host</span>
                        <strong>{activeCommunity.owner_name}</strong>
                      </li>
                    </ul>
                  </div>
                </div>
              </aside>
            </div>
          </main>

          {/* Members Sidebar */}
          {membersOpenFor === activeChatCommunityId && (
            <aside className="discord-members">
              <div className="members-header">
                <h3>Members ({members.length})</h3>
                <button
                  className="close-members"
                  onClick={() => setMembersOpenFor(null)}
                  title="Close members"
                >
                  ✕
                </button>
              </div>
              <div className="members-list-container">
                {membersLoading && <p className="loading-text">Loading members...</p>}
                {membersError && <p className="error-message">{membersError}</p>}

                {!membersLoading && members.length === 0 && (
                  <p className="loading-text">No members found.</p>
                )}

                {!membersLoading &&
                  members.map((member) => (
                    <div key={member.user_id} className="member-item">
                      <div className="member-avatar">
                        {getAvatarInitials(member.display_name)}
                      </div>
                      <div className="member-info">
                        <p className="member-name">{member.display_name}</p>
                        {member.role === "owner" && <span className="owner-badge">Owner</span>}
                      </div>
                      {activeCommunity.is_owner && member.role !== "owner" && (
                        <button
                          className="kick-btn"
                          onClick={() =>
                            onKick(activeChatCommunityId, member.user_id)
                          }
                          title="Remove member"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </aside>
          )}
        </div>
      </div>
    );
  }

  // Communities Browse View
  return (
    <div className="chat-page">
      <Header />
      <main className="chat-container">
        <section className="page-header">
          <div>
            <h1 className="page-title">Game Communities</h1>
            <p className="page-subtitle">
              Search by game, join communities, or create your own and moderate members.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              if (!isSignedIn) {
                return;
              }
              setShowCreateForm((value) => !value);
              setCreateError("");
            }}
          >
            {isSignedIn ? (showCreateForm ? "Close" : "Create Community") : "Sign In to Create"}
          </button>
        </section>

        {!isSignedIn && (
          <section className="panel">
            <h2 className="section-heading">Browse Communities</h2>
            <p className="muted-text">
              You can search and explore communities now. Sign in to create, join, or manage
              members.
            </p>
            <Link to="/login" className="btn-primary">
              Sign In
            </Link>
          </section>
        )}

        {showCreateForm && isSignedIn && (
          <section className="panel create-panel">
            <h2 className="section-heading">Create Community</h2>
            <form className="create-form" onSubmit={onCreateCommunity}>
              <label className="form-label" htmlFor="community-name">
                Community Name
              </label>
              <input
                id="community-name"
                className="form-input"
                value={formState.name}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Example: Valorant Ranked Grind Squad"
                maxLength={80}
                required
              />

              <label className="form-label" htmlFor="community-game">
                Game
              </label>
              <div className="create-game-picker" ref={createGamePickerRef}>
                <input
                  id="community-game"
                  className="form-input create-game-input"
                  type="search"
                  placeholder="Search any game..."
                  value={createGameQuery}
                  onFocus={() => setCreateGameDropdownOpen(true)}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setCreateGameQuery(nextValue);
                    setCreateGameDropdownOpen(true);

                    if (
                      selectedCreateGame &&
                      nextValue.trim().toLowerCase() !==
                        selectedCreateGame.name.trim().toLowerCase()
                    ) {
                      setSelectedCreateGame(null);
                      setFormState((prev) => ({ ...prev, gameKey: "" }));
                    }
                  }}
                  onKeyDown={(event) => {
                    if (!createGameDropdownOpen) {
                      return;
                    }

                    if (createGameResults.length === 0) {
                      if (event.key === "Escape") {
                        setCreateGameDropdownOpen(false);
                        setCreateGameActiveIndex(-1);
                      }
                      return;
                    }

                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setCreateGameActiveIndex((prev) => {
                        const next = prev + 1;
                        return next >= createGameResults.length ? 0 : next;
                      });
                      return;
                    }

                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setCreateGameActiveIndex((prev) => {
                        const next = prev - 1;
                        return next < 0 ? createGameResults.length - 1 : next;
                      });
                      return;
                    }

                    if (event.key === "Enter" && createGameResults.length > 0) {
                      event.preventDefault();
                      const targetIndex = createGameActiveIndex >= 0 ? createGameActiveIndex : 0;
                      onSelectCreateGame(createGameResults[targetIndex]);
                      return;
                    }

                    if (event.key === "Escape") {
                      setCreateGameDropdownOpen(false);
                      setCreateGameActiveIndex(-1);
                    }
                  }}
                  aria-label="Game"
                  aria-expanded={createGameDropdownOpen}
                  aria-autocomplete="list"
                  aria-controls="community-game-results"
                  role="combobox"
                  required
                />

                {selectedCreateGame && (
                  <div className="create-game-selected" aria-live="polite">
                    <img
                      src={resolveCreateGamePoster(selectedCreateGame)}
                      alt={`${selectedCreateGame.name} poster`}
                      className="create-game-selected-poster"
                      loading="lazy"
                      decoding="async"
                      onError={(event) =>
                        applyPosterFallback(
                          event,
                          selectedCreateGame.name,
                          getGameColor(selectedCreateGame.id),
                        )
                      }
                    />
                    <div className="create-game-selected-text">
                      <p className="create-game-selected-title">{selectedCreateGame.name}</p>
                      <p className="create-game-selected-meta">
                        {getCreateGameMeta(selectedCreateGame) || "Ready for community setup"}
                      </p>
                    </div>
                  </div>
                )}

                {createGameDropdownOpen && (
                  <div
                    id="community-game-results"
                    className="create-game-dropdown"
                    role="listbox"
                  >
                    {createGameQuery.trim().length < 2 && !createGameLoading && (
                      <p className="create-game-status">Type at least 2 characters to search.</p>
                    )}

                    {createGameQuery.trim().length >= 2 && createGameLoading && (
                      <p className="create-game-status">Searching global game database...</p>
                    )}

                    {createGameQuery.trim().length >= 2 && !createGameLoading && createGameResults.length === 0 && (
                      <p className="create-game-status">No games found. Try a different search.</p>
                    )}

                    {createGameQuery.trim().length >= 2 && !createGameLoading &&
                      createGameResults.map((game, index) => {
                        const isSelected = selectedCreateGame?.id === game.id;
                        const isActive = index === createGameActiveIndex;

                        return (
                          <button
                            key={`${game.id}-${game.name}`}
                            type="button"
                            className={`create-game-option${isSelected ? " is-selected" : ""}${
                              isActive ? " is-active" : ""
                            }`}
                            onMouseEnter={() => setCreateGameActiveIndex(index)}
                            onClick={() => onSelectCreateGame(game)}
                            role="option"
                            aria-selected={isSelected}
                          >
                            <img
                              src={resolveCreateGamePoster(game)}
                              alt={`${game.name} cover`}
                              className="create-game-option-poster"
                              loading="lazy"
                              decoding="async"
                              onError={(event) =>
                                applyPosterFallback(
                                  event,
                                  game.name,
                                  getGameColor(game.id),
                                )
                              }
                            />
                            <span className="create-game-option-text">
                              <span className="create-game-option-name">{game.name}</span>
                              <span className="create-game-option-meta">
                                {getCreateGameMeta(game) || "Game"}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>

              <label className="form-label" htmlFor="community-description">
                Description
              </label>
              <textarea
                id="community-description"
                className="form-textarea"
                value={formState.description}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="What is this community about?"
                maxLength={500}
                rows={3}
              />

              {createError && <p className="error-text">{createError}</p>}

              <button type="submit" className="btn-primary" disabled={createLoading}>
                {createLoading ? "Creating..." : "Create"}
              </button>
            </form>
          </section>
        )}

        <section className="panel search-panel">
          <div className="search-controls">
            <div className="search-box-wrapper">
              <input
                className="search-input"
                type="search"
                placeholder="🔍 Search by game name or community..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="filters-row">
              <select
                className="filter-select"
                value={filterGenre}
                onChange={(e) => setFilterGenre(e.target.value)}
              >
                <option value="all">All Genres</option>
                {allGenres.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>

              <select
                className="filter-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="popular">Most Popular</option>
                <option value="members">Most Members</option>
                <option value="new">Newest</option>
              </select>
            </div>
          </div>

          {(search || filterGenre !== "all") && filteredCommunities.length > 0 && (
            <p className="results-count">
              Found {filteredCommunities.length} communit{filteredCommunities.length === 1 ? "y" : "ies"}
            </p>
          )}
        </section>

          <div className="community-list">
            {pageError && <p className="error-text">{pageError}</p>}
            {loading && <p className="muted-text">Loading communities...</p>}

            {!loading && filteredCommunities.length === 0 && (
              <div className="empty-box full-width">
                <div className="empty-icon">🎮</div>
                <h3>No communities found</h3>
                <p>Try adjusting your search filters or create your own community</p>
              </div>
            )}

            {filteredCommunities.map((community) => {
              const communityPosterSrc = resolveCommunityPoster(community, communityCoverMap);

              return (
                <article
                  key={community.id}
                  className="community-card-enhanced"
                  style={{
                    "--game-color": getGameColor(community.game_key),
                  }}
                >
                {/* Poster Image */}
                <div className="card-poster">
                  <img
                    src={communityPosterSrc}
                    alt={community.game_name}
                    className="poster-image"
                    loading="eager"
                    fetchPriority="high"
                    decoding="sync"
                    onError={(event) =>
                      applyPosterFallback(
                        event,
                        community.game_name,
                        getGameColor(community.game_key),
                      )
                    }
                  />
                </div>

                {/* Card Content */}
                <div className="card-body">
                  {/* Game Info & Badges */}
                  <div className="game-info">
                    <span className="game-tag">{community.game_name}</span>
                    <div className="member-badge">
                      👥 {community.members_count} Members
                    </div>
                    {isSignedIn && community.is_joined && (
                      <span className="joined-badge">✓ Joined</span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <h3 className="community-name">{community.name}</h3>
                  <p className="community-description">
                    {community.description || "A great community for gaming! Join us to chat, make friends, and enjoy games together."}
                  </p>

                  {/* Host Info */}
                  <div className="host-info">
                    <span className="host-label">Host: {community.owner_name}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="card-actions">
                    {!isSignedIn && (
                      <Link to="/login" className="action-btn primary">
                        Sign In to Join
                      </Link>
                    )}

                    {isSignedIn && !community.is_joined && (
                      <button
                        type="button"
                        className="action-btn primary"
                        onClick={() => onJoin(community.id)}
                      >
                        Join Community
                      </button>
                    )}

                    {isSignedIn && community.is_joined && !community.is_owner && (
                      <button
                        type="button"
                        className="action-btn secondary"
                        onClick={() => onLeave(community.id)}
                      >
                        Leave
                      </button>
                    )}

                    {isSignedIn && (community.is_joined || community.is_owner) && (
                      <button
                        type="button"
                        className="action-btn primary"
                        onClick={() => void openChat(community.id)}
                      >
                        💬 Chat
                      </button>
                    )}

                    {isSignedIn && community.is_owner && (
                      <button
                        type="button"
                        className="action-btn secondary"
                        onClick={() => void onOpenMembers(community.id)}
                      >
                        Manage
                      </button>
                    )}
                  </div>
                </div>
                </article>
              );
            })}
          </div>

        {isSignedIn && !activeChatCommunityId && membersOpenFor && managedCommunity && (
          <div
            className="manage-modal-overlay"
            onClick={() => {
              setMembersOpenFor(null);
              setMembers([]);
            }}
          >
            <section
              className="manage-modal"
              onClick={(event) => event.stopPropagation()}
              aria-label="Community member management"
            >
              <header className="manage-modal-header">
                <div>
                  <h3>Manage Members</h3>
                  <p>{managedCommunity.name}</p>
                </div>
                <div className="manage-modal-header-actions">
                  {managedCommunity.is_owner && (
                    <button
                      type="button"
                      className="btn-delete-community"
                      onClick={() => void onDeleteCommunity(managedCommunity)}
                      disabled={deleteCommunityLoadingId === managedCommunity.id}
                    >
                      {deleteCommunityLoadingId === managedCommunity.id
                        ? "Deleting..."
                        : "Delete Community"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="close-members"
                    onClick={() => {
                      setMembersOpenFor(null);
                      setMembers([]);
                    }}
                  >
                    ✕
                  </button>
                </div>
              </header>

              <div className="manage-modal-body">
                {membersLoading && <p className="loading-text">Loading members...</p>}
                {membersError && <p className="error-message">{membersError}</p>}

                {!membersLoading && !membersError && members.length === 0 && (
                  <p className="loading-text">No members found.</p>
                )}

                {!membersLoading &&
                  members.map((member) => (
                    <div key={member.user_id} className="member-item">
                      <div className="member-avatar">
                        {getAvatarInitials(member.display_name)}
                      </div>
                      <div className="member-info">
                        <p className="member-name">{member.display_name}</p>
                        {member.role === "owner" && <span className="owner-badge">Owner</span>}
                      </div>
                      {managedCommunity.is_owner && member.role !== "owner" && (
                        <button
                          className="kick-btn force-visible"
                          onClick={() => onKick(managedCommunity.id, member.user_id)}
                          title="Remove member"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
