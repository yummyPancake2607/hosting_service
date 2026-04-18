import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  deleteLibraryEntry,
  fetchMyLibrary,
  upsertLibraryEntry,
} from "../../services/libraryApi";

const UserContext = createContext(undefined);

const PROFILE_MEDIA_BUCKET = "profile-media";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_BANNER_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const inferFileExtension = (file) => {
  const fileNameExt = file?.name?.split(".").pop()?.toLowerCase();
  if (fileNameExt) {
    return fileNameExt;
  }

  const typeToExt = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };

  return typeToExt[file?.type] || "png";
};

export const UserProvider = ({ children }) => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [dateJoined, setDateJoined] = useState("-");
  const [authLoading, setAuthLoading] = useState(true);
  const [profileBackground, setProfileBg] = useState("midnight");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [profileBannerUrl, setProfileBannerUrl] = useState("");
  const [gameStatuses, setGameStatuses] = useState([]);
  const [gameLookup, setGameLookup] = useState({});
  const [libraryError, setLibraryError] = useState("");

  const clearUserState = useCallback(() => {
    setIsSignedIn(false);
    setUsername("");
    setCurrentUser(null);
    setDateJoined("-");
    setProfileBg("midnight");
    setProfileAvatarUrl("");
    setProfileBannerUrl("");
    setGameStatuses([]);
    setGameLookup({});
    setLibraryError("");
  }, []);

  const loadLibrary = useCallback(async (accessToken) => {
    try {
      const items = await fetchMyLibrary(accessToken);
      const statuses = [];
      const lookup = {};

      items.forEach((item) => {
        statuses.push({
          gameId: item.game_key,
          status: item.status,
          startDate: item.start_date || "",
          endDate: item.end_date || "",
        });

        lookup[item.game_key] = {
          id: item.game_id,
          slug: item.game_slug || item.game_key,
          name: item.game_name,
          coverImage: item.cover_image,
          genres: item.genres || [],
        };
      });

      setGameStatuses(statuses);
      setGameLookup(lookup);
      setLibraryError("");
    } catch {
      // Keep UI usable even if backend is temporarily unavailable.
      setGameStatuses([]);
      setGameLookup({});
      setLibraryError("Could not load your library from backend. Please try again.");
    }
  }, []);

  const hydrateFromSession = useCallback(
    async (session) => {
      const user = session?.user;
      if (!user) {
        clearUserState();
        return;
      }

      const fullName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "Gamer";

      const resolvedAvatar =
        user.user_metadata?.custom_avatar_url ||
        user.user_metadata?.avatar_url ||
        "";
      const resolvedBanner =
        user.user_metadata?.profile_banner_url ||
        "";
      const resolvedBackground = user.user_metadata?.profile_background || "midnight";

      setIsSignedIn(true);
      setUsername(fullName);
      setCurrentUser({
        id: user.id,
        name: fullName,
        email: user.email,
        avatarUrl: resolvedAvatar,
        bannerUrl: resolvedBanner,
      });
      setProfileAvatarUrl(resolvedAvatar);
      setProfileBannerUrl(resolvedBanner);
      setProfileBg(resolvedBackground);
      setDateJoined(
        user.created_at
          ? new Date(user.created_at).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })
          : "-",
      );

      await loadLibrary(session?.access_token);
    },
    [clearUserState, loadLibrary],
  );

  const refreshLibrary = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await loadLibrary(session?.access_token);
  }, [loadLibrary]);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (session) {
        await hydrateFromSession(session);
      } else {
        clearUserState();
      }

      if (isMounted) {
        setAuthLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        await hydrateFromSession(session);
      } else {
        clearUserState();
      }
      setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [clearUserState, hydrateFromSession]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
  };

  const signOut = async () => {
    // Clear UI state first so logout always feels immediate.
    clearUserState();
    try {
      await supabase.auth.signOut({ scope: "global" });
      // Explicitly clear localStorage to ensure session is gone
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Local state is already cleared; keep app usable.
      localStorage.clear();
      sessionStorage.clear();
    }
  };

  const setProfileBackground = (background) => {
    setProfileBg(background);

    if (!isSignedIn || !background) {
      return;
    }

    void supabase.auth.updateUser({
      data: {
        profile_background: background,
      },
    });
  };

  const uploadProfileMedia = useCallback(
    async (kind, file) => {
      if (!isSignedIn) {
        return { ok: false, error: "Please sign in to upload images." };
      }

      const mediaKind = kind === "banner" ? "banner" : "avatar";
      const maxBytes = mediaKind === "banner" ? MAX_BANNER_BYTES : MAX_AVATAR_BYTES;
      const maxSizeMb = mediaKind === "banner" ? 5 : 2;

      if (!file) {
        return { ok: false, error: "Please choose an image file first." };
      }

      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        return { ok: false, error: "Use JPG, PNG, WEBP, or GIF image files." };
      }

      if (file.size > maxBytes) {
        return {
          ok: false,
          error: `${mediaKind === "banner" ? "Banner" : "Profile photo"} must be under ${maxSizeMb}MB.`,
        };
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        return { ok: false, error: "Session expired. Please sign in again." };
      }

      try {
        const extension = inferFileExtension(file);
        const mediaPath = `${user.id}/${mediaKind}-${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(PROFILE_MEDIA_BUCKET)
          .upload(mediaPath, file, {
            upsert: true,
            cacheControl: "3600",
          });

        if (uploadError) {
          return {
            ok: false,
            error: "Could not upload to Supabase storage. Check profile-media bucket policies.",
          };
        }

        const { data: publicData } = supabase.storage
          .from(PROFILE_MEDIA_BUCKET)
          .getPublicUrl(mediaPath);
        const uploadedUrl = publicData?.publicUrl || "";

        if (!uploadedUrl) {
          return {
            ok: false,
            error: "Could not resolve uploaded image URL from Supabase.",
          };
        }

        const metadataPatch =
          mediaKind === "avatar"
            ? { custom_avatar_url: uploadedUrl }
            : { profile_banner_url: uploadedUrl };
        const { error: metadataError } = await supabase.auth.updateUser({
          data: metadataPatch,
        });

        if (metadataError) {
          return {
            ok: false,
            error: "Image uploaded but profile metadata update failed in Supabase.",
          };
        }

        if (mediaKind === "avatar") {
          const { error: profileUpdateError } = await supabase
            .from("profiles")
            .update({ avatar_url: uploadedUrl })
            .eq("id", user.id);

          if (profileUpdateError) {
            // Metadata already saved successfully, so keep the flow successful.
            console.warn("Could not sync avatar_url in public.profiles", profileUpdateError);
          }
        }

        if (mediaKind === "avatar") {
          setProfileAvatarUrl(uploadedUrl);
          setCurrentUser((prev) =>
            prev
              ? {
                  ...prev,
                  avatarUrl: uploadedUrl,
                }
              : prev,
          );
        } else {
          setProfileBannerUrl(uploadedUrl);
          setCurrentUser((prev) =>
            prev
              ? {
                  ...prev,
                  bannerUrl: uploadedUrl,
                }
              : prev,
          );
        }

        return {
          ok: true,
        };
      } catch {
        return {
          ok: false,
          error: "Could not upload this image to Supabase. Please try again.",
        };
      }
    },
    [isSignedIn],
  );

  const rememberGameMeta = (gameId, gameMeta) => {
    if (!gameId || !gameMeta) {
      return;
    }

    setGameLookup((prev) => ({
      ...prev,
      [gameId]: {
        id: gameMeta.id,
        slug: gameMeta.slug,
        name: gameMeta.name,
        coverImage: gameMeta.coverImage,
        genres: gameMeta.genres || [],
      },
    }));
  };

  const persistLibraryEntry = async (gameId, status, startDate, endDate, gameMeta) => {
    if (!isSignedIn) {
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      await upsertLibraryEntry(
        {
          game_id: gameMeta?.id || null,
          game_key: gameId,
          game_slug: gameMeta?.slug || null,
          game_name: gameMeta?.name || gameId,
          cover_image: gameMeta?.coverImage || null,
          genres: gameMeta?.genres || [],
          status,
          start_date: startDate || null,
          end_date: endDate || null,
        },
        session?.access_token,
      );
      setLibraryError("");
    } catch {
      setLibraryError("Could not save game status to backend.");
    }
  };

  const addToWishlist = (gameId, gameMeta) => {
    rememberGameMeta(gameId, gameMeta);
    setGameStatuses((prev) => {
      const filtered = prev.filter((g) => g.gameId !== gameId);
      return [...filtered, { gameId, status: "wishlist" }];
    });
    void persistLibraryEntry(gameId, "wishlist", "", "", gameMeta);
  };

  const setCurrentlyPlaying = (gameId, gameMeta) => {
    rememberGameMeta(gameId, gameMeta);
    setGameStatuses((prev) => {
      const filtered = prev.filter((g) => g.gameId !== gameId);
      return [...filtered, { gameId, status: "playing" }];
    });
    void persistLibraryEntry(gameId, "playing", "", "", gameMeta);
  };

  const setCompleted = (gameId, startDate, endDate, gameMeta) => {
    rememberGameMeta(gameId, gameMeta);
    setGameStatuses((prev) => {
      const filtered = prev.filter((g) => g.gameId !== gameId);
      return [...filtered, { gameId, status: "completed", startDate, endDate }];
    });
    void persistLibraryEntry(gameId, "completed", startDate, endDate, gameMeta);
  };

  const removeGameStatus = (gameId) => {
    setGameStatuses((prev) => prev.filter((g) => g.gameId !== gameId));
    if (isSignedIn) {
      void (async () => {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          await deleteLibraryEntry(gameId, session?.access_token);
          setLibraryError("");
        } catch {
          setLibraryError("Could not remove game status from backend.");
        }
      })();
    }
  };

  const getGameStatus = (gameId) => {
    return gameStatuses.find((g) => g.gameId === gameId);
  };

  return (
    <UserContext.Provider
      value={{
        isSignedIn,
        username,
        currentUser,
        dateJoined,
        authLoading,
        profileBackground,
        profileAvatarUrl,
        profileBannerUrl,
        gameStatuses,
        gameLookup,
        libraryError,
        refreshLibrary,
        signInWithGoogle,
        signOut,
        setProfileBackground,
        uploadProfileMedia,
        addToWishlist,
        setCurrentlyPlaying,
        setCompleted,
        removeGameStatus,
        getGameStatus,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within UserProvider");
  }
  return context;
};
