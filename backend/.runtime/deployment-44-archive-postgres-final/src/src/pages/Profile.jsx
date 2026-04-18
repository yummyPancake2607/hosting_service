import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  Clock,
  Users,
  Star,
  ImagePlus,
  Camera,
  Palette,
  Loader2,
} from "lucide-react";
import { useUser } from "../components/context/UserContent";
import { Header } from "../components/Header";
import "./Profile.css";

const backgroundOptions = {
  midnight: "linear-gradient(120deg, #0f172a, #1f2937)",
  ember: "linear-gradient(120deg, #3f1d12, #7c2d12)",
  ocean: "linear-gradient(120deg, #0f172a, #0c4a6e)",
};

export default function Profile() {
  const {
    username,
    dateJoined,
    profileBackground,
    profileAvatarUrl,
    profileBannerUrl,
    gameStatuses,
    gameLookup,
    setProfileBackground,
    uploadProfileMedia,
    isSignedIn,
  } = useUser();

  const [showBackgroundSelector, setShowBackgroundSelector] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadInfo, setUploadInfo] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  if (!isSignedIn) {
    return (
      <div className="profile-page">
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

  const completedGames = gameStatuses.filter((g) => g.status === "completed");
  const playingGames = gameStatuses.filter((g) => g.status === "playing");
  const wishlistGames = gameStatuses.filter((g) => g.status === "wishlist");

  const totalHours = completedGames.length * 40 + playingGames.length * 20;
  const activeBackground = backgroundOptions[profileBackground] || backgroundOptions.midnight;
  const bannerStyle = profileBannerUrl
    ? { backgroundImage: `url(${profileBannerUrl})` }
    : { background: activeBackground };

  const handleImageUpload = async (kind, event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setUploadError("");
    setUploadInfo("");

    if (kind === "avatar") {
      setAvatarUploading(true);
    } else {
      setBannerUploading(true);
    }

    try {
      const result = await uploadProfileMedia(kind, file);

      if (!result?.ok) {
        setUploadError(result?.error || "Could not upload image right now.");
        return;
      }

      setUploadInfo(
        result?.message
          || (kind === "avatar"
            ? "Profile photo updated successfully."
            : "Banner updated successfully."),
      );
    } catch {
      setUploadError("Could not upload image right now.");
    } finally {
      if (kind === "avatar") {
        setAvatarUploading(false);
      } else {
        setBannerUploading(false);
      }
    }
  };

  return (
    <div className="profile-page">
      <Header />

      <div className="profile-container">
        <div className="profile-header-card">
          <div className="profile-bg-wrapper">
            <div
              className={`profile-bg-image ${profileBannerUrl ? "is-photo" : "is-gradient"}`}
              style={bannerStyle}
            />
            <div className="profile-bg-overlay"></div>
            <div className="profile-bg-hint">Customize your profile look</div>

            <div className={`profile-header-actions ${bannerUploading ? "is-visible" : ""}`}>
              <button
                type="button"
                className="profile-action-btn"
                onClick={() => bannerInputRef.current?.click()}
                disabled={bannerUploading}
              >
                {bannerUploading ? (
                  <Loader2 className="btn-icon spin" />
                ) : (
                  <ImagePlus className="btn-icon" />
                )}
                {bannerUploading ? "Uploading" : "Upload Banner"}
              </button>
              <button
                type="button"
                className="profile-action-btn secondary"
                onClick={() => setShowBackgroundSelector((prev) => !prev)}
              >
                <Palette className="btn-icon" />
                Theme
              </button>
            </div>

            <input
              ref={bannerInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden-file-input"
              onChange={(event) => {
                void handleImageUpload("banner", event);
              }}
            />
          </div>

          {showBackgroundSelector && (
            <div className="bg-selector-modal">
              <h3 className="bg-selector-title">Choose Background</h3>
              <div className="bg-selector-grid">
                {Object.entries(backgroundOptions).map(([key, value]) => {
                  const isActive = profileBackground === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setProfileBackground(key);
                        setShowBackgroundSelector(false);
                      }}
                      className={`bg-option-btn ${isActive ? "active" : ""}`}
                    >
                      <div className="bg-option-image" style={{ background: value }} />
                      <div className="bg-option-overlay">
                        <span className="bg-option-text">{key}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="profile-info-section">
            <div className="profile-info-flex">
              <div className="profile-user-details">
                <div className="profile-avatar">
                  {profileAvatarUrl ? (
                    <img
                      src={profileAvatarUrl}
                      alt={`${username} profile`}
                      className="profile-avatar-image"
                    />
                  ) : (
                    <span className="profile-avatar-fallback">
                      {username.charAt(0).toUpperCase()}
                    </span>
                  )}

                  <button
                    type="button"
                    className={`avatar-upload-btn ${avatarUploading ? "is-visible" : ""}`}
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                    aria-label="Upload profile photo"
                  >
                    {avatarUploading ? (
                      <Loader2 className="avatar-upload-icon spin" />
                    ) : (
                      <Camera className="avatar-upload-icon" />
                    )}
                  </button>

                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden-file-input"
                    onChange={(event) => {
                      void handleImageUpload("avatar", event);
                    }}
                  />
                </div>
                <div>
                  <h1 className="profile-name">{username}</h1>
                  <p className="profile-bio">Live profile synced with your account</p>
                  <div className="profile-meta">
                    <span>
                      <Calendar className="meta-icon" />
                      Joined {dateJoined}
                    </span>
                  </div>
                  {uploadError && <p className="profile-upload-notice error">{uploadError}</p>}
                  {uploadInfo && <p className="profile-upload-notice info">{uploadInfo}</p>}
                </div>
              </div>
              <Link to="/community-chat" className="btn-community">
                <Users className="btn-icon" />
                Community
              </Link>
            </div>
          </div>
        </div>

        <div className="profile-stats-grid">
          <div className="profile-stat-card">
            <div className="profile-stat-val text-white">{gameStatuses.length}</div>
            <div className="profile-stat-label">Total Games</div>
          </div>
          <div className="profile-stat-card">
            <div className="profile-stat-val text-green">{playingGames.length}</div>
            <div className="profile-stat-label">Playing Now</div>
          </div>
          <div className="profile-stat-card">
            <div className="profile-stat-val text-blue">{completedGames.length}</div>
            <div className="profile-stat-label">Completed</div>
          </div>
          <div className="profile-stat-card">
            <div className="profile-stat-val flex-center text-white">
              <Clock className="stat-icon-large" />
              {totalHours}
            </div>
            <div className="profile-stat-label">Hours Played</div>
          </div>
        </div>

        <div className="games-collection-wrapper">
          {[
            { title: "Currently Playing", items: playingGames, hoverClass: "hover-green", statusClass: "status-playing", statusText: "Playing" },
            { title: "Completed Games", items: completedGames, hoverClass: "hover-blue", statusClass: "status-completed", statusText: "Completed" },
            { title: "Wishlist", items: wishlistGames, hoverClass: "hover-pink", statusClass: "status-wishlist", statusText: "Wishlist" },
          ].map((group) =>
            group.items.length > 0 ? (
              <div className="games-section" key={group.title}>
                <h2 className="games-section-title">{group.title}</h2>
                <div className="games-grid">
                  {group.items.map((gameStatus) => {
                    const game = gameLookup[gameStatus.gameId];
                    if (!game) return null;
                    return (
                      <Link
                        key={gameStatus.gameId}
                        to={`/game/${gameStatus.gameId}`}
                        className={`profile-game-card ${group.hoverClass}`}
                      >
                        <img src={game.coverImage} alt={game.name} className="game-cover" />
                        <div className={`game-status-badge ${group.statusClass}`}>{group.statusText}</div>
                        <div className="game-card-overlay">
                          <div className="game-card-info">
                            <div className="game-title">{game.name}</div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null,
          )}

          {gameStatuses.length === 0 && (
            <div className="empty-state">
              <h3 className="empty-title">No Games Yet</h3>
              <p className="empty-desc">Start building your profile with live IGDB games.</p>
              <Link to="/browse" className="btn-explore">
                Explore Now
              </Link>
            </div>
          )}


        </div>
      </div>
    </div>
  );
}
