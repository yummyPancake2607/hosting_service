import '../styles/GameCategoryNav.css'

const categories = [
  { id: 'all', label: 'All Games', icon: '◆' },
  { id: 'action', label: 'Action', icon: '⚔️' },
  { id: 'rpg', label: 'RPG', icon: '🗡️' },
  { id: 'strategy', label: 'Strategy', icon: '♟️' },
  { id: 'adventure', label: 'Adventure', icon: '🧭' },
  { id: 'sports', label: 'Sports', icon: '⚽' },
  { id: 'puzzle', label: 'Puzzle', icon: '🧩' },
  { id: 'racing', label: 'Racing', icon: '🏎️' },
  { id: 'indie', label: 'Indie', icon: '✨' },
  { id: 'horror', label: 'Horror', icon: '👻' },
]

function GameCategoryNav({ activeCategory = 'all', onCategoryChange }) {
  return (
    <div className="game-category-nav">
      <div className="category-label">Browse by Genre:</div>
      <div className="category-list">
        {categories.map((category) => (
          <button
            key={category.id}
            className={`category-btn ${activeCategory === category.id ? 'active' : ''}`}
            onClick={() => onCategoryChange && onCategoryChange(category.id)}
            title={category.label}
          >
            <span className="category-icon">{category.icon}</span>
            <span className="category-text">{category.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default GameCategoryNav
