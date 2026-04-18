// Game poster mapping - Maps game IDs to poster image URLs
// Using high-quality gaming images
export const gamePosters = {
  // Action/Adventure
  "gta-v": "https://images.unsplash.com/photo-1538481143235-5d630894cb4f?w=400&h=600&fit=crop",
  "rdr2": "https://images.unsplash.com/photo-1516573518620-cd4628902674?w=400&h=600&fit=crop",
  "red-dead-redemption-2": "https://images.unsplash.com/photo-1516573518620-cd4628902674?w=400&h=600&fit=crop",
  "witcher-3": "https://images.unsplash.com/photo-1538481143235-5d630894cb4f?w=400&h=600&fit=crop",
  "the-witcher-3": "https://images.unsplash.com/photo-1538481143235-5d630894cb4f?w=400&h=600&fit=crop",
  "cyberpunk-2077": "https://images.unsplash.com/photo-1611339555312-e607c90352fd?w=400&h=600&fit=crop",
  "skyrim": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=600&fit=crop",
  "elden-ring": "https://images.unsplash.com/photo-1614613535308-eb5fbd8f2c47?w=400&h=600&fit=crop",
  "god-of-war": "https://images.unsplash.com/photo-1538481143235-5d630894cb4f?w=400&h=600&fit=crop",
  "horizon-zero-dawn": "https://images.unsplash.com/photo-1611003228941-98852ba62227?w=400&h=600&fit=crop",
  "horizon-forbidden-west": "https://images.unsplash.com/photo-1611003228941-98852ba62227?w=400&h=600&fit=crop",
  "assassins-creed-valhalla": "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=600",
  "assassins-creed-odyssey": "https://images.igdb.com/igdb/image/upload/t_cover_big/co2nul.jpg",
  "far-cry-6": "https://images.unsplash.com/photo-1538481143235-5d630894cb4f?w=400&h=600&fit=crop",
  "far-cry-5": "https://images.unsplash.com/photo-1538481143235-5d630894cb4f?w=400&h=600&fit=crop",
  "tomb-raider": "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=600",
  "uncharted-4": "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=600",
  "last-of-us": "https://images.unsplash.com/photo-1538481143235-5d630894cb4f?w=400&h=600&fit=crop",
  "last-of-us-2": "https://images.unsplash.com/photo-1538481143235-5d630894cb4f?w=400&h=600&fit=crop",
  "spider-man": "https://images.unsplash.com/photo-1611003228941-98852ba62227?w=400&h=600&fit=crop",
  
  // Sports/Racing
  "f1-2024": "https://images.unsplash.com/photo-1617638924702-92d37bbc07cd?w=400&h=600&fit=crop",
  "nba2k24": "https://images.unsplash.com/photo-1546519638-68711109c5d1?w=400&h=600&fit=crop",
  "fifa-24": "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&h=600&fit=crop",
  
  // FPS/Competitive
  "valorant": "https://images.unsplash.com/photo-1538481143235-5d630894cb4f?w=400&h=600&fit=crop",
  "apex-legends": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=600&fit=crop",
  "fortnite": "https://images.unsplash.com/photo-1612036782180-69c5dba59e2a?w=400&h=600&fit=crop",
  "call-of-duty": "https://images.unsplash.com/photo-1538481143235-5d630894cb4f?w=400&h=600&fit=crop",
  "counter-strike": "https://images.unsplash.com/photo-1538481143235-5d630894cb4f?w=400&h=600&fit=crop",
  
  // RPG
  "baldurs-gate-3": "https://images.unsplash.com/photo-1614613535308-eb5fbd8f2c47?w=400&h=600&fit=crop",
  "final-fantasy-16": "https://images.unsplash.com/photo-1614613535308-eb5fbd8f2c47?w=400&h=600&fit=crop",
  "persona-5": "https://images.unsplash.com/photo-1614613535308-eb5fbd8f2c47?w=400&h=600&fit=crop",
  
  // Multiplayer/Online
  "world-of-warcraft": "https://images.unsplash.com/photo-1614613535308-eb5fbd8f2c47?w=400&h=600&fit=crop",
  "lost-ark": "https://images.unsplash.com/photo-1614613535308-eb5fbd8f2c47?w=400&h=600&fit=crop",
  "guild-wars-2": "https://images.unsplash.com/photo-1614613535308-eb5fbd8f2c47?w=400&h=600&fit=crop",
};

// Get poster URL for a game, with fallback
export const getGamePoster = (gameId) => {
  return gamePosters[gameId] || "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=600&fit=crop";
};

// Generate a color based on game ID for fallback styling
export const getGameColor = (gameId) => {
  const colors = [
    "#5865f2", // Discord Purple
    "#3498db", // Blue
    "#e74c3c", // Red
    "#f39c12", // Orange
    "#2ecc71", // Green
    "#9b59b6", // Purple
    "#1abc9c", // Cyan
    "#e91e63", // Pink
  ];
  
  let hash = 0;
  for (let i = 0; i < gameId.length; i++) {
    hash = gameId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};
