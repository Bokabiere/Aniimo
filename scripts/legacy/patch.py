import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'c:\IA\Projets\Aniimo\logis-manager\src\App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add NIVEAUX import
old_import = "import ANIIMO_DB from './data/aniimo_db.json';"
new_import = """import ANIIMO_DB from './data/aniimo_db.json';
import NIVEAUX from './data/niveaux.json';"""
content = content.replace(old_import, new_import, 1)

# 2. Add showNiveauModal state after showLevelModal
old_state = "  const [showLevelModal, setShowLevelModal] = useState(false);"
new_state = """  const [showLevelModal, setShowLevelModal] = useState(false);
  const [showNiveauModal, setShowNiveauModal] = useState(false);
  const [niveauCible, setNiveauCible] = useState(logis.level + 1);
  const [piecesPerHeure, setPiecesPerHeure] = useState(0);"""
content = content.replace(old_state, new_state, 1)

# 3. Add button after Max Niveau button
old_btn = 'className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1 text-sm rounded font-bold transition">⬆️ Max Niveau</button>'
new_btn = """className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1 text-sm rounded font-bold transition">⬆️ Max Niveau</button>
                  <button onClick={() => { setNiveauCible(logis.level + 1); setShowNiveauModal(true); }} className="bg-teal-600 hover:bg-teal-500 px-3 py-1 text-sm rounded font-bold transition">📊 Calc. Niveau</button>"""
content = content.replace(old_btn, new_btn, 1)

