import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import {
  ArrowLeft, Zap, Euro, MapPin, Clock, Users, CheckCircle,
  AlertCircle, TrendingUp, Award, ChevronDown, ChevronUp,
  Loader2, FileText, Trash2, RotateCcw
} from 'lucide-react'
import clsx from 'clsx'

// Animated score ring
function ScoreRing({ score, size = 80 }) {
  const radius = (size / 2) - 8
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const color = score >= 75 ? '#10b981' : score >= 50 ? '#3b82f6' : score >= 30 ? '#f59e0b' : '#ef4444'

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size/2} cy={size/2} r={radius}
        className="fill-none stroke-white/5" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={radius}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s ease-out' }}
      />
      <text
        x={size/2} y={size/2}
        dominantBaseline="middle" textAnchor="middle"
        className="fill-white font-bold text-base rotate-90"
        style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px`, fontSize: size < 70 ? '13px' : '16px' }}
      >
        {score}
      </text>
    </svg>
  )
}

function RecoTag({ reco }) {
  const styles = {
    FORT: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    MOYEN: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
    FAIBLE: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  }
  const labels = { FORT: '★ Recommandé', MOYEN: 'À considérer', FAIBLE: 'Peu adapté' }
  return (
    <span className={clsx('badge border text-xs', styles[reco] || styles.MOYEN)}>
      {labels[reco] || reco}
    </span>
  )
}

function BreakdownBar({ label, value, max = 40 }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span className="text-white font-medium">{value}/{max}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-500 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function MatchCard({ result, rank }) {
  const [expanded, setExpanded] = useState(rank === 1)

  const bd = result.breakdown || {}
  const bdEntries = [
    { label: 'Compétences techniques', value: bd.competences_techniques ?? 0, max: 40 },
    { label: 'Séniorité', value: bd.seniorite ?? 0, max: 20 },
    { label: 'Contexte / domaine', value: bd.contexte_domaine ?? 0, max: 20 },
    { label: 'Compatibilité TJM', value: bd.compatibilite_tjm ?? 0, max: 20 },
  ]

  return (
    <div className={clsx(
      'card overflow-hidden transition-all duration-200',
      rank === 1 && 'border-emerald-500/30 bg-emerald-500/3'
    )}>
      {rank === 1 && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-1.5 flex items-center gap-1.5">
          <Award size={12} className="text-emerald-400" />
          <span className="text-xs text-emerald-400 font-semibold">Meilleur match</span>
        </div>
      )}

      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/2 transition-colors"
        onClick={() => setExpanded(p => !p)}
      >
        {/* Rank */}
        <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
          {rank}
        </div>

        {/* Score ring */}
        <ScoreRing score={result.score_total} size={64} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-white">{result.consultant_name}</h3>
            <RecoTag reco={result.recommandation} />
          </div>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{result.resume_matching}</p>
          {result.consultant_tjm && (
            <span className="text-xs text-emerald-400 mt-1 inline-flex items-center gap-0.5">
              <Euro size={10} />{result.consultant_tjm}€/j
            </span>
          )}
        </div>

        {/* Expand */}
        <button className="text-slate-600 hover:text-slate-300 transition-colors shrink-0">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4 animate-fade-in">
          {/* Breakdown bars */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Détail du score</p>
            {bdEntries.map(e => (
              <BreakdownBar key={e.label} label={e.label} value={e.value} max={e.max} />
            ))}
          </div>

          {/* Points forts / faibles */}
          <div className="grid grid-cols-2 gap-3">
            {result.points_forts?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1">
                  <CheckCircle size={11} /> Points forts
                </p>
                <ul className="space-y-1">
                  {result.points_forts.map((p, i) => (
                    <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                      <span className="text-emerald-500 mt-0.5 shrink-0">·</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.points_faibles?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1">
                  <AlertCircle size={11} /> Points de vigilance
                </p>
                <ul className="space-y-1">
                  {result.points_faibles.map((p, i) => (
                    <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                      <span className="text-amber-500 mt-0.5 shrink-0">·</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* CV link */}
          {result.consultants?.cv_url && (
            <a
              href={result.consultants.cv_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-xs w-full justify-center"
            >
              <FileText size={13} /> Consulter le CV complet
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export default function AODetailPage() {
  const { id } = useParams()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  const [ao, setAo] = useState(null)
  const [matchResults, setMatchResults] = useState(null)
  const [loading, setLoading] = useState(true)
  const [matching, setMatching] = useState(false)
  const [matchError, setMatchError] = useState('')
  const [consultantCount, setConsultantCount] = useState(0)

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [aoRes, consultantsRes] = await Promise.all([
          api.get(`/aos/${id}`),
          api.get('/consultants'),
        ])
        setAo(aoRes.data)
        setConsultantCount(consultantsRes.data.length)

        // Try loading existing matching results
        if (isAdmin) {
          try {
            const matchRes = await api.get(`/matching/results/${id}`)
            if (matchRes.data.results?.length) {
              setMatchResults(matchRes.data.results)
            }
          } catch { /* no prior results */ }
        }
      } catch {
        navigate('/aos')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [id, isAdmin])

  const handleMatch = async () => {
    setMatching(true)
    setMatchError('')
    try {
      const { data } = await api.post('/matching/run', { ao_id: id, top_n: 3 })
      setMatchResults(data.results)
    } catch (err) {
      setMatchError(err.response?.data?.detail || 'Erreur lors du matching IA')
    } finally {
      setMatching(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Supprimer cet AO ?')) return
    await api.delete(`/aos/${id}`)
    navigate('/aos')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-brand-400" />
      </div>
    )
  }

  if (!ao) return null

  return (
    <div className="max-w-4xl animate-slide-up">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <button onClick={() => navigate('/aos')} className="btn-ghost p-2 mt-0.5">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-white">{ao.title}</h1>
            <span className={clsx(
              'badge',
              ao.status === 'open'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-slate-500/10 text-slate-400'
            )}>
              {ao.status === 'open' ? 'Ouvert' : 'Fermé'}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
            {ao.budget_max && <span className="flex items-center gap-1"><Euro size={11} />{ao.budget_max}€/j max</span>}
            {ao.location && <span className="flex items-center gap-1"><MapPin size={11} />{ao.location}</span>}
            {ao.duration && <span className="flex items-center gap-1"><Clock size={11} />{ao.duration}</span>}
            <span className="flex items-center gap-1"><Users size={11} />{consultantCount} consultants disponibles</span>
          </div>
        </div>
        {isAdmin && (
          <button onClick={handleDelete} className="btn-danger p-2">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: AO info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Description</p>
            <p className="text-sm text-slate-300 leading-relaxed">{ao.description}</p>
          </div>

          <div className="card p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Compétences requises</p>
            <div className="flex flex-wrap gap-1.5">
              {ao.skills_required?.split(',').map((s, i) => (
                <span key={i} className="badge bg-brand-600/10 text-brand-300 border border-brand-500/15 text-[10px]">
                  {s.trim()}
                </span>
              ))}
            </div>
          </div>

          {ao.context && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Contexte additionnel</p>
              <p className="text-xs text-slate-400 leading-relaxed">{ao.context}</p>
            </div>
          )}
        </div>

        {/* Right: AI Matching */}
        <div className="lg:col-span-2 space-y-4">
          {/* Match trigger */}
          {isAdmin && (
            <div className="card p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm font-semibold text-white flex items-center gap-2">
                    <Zap size={15} className="text-brand-400" />
                    Scoring IA
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Analyse {consultantCount} consultant{consultantCount > 1 ? 's' : ''} · Retourne les 3 meilleurs profils
                  </p>
                </div>
                <button
                  onClick={handleMatch}
                  disabled={matching || consultantCount === 0}
                  className={clsx(
                    'btn-primary gap-2',
                    matching && 'opacity-75'
                  )}
                >
                  {matching ? (
                    <><Loader2 size={15} className="animate-spin" />Analyse en cours...</>
                  ) : matchResults ? (
                    <><RotateCcw size={15} />Relancer le scoring</>
                  ) : (
                    <><Zap size={15} />Lancer le matching</>
                  )}
                </button>
              </div>

              {matching && (
                <div className="mt-3 p-3 bg-brand-500/5 border border-brand-500/15 rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-brand-300">
                    <Loader2 size={12} className="animate-spin" />
                    GPT-4o analyse les CVs... cela peut prendre 15–30 secondes.
                  </div>
                </div>
              )}

              {matchError && (
                <div className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {matchError}
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {matchResults && matchResults.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <TrendingUp size={12} className="text-brand-400" />
                <span>Top {matchResults.length} consultant{matchResults.length > 1 ? 's' : ''} · classés par score IA</span>
              </div>
              {matchResults.map((result, i) => (
                <MatchCard key={result.consultant_id || i} result={result} rank={i + 1} />
              ))}
            </div>
          ) : !isAdmin ? (
            <div className="card p-8 text-center">
              <TrendingUp size={28} className="mx-auto text-slate-700 mb-3" />
              <p className="text-slate-400 text-sm">Le matching IA est réservé aux administrateurs</p>
            </div>
          ) : !matching && (
            <div className="card p-8 text-center border-dashed border-white/10">
              <Zap size={28} className="mx-auto text-slate-700 mb-3" />
              <p className="text-slate-400 text-sm">Lancez le scoring pour voir les meilleurs profils</p>
              <p className="text-xs text-slate-600 mt-1">GPT-4o analyse et classe tous les CVs automatiquement</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
