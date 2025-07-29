import { useState } from 'react'

export default function Home() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  const search = async () => {
    setLoading(true)
    try {
      const res = await fetch('https://brain-worker.dusty-786.workers.dev/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 5 })
      })
      const data = await res.json()
      setResults(data)
    } catch (err) {
      setResults({ error: err.message })
    }
    setLoading(false)
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Brain Search</h1>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && search()}
          placeholder="Search your brain..."
          style={{ flex: 1, padding: '10px', fontSize: '16px' }}
        />
        <button 
          onClick={search} 
          disabled={loading}
          style={{ padding: '10px 20px', fontSize: '16px' }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      
      {results && (
        <div>
          {results.error ? (
            <p style={{ color: 'red' }}>Error: {results.error}</p>
          ) : (
            <>
              <p>Found {results.results?.length || 0} results</p>
              {results.results?.map((r, i) => (
                <div key={i} style={{ 
                  padding: '10px', 
                  margin: '10px 0', 
                  background: '#f5f5f5',
                  borderRadius: '5px' 
                }}>
                  <p>{r.content}</p>
                  <small>Score: {r.score}</small>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}