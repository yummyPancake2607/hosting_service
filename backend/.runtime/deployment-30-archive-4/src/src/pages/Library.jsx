import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Filter } from "lucide-react";
import { useUser } from "../components/context/UserContent";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Header } from "../components/Header";
import "./Library.css";

export default function Library() {
  const { gameStatuses, gameLookup, isSignedIn, libraryError, refreshLibrary } = useUser();
  const [activeFilter, setActiveFilter] = useState("all");

  if (!isSignedIn) {
    return (
      <div className="library-page">
        <Header />
        <div className="auth-prompt-container">
          <div className="auth-prompt-content">
            <h1 className="auth-prompt-title">Please Sign In</h1>
            <Link to="/login" className="btn-login">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const sortedGameStatuses = [...gameStatuses].sort((a, b) => {
    const order = { playing: 0, completed: 1, wishlist: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  const filteredGames =
    activeFilter === "all"
      ? sortedGameStatuses
      : gameStatuses.filter((g) => g.status === activeFilter);

  const getStatusLabel = (status) => {
    switch (status) {
      case "playing":
        return { text: "Playing", styleClass: "status-playing" };
      case "completed":
        return { text: "Completed", styleClass: "status-completed" };
      case "wishlist":
        return { text: "Wishlist", styleClass: "status-wishlist" };
      default:
        return { text: "", styleClass: "" };
    }
  };

  const filterButtons = [
    { type: "all", label: "All Games", activeClass: "active-all" },
    { type: "playing", label: "Playing", activeClass: "active-playing" },
    { type: "completed", label: "Completed", activeClass: "active-completed" },
    { type: "wishlist", label: "Wishlist", activeClass: "active-wishlist" },
  ];

  return (
    <div className="library-page">
      <Header />

      <div className="library-container">
        <div className="library-header">
          <h1 className="library-title">My Library</h1>
          <p className="library-subtitle">Synced to your account</p>
        </div>

        {libraryError && (
          <div className="browse-empty-state" style={{ marginBottom: "1rem" }}>
            <p>{libraryError}</p>
            <button type="button" className="btn-explore" onClick={() => void refreshLibrary()}>
              Retry
            </button>
          </div>
        )}

        <div className="filters-wrapper">
          <div className="filters-label">
            <Filter className="filter-icon" />
            <span>Filter:</span>
          </div>
          {filterButtons.map((button) => {
            const isActive = activeFilter === button.type;
            return (
              <button
                key={button.type}
                onClick={() => setActiveFilter(button.type)}
                className={`filter-btn ${isActive ? button.activeClass : ""}`}
              >
                {button.label}
                {button.type !== "all" && (
                  <span className="filter-count">
                    ({gameStatuses.filter((g) => g.status === button.type).length})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {filteredGames.length > 0 ? (
          <div className="library-grid">
            {filteredGames.map((gameStatus) => {
              const game = gameLookup[gameStatus.gameId];
              if (!game) return null;
              const statusLabel = getStatusLabel(gameStatus.status);

              return (
                <Link key={gameStatus.gameId} to={`/game/${gameStatus.gameId}`} className="library-card">
                  <ImageWithFallback src={game.coverImage} alt={game.name} className="game-cover" />

                  {statusLabel.text && (
                    <div className={`status-badge ${statusLabel.styleClass}`}>{statusLabel.text}</div>
                  )}

                  <div className="card-overlay">
                    <div className="card-info">
                      <div className="game-name">{game.name}</div>
                      <div className="game-genres">{(game.genres || []).join(" • ")}</div>
                      {gameStatus.status === "completed" && gameStatus.startDate && gameStatus.endDate && (
                        <div className="game-dates">
                          {gameStatus.startDate} → {gameStatus.endDate}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <h3 className="empty-title">
              {activeFilter === "all"
                ? "No Games in Your Library"
                : `No ${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Games`}
            </h3>
            <p className="empty-desc">
              {activeFilter === "all"
                ? "Start building your library from live data."
                : `You don't have any ${activeFilter} games yet.`}
            </p>
            <Link to="/browse" className="btn-explore">
              Explore Games
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
