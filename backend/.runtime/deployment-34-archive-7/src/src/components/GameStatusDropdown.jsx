import '../styles/GameStatus.css'

const gameStatuses = [
  { value: 'none', label: 'Add to Library', icon: '+', color: 'neutral' },
  { value: 'want-to-play', label: 'Want to Play', icon: '→', color: 'blue' },
  { value: 'currently-playing', label: 'Currently Playing', icon: '▸', color: 'green' },
  { value: 'completed', label: 'Completed', icon: '✓', color: 'gold' },
  { value: 'dropped', label: 'Dropped', icon: '✗', color: 'red' },
]

function GameStatusDropdown({ gameId, currentStatus = 'none', onStatusChange, userId = 'current-user' }) {
  const handleStatusChange = (newStatus) => {
    console.log(`Updated game ${gameId} status to ${newStatus} for user ${userId}`)
    onStatusChange && onStatusChange(newStatus)
  }

  const statusObj = gameStatuses.find((s) => s.value === currentStatus) || gameStatuses[0]

  return (
    <div className="game-status-dropdown">
      <div className={`status-badge status-${statusObj.color}`}>
        <span className="status-icon">{statusObj.icon}</span>
        <span className="status-label">{statusObj.label}</span>
      </div>

      <div className="status-menu">
        <div className="status-menu-header">Library Status</div>
        {gameStatuses.map((status) => (
          <button
            key={status.value}
            className={`status-option ${currentStatus === status.value ? 'active' : ''}`}
            onClick={() => handleStatusChange(status.value)}
            title={status.label}
          >
            <span className="status-option-icon">{status.icon}</span>
            <span className="status-option-label">{status.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default GameStatusDropdown