# 4. Add the Niveau modal just before the closing pattern
MODAL = '''
        {/* ===== MODAL CALCULATEUR DE NIVEAU ===== */}
        {showNiveauModal && (() => {
          const nivData = NIVEAUX.find(n => n.niveau === niveauCible);
          if (!nivData) return null;

          // Calculer profit horaire de la grille actuelle (proxy pour pièces/h)
          let profitH = 0;
          let cyclesH = 0;
          grid.forEach((row, r) => row.forEach((cell, c) => {
            if (cell && cell.originR === r && cell.originC === c) {
              const rec = recettesDB.find(x => x.id === cell.rId);
              if (rec) {
                const runs = 60 / Math.max(1, rec.tempsMin);
                profitH += (rec.profit || 0) * runs;
                cyclesH += runs;
              }
            }
          }));

          const tauxPieces = piecesPerHeure > 0 ? piecesPerHeure : Math.max(1, Math.round(profitH * 0.15));
          const heuresNecessaires = nivData.pieces / tauxPieces;
          const joursH = Math.floor(heuresNecessaires / 24);
          const resHours = Math.floor(heuresNecessaires % 24);

          // Stratégie optimale : top recettes par profit/heure
          const topRecettes = [...recettesDB]
            .filter(r => (r.profit || 0) > 0 && r.tempsMin > 0)
            .map(r => ({ ...r, profitH: (r.profit * 60) / r.tempsMin }))
            .sort((a, b) => b.profitH - a.profitH)
            .slice(0, 5);

          const formatDuree = (min) => {
            if (min < 60) return `${min} min`;
            const h = Math.floor(min / 60), m = min % 60;
            return m > 0 ? `${h}h${m.toString().padStart(2,'0')}` : `${h}h`;
          };

          return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowNiveauModal(false)}>
              <div className="bg-slate-800 rounded-2xl border border-teal-700/50 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-teal-400">📊 Calculateur de Montée en Niveau</h2>
                      <p className="text-slate-400 text-sm mt-1">Estimez le temps et la stratégie pour passer au niveau suivant</p>
                    </div>
                    <button onClick={() => setShowNiveauModal(false)} className="text-slate-400 hover:text-white text-2xl">✕</button>
                  </div>

                  {/* Sélecteur de niveaux */}
                  <div className="flex items-center gap-4 mb-6 p-4 bg-slate-900 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <div className="text-xs text-slate-400 mb-1">Niveau actuel</div>
                        <div className="text-3xl font-black text-slate-300">{logis.level}</div>
                      </div>
                      <div className="text-2xl text-teal-400 font-black">→</div>
                      <div className="text-center">
                        <div className="text-xs text-slate-400 mb-1">Niveau cible</div>
                        <input
                          type="number"
                          min={logis.level + 1} max={20}
                          value={niveauCible}
                          onChange={e => setNiveauCible(Math.min(20, Math.max(logis.level + 1, parseInt(e.target.value) || logis.level + 1)))}
                          className="text-3xl font-black text-teal-400 bg-slate-800 border border-teal-700 rounded-lg w-16 text-center outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex-1 border-l border-slate-700 pl-4 grid grid-cols-2 gap-2 text-sm">
                      <div className="text-slate-400">Durée de construction :</div>
                      <div className="font-bold text-white">{formatDuree(nivData.dureeMin)}</div>
                      <div className="text-slate-400">Aniimo débloqués :</div>
                      <div className="font-bold text-teal-300">+{nivData.aniimo - (NIVEAUX.find(n => n.niveau === logis.level)?.aniimo || 0)} ({nivData.aniimo} total)</div>
                    </div>
                  </div>

                  {/* Coûts requis */}
                  <h3 className="font-bold text-slate-300 uppercase text-xs tracking-wider mb-3">🔨 Ressources requises pour passer au Niv.{niveauCible}</h3>
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-amber-900/30 border border-amber-600/40 rounded-xl p-3 text-center">
                      <div className="text-xl font-black text-amber-400">{nivData.pieces.toLocaleString('fr-FR')}</div>
                      <div className="text-xs text-slate-400">Pièces de Logis</div>
                    </div>
                    {nivData.bois > 0 && (
                      <div className="bg-green-900/30 border border-green-600/40 rounded-xl p-3 text-center">
                        <div className="text-xl font-black text-green-400">{nivData.bois.toLocaleString('fr-FR')}</div>
                        <div className="text-xs text-slate-400">Blocs de Bois</div>
                      </div>
                    )}
                    {nivData.sable > 0 && (
                      <div className="bg-yellow-900/30 border border-yellow-600/40 rounded-xl p-3 text-center">
                        <div className="text-xl font-black text-yellow-400">{nivData.sable.toLocaleString('fr-FR')}</div>
                        <div className="text-xs text-slate-400">Sable Minéral</div>
                      </div>
                    )}
                  </div>

                  {/* Estimation du temps */}
                  <h3 className="font-bold text-slate-300 uppercase text-xs tracking-wider mb-3">⏱️ Estimation du temps de farming</h3>
                  <div className="bg-slate-900 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-slate-400 text-sm">Votre taux de Pièces/heure estimé :</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={piecesPerHeure || ''}
                          placeholder={Math.round(profitH * 0.15).toLocaleString('fr-FR')}
                          onChange={e => setPiecesPerHeure(parseInt(e.target.value) || 0)}
                          className="bg-slate-800 border border-teal-700 rounded-lg px-2 py-1 text-teal-300 font-bold w-32 text-right outline-none text-sm"
                        />
                        <span className="text-slate-500 text-sm">/heure</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500 mb-3 italic">
                      ℹ️ Valeur auto-estimée à ~15% du profit/heure de la grille ({Math.round(profitH).toLocaleString('fr-FR')} crédits/h → {Math.round(profitH*0.15).toLocaleString('fr-FR')} pièces/h). Ajustez selon votre expérience.
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-teal-900/30 border border-teal-700/40 rounded-xl">
                        <div className="text-2xl font-black text-teal-400">
                          {joursH > 0 ? `${joursH}j ${resHours}h` : `${Math.ceil(heuresNecessaires)}h`}
                        </div>
                        <div className="text-xs text-slate-400">de farming estimé</div>
                      </div>
                      <div className="text-center p-3 bg-teal-900/30 border border-teal-700/40 rounded-xl">
                        <div className="text-2xl font-black text-teal-400">{tauxPieces.toLocaleString('fr-FR')}</div>
                        <div className="text-xs text-slate-400">pièces/heure utilisé</div>
                      </div>
                    </div>
                  </div>

                  {/* Top recettes pour farmer des pièces */}
                  <h3 className="font-bold text-slate-300 uppercase text-xs tracking-wider mb-3">🏆 Meilleures recettes pour farmer des Pièces de Logis</h3>
                  <div className="space-y-2">
                    {topRecettes.map((r, i) => {
                      const barW = Math.round((r.profitH / topRecettes[0].profitH) * 100);
                      const estPieces = Math.round(r.profitH * 0.15);
                      return (
                        <div key={r.id} className="bg-slate-900 rounded-lg p-3 flex items-center gap-3">
                          <span className={`text-sm font-black w-5 text-center ${i === 0 ? 'text-yellow-400' : i < 3 ? 'text-slate-300' : 'text-slate-500'}`}>#{i+1}</span>
                          <div className={`w-3 h-3 rounded flex-shrink-0 ${r.color || 'bg-slate-600'}`}></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm truncate">{r.nom}</span>
                              <div className="text-right ml-2 flex-shrink-0">
                                <span className="text-amber-400 font-bold text-sm">~{estPieces.toLocaleString('fr-FR')} pièces/h</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                                <div className="bg-teal-500 rounded-full h-1.5" style={{width: barW + "%"}}></div>
                              </div>
                              <span className="text-[10px] text-slate-500">{r.tempsMin}min · {Math.round(r.profitH).toLocaleString('fr-FR')} crédits/h</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 p-3 bg-teal-900/20 border border-teal-700/40 rounded-lg text-xs text-slate-400">
                    💡 <strong className="text-teal-400">Note :</strong> Le ratio Crédits → Pièces de Logis est estimé (les commandes rapportent des pièces, pas directement les productions). Entrez votre taux réel ci-dessus pour une estimation précise.
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
'''

closing = '\n      </div>\n    </div>\n  );\n}'
idx = content.rfind(closing)
content = content[:idx] + MODAL + closing + '\n\nexport default App;\n'

# Remove duplicate export if any
import re
content = re.sub(r'(export default App;\s*){2,}', 'export default App;\n', content)

with open(r'c:\IA\Projets\Aniimo\logis-manager\src\App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS")
