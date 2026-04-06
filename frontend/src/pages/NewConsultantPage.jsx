import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { Upload, FileText, X, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react'
import clsx from 'clsx'

export default function NewConsultantPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [form, setForm] = useState({
    name: '', tjm: '', skills: '', experience_years: '', availability: '',
  })
  const [cvFile, setCvFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = (file) => {
    if (file && file.type === 'application/pdf') {
      setCvFile(file)
    } else {
      setError('Seuls les fichiers PDF sont acceptés')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!cvFile) { setError('Veuillez joindre un CV PDF'); return }
    setError('')
    setLoading(true)

    try {
      const fd = new FormData()
      fd.append('name', form.name)
      fd.append('skills', form.skills)
      if (form.tjm) fd.append('tjm', form.tjm)
      if (form.experience_years) fd.append('experience_years', form.experience_years)
      if (form.availability) fd.append('availability', form.availability)
      fd.append('cv_file', cvFile)

      await api.post('/consultants', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      navigate('/consultants')
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="section-title">Nouveau Consultant</h1>
          <p className="text-sm text-slate-500 mt-0.5">Renseignez le profil et uploadez le CV</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card p-5 space-y-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Informations</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nom complet *</label>
              <input
                type="text" className="input" placeholder="Marie Dupont"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="label">TJM (€/jour)</label>
              <input
                type="number" className="input" placeholder="650"
                value={form.tjm}
                onChange={e => setForm(p => ({ ...p, tjm: e.target.value }))}
                min="0" max="9999"
              />
            </div>

            <div>
              <label className="label">Années d'expérience</label>
              <input
                type="number" className="input" placeholder="5"
                value={form.experience_years}
                onChange={e => setForm(p => ({ ...p, experience_years: e.target.value }))}
                min="0" max="50"
              />
            </div>

            <div className="col-span-2">
              <label className="label">Compétences clés *</label>
              <input
                type="text" className="input"
                placeholder="Python, React, AWS, Docker (séparées par des virgules)"
                value={form.skills}
                onChange={e => setForm(p => ({ ...p, skills: e.target.value }))}
                required
              />
              <p className="text-[11px] text-slate-600 mt-1">Séparez les compétences par des virgules</p>
            </div>

            <div className="col-span-2">
              <label className="label">Disponibilité</label>
              <input
                type="text" className="input" placeholder="Immédiate, Janvier 2025..."
                value={form.availability}
                onChange={e => setForm(p => ({ ...p, availability: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* CV Upload */}
        <div className="card p-5">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">CV (PDF) *</h2>

          {cvFile ? (
            <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <CheckCircle size={18} className="text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-emerald-300 truncate">{cvFile.name}</div>
                <div className="text-xs text-slate-500">{(cvFile.size / 1024).toFixed(0)} Ko</div>
              </div>
              <button
                type="button"
                onClick={() => setCvFile(null)}
                className="text-slate-500 hover:text-red-400 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <div
              className={clsx(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-150',
                dragOver
                  ? 'border-brand-500 bg-brand-500/5'
                  : 'border-white/10 hover:border-white/20 hover:bg-white/3'
              )}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={28} className="mx-auto text-slate-600 mb-3" />
              <p className="text-sm text-slate-400 font-medium">Glissez le PDF ici</p>
              <p className="text-xs text-slate-600 mt-1">ou cliquez pour sélectionner</p>
              <p className="text-[10px] text-slate-700 mt-2">PDF uniquement · Max 10MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={e => handleFile(e.target.files[0])}
              />
            </div>
          )}
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost flex-1 justify-center py-2.5">
            Annuler
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center py-2.5">
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Traitement du CV...
              </>
            ) : (
              <>
                <FileText size={15} />
                Créer le consultant
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
