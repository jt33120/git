import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { FileText, Plus, Euro, MapPin, Clock, ArrowRight, Search } from 'lucide-react'
import clsx from 'clsx'

function AOCard({ ao }) {
  const isOpen = ao.status === 'open'
  return (
    <Link to={`/aos/${ao.id}`} className="card p-4 hover:border-white/10 transition-all duration-150 group block">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-white group-hover:text-brand-300 transition-colors line-clamp-2 flex-1">
          {ao.title}
        </h3>
        <span className={clsx(
          'badge shrink-0',
          isOpen
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-slate-500/10 text-slate-500 border border-slate-600/20'
        )}>
          {isOpen ? 'Ouvert' : 'Fermé'}
        </span>
      </div>

      <p className="text-xs text-slate-500 mb-3 line-clamp-2">{ao.description}</p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {ao.skills_required?.split(',').slice(0, 3).map((s, i) => (
          <span key={i} className="badge bg-brand-600/10 text-brand-300 border border-brand-500/15 text-[10px]">
            {s.trim()}
          </span>
        ))}
        {ao.skills_required?.split(',').length > 3 && (
          <span className="badge bg-white/5 text-slate-500 text-[10px]">
            +{ao.skills_required.split(',').length - 3}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-500 pt-2 border-t border-white/5">
        {ao.budget_max && (
          <span className="flex items-center gap-1">
            <Euro size={10} className="text-emerald-500" />
            {ao.budget_max}€/j max
          </span>
        )}
        {ao.location && (
          <span className="flex items-center gap-1">
            <MapPin size={10} />
            {ao.location}
          </span>
        )}
        {ao.duration && (
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {ao.duration}
          </span>
        )}
        <ArrowRight size={12} className="ml-auto text-slate-700 group-hover:text-brand-400 transition-colors" />
      </div>
    </Link>
  )
}

export default function AOSPage() {
  const { isAdmin } = useAuth()
  const [aos, setAos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    api.get('/aos').then(r => setAos(r.data)).finally(() => setLoading(false))
  }, [])

  const filtered = aos.filter(ao => {
    const matchSearch = !search ||
      ao.title.toLowerCase().includes(search.toLowerCase()) ||
      ao.skills_required?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || ao.status === filter
    return matchSearch && matchFilter
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <FileText size={20} className="text-brand-400" />
            Appels d'Offres
            <span className="text-sm font-normal text-slate-500">({aos.length})</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Cliquez sur un AO pour lancer le matching IA</p>
        </div>
        {isAdmin && (
          <Link to="/aos/new" className="btn-primary">
            <Plus size={15} />
            Nouvel AO
          </Link>
        )}
      </div>

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text" className="input pl-9"
            placeholder="Rechercher par titre, compétence..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {['all', 'open', 'closed'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'px-3 py-1 text-xs rounded-md font-medium transition-all',
                filter === f
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {f === 'all' ? 'Tous' : f === 'open' ? 'Ouverts' : 'Fermés'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText size={32} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-500 text-sm">
            {search ? 'Aucun résultat' : 'Aucun appel d\'offres pour le moment'}
          </p>
          {isAdmin && (
            <Link to="/aos/new" className="btn-primary mt-4 mx-auto">
              <Plus size={14} /> Créer le premier AO
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(ao => <AOCard key={ao.id} ao={ao} />)}
        </div>
      )}
    </div>
  )
}
