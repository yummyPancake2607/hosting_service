import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Gamepad2,
  Sword,
  Users,
  Zap,
  Trophy,
  Heart,
  Target,
  Sparkles,
} from "lucide-react";
import { Header } from "../components/Header";
import { peekSearchGamesApi, searchGamesApi } from "../services/gamesApi";
import "./Browse.css";

const PAGE_SIZE = 24;

export default function Browse() {
  const [searchParams] = useSearchParams();
  const genreFromUrl = searchParams.get("genre");
  const [selectedGenre, setSelectedGenre] = useState(genreFromUrl || "All Games");
  const [allGames, setAllGames] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (genreFromUrl) {
      setSelectedGenre(genreFromUrl);
    }
  }, [genreFromUrl]);

  const loadGames = async (nextOffset, replace = false) => {
    const query = selectedGenre === "All Games" ? "" : selectedGenre;
    const cachedPage = replace ? peekSearchGamesApi(query, PAGE_SIZE, nextOffset) : null;
    const hasCachedPage = Array.isArray(cachedPage);

    if (replace && hasCachedPage) {
      setAllGames(cachedPage);
      setOffset(nextOffset + cachedPage.length);
      setHasMore(cachedPage.length === PAGE_SIZE);
      setLoadError("");
      setIsLoading(false);
    }

    if (replace) {
      if (!hasCachedPage) {
        setIsLoading(true);
      }
    } else {
      setIsLoadingMore(true);
    }

    try {
      const games = await searchGamesApi(query, PAGE_SIZE, nextOffset);
      setAllGames((prev) => (replace ? games : [...prev, ...games]));
      setOffset(nextOffset + games.length);
      setHasMore(games.length === PAGE_SIZE);
      setLoadError("");
    } catch {
      if (replace) {
        setAllGames([]);
      }
      setHasMore(false);
      setLoadError("Could not load games right now. Make sure backend is running and try again.");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    setAllGames([]);
    setOffset(0);
    setHasMore(true);
    void loadGames(0, true);
  }, [selectedGenre]);

  useEffect(() => {
    if (!hasMore || isLoading || isLoadingMore || !loadMoreRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting) {
          void loadGames(offset, false);
        }
      },
      { rootMargin: "300px" },
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, offset]);

  const genres = [
    { name: "All Games", icon: Gamepad2 },
    { name: "Action", icon: Sword },
    { name: "RPG", icon: Users },
    { name: "FPS", icon: Target },
    { name: "Adventure", icon: Sparkles },
    { name: "Open World", icon: Trophy },
    { name: "Shooter", icon: Zap },
    { name: "Souls-like", icon: Heart },
  ];

  const filteredGames = allGames;

  return (
    <div className="browse-page">
      <Header />

      <main className="browse-container">
        <section className="browse-hero">
          <p className="browse-kicker">Discover</p>
          <h1 className="browse-title">Games by Genre</h1>
          <p className="browse-subtitle">
            Switch genres instantly and explore a curated live feed from IGDB.
          </p>
        </section>

        <div className="genre-filters-wrapper">
          {genres.map((genre) => {
            const Icon = genre.icon;
            const isActive = selectedGenre === genre.name;
            return (
              <button
                key={genre.name}
                onClick={() => setSelectedGenre(genre.name)}
                className={`btn-genre ${isActive ? "active" : ""}`}
              >
                <Icon className="genre-icon" />
                {genre.name}
              </button>
            );
          })}
        </div>

        <div className="games-section">
          <div className="games-grid-header">
            <h2 className="games-grid-title">
              {selectedGenre === "All Games" ? "All Games" : `${selectedGenre} Games`}
            </h2>
            <p className="games-count">
              {isLoading ? "Loading games..." : `${filteredGames.length} games loaded`}
            </p>
          </div>

          <div className="browse-games-grid">
            {filteredGames.map((game) => (
              <Link key={game.key} to={`/game/${game.slug || game.id}`} className="browse-game-card">
                <div className="browse-game-cover-wrapper">
                  <img src={game.coverImage} alt={game.name} className="browse-game-cover" loading="lazy" />
                </div>
                <div className="browse-card-overlay">
                  <p className="browse-card-genre">{game.genres[0] || "Genre"}</p>
                  <h3 className="browse-card-title">{game.name}</h3>

                  <div className="browse-card-rating">
                    <div className="stars-wrapper">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`star-icon ${i < Math.round((game.rating || 0) / 2) ? "star-filled" : "star-empty"}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="rating-text">{game.rating ?? "N/A"}/10</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {filteredGames.length === 0 && !isLoading && (
            <div className="browse-empty-state">
              <p>{loadError || "No games found in this genre."}</p>
              {loadError && (
                <button
                  type="button"
                  className="btn-genre active"
                  onClick={() => void loadGames(0, true)}
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {filteredGames.length > 0 && hasMore && (
            <div className="browse-empty-state">
              <button
                type="button"
                className="btn-genre active"
                onClick={() => void loadGames(offset, false)}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Loading more..." : "Load More Games"}
              </button>
              <div ref={loadMoreRef} style={{ height: "1px" }} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
