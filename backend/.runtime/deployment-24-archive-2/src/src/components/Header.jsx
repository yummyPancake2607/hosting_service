import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, User, Check, Menu, X } from "lucide-react";
import { useUser } from "../components/context/UserContent";
import { peekSearchGamesApi, searchGamesApi } from "../services/gamesApi";
import "./Header.css"; // Import standard CSS

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSignedIn, currentUser, signOut } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchRef = useRef(null);

  const isActive = (path) => location.pathname === path;

  const handleSearchChange = (e) => {
    const nextQuery = e.target.value;
    setSearchQuery(nextQuery);

    if (!nextQuery.trim()) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const cachedResults = peekSearchGamesApi(nextQuery.trim(), 8, 0);
    if (Array.isArray(cachedResults)) {
      setSearchSuggestions(cachedResults);
      setShowSuggestions(true);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const query = searchQuery.trim();
    if (!query) {
      return;
    }

    const timerId = window.setTimeout(async () => {
      try {
        const results = await searchGamesApi(query, 8);
        if (!isMounted) {
          return;
        }
        setSearchSuggestions(results);
        setShowSuggestions(true);
      } catch {
        if (!isMounted) {
          return;
        }
        setSearchSuggestions([]);
        setShowSuggestions(true);
      }
    }, 250);

    return () => {
      isMounted = false;
      window.clearTimeout(timerId);
    };
  }, [searchQuery]);

  // Handle clicking on a suggestion
  const handleSuggestionClick = (game) => {
    setSearchQuery("");
    setShowSuggestions(false);
    setSearchSuggestions([]);
    setMobileSearchOpen(false);
    setMobileMenuOpen(false);
    navigate(`/game/${game.slug || game.id}`);
  };

  const handleLogout = async () => {
    setMobileSearchOpen(false);
    setMobileMenuOpen(false);
    await signOut();
    navigate("/login");
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen && !mobileSearchOpen) {
      return;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        setMobileSearchOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [mobileMenuOpen, mobileSearchOpen]);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
  };

  const toggleMobileMenu = () => {
    const nextOpen = !mobileMenuOpen;
    setMobileMenuOpen(nextOpen);
    if (nextOpen) {
      setMobileSearchOpen(false);
    }
  };

  const toggleMobileSearch = () => {
    const nextOpen = !mobileSearchOpen;
    setMobileSearchOpen(nextOpen);
    if (nextOpen) {
      setMobileMenuOpen(false);
    }
  };

  return (
    <nav className="header-nav">
      <div className="header-container">
        {/* Logo */}
        <Link to="/" className="header-logo-link" onClick={closeMobileMenu}>
          <div className="header-logo-icon">
            <svg
              className="logo-svg"
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
          <h1 className="header-logo-text">GAME INSIGHTS</h1>
        </Link>

        <div className="header-mobile-actions">
          <button
            type="button"
            className={`header-mobile-toggle ${mobileSearchOpen ? "active" : ""}`}
            onClick={toggleMobileSearch}
            aria-label={mobileSearchOpen ? "Hide search" : "Show search"}
            aria-expanded={mobileSearchOpen}
            aria-controls="header-search-container"
          >
            <Search size={18} />
          </button>

          <button
            type="button"
            className={`header-mobile-toggle ${mobileMenuOpen ? "active" : ""}`}
            onClick={toggleMobileMenu}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="header-nav-links"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Search Bar with Suggestions */}
        <div
          id="header-search-container"
          className={`header-search-container ${mobileSearchOpen ? "is-open" : ""}`}
          ref={searchRef}
        >
          <Search className="header-search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => {
              setMobileSearchOpen(true);
              if (searchQuery) {
                setShowSuggestions(true);
              }
            }}
            placeholder="Search games, genres, or communities..."
            className="header-search-input"
          />

          {/* Search Suggestions Dropdown */}
          {showSuggestions && searchSuggestions.length > 0 && (
            <div className="search-dropdown">
              {searchSuggestions.map((game) => (
                <button
                  key={game.key}
                  onClick={() => handleSuggestionClick(game)}
                  className="suggestion-item"
                >
                  <div className="suggestion-poster-wrap" aria-hidden="true">
                    <img
                      src={game.coverImage}
                      alt=""
                      className="suggestion-poster"
                      loading="lazy"
                    />
                  </div>
                  <div className="suggestion-content">
                    <div className="suggestion-title">{game.name}</div>
                    <div className="suggestion-meta">
                      {game.genres.join(", ")} {game.releaseDate !== "Unknown" && `• ${game.releaseDate}`}
                    </div>
                  </div>
                  <div className="suggestion-indicator">
                    <Check className="indicator-icon" />
                  </div>
                </button>
              ))}
              <div className="suggestion-footer">
                Showing {searchSuggestions.length} results
              </div>
            </div>
          )}

          {/* No results message */}
          {showSuggestions && searchQuery && searchSuggestions.length === 0 && (
            <div className="search-dropdown empty-dropdown">
              <p>No games found for "{searchQuery}"</p>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <div
          id="header-nav-links"
          className={`header-nav-links ${mobileMenuOpen ? "is-open" : ""}`}
        >
          <Link
            to="/browse"
            className={`header-nav-link ${isActive("/browse") ? "active" : ""}`}
            onClick={closeMobileMenu}
          >
            Games
          </Link>
          <Link
            to="/library"
            className={`header-nav-link ${isActive("/library") ? "active" : ""}`}
            onClick={closeMobileMenu}
          >
            My Library
          </Link>
          {isSignedIn && (
            <Link
              to="/profile"
              className={`header-nav-link ${isActive("/profile") ? "active" : ""}`}
              onClick={closeMobileMenu}
            >
              My Profile
            </Link>
          )}
          <Link
            to="/community-chat"
            className={`header-nav-link ${isActive("/community-chat") ? "active" : ""}`}
            onClick={closeMobileMenu}
          >
            Community Chat
          </Link>

          {/* Login/Logged In Button */}
          {isSignedIn ? (
            <div className="header-user-actions">
              <div className="header-user-badge">
                <div className="user-badge-icon-wrapper">
                  <User className="user-badge-icon" />
                </div>
                <span className="user-badge-text">
                  {currentUser?.name || "Logged In"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="header-btn-login"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link to="/login" className="header-btn-login" onClick={closeMobileMenu}>
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
