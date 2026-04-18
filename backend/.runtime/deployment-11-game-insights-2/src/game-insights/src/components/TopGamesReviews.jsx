import '../styles/TopGamesReviews.css'

// Mock reviews data
const topGamesReviews = [
  {
    id: 1,
    game: 'Baldur\'s Gate 3',
    reviewer: 'Gaming Expert Pro',
    avatar: '👤',
    rating: 9.6,
    review:
      'An absolute masterpiece! Baldur\'s Gate 3 redefines what RPGs can be. With incredible depth, meaningful choices, and hundreds of hours of content, this is a definitive must-play.',
    verified: true,
    helpful: 2847,
    source: 'Official Review',
  },
  {
    id: 2,
    game: 'Elden Ring',
    reviewer: 'Challenge Master',
    avatar: 'GI',
    rating: 9.2,
    review:
      'FromSoftware outdid themselves. A challenging, beautiful, and rewarding experience that stands among the greatest games ever made. The open world design is revolutionary.',
    verified: true,
    helpful: 2341,
    source: 'Expert Opinion',
  },
  {
    id: 3,
    game: 'Cyberpunk 2077',
    reviewer: 'Tech Enthusiast',
    avatar: '🤖',
    rating: 8.5,
    review:
      'After the patches and updates, Cyberpunk 2077 is now an exceptional game. The world is immersive, missions are engaging, and the cyberpunk aesthetic is perfectly realized.',
    verified: true,
    helpful: 1956,
    source: 'Updated Review',
  },
  {
    id: 4,
    game: 'Starfield',
    reviewer: 'Space Explorer',
    avatar: '🚀',
    rating: 8.8,
    review:
      'A massive space exploration game that captures the wonder of discovering new worlds. With deep customization and exploration, Starfield is a worthy Next-Gen experience.',
    verified: true,
    helpful: 1723,
    source: 'Community Review',
  },
  {
    id: 5,
    game: 'The Legend of Zelda: Tears of the Kingdom',
    reviewer: 'Adventure Seeker',
    avatar: '⚔️',
    rating: 9.8,
    review:
      'Nintendo\'s masterpiece continues the legacy with breathtaking dungeons, innovative mechanics, and a world full of secrets. This is gaming at its finest.',
    verified: true,
    helpful: 3102,
    source: 'Expert Review',
  },
  {
    id: 6,
    game: 'Final Fantasy XVI',
    reviewer: 'JRPG Veteran',
    avatar: '⚡',
    rating: 9.1,
    review:
      'A bold new direction for the franchise. Stunning visuals, intense action sequences, and a compelling story make this a standout JRPG experience.',
    verified: true,
    helpful: 2564,
    source: 'Critic Review',
  },
]

function TopGamesReviews() {
  return (
    <div className="reviews-container">
      <div className="reviews-header">
        <div className="reviews-title-section">
          <h2>📊 Community Reviews & Ratings</h2>
          <p>What gamers are saying about the top titles</p>
        </div>
      </div>

      <div className="reviews-grid">
        {topGamesReviews.map((review) => (
          <div key={review.id} className="review-card">
            <div className="review-top">
              <div className="review-header">
                <div className="reviewer-info">
                  <div className="reviewer-avatar">{review.avatar}</div>
                  <div className="reviewer-details">
                    <div className="reviewer-name">
                      {review.reviewer}
                      {review.verified && <span className="verified-badge">✓</span>}
                    </div>
                    <div className="review-source">{review.source}</div>
                  </div>
                </div>
                <div className="review-rating-large">
                  <span className="rating-number">{review.rating}</span>
                  <span className="rating-max">/10</span>
                </div>
              </div>

              <div className="review-game-title">
                Game: <strong>{review.game}</strong>
              </div>
            </div>

            <div className="review-text">{review.review}</div>

            <div className="review-footer">
              <div className="helpful-section">
                <span className="helpful-count">👍 {review.helpful.toLocaleString()} found helpful</span>
              </div>
              <button className="review-action-btn">Read More</button>
            </div>
          </div>
        ))}
      </div>

      <div className="reviews-footer">
        <button className="view-all-reviews-btn">View All Reviews</button>
      </div>
    </div>
  )
}

export default TopGamesReviews
