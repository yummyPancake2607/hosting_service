import { useState } from 'react'
import GameStatusDropdown from './GameStatusDropdown'
import '../styles/GameCard.css'

function GameCard({ game }) {
  const [gameStatus, setGameStatus] = useState('none')

  const handleAddToWishlist = (e) => {
    e.preventDefault()
    console.log('Added to wishlist:', game.name)
  }

  const handleOpenSteam = (e) => {
    e.preventDefault()
    if (game.steamUrl) {
      window.open(game.steamUrl, '_blank')
    }
  }

  const handleStatusChange = (newStatus) => {
    setGameStatus(newStatus)
    console.log(`Game "${game.name}" status changed to: ${newStatus}`)
  }

  return (
    <div className="game-card">
      <div className="game-card-image">
        <img
          src={game.coverImage || 'https://via.placeholder.com/300x400?text=Game+Cover'}
          alt={game.name}
          loading="lazy"
        />
        <div className="game-card-overlay">
          <div className="game-card-buttons">
            <button className="card-btn wishlist-btn" onClick={handleAddToWishlist} title="Add to Wishlist">
              Save
            </button>
            <button className="card-btn steam-btn" onClick={handleOpenSteam} title="Open on Steam">
              View
            </button>
          </div>
        </div>
      </div>
      <div className="game-card-content">
        <h3 className="game-card-title">{game.name}</h3>
        <div className="game-card-meta">
          <span className="game-genre">{game.genre}</span>
          <span className="game-rating">★ {game.rating}/10</span>
        </div>
        <p className="game-card-description">{game.description}</p>
        <div className="game-card-footer">
          <span className="game-release">{game.releaseYear}</span>
          <span className={`game-status ${game.status}`}>{game.status}</span>
        </div>

        {/* Library Status Section */}
        <div className="game-card-library-section">
          <GameStatusDropdown 
            gameId={game.id} 
            currentStatus={gameStatus} 
            onStatusChange={handleStatusChange}
          />
        </div>
      </div>
    </div>
  )
}

export default GameCard
