import '../styles/FeaturedGames.css'

// Mock featured games data
const featuredGames = [
  {
    id: 1,
    name: 'Cyberpunk 2077',
    rating: 8.5,
    image: 'https://via.placeholder.com/400x500?text=Cyberpunk+2077',
    category: 'Action-RPG',
    price: '$59.99',
    badge: 'Popular',
    reviews: 2847,
  },
  {
    id: 2,
    name: 'Elden Ring',
    rating: 9.2,
    image: 'https://via.placeholder.com/400x500?text=Elden+Ring',
    category: 'Action-RPG',
    price: '$59.99',
    badge: 'Top Rated',
    reviews: 3521,
  },
  {
    id: 3,
    name: 'Baldur\'s Gate 3',
    rating: 9.6,
    image: 'https://via.placeholder.com/400x500?text=Baldurs+Gate+3',
    category: 'RPG',
    price: '$59.99',
    badge: 'New',
    reviews: 4102,
  },
  {
    id: 4,
    name: 'Starfield',
    rating: 8.8,
    image: 'https://via.placeholder.com/400x500?text=Starfield',
    category: 'Action-RPG',
    price: '$69.99',
    badge: 'Featured',
    reviews: 2156,
  },
]

function FeaturedGames() {
  return (
    <div className="featured-games-container">
      <div className="featured-header">
        <h2>✨ Featured Games</h2>
        <p>Top picks handpicked for you</p>
      </div>

      <div className="featured-grid">
        {featuredGames.map((game) => (
          <div key={game.id} className="featured-card">
            <div className="featured-image-wrapper">
              <img
                src={game.image}
                alt={game.name}
                className="featured-image"
                loading="lazy"
              />
              <div className="featured-overlay">
                <button className="featured-play-btn">View Details</button>
              </div>
              <span className={`featured-badge badge-${game.badge.toLowerCase()}`}>
                {game.badge}
              </span>
            </div>

            <div className="featured-content">
              <h3 className="featured-title">{game.name}</h3>
              
              <div className="featured-meta">
                <div className="featured-category">{game.category}</div>
                <div className="featured-price">{game.price}</div>
              </div>

              <div className="featured-rating">
                <div className="rating-stars">
                  {'★'.repeat(Math.floor(game.rating / 2))}
                  {game.rating % 2 !== 0 && '½'}
                </div>
                <span className="rating-value">{game.rating}/10</span>
              </div>

              <div className="featured-reviews">
                <span className="review-count">{game.reviews.toLocaleString()} reviews</span>
              </div>

              <div className="featured-actions">
                <button className="featured-btn primary">Add to Wishlist</button>
                <button className="featured-btn secondary">Open on Steam</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default FeaturedGames
