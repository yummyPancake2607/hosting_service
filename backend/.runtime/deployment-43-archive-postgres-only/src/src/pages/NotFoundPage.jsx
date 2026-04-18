import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <section className="panel">
      <h2>Page Not Found</h2>
      <p>The page you are trying to access does not exist.</p>
      <Link to="/" className="btn-link">
        Back to Home
      </Link>
    </section>
  )
}

export default NotFoundPage
