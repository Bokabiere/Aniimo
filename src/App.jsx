import { useState, useEffect, useMemo } from 'react';
import DEFAULT_RECETTES from './data/recettes.json';
import ANIIMO_ROLES from './data/aniimo_roles.json';
import ANIIMO_DB from './data/aniimo_db.json';
import NIVEAUX from './data/niveaux.json';
import GRAINES_DB from './data/graines_db.json';
import { getLimitForStructure, getFirstUnlockLevel } from './lib/structures.js';
import ProgressionTracker from './components/ProgressionTracker.jsx';

const GRID_SIZE = 10;
const MAX_STRUCTURES_PER_LEVEL = 5;

// Mapping capacite recette → capacite aniimo
const CAPACITE_MAP = {
  'Culture': 'Porter',
  'Transport': 'Porter',
  'Fabrication': 'Artisanat',
  'Cuisine': 'Artisanat',
  'Repos': 'Loisir',
  'Parfumerie': 'Parfumerie',
};

// Helper pour l'affichage fidèle "Vue Jeu" (icônes rondes et niveaux Lv.X)
const getGameViewInfo = (recette) => {
  if (!recette) return { icon: '📦', level: 'Lv.1', type: 'Autre' };

  const s = recette.structure || '';
  const nomLower = (recette.nom || '').toLowerCase();

  // Pépinière / Arbres
  if (s === 'Pépinière' || nomLower.includes('arbre')) {
    let lvl = 'Lv.2';
    if (nomLower.includes('cacao') || nomLower.includes('oranger')) lvl = 'Lv.6';
    else if (nomLower.includes('coco') || nomLower.includes('caoutchouc')) lvl = 'Lv.5';
    else if (nomLower.includes('châtaigne') || nomLower.includes('palmier') || nomLower.includes('noix')) lvl = 'Lv.4';
    else if (nomLower.includes('érable') || nomLower.includes('cerisier') || nomLower.includes('pomme')) lvl = 'Lv.3';
    else if (nomLower.includes('bambou') || nomLower.includes('citron')) lvl = 'Lv.2';
    else if (nomLower.includes('saule')) lvl = 'Lv.1';
    return { icon: '🌳', level: lvl, type: 'Pépinière' };
  }

  // Ferme / Cultures
  if (s === 'Ferme' || nomLower.includes('champ')) {
    let lvl = 'Lv.1';
    if (nomLower.includes('agave') || nomLower.includes('canneberge')) lvl = 'Lv.7';
    else if (nomLower.includes('ginseng') || nomLower.includes('raisin')) lvl = 'Lv.6';
    else if (nomLower.includes('fraise') || nomLower.includes('sucre') || nomLower.includes('lavande')) lvl = 'Lv.5';
    else if (nomLower.includes('coton') || nomLower.includes('rose')) lvl = 'Lv.4';
    else if (nomLower.includes('riz') || nomLower.includes('soja')) lvl = 'Lv.3';
    else if (nomLower.includes('pomme de terre')) lvl = 'Lv.2';
    return { icon: '🌱', level: lvl, type: 'Ferme' };
  }

  // Zone de coupe
  if (s === 'Zone de coupe' || nomLower.includes('coupe') || nomLower === 'bloc de bois' || nomLower === 'bois') {
    return { icon: '🪵', level: 'Lv.2', type: 'Zone de coupe' };
  }

  // Établi de menuiserie
  if (s === 'Établi de menuiserie' || nomLower.includes('planche') || nomLower.includes('bois brut')) {
    let lvl = 'Lv.1';
    if (nomLower.includes('densifié')) lvl = 'Lv.3';
    else if (nomLower.includes('planche')) lvl = 'Lv.2';
    return { icon: '🪚', level: lvl, type: 'Menuiserie' };
  }

  // Mine
  if (s === 'Mine' || nomLower.includes('mine') || nomLower.includes('pierre')) {
    return { icon: '⛏️', level: 'Lv.3', type: 'Mine' };
  }

  // Climatisation / Fournaise
  if (s === 'Climatisation' || nomLower.includes('clim')) {
    return { icon: '❄️', level: 'Lv.1', type: 'Climatisation' };
  }
  if (s === 'Fournaise') {
    return { icon: '🔥', level: 'Lv.1', type: 'Fournaise' };
  }

  // Établi artisanal
  if (s === 'Établi artisanal') {
    return { icon: '🧵', level: 'Lv.3', type: 'Artisanat' };
  }

  // Marmite à mijoter
  if (s === 'Marmite à mijoter') {
    return { icon: '🍲', level: 'Lv.2', type: 'Cuisine' };
  }

  // Bocal à pickles / Trempo-barils
  if (s === 'Bocal à pickles' || s === 'Trempo-barils') {
    return { icon: '🫙', level: 'Lv.2', type: 'Conserve' };
  }

  // Lit de Cumulaine
  if (s === 'Lit de Cumulaine' || nomLower.includes('laine')) {
    return { icon: '🛏️', level: 'Lv.5', type: 'Repos' };
  }

  // Château de sable Murmarée
  if (s === 'Château de sable Murmarée' || nomLower.includes('sel')) {
    return { icon: '🏖️', level: 'Lv.2', type: 'Murmarée' };
  }

  // Moulin-carrousel
  if (s === 'Moulin-carrousel' || nomLower.includes('moulin')) {
    return { icon: '🎡', level: 'Lv.2', type: 'Moulin' };
  }

  // Maison de Plumiel
  if (s === 'Maison de Plumiel') {
    return { icon: '🌸', level: 'Lv.1', type: 'Parfum' };
  }

  return { icon: '🏠', level: 'Lv.2', type: s };
};

// Générateur de modèles pré-remplis de base (Presets)
const generateInitialPresets = (existingGrid, level = 11) => {
  const makeEmpty = () => Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(null));
  const addBuilding = (g, r, c, rId, w = 2, h = 2) => {
    const cid = `b_${r}_${c}_${Math.random().toString(36).substring(2, 6)}`;
    for (let dr = 0; dr < h; dr++) {
      for (let dc = 0; dc < w; dc++) {
        if (r + dr < GRID_SIZE && c + dc < GRID_SIZE) {
          g[r + dr][c + dc] = { id: cid, rId, originR: r, originC: c };
        }
      }
    }
  };

  // 1. Plan de travail actif
  const customPlan = {
    id: 'preset-custom-1',
    name: '🎯 Mon Aménagement Actuel',
    description: 'Votre agencement de travail en cours',
    isBuiltIn: false,
    grid: existingGrid ? JSON.parse(JSON.stringify(existingGrid)) : makeEmpty(),
    level: level || 11,
    createdAt: Date.now()
  };

  // 2. Modèle Rush Bois & Planches (Niv. 11)
  const gBois = makeEmpty();
  addBuilding(gBois, 0, 0, 'r16', 1, 1); // Climatisation (Aura Brise)
  addBuilding(gBois, 0, 1, 'r5', 2, 2);  // Pépinière
  addBuilding(gBois, 0, 3, 'r5', 2, 2);  // Pépinière
  addBuilding(gBois, 0, 5, 'r5', 2, 2);  // Pépinière
  addBuilding(gBois, 0, 7, 'r5', 2, 2);  // Pépinière
  addBuilding(gBois, 2, 1, 'base_bois_bloc', 2, 2); // Zone de coupe
  addBuilding(gBois, 2, 3, 'base_bois_bloc', 2, 2); // Zone de coupe
  addBuilding(gBois, 2, 5, 'base_bois_bloc', 2, 2); // Zone de coupe
  addBuilding(gBois, 4, 1, 'r12', 2, 2); // Établi de menuiserie
  addBuilding(gBois, 4, 3, 'r12', 2, 2); // Établi de menuiserie
  addBuilding(gBois, 4, 5, 'r12', 2, 2); // Établi de menuiserie

  const presetRushBois = {
    id: 'preset-template-rush-bois',
    name: '🪵 Rush Bois & Planches',
    description: 'Production massive de bois brut, planches standards et pépinières',
    isBuiltIn: true,
    grid: gBois,
    level: 11,
    createdAt: Date.now() - 100000
  };

  // 3. Modèle Équilibré Logis (Niv. 11)
  const gEquilibre = makeEmpty();
  addBuilding(gEquilibre, 0, 0, 'r16', 1, 1); // Clim
  addBuilding(gEquilibre, 0, 1, 'r1', 2, 2);  // Ferme Blé
  addBuilding(gEquilibre, 0, 3, 'r4', 2, 2);  // Ferme Pomme de terre
  addBuilding(gEquilibre, 0, 5, 'r5', 2, 2);  // Pépinière
  addBuilding(gEquilibre, 0, 7, 'base_bois_bloc', 2, 2); // Zone de coupe
  addBuilding(gEquilibre, 2, 1, 'r12', 2, 2); // Menuiserie
  addBuilding(gEquilibre, 2, 3, 'r6', 2, 2);  // Mine Pierre
  addBuilding(gEquilibre, 2, 5, 'r8', 1, 1);  // Établi artisanal
  addBuilding(gEquilibre, 4, 1, 'r1', 2, 2);  // Ferme

  const presetEquilibre = {
    id: 'preset-template-equilibre',
    name: '⚖️ Équilibré Logis',
    description: 'Agencement diversifié polyvalent (Ferme, Pépinière, Bois, Mine, Artisanat)',
    isBuiltIn: true,
    grid: gEquilibre,
    level: 11,
    createdAt: Date.now() - 200000
  };

  // 4. Modèle Rush Pièces d'or (Niv. 11)
  const gPieces = makeEmpty();
  addBuilding(gPieces, 0, 0, 'r16', 1, 1); // Clim
  addBuilding(gPieces, 0, 1, 'r2', 2, 2);  // Fraise
  addBuilding(gPieces, 0, 3, 'r2', 2, 2);  // Fraise
  addBuilding(gPieces, 0, 5, 'r4', 2, 2);  // Pomme de terre
  addBuilding(gPieces, 0, 7, 'r5', 2, 2);  // Citron
  addBuilding(gPieces, 2, 1, 'r8', 1, 1);  // Carillon vent
  addBuilding(gPieces, 2, 2, 'r9', 1, 1);  // Encens citron
  addBuilding(gPieces, 2, 3, 'r10', 1, 1); // Séchoir citron
  addBuilding(gPieces, 3, 1, 'r12', 2, 2); // Menuiserie

  const presetRushPieces = {
    id: 'preset-template-rush-pieces',
    name: '🟡 Rush Pièces d\'or',
    description: 'Rentabilité horaire maximale (Fraise, Citron, Transformation)',
    isBuiltIn: true,
    grid: gPieces,
    level: 11,
    createdAt: Date.now() - 300000
  };

  return [customPlan, presetRushBois, presetEquilibre, presetRushPieces];
};

function App() {
  const [activeTab, setActiveTab] = useState('optimiseur');

  const [logis, setLogis] = useState(() => {
    const saved = localStorage.getItem('aniimo_logis');
    return saved ? JSON.parse(saved) : { level: 11, stationnement: 'Mer florale', solde: 1250, indexPoints: 450 };
  });

  // grid stocke { id: uuid, rId: 'r1', originR: 0, originC: 0 }
  const [grid, setGrid] = useState(() => {
    const saved = localStorage.getItem('aniimo_grid_v6');
    if (saved) return JSON.parse(saved);
    return Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(null));
  });

  const [recettesDB, setRecettesDB] = useState(() => {
    try {
      const saved = localStorage.getItem('aniimo_recettes_db_v12');
      if (saved) {
        const parsed = JSON.parse(saved);
        const missing = DEFAULT_RECETTES.filter(d => !parsed.some(p => p.id === d.id));
        if (missing.length === 0) return parsed;
        return [...parsed, ...missing];
      }
      const oldSaved = localStorage.getItem('aniimo_recettes_db_v10');
      if (oldSaved) {
        const parsedOld = JSON.parse(oldSaved);
        const merged = [...DEFAULT_RECETTES];
        parsedOld.forEach(r => {
          if (!merged.some(m => m.id === r.id)) merged.push(r);
        });
        localStorage.setItem('aniimo_recettes_db_v12', JSON.stringify(merged));
        return merged;
      }
    } catch (e) {}
    return DEFAULT_RECETTES;
  });

  const [monEquipe, setMonEquipe] = useState(() => {
    const saved = localStorage.getItem('aniimo_equipe_v1');
    return saved ? JSON.parse(saved) : [];
  });

  const [recipeSearch, setRecipeSearch] = useState('');

  const sortedRecettes = [...recettesDB].sort((a, b) => a.structure.localeCompare(b.structure) || a.nom.localeCompare(b.nom));

  const filteredRecettes = sortedRecettes.filter(r =>
    !recipeSearch ||
    r.nom.toLowerCase().includes(recipeSearch.toLowerCase()) ||
    r.structure.toLowerCase().includes(recipeSearch.toLowerCase())
  );

  const [selectedTool, setSelectedTool] = useState(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [showNiveauModal, setShowNiveauModal] = useState(false);
  const [showGrainesModal, setShowGrainesModal] = useState(false);
  const [graineFilter, setGraineFilter] = useState('all');
  const [showOptimizeDropdown, setShowOptimizeDropdown] = useState(false);
  const [optimizeSearch, setOptimizeSearch] = useState('');
  const [gridDisplayMode, setGridDisplayMode] = useState('mixte');
  const [viewTheme, setViewTheme] = useState('jeu');
  const [niveauCible, setNiveauCible] = useState(logis.level + 1);
  const [piecesPerHeure, setPiecesPerHeure] = useState(0);
  const [newRecipe, setNewRecipe] = useState({ nom: '', structure: 'Ferme', tempsMin: 20, w: 2, h: 2, needsAura: '', profit: 0, inputName: '', inputQty: 0, outputName: '', outputQty: 1 });
  const [aniimoEfficiency, setAniimoEfficiency] = useState(100);
  const [showFlowPanel, setShowFlowPanel] = useState(true);
  const [notification, setNotification] = useState(null);
  const [hoveredCell, setHoveredCell] = useState(null);

  // Système de Presets (Plans d'aménagement)
  const [presets, setPresets] = useState(() => {
    try {
      const saved = localStorage.getItem('aniimo_presets_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    const existingGrid = localStorage.getItem('aniimo_grid_v6');
    const parsedGrid = existingGrid ? JSON.parse(existingGrid) : null;
    return generateInitialPresets(parsedGrid, logis.level || 11);
  });

  const [activePresetId, setActivePresetId] = useState(() => {
    try {
      const saved = localStorage.getItem('aniimo_active_preset_id');
      if (saved) return saved;
    } catch (e) {}
    return 'preset-custom-1';
  });

  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetImportText, setPresetImportText] = useState('');
  const [editingPresetId, setEditingPresetId] = useState(null);
  const [editingPresetName, setEditingPresetName] = useState('');

  const showToast = (message, type = 'info') => {
    setNotification({ message, type, id: Date.now() });
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => localStorage.setItem('aniimo_logis', JSON.stringify(logis)), [logis]);
  useEffect(() => localStorage.setItem('aniimo_grid_v6', JSON.stringify(grid)), [grid]);
  useEffect(() => localStorage.setItem('aniimo_recettes_db_v12', JSON.stringify(recettesDB)), [recettesDB]);
  useEffect(() => localStorage.setItem('aniimo_equipe_v1', JSON.stringify(monEquipe)), [monEquipe]);

  // Synchronisation automatique du plan actif
  useEffect(() => {
    setPresets(prev => prev.map(p => {
      if (p.id === activePresetId) {
        return { ...p, grid, level: logis.level, updatedAt: Date.now() };
      }
      return p;
    }));
  }, [grid, logis.level, activePresetId]);

  useEffect(() => {
    localStorage.setItem('aniimo_presets_v1', JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    localStorage.setItem('aniimo_active_preset_id', activePresetId);
  }, [activePresetId]);

  const updateLogis = (key, value) => setLogis(prev => ({ ...prev, [key]: value }));

  const getPresetStats = (preset) => {
    if (!preset || !preset.grid) return { count: 0, occupied: 0 };
    let count = 0;
    let occupied = 0;
    preset.grid.forEach((row, r) => row.forEach((cell, c) => {
      if (cell) {
        occupied++;
        if (cell.originR === r && cell.originC === c) count++;
      }
    }));
    return { count, occupied };
  };

  const handleSelectPreset = (presetId) => {
    const target = presets.find(p => p.id === presetId);
    if (!target) return;
    setActivePresetId(presetId);
    setGrid(target.grid);
    if (target.level) {
      updateLogis('level', target.level);
    }
    showToast(`Plan « ${target.name} » chargé !`, 'success');
  };

  const handleCreatePreset = (name = null) => {
    const newId = `preset-${Date.now()}`;
    const newName = name || `Plan Personnalisé ${presets.length + 1}`;
    const newPreset = {
      id: newId,
      name: newName,
      description: 'Plan personnalisé',
      isBuiltIn: false,
      grid: JSON.parse(JSON.stringify(grid)),
      level: logis.level,
      createdAt: Date.now()
    };
    setPresets(prev => [...prev, newPreset]);
    setActivePresetId(newId);
    showToast(`Nouveau plan « ${newName} » créé !`, 'success');
  };

  const handleDuplicatePreset = (presetId) => {
    const source = presets.find(p => p.id === presetId);
    if (!source) return;
    const newId = `preset-${Date.now()}`;
    const newName = `${source.name} (Copie)`;
    const newPreset = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      name: newName,
      isBuiltIn: false,
      createdAt: Date.now()
    };
    setPresets(prev => [...prev, newPreset]);
    setActivePresetId(newId);
    showToast(`Plan dupliqué en « ${newName} » !`, 'success');
  };

  const handleDeletePreset = (presetId) => {
    if (presets.length <= 1) {
      showToast('Vous devez conserver au moins un plan d\'aménagement !', 'warning');
      return;
    }
    const remaining = presets.filter(p => p.id !== presetId);
    setPresets(remaining);
    if (activePresetId === presetId) {
      const next = remaining[0];
      setActivePresetId(next.id);
      setGrid(next.grid);
      if (next.level) updateLogis('level', next.level);
    }
    showToast('Plan supprimé.', 'info');
  };

  const handleRenamePreset = (presetId, newName) => {
    if (!newName || !newName.trim()) return;
    setPresets(prev => prev.map(p => p.id === presetId ? { ...p, name: newName.trim() } : p));
    setEditingPresetId(null);
    showToast('Nom du plan mis à jour.', 'info');
  };

  const handleExportJSON = (preset) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(preset, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `aniimo_plan_${preset.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Fichier .json téléchargé !', 'success');
  };

  const handleCopyPresetCode = (preset) => {
    const code = JSON.stringify(preset);
    navigator.clipboard.writeText(code).then(() => {
      showToast('Code du plan copié dans le presse-papier !', 'success');
    }).catch(() => {
      showToast('Erreur lors de la copie', 'warning');
    });
  };

  const handleImportPreset = (jsonString) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.grid || !Array.isArray(parsed.grid)) {
        throw new Error('Format de grille invalide.');
      }
      const newId = `preset-${Date.now()}`;
      const imported = {
        id: newId,
        name: parsed.name ? `${parsed.name} (Importé)` : `Plan Importé ${presets.length + 1}`,
        description: parsed.description || 'Plan importé',
        isBuiltIn: false,
        grid: parsed.grid,
        level: parsed.level || logis.level,
        createdAt: Date.now()
      };
      setPresets(prev => [...prev, imported]);
      setActivePresetId(newId);
      setGrid(imported.grid);
      if (imported.level) updateLogis('level', imported.level);
      setPresetImportText('');
      setShowPresetModal(false);
      showToast(`Plan « ${imported.name} » importé avec succès !`, 'success');
    } catch (err) {
      showToast(`Erreur d'import : ${err.message}`, 'warning');
    }
  };

  const handleResetBuiltinPresets = () => {
    const initial = generateInitialPresets(grid, logis.level);
    const customOnes = presets.filter(p => !p.isBuiltIn && p.id !== 'preset-custom-1');
    const merged = [...initial, ...customOnes];
    setPresets(merged);
    showToast('Modèles par défaut réinitialisés !', 'info');
  };


  const getUsageForStructure = (gridData, structureName) => {
    let count = 0;
    gridData.forEach((row, r) => row.forEach((cell, c) => {
      if (cell && cell.originR === r && cell.originC === c) {
        const rec = recettesDB.find(x => x.id === cell.rId);
        if (rec && rec.structure === structureName) count++;
      }
    }));
    return count;
  };

  const canPlace = (gridData, r, c, w, h) => {
    if (r + h > GRID_SIZE || c + w > GRID_SIZE) return false;
    for(let i=0; i<h; i++) {
      for(let j=0; j<w; j++) {
        if (gridData[r+i][c+j] !== null) return false;
      }
    }
    return true;
  };

  const hasAura = (gridData, r, c, w, h, auraType) => {
    for(let i=0; i<GRID_SIZE; i++){
      for(let j=0; j<GRID_SIZE; j++){
        const cell = gridData[i][j];
        if (cell && cell.originR === i && cell.originC === j) {
          const rec = recettesDB.find(x => x.id === cell.rId);
          if (rec && rec.providesAura && rec.providesAura.type === auraType) {
            const distR = Math.max(0, Math.max(i - (r + h - 1), r - (i + (rec.h||1) - 1)));
            const distC = Math.max(0, Math.max(j - (c + w - 1), c - (j + (rec.w||1) - 1)));
            if (Math.max(distR, distC) <= rec.providesAura.range) return true;
          }
        }
      }
    }
    return false;
  };

  // Détection du halo d'aura actif (survol de la grille ou prévisualisation de pose)
  const activeHaloSource = useMemo(() => {
    // 1. Prévisualisation sous curseur : si un outil générateur est sélectionné dans la palette
    if (selectedTool && selectedTool !== 'eraser' && hoveredCell) {
      const toolRec = recettesDB.find(x => x.id === selectedTool);
      if (toolRec && toolRec.providesAura) {
        return {
          r: hoveredCell.r,
          c: hoveredCell.c,
          w: toolRec.w || 1,
          h: toolRec.h || 1,
          range: toolRec.providesAura.range || 2,
          type: toolRec.providesAura.type,
          isPlacingPreview: true
        };
      }
    }

    // 2. Survol d'une structure sur la grille (générateur ou demandeur d'aura)
    if (hoveredCell) {
      const cell = grid[hoveredCell.r]?.[hoveredCell.c];
      if (cell) {
        const rec = recettesDB.find(x => x.id === cell.rId);
        if (rec) {
          if (rec.providesAura) {
            return {
              r: cell.originR,
              c: cell.originC,
              w: rec.w || 1,
              h: rec.h || 1,
              range: rec.providesAura.range || 2,
              type: rec.providesAura.type,
              isPlacingPreview: false
            };
          }
          if (rec.needsAura) {
            return {
              r: cell.originR,
              c: cell.originC,
              w: rec.w || 1,
              h: rec.h || 1,
              range: 2,
              type: rec.needsAura,
              isTargetNeedsAura: true
            };
          }
        }
      }
    }
    return null;
  }, [selectedTool, hoveredCell, grid, recettesDB]);

  // Teste si une case ou un bâtiment (r, c, w, h) se trouve dans le halo actif
  const isCellInHalo = (r, c, w = 1, h = 1) => {
    if (!activeHaloSource) return null;
    const distR = Math.max(0, Math.max(activeHaloSource.r - (r + h - 1), r - (activeHaloSource.r + activeHaloSource.h - 1)));
    const distC = Math.max(0, Math.max(activeHaloSource.c - (c + w - 1), c - (activeHaloSource.c + activeHaloSource.w - 1)));
    if (Math.max(distR, distC) <= activeHaloSource.range) {
      return activeHaloSource.type;
    }
    return null;
  };

  // Nombre de bâtiments sur la grille dont l'aura est en défaut
  const missingAurasCount = useMemo(() => {
    let count = 0;
    grid.forEach((row, r) => row.forEach((cell, c) => {
      if (cell && cell.originR === r && cell.originC === c) {
        const rec = recettesDB.find(x => x.id === cell.rId);
        if (rec && rec.needsAura && !hasAura(grid, r, c, rec.w || 1, rec.h || 1, rec.needsAura)) {
          count++;
        }
      }
    }));
    return count;
  }, [grid, recettesDB]);

  // Pose intelligente en 1 clic d'une source d'aura pour couvrir un bâtiment ciblé
  const autoPlaceAuraSource = (targetR, targetC, auraType) => {
    const targetCell = grid[targetR]?.[targetC];
    if (!targetCell) return;
    const targetRec = recettesDB.find(x => x.id === targetCell.rId);
    const targetW = targetRec ? (targetRec.w || 1) : 1;
    const targetH = targetRec ? (targetRec.h || 1) : 1;

    // Trouver le générateur d'aura approprié
    const auraGen = recettesDB.find(r => r.providesAura && r.providesAura.type === auraType);
    if (!auraGen) {
      showToast(`Aucun générateur d'aura trouvé pour l'aura "${auraType}".`, 'warning');
      return;
    }

    const genW = auraGen.w || 1;
    const genH = auraGen.h || 1;
    const range = auraGen.providesAura.range || 2;

    // Vérifier les quotas de structure
    const currentUsage = getUsageForStructure(grid, auraGen.structure);
    const maxAllowed = getLimitForStructure(auraGen.structure, logis.level);
    if (currentUsage >= maxAllowed) {
      showToast(`Limite atteinte pour ${auraGen.structure} (${currentUsage}/${maxAllowed} au Niv.${logis.level}).`, 'warning');
      return;
    }

    let candidatePositions = [];

    for (let r = 0; r <= GRID_SIZE - genH; r++) {
      for (let c = 0; c <= GRID_SIZE - genW; c++) {
        if (canPlace(grid, r, c, genW, genH)) {
          const distR = Math.max(0, Math.max(r - (targetCell.originR + targetH - 1), targetCell.originR - (r + genH - 1)));
          const distC = Math.max(0, Math.max(c - (targetCell.originC + targetW - 1), targetCell.originC - (c + genW - 1)));
          if (Math.max(distR, distC) <= range) {
            // Nombre d'autres bâtiments en manque d'aura qui profiteraient aussi de ce placement
            let extraCovered = 0;
            grid.forEach((row, ri) => row.forEach((cell, ci) => {
              if (cell && cell.originR === ri && cell.originC === ci && !(ri === targetCell.originR && ci === targetCell.originC)) {
                const rec = recettesDB.find(x => x.id === cell.rId);
                if (rec && rec.needsAura === auraType && !hasAura(grid, ri, ci, rec.w || 1, rec.h || 1, auraType)) {
                  const dR = Math.max(0, Math.max(r - (ri + (rec.h || 1) - 1), ri - (r + genH - 1)));
                  const dC = Math.max(0, Math.max(c - (ci + (rec.w || 1) - 1), ci - (c + genW - 1)));
                  if (Math.max(dR, dC) <= range) extraCovered++;
                }
              }
            }));

            // Score: maximiser la couverture partagée, puis privilégier la proximité immédiate
            const manhattanDist = distR + distC;
            candidatePositions.push({ r, c, score: extraCovered * 100 - manhattanDist });
          }
        }
      }
    }

    if (candidatePositions.length === 0) {
      showToast(`Aucun espace libre (1×1) à portée (2 cases) pour poser ${auraGen.nom}. Libérez une case proche !`, 'warning');
      return;
    }

    candidatePositions.sort((a, b) => b.score - a.score);
    const best = candidatePositions[0];

    const newGrid = grid.map(row => [...row]);
    const cellId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    for (let i = 0; i < genH; i++) {
      for (let j = 0; j < genW; j++) {
        newGrid[best.r + i][best.c + j] = {
          id: cellId,
          rId: auraGen.id,
          originR: best.r,
          originC: best.c
        };
      }
    }

    setGrid(newGrid);
    localStorage.setItem('aniimo_grid_v6', JSON.stringify(newGrid));
    showToast(`✓ ${auraGen.nom} posé en (${best.r + 1}, ${best.c + 1}) pour couvrir ${targetRec ? targetRec.nom : 'le bâtiment'} !`, 'success');
  };

  // Résolution globale automatique de toutes les auras manquantes
  const autoResolveAllMissingAuras = () => {
    let missingTargets = [];
    grid.forEach((row, r) => row.forEach((cell, c) => {
      if (cell && cell.originR === r && cell.originC === c) {
        const rec = recettesDB.find(x => x.id === cell.rId);
        if (rec && rec.needsAura && !hasAura(grid, r, c, rec.w || 1, rec.h || 1, rec.needsAura)) {
          missingTargets.push({ r, c, aura: rec.needsAura, nom: rec.nom });
        }
      }
    }));

    if (missingTargets.length === 0) {
      showToast('Toutes les structures disposent déjà de leur aura requise !', 'info');
      return;
    }

    let tempGrid = grid.map(row => [...row]);
    let placedCount = 0;

    for (const target of missingTargets) {
      const targetCell = tempGrid[target.r]?.[target.c];
      if (!targetCell) continue;
      const targetRec = recettesDB.find(x => x.id === targetCell.rId);
      if (!targetRec) continue;
      if (hasAura(tempGrid, target.r, target.c, targetRec.w || 1, targetRec.h || 1, target.aura)) {
        continue;
      }

      const auraGen = recettesDB.find(r => r.providesAura && r.providesAura.type === target.aura);
      if (!auraGen) continue;
      const genW = auraGen.w || 1;
      const genH = auraGen.h || 1;
      const range = auraGen.providesAura.range || 2;

      const currentUsage = getUsageForStructure(tempGrid, auraGen.structure);
      const maxAllowed = getLimitForStructure(auraGen.structure, logis.level);
      if (currentUsage >= maxAllowed) continue;

      let candidates = [];
      for (let r = 0; r <= GRID_SIZE - genH; r++) {
        for (let c = 0; c <= GRID_SIZE - genW; c++) {
          if (canPlace(tempGrid, r, c, genW, genH)) {
            const distR = Math.max(0, Math.max(r - (target.r + (targetRec.h || 1) - 1), target.r - (r + genH - 1)));
            const distC = Math.max(0, Math.max(c - (target.c + (targetRec.w || 1) - 1), target.c - (c + genW - 1)));
            if (Math.max(distR, distC) <= range) {
              let extra = 0;
              tempGrid.forEach((row, ri) => row.forEach((c2, ci) => {
                if (c2 && c2.originR === ri && c2.originC === ci) {
                  const r2 = recettesDB.find(x => x.id === c2.rId);
                  if (r2 && r2.needsAura === target.aura && !hasAura(tempGrid, ri, ci, r2.w || 1, r2.h || 1, target.aura)) {
                    const dR = Math.max(0, Math.max(r - (ri + (r2.h || 1) - 1), ri - (r + genH - 1)));
                    const dC = Math.max(0, Math.max(c - (ci + (r2.w || 1) - 1), ci - (c + genW - 1)));
                    if (Math.max(dR, dC) <= range) extra++;
                  }
                }
              }));
              candidates.push({ r, c, score: extra * 100 - (distR + distC) });
            }
          }
        }
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0];
        const cellId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
        for (let i = 0; i < genH; i++) {
          for (let j = 0; j < genW; j++) {
            tempGrid[best.r + i][best.c + j] = {
              id: cellId,
              rId: auraGen.id,
              originR: best.r,
              originC: best.c
            };
          }
        }
        placedCount++;
      }
    }

    if (placedCount > 0) {
      setGrid(tempGrid);
      localStorage.setItem('aniimo_grid_v6', JSON.stringify(tempGrid));
      showToast(`✓ ${placedCount} source(s) d'aura posée(s) avec succès !`, 'success');
    } else {
      showToast(`Impossible de placer les sources d'aura : espace saturé à portée ou quotas atteints.`, 'warning');
    }
  };

  const getRecommendedSeedsForRecipe = (recette, levelOverride) => {
    if (!recette) return [];
    const playerLevel = levelOverride !== undefined ? levelOverride : (logis.level || 1);

    // 1. Si c'est déjà une culture directe de Ferme ou Pépinière
    if (recette.structure === 'Ferme' || recette.structure === 'Pépinière') {
      const cName = recette.nom.toLowerCase().trim();
      const g = GRAINES_DB.find(x => {
        const gx = x.culture.toLowerCase().trim();
        return cName === gx || cName === `champ ${gx}` || cName === `arbre à ${gx}` || cName.includes(gx);
      });
      if (g) {
        return [{
          graine: g.graine,
          culture: g.culture,
          structure: g.structure,
          aura: g.aura,
          rendement: `${g.pieces_h} pts/h`,
          bois_h: g.bois_h || 0,
          niveau_requis: g.niveau_requis || 1,
          locked: (g.niveau_requis || 1) > playerLevel
        }];
      }
    }

    // 2. Si c'est du bois ou Zone de coupe (Bloc de bois, Bois brut, Planches...)
    const recNomLower = recette.nom.toLowerCase().trim();
    if (recette.structure === 'Zone de coupe' || recNomLower.includes('bois') || recNomLower.includes('planche')) {
      const woodTrees = [...GRAINES_DB]
        .filter(g => (g.bois_h || 0) > 0 && (g.niveau_requis || 1) <= playerLevel)
        .sort((a, b) => (b.bois_h || 0) - (a.bois_h || 0) || b.pieces_h - a.pieces_h);
      const best = woodTrees[0] || [...GRAINES_DB].filter(g => (g.bois_h || 0) > 0).sort((a, b) => (b.bois_h || 0) - (a.bois_h || 0))[0];
      if (best) {
        return [{
          res: 'Bois',
          graine: best.graine,
          culture: best.culture,
          structure: best.structure,
          aura: best.aura,
          rendement: `${best.pieces_h} pts/h`,
          bois_h: best.bois_h,
          niveau_requis: best.niveau_requis || 1,
          locked: (best.niveau_requis || 1) > playerLevel,
          isWood: true
        }];
      }
    }

    // 3. Recherche récursive des ressources racines requises
    const findRoots = (recId, visited = new Set()) => {
      if (visited.has(recId)) return {};
      visited.add(recId);
      const r = recettesDB.find(x => x.id === recId);
      if (!r || !r.input || Object.keys(r.input).length === 0) return {};

      const roots = {};
      Object.entries(r.input).forEach(([inp, qty]) => {
        const producer = recettesDB.find(x =>
          x.output && Object.keys(x.output).some(k => k.toLowerCase() === inp.toLowerCase())
        );
        if (!producer || !producer.input || Object.keys(producer.input).length === 0) {
          roots[inp] = (roots[inp] || 0) + qty;
        } else {
          const sub = findRoots(producer.id, visited);
          Object.entries(sub).forEach(([sInp, sQty]) => {
            roots[sInp] = (roots[sInp] || 0) + sQty * qty;
          });
        }
      });
      return roots;
    };

    const roots = findRoots(recette.id);
    const results = [];
    const seen = new Set();

    Object.keys(roots).forEach(resName => {
      const resLower = resName.toLowerCase().trim();

      if (resLower.includes('bois') || resLower.includes('planche')) {
        const woodTrees = [...GRAINES_DB]
          .filter(g => (g.bois_h || 0) > 0 && (g.niveau_requis || 1) <= playerLevel)
          .sort((a, b) => (b.bois_h || 0) - (a.bois_h || 0) || b.pieces_h - a.pieces_h);
        const best = woodTrees[0] || [...GRAINES_DB].filter(g => (g.bois_h || 0) > 0).sort((a, b) => (b.bois_h || 0) - (a.bois_h || 0))[0];
        if (best && !seen.has(best.graine)) {
          seen.add(best.graine);
          results.push({
            res: resName,
            graine: best.graine,
            culture: best.culture,
            structure: best.structure,
            aura: best.aura,
            rendement: `${best.pieces_h} pts/h`,
            bois_h: best.bois_h,
            niveau_requis: best.niveau_requis || 1,
            locked: (best.niveau_requis || 1) > playerLevel,
            isWood: true
          });
        }
      } else {
        const matchingUnlocked = GRAINES_DB.filter(x => {
          const gx = x.culture.toLowerCase().trim();
          return (resLower === gx || resLower.includes(gx) || gx.includes(resLower)) && (x.niveau_requis || 1) <= playerLevel;
        }).sort((a, b) => b.pieces_h - a.pieces_h);

        const g = matchingUnlocked[0] || GRAINES_DB.find(x => {
          const gx = x.culture.toLowerCase().trim();
          return resLower === gx || resLower.includes(gx) || gx.includes(resLower);
        });

        if (g && !seen.has(g.graine)) {
          seen.add(g.graine);
          results.push({
            res: resName,
            graine: g.graine,
            culture: g.culture,
            structure: g.structure,
            aura: g.aura,
            rendement: `${g.pieces_h} pts/h`,
            bois_h: g.bois_h || 0,
            niveau_requis: g.niveau_requis || 1,
            locked: (g.niveau_requis || 1) > playerLevel
          });
        }
      }
    });

    return results;
  };

  const handleCellClick = (rIndex, cIndex) => {
    if (!selectedTool) return;
    const newGrid = grid.map(row => [...row]);

    if (selectedTool === 'eraser') {
      const cell = newGrid[rIndex][cIndex];
      if (cell) {
        // effacer tout le bloc
        for(let i=0; i<GRID_SIZE; i++) {
          for(let j=0; j<GRID_SIZE; j++) {
            if (newGrid[i][j] && newGrid[i][j].id === cell.id) newGrid[i][j] = null;
          }
        }
        setGrid(newGrid);
      }
      return;
    }

    const recette = recettesDB.find(r => r.id === selectedTool);
    if (!recette) return;

    const limit = getLimitForStructure(recette.structure, logis.level);
    const usage = getUsageForStructure(newGrid, recette.structure);
    if (limit === 0) {
      showToast(`« ${recette.structure} » se débloque au niveau de camping-car ${getFirstUnlockLevel(recette.structure)} !`, 'warning');
      return;
    }
    if (usage >= limit) {
      showToast(`Limite atteinte ! Au niveau ${logis.level}, vous ne pouvez avoir que ${limit}x « ${recette.structure} ».`, 'warning');
      return;
    }

    const w = recette.w || 1;
    const h = recette.h || 1;
    
    // Check if clicked cell can be the origin
    if (!canPlace(newGrid, rIndex, cIndex, w, h)) {
      // alert("Pas assez d'espace pour placer cette structure ici !");
      return;
    }

    const uid = Date.now().toString() + Math.random();
    for(let i=0; i<h; i++) {
      for(let j=0; j<w; j++) {
        newGrid[rIndex+i][cIndex+j] = { id: uid, rId: recette.id, originR: rIndex, originC: cIndex };
      }
    }
    setGrid(newGrid);
  };

  const clearGrid = () => {
    if(confirm('Tout effacer ?')) setGrid(Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(null)));
  };

  const autoOptimize = (strategy, targetId) => {
    let structuresToPlace = [];
    const tryAdd = (recId, tempUsages) => {
      const rec = recettesDB.find(r => r.id === recId);
      if (!rec) return false;
      const limit = getLimitForStructure(rec.structure, logis.level);
      const usage = tempUsages[rec.structure] || 0;
      if (usage < limit) {
        structuresToPlace.push(recId);
        tempUsages[rec.structure] = usage + 1;
        return true;
      }
      return false;
    };

    const maxStructs = Math.min(100, logis.level * MAX_STRUCTURES_PER_LEVEL);
    let tempUsages = {};

    if (strategy === 'money') {
      // Pour utiliser la logique d'Aura, on force Max Argent à utiliser le solveur logique
      strategy = 'custom';
      targetId = 'r2';
    } else if (strategy === 'optimal') {
      const ratio = ['r5', 'r5', 'r4', 'r16', 'r8', 'r9', 'r10', 'r5', 'r5', 'r4'];
      for (let i = 0; i < maxStructs; i++) tryAdd(ratio[i % ratio.length], tempUsages);
    } else if (strategy === 'levelup') {
      // Stratégie Max Niveau : maximise le nombre d'items produits/heure (cycles courts, petites structures)
      // Score = cycles/heure divisé par la surface occupée (densité de production)
      const scored = recettesDB
        .filter(r => !r.needsAura && r.tempsMin > 0) // exclure les recettes nécessitant une aura (trop de contraintes)
        .map(r => ({
          id: r.id,
          score: (60 / r.tempsMin) / ((r.w||1) * (r.h||1)), // cycles/heure par case
          cyclesH: 60 / r.tempsMin,
          area: (r.w||1) * (r.h||1),
          structure: r.structure,
        }))
        .sort((a, b) => b.score - a.score);

      // Sélectionner les meilleures recettes en respectant les limites, avec diversité de structures
      const usedStructures = new Set();
      // Premier tour : une de chaque structure top
      for (const s of scored) {
        const limit = getLimitForStructure(s.structure, logis.level);
        const usage = tempUsages[s.structure] || 0;
        if (usage < limit && structuresToPlace.length < maxStructs) {
          structuresToPlace.push(s.id);
          tempUsages[s.structure] = usage + 1;
          usedStructures.add(s.structure);
        }
        if (structuresToPlace.length >= Math.min(maxStructs, scored.length)) break;
      }
      // Remplir le reste avec la meilleure recette encore disponible
      while (structuresToPlace.length < maxStructs) {
        let added = false;
        for (const s of scored) {
          const limit = getLimitForStructure(s.structure, logis.level);
          const usage = tempUsages[s.structure] || 0;
          if (usage < limit) {
            structuresToPlace.push(s.id);
            tempUsages[s.structure] = usage + 1;
            added = true;
            break;
          }
        }
        if (!added) break;
      }
    } 
    
    if (strategy === 'custom') {
      if (!targetId) return;

      const getNetResource = (resName, tempList) => {
        let net = 0;
        const resLower = resName.toLowerCase().trim();
        tempList.forEach(id => {
          const r = recettesDB.find(x => x.id === id);
          if (r) {
            const runs = 60 / Math.max(0.1, r.tempsMin);
            if (r.input) {
              Object.entries(r.input).forEach(([k, qte]) => {
                if (k.toLowerCase() === resLower) net -= qte * runs;
              });
            }
            if (r.output) {
              Object.entries(r.output).forEach(([k, qte]) => {
                if (k.toLowerCase() === resLower) net += qte * runs;
              });
            }
            if ((resLower === 'bloc de bois' || resLower === 'bois') && r.structure === 'Pépinière') {
              const g = GRAINES_DB.find(x => x.culture.toLowerCase() === r.nom.toLowerCase() || r.nom.toLowerCase().includes(x.culture.toLowerCase()));
              if (g && (g.bois_h || 0) > 0) {
                net += g.bois_h;
              }
            }
          }
        });
        return net;
      };

      // 1. Poser en priorité la recette cible
      tryAdd(targetId, tempUsages);

      const targetRec = recettesDB.find(x => x.id === targetId);
      const usesWood = targetRec && (
        (targetRec.input && Object.keys(targetRec.input).some(k => k.toLowerCase().includes('bois'))) ||
        targetRec.structure === 'Établi de menuiserie' ||
        targetRec.nom.toLowerCase().includes('planche') ||
        targetRec.nom.toLowerCase().includes('bois')
      );

      // 2. Boucle pour équilibrer la chaîne de production et combler les déficits directs
      for (let pass = 0; pass < 30; pass++) {
        let deficits = {};
        let missingAuras = new Set();
        let auraDemands = {};
        let auraProvidersCount = {};

        structuresToPlace.forEach(id => {
          const r = recettesDB.find(x => x.id === id);
          if (r) {
            if (r.input) {
              Object.keys(r.input).forEach(req => {
                const net = getNetResource(req, structuresToPlace);
                if (net < 0) deficits[req] = net;
              });
            }
            if (r.needsAura) {
              auraDemands[r.needsAura] = (auraDemands[r.needsAura] || 0) + (r.w||1)*(r.h||1);
            }
            if (r.providesAura) {
              auraProvidersCount[r.providesAura.type] = (auraProvidersCount[r.providesAura.type] || 0) + 1;
            }
          }
        });

        // Vérification des auras requises
        Object.keys(auraDemands).forEach(auraType => {
          const demandArea = auraDemands[auraType];
          const providersArea = (auraProvidersCount[auraType] || 0) * 16;
          if (demandArea >= providersArea) {
            missingAuras.add(auraType);
          }
        });

        let added = false;
        if (missingAuras.size > 0) {
          const neededAura = Array.from(missingAuras)[0];
          const provider = recettesDB.find(r => r.providesAura && r.providesAura.type === neededAura);
          if (provider) added = tryAdd(provider.id, tempUsages);
        }

        if (!added && Object.keys(deficits).length > 0) {
          const sortedDeficits = Object.keys(deficits).sort((a, b) => deficits[a] - deficits[b]);
          for (const defRes of sortedDeficits) {
            let producer = recettesDB.find(r =>
              r.output && Object.keys(r.output).some(k => k.toLowerCase() === defRes.toLowerCase())
            );
            if (!producer && (defRes.toLowerCase() === 'bloc de bois' || defRes.toLowerCase() === 'bois')) {
              producer = recettesDB.find(r => r.id === 'base_bois_bloc' || r.id === 'base_bois');
            }
            if (!producer) {
              const matchingCrop = GRAINES_DB.find(g => {
                const cLower = g.culture.toLowerCase().trim();
                return (defRes.toLowerCase() === cLower || defRes.toLowerCase().includes(cLower)) && (g.niveau_requis || 1) <= logis.level;
              });
              if (matchingCrop) {
                producer = recettesDB.find(r => {
                  const rLower = r.nom.toLowerCase().trim();
                  const cLower = matchingCrop.culture.toLowerCase().trim();
                  return rLower === cLower || rLower === `champ ${cLower}` || rLower === `arbre à ${cLower}` || rLower.includes(cLower);
                });
              }
            }
            if (producer && tryAdd(producer.id, tempUsages)) {
              added = true;
              break;
            }
          }
        }

        // Tenter d'ajouter un autre exemplaire de la recette cible si quota disponible
        if (!added) {
          added = tryAdd(targetId, tempUsages);
        }

        if (!added) break;
      }

      // 3. MAXIMISATION DU BOIS SI LA RECETTE UTILISE DU BOIS :
      if (usesWood) {
        const zc = recettesDB.find(r => r.id === 'base_bois_bloc');
        if (zc) {
          while (tryAdd(zc.id, tempUsages)) {}
        }
      }

      // 4. SATURATION DU LOGIS AVEC LE MAXIMUM DE MACHINES AUTORISÉES DU NIVEAU :
      // On comble le reste de la grille avec les structures majeures pour ne pas laisser de cases vides
      
      // A. Pépinières : remplir jusqu'au quota maximum débloqué (ex: 4 au niv 11)
      const bestPepCrop = GRAINES_DB.filter(g => g.structure === 'Pépinière' && (g.niveau_requis || 1) <= logis.level)
        .sort((a, b) => (usesWood ? (b.bois_h || 0) - (a.bois_h || 0) : b.pieces_h - a.pieces_h))[0];
      if (bestPepCrop) {
        const pepRec = recettesDB.find(r => r.nom.toLowerCase().includes(bestPepCrop.culture.toLowerCase())) || recettesDB.find(r => r.id === 'r5');
        if (pepRec) {
          while (tryAdd(pepRec.id, tempUsages)) {}
        }
      }

      // B. Fermes : remplir jusqu'au quota maximum débloqué (ex: 5 au niv 11) avec la meilleure culture
      const bestFarmCrop = GRAINES_DB.filter(g => g.structure === 'Ferme' && (g.niveau_requis || 1) <= logis.level)
        .sort((a, b) => b.pieces_h - a.pieces_h)[0];
      if (bestFarmCrop) {
        const farmRec = recettesDB.find(r => r.nom.toLowerCase().includes(bestFarmCrop.culture.toLowerCase())) || recettesDB.find(r => r.id === 'r2') || recettesDB.find(r => r.id === 'r1');
        if (farmRec) {
          // Si la culture exige une aura Frais (ex: Fraise), poser la Climatisation si quota disponible
          if (farmRec.needsAura && !structuresToPlace.some(id => recettesDB.find(x => x.id === id)?.providesAura?.type === farmRec.needsAura)) {
            const auraProv = recettesDB.find(r => r.providesAura && r.providesAura.type === farmRec.needsAura);
            if (auraProv) tryAdd(auraProv.id, tempUsages);
          }
          while (tryAdd(farmRec.id, tempUsages)) {}
        }
      }

      // C. Mines : remplir jusqu'au quota maximum (ex: 3 au niv 11)
      const mineRec = recettesDB.find(r => r.id === 'r6' || r.structure === 'Mine');
      if (mineRec) {
        while (tryAdd(mineRec.id, tempUsages)) {}
      }

      // D. Zones de coupe : si pas encore au max (ex: 4 au niv 11), les maxer
      const zcAny = recettesDB.find(r => r.id === 'base_bois_bloc');
      if (zcAny) {
        while (tryAdd(zcAny.id, tempUsages)) {}
      }

      // E. Ateliers complémentaires débloqués (Artisanat, Cuisine, Bocal...)
      const secondaryCandidates = [
        recettesDB.find(r => r.id === 'r8'),  // Établi artisanal
        recettesDB.find(r => r.id === 'r15'), // Bocal à pickles
        recettesDB.find(r => r.id === 'r14'), // Marmite à mijoter
        recettesDB.find(r => r.id === 'r11'), // Puits
        recettesDB.find(r => r.structure === 'Attrape-popote'),
        recettesDB.find(r => r.structure === 'Grande roue à tisser')
      ].filter(Boolean);

      for (const secRec of secondaryCandidates) {
        if (secRec.needsAura && !structuresToPlace.some(id => recettesDB.find(x => x.id === id)?.providesAura?.type === secRec.needsAura)) {
          const prov = recettesDB.find(r => r.providesAura && r.providesAura.type === secRec.needsAura);
          if (prov) tryAdd(prov.id, tempUsages);
        }
        while (tryAdd(secRec.id, tempUsages)) {}
      }
    }

    // Phase 2: Placement spatial (Bin Packing heuristique)
    const newGrid = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(null));
    
    structuresToPlace.sort((a, b) => {
       const ra = recettesDB.find(x => x.id === a);
       const rb = recettesDB.find(x => x.id === b);
       const pa = ra.providesAura ? 1 : 0;
       const pb = rb.providesAura ? 1 : 0;
       if (pa !== pb) return pb - pa;
       const da = ra.needsAura ? 1 : 0;
       const db = rb.needsAura ? 1 : 0;
       if (da !== db) return db - da;
       return (rb.w * rb.h) - (ra.w * ra.h);
    });

    structuresToPlace.forEach(id => {
       const r = recettesDB.find(x => x.id === id);
       if (!r) return;
       const w = r.w || 1;
       const h = r.h || 1;
       let bestSpot = null;
       let bestScore = -Infinity;

       // 1. Chercher le meilleur emplacement avec un système de scoring
       for(let row=0; row<=GRID_SIZE - h; row++) {
         for(let col=0; col<=GRID_SIZE - w; col++) {
            if (canPlace(newGrid, row, col, w, h)) {
               // Ignorer si la zone n'est pas couverte par l'aura requise
               if (r.needsAura && !hasAura(newGrid, row, col, w, h, r.needsAura)) continue;
               
               let score = 0;

               // Critère 1 : Couverture maximale pour les générateurs d'Aura
               if (r.providesAura) {
                  let newCoverage = 0;
                  const range = r.providesAura.range;
                  const startR = Math.max(0, row - range);
                  const endR = Math.min(GRID_SIZE - 1, row + h - 1 + range);
                  const startC = Math.max(0, col - range);
                  const endC = Math.min(GRID_SIZE - 1, col + w - 1 + range);
                  
                  for (let i = startR; i <= endR; i++) {
                     for (let j = startC; j <= endC; j++) {
                        if (!hasAura(newGrid, i, j, 1, 1, r.providesAura.type)) {
                           newCoverage++;
                        }
                     }
                  }
                  score += newCoverage * 100; // Forte priorité à la couverture
               }

               // Critère 2 : Compacité (Toucher les murs ou d'autres blocs)
               let touches = 0;
               for (let i = 0; i < h; i++) {
                 if (col === 0 || newGrid[row+i][col-1]) touches++;
                 if (col+w === GRID_SIZE || newGrid[row+i][col+w]) touches++;
               }
               for (let j = 0; j < w; j++) {
                 if (row === 0 || newGrid[row-1][col+j]) touches++;
                 if (row+h === GRID_SIZE || newGrid[row+h][col+j]) touches++;
               }
               score += touches * 10;

               // Critère 3 : Gravité (Tasser en haut à gauche pour éviter la fragmentation)
               score -= (row * 2 + col);

               if (score > bestScore) {
                 bestScore = score;
                 bestSpot = { row, col };
               }
            }
         }
       }

       const uid = Date.now().toString() + Math.random();

       // 2. Placer à l'emplacement optimal trouvé
       if (bestSpot) {
          for(let i=0; i<h; i++) {
            for(let j=0; j<w; j++) {
              newGrid[bestSpot.row+i][bestSpot.col+j] = { id: uid, rId: id, originR: bestSpot.row, originC: bestSpot.col };
            }
          }
       } else {
          // 3. Fallback : Si impossible (ex: plus de place sous aura), forcer n'importe où
          let fallbackPlaced = false;
          for(let row=0; row<=GRID_SIZE - h; row++) {
            for(let col=0; col<=GRID_SIZE - w; col++) {
               if (canPlace(newGrid, row, col, w, h)) {
                  for(let i=0; i<h; i++) {
                    for(let j=0; j<w; j++) {
                      newGrid[row+i][col+j] = { id: uid, rId: id, originR: row, originC: col };
                    }
                  }
                  fallbackPlaced = true; break;
               }
            }
            if (fallbackPlaced) break;
          }
       }
    });

    setGrid(newGrid);
    const targetObj = targetId ? recettesDB.find(x => x.id === targetId) : null;
    showToast(
      targetObj 
        ? `⚡ Grille optimisée avec ${structuresToPlace.length} installations pour « ${targetObj.nom} » !` 
        : `⚡ Grille optimisée avec ${structuresToPlace.length} installations !`,
      'success'
    );
  };

  const completeMissingProduction = () => {
    const newGrid = grid.map(row => [...row]);
    const speedFactor = aniimoEfficiency / 100;

    // Calculer les déficits nets actuels
    const getGridDeficits = (targetGrid) => {
      const produced = {};
      const consumed = {};

      targetGrid.forEach((row, r) => row.forEach((cell, c) => {
        if (cell && cell.originR === r && cell.originC === c) {
          const rec = recettesDB.find(x => x.id === cell.rId);
          if (!rec) return;

          let active = true;
          if (rec.needsAura) {
            active = hasAura(targetGrid, r, c, rec.w || 1, rec.h || 1, rec.needsAura);
          }

          if (active) {
            const runsPerHour = (60 / Math.max(0.1, rec.tempsMin)) * speedFactor;
            if (rec.input) {
              Object.entries(rec.input).forEach(([item, qte]) => {
                consumed[item] = (consumed[item] || 0) + (qte * runsPerHour);
              });
            }
            if (rec.output) {
              Object.entries(rec.output).forEach(([item, qte]) => {
                produced[item] = (produced[item] || 0) + (qte * runsPerHour);
              });
            }
            if (rec.structure === 'Pépinière') {
              const g = GRAINES_DB.find(x => x.culture.toLowerCase() === rec.nom.toLowerCase() || rec.nom.toLowerCase().includes(x.culture.toLowerCase()));
              if (g && (g.bois_h || 0) > 0) {
                const woodH = g.bois_h * speedFactor;
                produced['Bloc de bois'] = (produced['Bloc de bois'] || 0) + woodH;
                produced['Bois'] = (produced['Bois'] || 0) + woodH;
              }
            }
          }
        }
      }));

      const defs = {};
      const allRes = Array.from(new Set([...Object.keys(produced), ...Object.keys(consumed)]));
      allRes.forEach(item => {
        const net = (produced[item] || 0) - (consumed[item] || 0);
        if (net < -0.01) {
          defs[item] = Math.abs(net);
        }
      });
      return defs;
    };

    const findBestProducer = (resName) => {
      const resLower = resName.toLowerCase().trim();

      // Bois brut ou Bloc de bois
      if (resLower === 'bloc de bois' || resLower === 'bois') {
        const zc = recettesDB.find(r => r.id === 'base_bois_bloc' || r.id === 'base_bois');
        if (zc) {
          const limit = getLimitForStructure(zc.structure, logis.level);
          const usage = getUsageForStructure(newGrid, zc.structure);
          if (usage < limit) return zc;
        }
        // Fallback pépinière pour le bois si la zone de coupe est pleine
        const bestWoodGraine = GRAINES_DB.filter(g => (g.bois_h || 0) > 0 && (g.niveau_requis || 1) <= logis.level)
          .sort((a, b) => (b.bois_h || 0) - (a.bois_h || 0))[0];
        if (bestWoodGraine) {
          const pep = recettesDB.find(r => r.nom.toLowerCase().includes(bestWoodGraine.culture.toLowerCase()));
          if (pep) return pep;
        }
      }

      const candidates = recettesDB.filter(r =>
        r.output && Object.keys(r.output).some(k => k.toLowerCase() === resLower)
      );

      if (candidates.length > 0) {
        return candidates.sort((a, b) => {
          const outA = a.output[Object.keys(a.output).find(k => k.toLowerCase() === resLower)] || 1;
          const outB = b.output[Object.keys(b.output).find(k => k.toLowerCase() === resLower)] || 1;
          const rateA = outA * (60 / Math.max(0.1, a.tempsMin));
          const rateB = outB * (60 / Math.max(0.1, b.tempsMin));
          return rateB - rateA;
        })[0];
      }

      // Cultures agricoles
      const matchingCrops = GRAINES_DB.filter(g => {
        const cLower = g.culture.toLowerCase().trim();
        return (resLower === cLower || resLower.includes(cLower) || cLower.includes(resLower)) && (g.niveau_requis || 1) <= logis.level;
      }).sort((a, b) => b.pieces_h - a.pieces_h);

      if (matchingCrops.length > 0) {
        const bestG = matchingCrops[0];
        const rMatch = recettesDB.find(r => {
          const rLower = r.nom.toLowerCase().trim();
          const cLower = bestG.culture.toLowerCase().trim();
          return rLower === cLower || rLower === `champ ${cLower}` || rLower === `arbre à ${cLower}` || rLower.includes(cLower);
        });
        if (rMatch) return rMatch;
      }

      return null;
    };

    const tryPlaceProducer = (producer) => {
      const w = producer.w || 1;
      const h = producer.h || 1;
      const limit = getLimitForStructure(producer.structure, logis.level);
      const usage = getUsageForStructure(newGrid, producer.structure);
      if (usage >= limit) return false;

      for (let r = 0; r <= GRID_SIZE - h; r++) {
        for (let c = 0; c <= GRID_SIZE - w; c++) {
          if (canPlace(newGrid, r, c, w, h)) {
            if (producer.needsAura && !hasAura(newGrid, r, c, w, h, producer.needsAura)) {
              continue;
            }
            const cellId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
            for (let i = 0; i < h; i++) {
              for (let j = 0; j < w; j++) {
                newGrid[r + i][c + j] = {
                  id: cellId,
                  rId: producer.id,
                  originR: r,
                  originC: c
                };
              }
            }
            return true;
          }
        }
      }
      return false;
    };

    const initialDeficits = getGridDeficits(newGrid);
    if (Object.keys(initialDeficits).length === 0) {
      showToast("✓ Votre chaîne de production est déjà 100% autosuffisante (aucun déficit).", "info");
      return;
    }

    let totalPlaced = 0;
    const placedCounts = {};

    for (let pass = 0; pass < 4; pass++) {
      const deficits = getGridDeficits(newGrid);
      const defKeys = Object.keys(deficits);
      if (defKeys.length === 0) break;

      let placedInPass = 0;
      for (const resName of defKeys) {
        const deficitAmount = deficits[resName];
        const producer = findBestProducer(resName);
        if (!producer) continue;

        // Si le producteur a besoin d'aura, essayer d'abord de placer le générateur d'Aura s'il n'existe pas
        if (producer.needsAura) {
          const hasAnyAura = hasAura(newGrid, 0, 0, GRID_SIZE, GRID_SIZE, producer.needsAura);
          if (!hasAnyAura) {
            const auraGen = recettesDB.find(r => r.providesAura && r.providesAura.type === producer.needsAura);
            if (auraGen && tryPlaceProducer(auraGen)) {
              placedInPass++;
              totalPlaced++;
              placedCounts[auraGen.nom] = (placedCounts[auraGen.nom] || 0) + 1;
            }
          }
        }

        const outKey = Object.keys(producer.output || {}).find(k => k.toLowerCase() === resName.toLowerCase()) || Object.keys(producer.output || {})[0];
        const outQty = producer.output ? (producer.output[outKey] || 1) : 1;
        const ratePerBuilding = outQty * (60 / Math.max(0.1, producer.tempsMin)) * speedFactor;
        const countNeeded = Math.max(1, Math.ceil(deficitAmount / Math.max(0.1, ratePerBuilding)));

        for (let i = 0; i < countNeeded; i++) {
          if (tryPlaceProducer(producer)) {
            placedInPass++;
            totalPlaced++;
            placedCounts[producer.nom] = (placedCounts[producer.nom] || 0) + 1;
          } else {
            break;
          }
        }
      }

      if (placedInPass === 0) break;
    }

    if (totalPlaced > 0) {
      setGrid(newGrid);
      const details = Object.entries(placedCounts).map(([nom, qte]) => `${qte}× ${nom}`).join(', ');
      showToast(`🧩 ${totalPlaced} installation(s) ajoutée(s) : ${details}`, "success");
    } else {
      showToast("⚠️ Impossible d'ajouter des bâtiments : limite par structure atteinte pour votre niveau ou plus d'espace libre !", "warning");
    }
  };

  const rebalanceGridFull = (specificRecipeId) => {
    let target = null;
    if (specificRecipeId) {
      target = recettesDB.find(r => r.id === specificRecipeId);
    }
    if (!target && selectedTool && selectedTool !== 'eraser') {
      target = recettesDB.find(r => r.id === selectedTool);
    }
    if (!target) {
      const onGrid = [];
      grid.forEach((row, r) => row.forEach((cell, c) => {
        if (cell && cell.originR === r && cell.originC === c) {
          const rec = recettesDB.find(x => x.id === cell.rId);
          if (rec && !onGrid.some(x => x.id === rec.id)) onGrid.push(rec);
        }
      }));
      onGrid.sort((a, b) => {
        const aHasInput = a.input && Object.keys(a.input).length > 0 ? 1 : 0;
        const bHasInput = b.input && Object.keys(b.input).length > 0 ? 1 : 0;
        if (bHasInput !== aHasInput) return bHasInput - aHasInput;
        return (b.profit || 0) - (a.profit || 0);
      });
      target = onGrid[0];
    }

    if (!target) {
      target = recettesDB.find(r => r.id === 'r273') || recettesDB.find(r => r.id === 'r2');
    }

    if (!target) {
      showToast("Veuillez sélectionner une recette dans la liste pour réaménager la grille.", "warning");
      return;
    }

    autoOptimize('custom', target.id);
    showToast(`⚡ Grille réaménagée à 100% pour "${target.nom}" !`, "success");
  };

  const speedFactor = aniimoEfficiency / 100;

  const flow = {
    produced: {},
    consumed: {},
    net: {},
    deficits: [],
    balanced: [],
    surpluses: [],
    profitHoraire: 0,
    totalStructures: 0
  };

  grid.forEach((row, r) => row.forEach((cell, c) => {
    if (cell && cell.originR === r && cell.originC === c) {
      flow.totalStructures++;
      const rec = recettesDB.find(x => x.id === cell.rId);
      if (!rec) return;

      let active = true;
      if (rec.needsAura) {
        active = hasAura(grid, r, c, rec.w || 1, rec.h || 1, rec.needsAura);
      }

      if (active) {
        const runsPerHour = (60 / Math.max(0.1, rec.tempsMin)) * speedFactor;
        let buildingProfit = (rec.profit * runsPerHour);
        if (rec.structure === 'Ferme' || rec.structure === 'Pépinière') {
          const g = GRAINES_DB.find(x => x.culture.toLowerCase() === rec.nom.toLowerCase() || rec.nom.toLowerCase().includes(x.culture.toLowerCase()));
          if (g && (g.pieces_h || 0) > 0) {
            buildingProfit = g.pieces_h * speedFactor;
          }
        }
        flow.profitHoraire += buildingProfit;

        if (rec.input) {
          Object.entries(rec.input).forEach(([item, qte]) => {
            flow.consumed[item] = (flow.consumed[item] || 0) + (qte * runsPerHour);
          });
        }
        if (rec.output) {
          Object.entries(rec.output).forEach(([item, qte]) => {
            flow.produced[item] = (flow.produced[item] || 0) + (qte * runsPerHour);
          });
        }
        // Pépinière wood output
        if (rec.structure === 'Pépinière') {
          const g = GRAINES_DB.find(x => x.culture.toLowerCase() === rec.nom.toLowerCase() || rec.nom.toLowerCase().includes(x.culture.toLowerCase()));
          if (g && (g.bois_h || 0) > 0) {
            const woodH = g.bois_h * speedFactor;
            flow.produced['Bloc de bois'] = (flow.produced['Bloc de bois'] || 0) + woodH;
            flow.produced['Bois'] = (flow.produced['Bois'] || 0) + woodH;
          }
        }
      }
    }
  }));

  const allFlowItems = Array.from(new Set([...Object.keys(flow.produced), ...Object.keys(flow.consumed)]));
  allFlowItems.forEach(item => {
    const prod = flow.produced[item] || 0;
    const cons = flow.consumed[item] || 0;
    const net = prod - cons;
    flow.net[item] = net;
    const itemData = {
      name: item,
      produced: prod,
      consumed: cons,
      net: net,
      coveragePercent: cons > 0 ? Math.round((prod / cons) * 100) : 100
    };
    if (net < -0.01) {
      flow.deficits.push(itemData);
    } else if (Math.abs(net) <= 0.01 && cons > 0) {
      flow.balanced.push(itemData);
    } else {
      flow.surpluses.push(itemData);
    }
  });

  const bilan = {
    ressources: flow.net,
    profitHoraire: flow.profitHoraire
  };
  const currentStructureCount = flow.totalStructures;
  const maxStructuresAllowed = Math.min(100, logis.level * MAX_STRUCTURES_PER_LEVEL);

  // Indicateurs économiques de progression vers le niveau cible
  const targetLevel = niveauCible || (logis.level + 1);
  const targetLevelData = NIVEAUX.find(n => n.niveau === targetLevel) || NIVEAUX[NIVEAUX.length - 1];
  const targetCost = targetLevelData ? (targetLevelData.pieces || 0) : 1060000;
  const currentWallet = logis.pieces || 0;
  const missingPieces = Math.max(0, targetCost - currentWallet);
  const completionPct = targetCost > 0 ? Math.min(100, Math.round((currentWallet / targetCost) * 100)) : 100;

  const timeRemainingText = useMemo(() => {
    if (missingPieces <= 0) return 'Objectif financé ! 🎉';
    const hourly = flow.profitHoraire;
    if (hourly <= 0) return 'Production à l\'arrêt';
    const totalHours = missingPieces / hourly;
    if (totalHours >= 24) {
      const days = Math.floor(totalHours / 24);
      const remHours = Math.round(totalHours % 24);
      return `${days}j ${remHours}h`;
    }
    const h = Math.floor(totalHours);
    const m = Math.round((totalHours - h) * 60);
    return `${h}h ${m}min`;
  }, [missingPieces, flow.profitHoraire]);

  return (
    <div className="min-h-screen p-2 sm:p-4 lg:p-6 w-full flex flex-col items-center">
      <div className="w-full max-w-[1920px] space-y-4">
        
        {/* Toast Notification flottant */}
        {notification && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300">
            <div className={`px-4 py-2.5 rounded-xl shadow-2xl border text-sm font-semibold flex items-center gap-2 backdrop-blur-md ${
              notification.type === 'success' ? 'bg-emerald-950/95 text-emerald-200 border-emerald-500/70 shadow-emerald-900/40' :
              notification.type === 'warning' ? 'bg-amber-950/95 text-amber-200 border-amber-500/70 shadow-amber-900/40' :
              'bg-slate-900/95 text-slate-200 border-indigo-500/70 shadow-indigo-900/40'
            }`}>
              <span className="text-base">{notification.type === 'success' ? '✓' : notification.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
              <span>{notification.message}</span>
            </div>
          </div>
        )}

        <header className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700 flex justify-between items-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            Aniimo - Foyer
          </h1>
          <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-2">
            <label className="text-xs text-slate-400 uppercase font-bold">Niveau Camping-Car</label>
            <input 
              type="number" 
              value={logis.level}
              onChange={e => updateLogis('level', parseInt(e.target.value) || 1)}
              className="bg-slate-800 text-lg font-bold w-12 text-center rounded focus:outline-none"
              min="1" max="20"
            />
          </div>
        </header>

        <section className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700">
          
          <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4 border-b border-slate-700 pb-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">🗺️ Grille d'Aménagement Avancée</h2>
              <p className="text-slate-400 text-sm">
                Les structures ont des dimensions et des portées d'action (Aura = 2 cases).
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-slate-900 border border-indigo-500/50 p-2 rounded-lg flex items-center gap-2 shadow-inner">
                <span className="text-xs uppercase font-bold text-indigo-400">Auto ({maxStructuresAllowed} max) :</span>
                <button onClick={() => autoOptimize('money')} className="bg-indigo-600 hover:bg-indigo-500 px-3 py-1 text-sm rounded font-semibold transition">Max Argent</button>
                <button onClick={() => autoOptimize('optimal')} className="bg-amber-500 text-black hover:bg-amber-400 px-3 py-1 text-sm rounded font-bold transition">Plan Optimal (Meta)</button>
                  <button onClick={() => { autoOptimize('levelup'); setShowLevelModal(true); }} className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1 text-sm rounded font-bold transition">⬆️ Max Niveau</button>
                  <button onClick={() => { setNiveauCible(logis.level + 1); setShowNiveauModal(true); }} className="bg-teal-600 hover:bg-teal-500 px-3 py-1 text-sm rounded font-bold transition">📊 Calc. Niveau</button>
                  <button onClick={() => setShowGrainesModal(true)} className="bg-lime-500 hover:bg-lime-400 text-slate-900 px-3 py-1 text-sm rounded font-bold transition flex items-center gap-1 shadow-sm">🌱 Graines</button>
                
                {/* Menu déroulant avec recherche intégrée pour Optimiser pour */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowOptimizeDropdown(prev => !prev);
                      setOptimizeSearch('');
                    }}
                    className="bg-indigo-700 hover:bg-indigo-600 px-3 py-1 text-sm rounded font-semibold text-white focus:outline-none flex items-center gap-1.5 cursor-pointer transition shadow-sm"
                  >
                    <span>🎯 Optimiser pour...</span>
                    <span className="text-[10px] opacity-75">{showOptimizeDropdown ? '▲' : '▼'}</span>
                  </button>

                  {showOptimizeDropdown && (
                    <>
                      {/* Arrière-plan transparent pour fermer au clic extérieur */}
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowOptimizeDropdown(false)}
                      />

                      {/* Boîte déroulante avec recherche */}
                      <div className="absolute right-0 mt-1.5 w-80 max-w-[90vw] bg-slate-900 border border-indigo-500/60 rounded-xl shadow-2xl z-50 overflow-hidden text-left">
                        {/* Champ de recherche */}
                        <div className="p-2 border-b border-slate-700 bg-slate-950/80 sticky top-0 z-10">
                          <div className="relative">
                            <input
                              type="text"
                              autoFocus
                              placeholder="🔍 Rechercher (ex: planche, pain)..."
                              value={optimizeSearch}
                              onChange={e => setOptimizeSearch(e.target.value)}
                              className="w-full bg-slate-800 text-xs px-3 py-2 rounded-lg border border-slate-700 text-white placeholder-slate-400 focus:outline-none focus:border-indigo-400"
                              onClick={e => e.stopPropagation()}
                            />
                            {optimizeSearch && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOptimizeSearch('');
                                }}
                                className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Liste des résultats filtrés */}
                        <div className="max-h-72 overflow-y-auto p-1 divide-y divide-slate-800/60">
                          {(() => {
                            const filtered = sortedRecettes.filter(r =>
                              !optimizeSearch ||
                              r.nom.toLowerCase().includes(optimizeSearch.toLowerCase()) ||
                              r.structure.toLowerCase().includes(optimizeSearch.toLowerCase())
                            );

                            if (filtered.length === 0) {
                              return (
                                <div className="p-4 text-center text-xs text-slate-400 italic">
                                  Aucune recette trouvée pour « {optimizeSearch} »
                                </div>
                              );
                            }

                            const groups = {};
                            filtered.forEach(r => {
                              if (!groups[r.structure]) groups[r.structure] = [];
                              groups[r.structure].push(r);
                            });

                            return Object.entries(groups).map(([structName, items]) => (
                              <div key={structName} className="py-1">
                                <div className="px-2.5 py-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-800/40 rounded flex justify-between items-center">
                                  <span>{structName}</span>
                                  <span className="text-[9px] text-slate-500 font-normal">{items.length}</span>
                                </div>
                                <div className="mt-0.5 space-y-0.5">
                                  {items.map(r => {
                                    const seeds = getRecommendedSeedsForRecipe(r);
                                    return (
                                      <button
                                        key={'opt_' + r.id}
                                        type="button"
                                        onClick={() => {
                                          autoOptimize('custom', r.id);
                                          setShowOptimizeDropdown(false);
                                          setOptimizeSearch('');
                                        }}
                                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/30 hover:text-white text-xs text-slate-200 flex items-center justify-between transition-colors group cursor-pointer"
                                      >
                                        <div className="flex items-center gap-2 truncate min-w-0">
                                          <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${r.color || 'bg-slate-600'}`} />
                                          <div className="truncate">
                                            <div className="font-semibold group-hover:text-indigo-300 truncate">{r.nom}</div>
                                            {seeds.length > 0 && (
                                              <div className="text-[9px] text-lime-400 font-normal truncate">
                                                🌱 {seeds.map(s => `${s.graine} (${s.bois_h ? `+${s.bois_h} bois/h` : s.rendement})`).join(', ')}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <span className="text-[10px] text-slate-500 flex-shrink-0 ml-2">
                                          {(r.w || 1)}x{(r.h || 1)} · {r.tempsMin}m
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <button onClick={clearGrid} className="bg-red-900/50 text-red-400 hover:bg-red-900/80 border border-red-800 px-4 py-2 text-sm rounded-lg font-bold transition">Effacer</button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 relative items-start w-full">
            
            {/* Palette */}
            <div className="lg:col-span-3 xl:col-span-3 bg-slate-900 p-4 rounded-xl border border-slate-700 flex flex-col gap-3 max-h-[calc(100vh-140px)] sticky top-4 overflow-y-auto pr-1.5 shadow-md">
              <h3 className="font-semibold text-slate-300 uppercase text-xs tracking-wider border-b border-slate-700 pb-2">Dessin manuel</h3>
              <button onClick={() => setSelectedTool('eraser')} className={`flex items-center gap-3 p-2 rounded-lg transition border ${selectedTool === 'eraser' ? 'bg-red-900/50 border-red-500' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'}`}>
                <span className="text-xl">🧹</span> <span className="font-semibold">Effaceur</span>
              </button>

              <div className="flex justify-between items-end border-b border-slate-700 pb-2 mt-2">
                <div>
                  <h3 className="font-semibold text-slate-300 uppercase text-xs tracking-wider">Vos Recettes</h3>
                  <span className="text-[10px] text-slate-500">{filteredRecettes.length} recette{filteredRecettes.length > 1 ? 's' : ''}</span>
                </div>
                <button onClick={() => setShowRecipeModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-2 py-1 rounded font-bold transition">+ Créer</button>
              </div>

              {/* Barre de recherche */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Rechercher (ex: planche, blé)..."
                  value={recipeSearch}
                  onChange={e => setRecipeSearch(e.target.value)}
                  className="w-full bg-slate-800 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                {recipeSearch && (
                  <button onClick={() => setRecipeSearch('')} className="absolute right-2 top-1.5 text-slate-400 hover:text-white text-xs">✕</button>
                )}
              </div>

              {filteredRecettes.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-500 italic">
                  Aucune recette trouvée pour « {recipeSearch} »
                </div>
              ) : filteredRecettes.map(r => {
                const limit = getLimitForStructure(r.structure, logis.level);
                const usage = getUsageForStructure(grid, r.structure);
                const isLocked = limit === 0;
                const isFull = usage >= limit;
                return (
                <button 
                  key={r.id} 
                  onClick={() => setSelectedTool(r.id)}
                  className={`flex items-center gap-3 p-2 rounded-lg transition border text-left cursor-pointer ${
                    selectedTool === r.id 
                      ? 'bg-indigo-900/50 border-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.3)]' 
                      : 'bg-slate-800 border-slate-600 hover:bg-slate-750'
                  } ${isLocked ? 'opacity-40 grayscale-[40%]' : isFull ? 'opacity-60' : ''}`}
                >
                  <div className={`w-6 h-6 rounded border border-white/20 flex-shrink-0 ${r.color}`}></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm leading-tight truncate">{r.nom}</div>
                    <div className="text-[10px] text-slate-400">{r.structure} ({r.w||1}x{r.h||1})</div>
                    {(r.needsAura || r.providesAura) && (
                       <div className="text-[9px] text-cyan-300 mt-0.5">
                         {r.needsAura ? `Requiert: ${r.needsAura}` : `Génère: ${r.providesAura.type}`}
                       </div>
                    )}
                    {ANIIMO_ROLES[r.structure] && (
                      <div className="text-[9px] text-amber-400 mt-0.5">
                        {ANIIMO_ROLES[r.structure].emoji} {ANIIMO_ROLES[r.structure].elements.join(' / ')}
                      </div>
                    )}
                    {(() => {
                      const seeds = getRecommendedSeedsForRecipe(r);
                      if (seeds.length === 0) return null;
                      return (
                        <div className="text-[9px] text-lime-400 mt-0.5 font-medium truncate" title={`Plantez : ${seeds.map(s => `${s.graine} (${s.structure})`).join(' + ')}`}>
                          🌱 {seeds.map(s => `${s.graine} (${s.bois_h ? `+${s.bois_h} bois/h` : s.rendement})`).join(', ')}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex-shrink-0">
                    {isLocked ? (
                      <span className="text-[10px] font-bold font-mono text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-600/50" title={`Débloqué au niveau de camping-car ${getFirstUnlockLevel(r.structure)}`}>
                        🔒 Niv.{getFirstUnlockLevel(r.structure)}
                      </span>
                    ) : (
                      <span className={`text-xs font-mono font-bold ${isFull ? 'text-red-400' : 'text-slate-400'}`}>
                        {usage}/{limit}
                      </span>
                    )}
                  </div>
                </button>
              )})}
            </div>

            {/* Grille centrale */}
            <div className="lg:col-span-6 xl:col-span-6 flex flex-col items-center bg-slate-900 p-3 sm:p-5 rounded-xl border border-slate-700 w-full shadow-lg">
              {/* Panneau de la recette active avec recommandation de graines */}
              {(() => {
                const activeRecipe = selectedTool && selectedTool !== 'eraser' ? recettesDB.find(r => r.id === selectedTool) : null;
                if (!activeRecipe) return null;
                const recSeeds = getRecommendedSeedsForRecipe(activeRecipe);
                return (
                  <div className="w-full mb-4 p-3 bg-slate-800/95 border border-indigo-500/50 rounded-xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className={`w-3.5 h-3.5 rounded flex-shrink-0 ${activeRecipe.color || 'bg-indigo-600'}`} />
                        <span className="font-bold text-sm text-white">{activeRecipe.nom}</span>
                        <span className="text-[10px] text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-700 font-semibold">
                          {activeRecipe.structure} ({activeRecipe.w || 1}×{activeRecipe.h || 1})
                        </span>
                        {activeRecipe.needsAura && (
                          <span className="text-[10px] text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800 font-bold">
                            ❄️ Requiert {activeRecipe.needsAura}
                          </span>
                        )}
                      </div>

                      {/* Graines recommandées */}
                      {recSeeds.length > 0 ? (
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-xs">
                          <span className="text-lime-400 font-bold">🌱 Pour optimiser (Niv. {logis.level}) :</span>
                          {recSeeds.map((s, idx) => (
                            <span key={idx} className={`border px-2 py-0.5 rounded font-semibold text-xs flex items-center gap-1 ${
                              s.locked
                                ? 'bg-amber-950/70 border-amber-500/50 text-amber-300'
                                : 'bg-lime-950/70 border-lime-500/40 text-lime-300'
                            }`}>
                              <span>{s.locked ? '🔒' : '🌱'}</span>
                              <strong>{s.graine}</strong>
                              <span className="text-slate-400 text-[10px]">
                                ({s.structure}) · {s.bois_h ? `+${s.bois_h} bois/h` : s.rendement}
                                {s.niveau_requis && <span className="ml-1 text-slate-300">· Niv.{s.niveau_requis}</span>}
                                {s.locked && <span className="text-amber-400 font-bold ml-1">(Verrouillé)</span>}
                              </span>
                            </span>
                          ))}
                          {activeRecipe.nom.toLowerCase().includes('planche') && (
                            <span className="text-[11px] text-slate-400 italic">
                              (+ Zone de coupe pour le bois)
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="mt-1 text-[11px] text-slate-400">
                          Extraction directe / minérale (aucune graine agricole requise).
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => autoOptimize('custom', activeRecipe.id)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition shadow cursor-pointer flex items-center gap-1 whitespace-nowrap"
                        title="Aménager toute la chaîne de production sur la grille"
                      >
                        <span>⚡ Optimiser grille</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTool(null)}
                        className="text-slate-400 hover:text-white p-1 text-xs rounded hover:bg-slate-700"
                        title="Désélectionner"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* ===== BARRE DES PLANS D'AMÉNAGEMENT (PRESETS) ===== */}
              <div className="w-full mb-3 bg-slate-850/95 p-2.5 rounded-2xl border border-slate-700/80 shadow-md">
                <div className="flex items-center justify-between gap-2.5 flex-wrap">
                  {/* Sélecteur principal & puces rapides */}
                  <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 flex-shrink-0">
                      <span>📑</span>
                      <span className="hidden sm:inline">Plan actif :</span>
                    </span>

                    {/* Menu déroulant propre et direct sans scrollbar */}
                    <div className="relative">
                      <select
                        value={activePresetId}
                        onChange={(e) => handleSelectPreset(e.target.value)}
                        className="bg-slate-900 border border-emerald-500/70 hover:border-emerald-400 text-emerald-300 font-extrabold text-xs pl-3 pr-7 py-1.5 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer appearance-none transition-colors"
                      >
                        {presets.map(p => (
                          <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                            {p.isBuiltIn ? '⭐ ' : '📋 '}{p.name} (Niv.{p.level})
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-emerald-400 text-[10px]">
                        ▼
                      </div>
                    </div>

                    {/* Puces de bascule rapide (flex-wrap, AUCUNE barre de défilement) */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {presets.map(p => {
                        const isActive = p.id === activePresetId;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectPreset(p.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                              isActive
                                ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-sm ring-1 ring-emerald-400/80'
                                : 'bg-slate-800/90 text-slate-400 hover:text-slate-200 hover:bg-slate-750 border border-slate-700/70'
                            }`}
                            title={`Charger le plan « ${p.name} »`}
                          >
                            <span>{p.isBuiltIn ? '⭐' : '📋'}</span>
                            <span className="truncate max-w-[130px]">{p.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCreatePreset()}
                      className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-650 text-slate-200 text-xs rounded-xl font-bold flex items-center gap-1 transition cursor-pointer shadow-sm"
                      title="Créer un nouveau plan"
                    >
                      <span>➕</span>
                      <span className="hidden sm:inline">Nouveau</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPresetModal(true)}
                      className="px-2.5 py-1.5 bg-indigo-650 hover:bg-indigo-600 text-white text-xs rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                      title="Gérer, exporter ou importer des plans"
                    >
                      <span>📁</span>
                      <span>Gérer / Exporter</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Sélecteur de vue & d'affichage */}
              <div className="w-full flex items-center justify-between mb-3 px-1 flex-wrap gap-2 text-xs">
                {/* Switcher Vue Jeu vs Vue Technique */}
                <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setViewTheme('jeu')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      viewTheme === 'jeu'
                        ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-md border border-emerald-400/40'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                    }`}
                    title="Vue fidèle au jeu (pelouse, cartes blanches, badges ronds et niveaux Lv.X)"
                  >
                    <span>🎮</span>
                    <span>Vue Jeu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewTheme('technique')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      viewTheme === 'technique'
                        ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md border border-indigo-400/40'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                    }`}
                    title="Vue technique de planification (codes couleurs, graines et dimensions)"
                  >
                    <span>📐</span>
                    <span>Vue Grille</span>
                  </button>
                </div>

                {/* Bouton global de correction des auras manquantes */}
                {missingAurasCount > 0 && (
                  <button
                    type="button"
                    onClick={autoResolveAllMissingAuras}
                    className="px-3 py-1 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md border border-cyan-400/50 cursor-pointer transition animate-pulse hover:scale-105 active:scale-95"
                    title="Poser automatiquement les Climatiseurs / Fournaises pour couvrir tous les bâtiments en alerte"
                  >
                    <span>❄️</span>
                    <span>Corriger {missingAurasCount} aura{missingAurasCount > 1 ? 's' : ''}</span>
                  </button>
                )}

                {/* Sélecteur de mode d'affichage des cases */}
                <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700 shadow-sm">
                  <span className="text-[10px] text-slate-400 px-1 font-medium">Détails cases :</span>
                  <button
                    type="button"
                    onClick={() => setGridDisplayMode('mixte')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${gridDisplayMode === 'mixte' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    title="Affiche le nom de la recette et la graine à planter"
                  >
                    ✨ Mixte
                  </button>
                  <button
                    type="button"
                    onClick={() => setGridDisplayMode('graines')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${gridDisplayMode === 'graines' ? 'bg-lime-500 text-slate-900 shadow-sm font-extrabold' : 'text-slate-400 hover:text-white'}`}
                    title="Affiche directement les graines recommandées sur chaque case"
                  >
                    🌱 Graines
                  </button>
                  <button
                    type="button"
                    onClick={() => setGridDisplayMode('noms')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${gridDisplayMode === 'noms' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    title="Affiche uniquement les noms de structures"
                  >
                    🏷️ Noms
                  </button>
                </div>
              </div>

              {viewTheme === 'jeu' ? (
                /* ================= CADRE VUE JEU FIDÈLE ================= */
                <div className="w-full max-w-[700px] 2xl:max-w-[780px] rounded-3xl bg-gradient-to-b from-[#6cb75b] via-[#63ad52] to-[#559e44] border-4 border-[#4a8f3b] p-3 sm:p-5 shadow-2xl relative select-none overflow-visible transition-all">
                  {/* Top Bar HUD Jeu */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center text-sm font-bold text-emerald-800 border border-white">
                        🏡
                      </div>
                      <div>
                        <div className="text-white font-extrabold text-sm sm:text-base drop-shadow-sm leading-tight flex items-center gap-1.5">
                          <span>Gestion du logis</span>
                          <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded-full font-bold">
                            Niv.{logis.level}
                          </span>
                        </div>
                        <div className="text-emerald-100 text-[10px] font-medium leading-tight opacity-90">
                          {logis.surfaceUtilisee} / {logis.tailleMax} cases occupées
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="bg-black/30 backdrop-blur-sm border border-white/30 rounded-full px-2.5 py-1 text-white text-xs font-black flex items-center gap-1.5 shadow-inner">
                        <span className="text-amber-300">🟡</span>
                        <span>{(logis.pieces || 121727).toLocaleString()}</span>
                      </div>
                      {/* Zoom HUD décoratif */}
                      <div className="hidden sm:flex items-center gap-1 bg-black/20 border border-white/20 rounded-full px-2 py-0.5 text-[10px] text-white/80">
                        <span>🔍</span>
                        <span className="w-8 h-1 bg-white/30 rounded-full relative inline-block">
                          <span className="absolute left-1/2 -top-0.5 w-2 h-2 rounded-full bg-white shadow-sm"></span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Parcelle Watermark Markers */}
                  <div className="relative">
                    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none p-2 z-0">
                      <span className="text-lime-900/15 font-black text-xs uppercase tracking-widest">Parcelle 1</span>
                      <span className="text-lime-900/15 font-black text-xs uppercase tracking-widest text-right">Parcelle 2</span>
                      <span className="text-lime-900/15 font-black text-xs uppercase tracking-widest self-end">Parcelle 3</span>
                      <span className="text-lime-900/15 font-black text-xs uppercase tracking-widest text-right self-end">Parcelle 4</span>
                    </div>

                    {/* Grille In-Game */}
                    <div 
                      className="grid gap-1.5 relative z-10"
                      style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(42px, 1fr))`, gridAutoRows: 'clamp(44px, 4.8vw, 62px)', width: '100%' }}
                    >
                      {grid.map((row, rIndex) => row.map((cell, cIndex) => {
                        if (cell && (cell.originR !== rIndex || cell.originC !== cIndex)) return null;

                        const isOrigin = cell !== null;
                        const recette = isOrigin ? recettesDB.find(r => r.id === cell.rId) : null;
                        const w = recette ? (recette.w || 1) : 1;
                        const h = recette ? (recette.h || 1) : 1;

                        let auraMissing = false;
                        if (recette && recette.needsAura) {
                          auraMissing = !hasAura(grid, rIndex, cIndex, w, h, recette.needsAura);
                        }

                        const gameInfo = recette ? getGameViewInfo(recette) : null;
                        const seeds = recette ? getRecommendedSeedsForRecipe(recette) : [];
                        const primarySeed = seeds[0];
                        const isMultiCell = w > 1 || h > 1;

                        const isTopRow = rIndex <= 2;
                        const isLeftCol = cIndex <= 2;
                        const isRightCol = cIndex >= 7;

                        const tooltipPos = `${isTopRow ? 'top-full mt-2' : 'bottom-full mb-2'} ${
                          isLeftCol ? 'left-0 translate-x-0' : isRightCol ? 'right-0 translate-x-0' : 'left-1/2 -translate-x-1/2'
                        }`;

                        const arrowPos = `${isTopRow ? '-top-1 border-t border-l' : '-bottom-1 border-b border-r'} ${
                          isLeftCol ? 'left-5 translate-x-0' : isRightCol ? 'right-5 translate-x-0' : 'left-1/2 -translate-x-1/2'
                        }`;

                        const haloType = isCellInHalo(rIndex, cIndex, w, h);

                        return (
                          <div 
                            key={`game-${rIndex}-${cIndex}`}
                            onClick={() => handleCellClick(rIndex, cIndex)}
                            onDragEnter={() => handleCellClick(rIndex, cIndex)}
                            onMouseOver={(e) => { if(e.buttons === 1) handleCellClick(rIndex, cIndex) }}
                            onMouseEnter={() => setHoveredCell({ r: rIndex, c: cIndex })}
                            onMouseLeave={() => setHoveredCell(null)}
                            className={`group relative cursor-pointer transition-all duration-100 flex items-center justify-center text-center select-none hover:z-50 ${
                              recette 
                                ? 'bg-white/95 rounded-2xl shadow-md border-2 border-white/90 hover:scale-[1.02] hover:shadow-xl' 
                                : 'rounded-xl border border-dashed border-white/35 bg-white/5 hover:bg-white/20 hover:border-white/70'
                            } ${auraMissing ? 'ring-2 ring-red-500' : ''}`}
                            style={{ gridColumn: `span ${w}`, gridRow: `span ${h}` }}
                          >
                            {/* Halo d'aura visuel */}
                            {haloType && (
                              <div 
                                className={`absolute -inset-1 rounded-2xl pointer-events-none z-20 border-2 transition-all duration-150 animate-pulse ${
                                  haloType === 'Frais'
                                    ? 'bg-cyan-400/25 border-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.6)]'
                                    : 'bg-amber-400/25 border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.6)]'
                                }`}
                              >
                                <div className={`absolute top-1 left-1 text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm ${
                                  haloType === 'Frais' ? 'bg-cyan-950/85 text-cyan-200 border border-cyan-400/40' : 'bg-amber-950/85 text-amber-200 border border-amber-400/40'
                                }`}>
                                  {haloType === 'Frais' ? '❄️ Frais' : '🔥 Chaud'}
                                </div>
                              </div>
                            )}

                            {/* Bouton d'alerte et de résolution 1-clic */}
                            {auraMissing && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  autoPlaceAuraSource(rIndex, cIndex, recette.needsAura);
                                }}
                                className="absolute top-1 right-1 text-xs bg-red-500 hover:bg-emerald-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-lg z-25 cursor-pointer transition-all hover:scale-125 animate-pulse"
                                title={`⚠️ Aura manquante : ${recette.needsAura}. Cliquer pour poser ${recette.needsAura === 'Chaud' ? 'la Fournaise' : 'la Climatisation'} automatiquement !`}
                              >
                                ⚠️
                              </button>
                            )}

                            {recette && (
                              <div className="flex flex-col items-center justify-center w-full h-full p-1 overflow-hidden leading-tight">
                                {/* Disc badge avec icône du jeu */}
                                <div className={`${isMultiCell ? 'w-8 h-8 sm:w-9 sm:h-9 text-base sm:text-lg' : 'w-5 h-5 text-xs'} rounded-full bg-[#39424e] text-white border-2 border-white shadow-sm flex items-center justify-center flex-shrink-0`}>
                                  {gameInfo.icon}
                                </div>

                                {/* Niveau Lv.X */}
                                <span className={`${isMultiCell ? 'text-[11px] sm:text-xs font-black' : 'text-[8.5px] font-black'} text-slate-800 tracking-tight mt-0.5 leading-none`}>
                                  {gameInfo.level}
                                </span>

                                {/* Détails supplémentaires si multi-case */}
                                {isMultiCell && (
                                  gridDisplayMode === 'graines' && primarySeed ? (
                                    <span className="text-[8px] text-emerald-800 bg-emerald-100 font-extrabold px-1 rounded truncate max-w-full mt-0.5">
                                      🌱 {primarySeed.graine.replace(/^Graines? de\s+/i, '')}
                                    </span>
                                  ) : (
                                    <span className="text-[8.5px] text-slate-500 font-semibold truncate max-w-full px-0.5 leading-none mt-0.5">
                                      {recette.nom}
                                    </span>
                                  )
                                )}
                              </div>
                            )}

                            {/* Tooltip hover */}
                            {recette && (
                              <div className={`absolute ${tooltipPos} hidden group-hover:flex flex-col items-start z-50 min-w-max bg-slate-900 border border-slate-600 p-2.5 rounded-xl shadow-2xl pointer-events-none text-left`}>
                                <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                                  <div className="w-5 h-5 rounded-full bg-[#39424e] text-white border border-white flex items-center justify-center text-xs">
                                    {gameInfo.icon}
                                  </div>
                                  <span>{recette.nom}</span>
                                  <span className="text-[10px] text-emerald-400 font-bold">({gameInfo.level})</span>
                                  <span className="text-[10px] text-slate-400 font-normal">[{recette.structure}]</span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Dimensions : {w}×{h} · Durée : {recette.tempsMin} min
                                </div>

                                {primarySeed && (
                                  <div className="mt-1.5 pt-1.5 border-t border-slate-700/80 text-[11px] text-lime-300 flex items-center gap-1">
                                    <span>{primarySeed.locked ? '🔒' : '🌱'}</span>
                                    <span><strong>Graine conseillée :</strong> {primarySeed.graine} <span className="text-slate-400">({primarySeed.structure}{primarySeed.bois_h ? ` · +${primarySeed.bois_h} bois/h` : ''}{primarySeed.niveau_requis ? ` · Niv.${primarySeed.niveau_requis}` : ''})</span>{primarySeed.locked && <span className="text-amber-400 font-bold ml-1">(Requis Niv.{primarySeed.niveau_requis})</span>}</span>
                                  </div>
                                )}

                                {auraMissing && (
                                  <div className="mt-1 pt-1 border-t border-red-500/40 flex flex-col gap-0.5">
                                    <span className="text-[10px] text-red-400 font-bold flex items-center gap-1">
                                      <span>⚠️</span> Aura requise manquante : {recette.needsAura} !
                                    </span>
                                    <span className="text-[9px] text-emerald-300 font-semibold">
                                      💡 Clique sur le badge ⚠️ pour poser la source automatiquement
                                    </span>
                                  </div>
                                )}
                                <div className={`w-2.5 h-2.5 bg-slate-900 ${arrowPos} rotate-45 absolute`}></div>
                              </div>
                            )}
                          </div>
                        );
                      }))}
                    </div>
                  </div>

                  {/* Barre d'action basse style jeu */}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/20 text-[11px] text-white font-bold flex-wrap gap-2">
                    <span className="bg-white/20 px-2.5 py-1 rounded-full backdrop-blur-sm shadow-sm flex items-center gap-1">
                      📋 Plan d'aménagement
                    </span>
                    <div className="flex items-center gap-2">
                      {missingAurasCount > 0 && (
                        <button
                          type="button"
                          onClick={autoResolveAllMissingAuras}
                          className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 px-2.5 py-1 rounded-full font-black shadow-md flex items-center gap-1 transition cursor-pointer animate-pulse"
                          title="Résoudre automatiquement toutes les auras manquantes"
                        >
                          <span>❄️</span>
                          <span>Corriger {missingAurasCount} aura{missingAurasCount > 1 ? 's' : ''}</span>
                        </button>
                      )}
                      <span className="bg-white/20 px-2 py-1 rounded-full backdrop-blur-sm cursor-pointer hover:bg-white/30" onClick={() => setShowFlowPanel(!showFlowPanel)}>
                        ⚖️ Ratios
                      </span>
                      <span className="bg-white/20 px-2 py-1 rounded-full backdrop-blur-sm cursor-pointer hover:bg-white/30" onClick={() => setViewTheme('technique')}>
                        📐 Vue Grille
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* ================= VUE TECHNIQUE ================= */
                <div 
                  className="grid gap-1.5 w-full max-w-[680px] 2xl:max-w-[760px] transition-all"
                  style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(42px, 1fr))`, gridAutoRows: 'clamp(44px, 4.8vw, 62px)', width: '100%' }}
                >
                  {grid.map((row, rIndex) => row.map((cell, cIndex) => {
                    // Ne dessiner le bloc complet que si c'est la cellule d'origine,
                    // les cellules couvertes sont sautées
                    if (cell && (cell.originR !== rIndex || cell.originC !== cIndex)) return null;
                    
                    const isOrigin = cell !== null;
                    const recette = isOrigin ? recettesDB.find(r => r.id === cell.rId) : null;
                    
                    const w = recette ? (recette.w || 1) : 1;
                    const h = recette ? (recette.h || 1) : 1;

                    let auraMissing = false;
                    if (recette && recette.needsAura) {
                      auraMissing = !hasAura(grid, rIndex, cIndex, w, h, recette.needsAura);
                    }

                    const seeds = recette ? getRecommendedSeedsForRecipe(recette) : [];
                    const primarySeed = seeds[0];
                    const isMultiCell = w > 1 || h > 1;

                    const isTopRow = rIndex <= 2;
                    const isLeftCol = cIndex <= 2;
                    const isRightCol = cIndex >= 7;

                    const tooltipPos = `${isTopRow ? 'top-full mt-2' : 'bottom-full mb-2'} ${
                      isLeftCol ? 'left-0 translate-x-0' : isRightCol ? 'right-0 translate-x-0' : 'left-1/2 -translate-x-1/2'
                    }`;

                    const arrowPos = `${isTopRow ? '-top-1 border-t border-l' : '-bottom-1 border-b border-r'} ${
                      isLeftCol ? 'left-5 translate-x-0' : isRightCol ? 'right-5 translate-x-0' : 'left-1/2 -translate-x-1/2'
                    }`;

                    const haloType = isCellInHalo(rIndex, cIndex, w, h);

                    return (
                      <div 
                        key={`${rIndex}-${cIndex}`}
                        onClick={() => handleCellClick(rIndex, cIndex)}
                        onDragEnter={() => handleCellClick(rIndex, cIndex)}
                        onMouseOver={(e) => { if(e.buttons === 1) handleCellClick(rIndex, cIndex) }}
                        onMouseEnter={() => setHoveredCell({ r: rIndex, c: cIndex })}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`group relative rounded-md border border-slate-700/50 cursor-pointer transition-colors duration-75 flex items-center justify-center text-center font-bold shadow-inner hover:z-50 ${recette ? recette.color : 'bg-slate-800 hover:bg-slate-700'} ${auraMissing ? 'opacity-30 border-red-500 border-2' : ''}`}
                        style={{ gridColumn: `span ${w}`, gridRow: `span ${h}` }}
                      >
                        {/* Halo d'aura visuel */}
                        {haloType && (
                          <div 
                            className={`absolute -inset-0.5 rounded pointer-events-none z-20 border-2 transition-all duration-150 animate-pulse ${
                              haloType === 'Frais'
                                ? 'bg-cyan-400/25 border-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.5)]'
                                : 'bg-amber-400/25 border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                            }`}
                          >
                            <div className={`absolute top-0.5 left-0.5 text-[7px] font-black px-1 rounded shadow-sm ${
                              haloType === 'Frais' ? 'bg-cyan-950/85 text-cyan-200 border border-cyan-400/40' : 'bg-amber-950/85 text-amber-200 border border-amber-400/40'
                            }`}>
                              {haloType === 'Frais' ? '❄️' : '🔥'}
                            </div>
                          </div>
                        )}

                        {/* Bouton d'alerte et de résolution 1-clic */}
                        {auraMissing && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              autoPlaceAuraSource(rIndex, cIndex, recette.needsAura);
                            }}
                            className="absolute top-1 right-1 text-xs bg-red-500 hover:bg-emerald-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-lg z-25 cursor-pointer transition-all hover:scale-125 animate-pulse"
                            title={`⚠️ Aura manquante : ${recette.needsAura}. Cliquer pour poser ${recette.needsAura === 'Chaud' ? 'la Fournaise' : 'la Climatisation'} automatiquement !`}
                          >
                            ⚠️
                          </button>
                        )}
                        
                        {recette ? (
                          isMultiCell ? (
                            // Bloc 2×2 ou plus : espace suffisant pour afficher la graine
                            gridDisplayMode === 'graines' ? (
                              <div className="flex flex-col items-center justify-center w-full h-full p-1.5 text-center overflow-hidden leading-tight">
                                {primarySeed ? (
                                  <>
                                    <span className="text-[10px] text-lime-300 font-extrabold flex items-center gap-0.5 truncate max-w-full">
                                      <span>🌱</span>
                                      <span className="truncate">{primarySeed.graine}</span>
                                    </span>
                                    <span className="text-[9px] text-white/80 font-medium truncate mt-0.5">
                                      {recette.nom}
                                    </span>
                                    <span className="text-[8px] text-lime-400 font-semibold mt-0.5">
                                      {primarySeed.bois_h ? `+${primarySeed.bois_h} bois/h` : primarySeed.rendement}
                                    </span>
                                  </>
                                ) : (
                                  <span className="font-bold text-xs sm:text-sm text-white drop-shadow truncate w-full">
                                    {recette.nom}
                                  </span>
                                )}
                              </div>
                            ) : gridDisplayMode === 'mixte' ? (
                              <div className="flex flex-col items-center justify-center w-full h-full p-1 text-center overflow-hidden leading-tight">
                                <span className="font-bold text-xs sm:text-sm text-white drop-shadow truncate w-full">
                                  {recette.nom}
                                </span>
                                {primarySeed && (
                                  <div className="mt-1 px-1.5 py-0.5 bg-black/60 rounded border border-lime-400/50 text-[10px] text-lime-300 font-extrabold truncate max-w-full flex items-center justify-center gap-1 shadow-sm">
                                    <span>🌱</span>
                                    <span className="truncate">{primarySeed.graine.replace(/^Graines? de\s+/i, '')}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="truncate w-full px-1 drop-shadow-md text-xs sm:text-sm font-bold text-white">
                                {recette.nom}
                              </span>
                            )
                          ) : (
                            // Bloc 1×1 (40×40)
                            gridDisplayMode === 'graines' ? (
                              <div className="flex flex-col items-center justify-center w-full h-full p-0.5 text-center overflow-hidden leading-none">
                                {primarySeed ? (
                                  <>
                                    <span className="text-[9px] text-lime-300 font-bold leading-tight">🌱</span>
                                    <span className="text-[8px] text-lime-200 font-extrabold truncate w-full leading-tight">
                                      {primarySeed.graine.replace(/^Graines? de\s+/i, '').substring(0, 5)}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-[9px] font-bold text-white truncate w-full">
                                    {recette.nom.substring(0, 4)}
                                  </span>
                                )}
                              </div>
                            ) : gridDisplayMode === 'mixte' ? (
                              <div className="flex flex-col items-center justify-center w-full h-full p-0.5 text-center overflow-hidden leading-none">
                                <span className="font-bold text-[10px] text-white truncate w-full">
                                  {recette.nom.substring(0, 4)}
                                </span>
                                {primarySeed && (
                                  <span className="text-[7.5px] text-lime-300 font-black truncate max-w-full mt-0.5 flex items-center justify-center">
                                    🌱{primarySeed.graine.replace(/^Graines? de\s+/i, '').substring(0, 4)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="truncate w-full px-1 drop-shadow-md text-[10px] font-bold text-white">
                                {recette.nom.substring(0, 4)}
                              </span>
                            )
                          )
                        ) : null}
                        
                        {recette && (
                          <div className={`absolute ${tooltipPos} hidden group-hover:flex flex-col items-start z-50 min-w-max bg-slate-900 border border-slate-600 p-2.5 rounded-xl shadow-2xl pointer-events-none text-left`}>
                            <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                              <div className={`w-2.5 h-2.5 rounded ${recette.color || 'bg-slate-600'}`} />
                              <span>{recette.nom}</span>
                              <span className="text-[10px] text-slate-400 font-normal">({recette.structure})</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Dimensions : {w}×{h} · Durée : {recette.tempsMin} min
                            </div>

                            {primarySeed && (
                              <div className="mt-1.5 pt-1.5 border-t border-slate-700/80 text-[11px] text-lime-300 flex items-center gap-1">
                                <span>{primarySeed.locked ? '🔒' : '🌱'}</span>
                                <span><strong>Graine conseillée :</strong> {primarySeed.graine} <span className="text-slate-400">({primarySeed.structure}{primarySeed.bois_h ? ` · +${primarySeed.bois_h} bois/h` : ''}{primarySeed.niveau_requis ? ` · Niv.${primarySeed.niveau_requis}` : ''})</span>{primarySeed.locked && <span className="text-amber-400 font-bold ml-1">(Requis Niv.{primarySeed.niveau_requis})</span>}</span>
                              </div>
                            )}

                            {auraMissing && (
                              <div className="mt-1 pt-1 border-t border-red-500/40 flex flex-col gap-0.5">
                                <span className="text-[10px] text-red-400 font-bold flex items-center gap-1">
                                  <span>⚠️</span> Aura requise manquante : {recette.needsAura} !
                                </span>
                                <span className="text-[9px] text-emerald-300 font-semibold">
                                  💡 Clique sur le badge ⚠️ pour poser la source automatiquement
                                </span>
                              </div>
                            )}
                            <div className={`w-2.5 h-2.5 bg-slate-900 ${arrowPos} rotate-45 absolute`}></div>
                          </div>
                        )}
                      </div>
                    )
                  }))}
                </div>
              )}

              {/* ===== PANNEAU RÉTRACTABLE : BILAN & ÉQUILIBRAGE DES RATIOS ===== */}
              <div className="w-full mt-4 bg-slate-800/95 border border-slate-700/80 rounded-xl overflow-hidden shadow-xl">
                {/* Header accordéon cliquable */}
                <div 
                  onClick={() => setShowFlowPanel(!showFlowPanel)}
                  className="p-3 bg-slate-800 hover:bg-slate-750 transition cursor-pointer flex items-center justify-between flex-wrap gap-2 select-none border-b border-slate-700/60"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚖️</span>
                    <span className="font-bold text-sm sm:text-base text-white">Bilan & Équilibrage des Ratios</span>
                    <span className="text-xs text-slate-400">({allFlowItems.length} ressource{allFlowItems.length > 1 ? 's' : ''})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {flow.deficits.length > 0 ? (
                      <span className="text-xs bg-red-950/80 border border-red-500/50 text-red-300 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 animate-pulse">
                        ⚠️ {flow.deficits.length} déficit{flow.deficits.length > 1 ? 's' : ''}
                      </span>
                    ) : allFlowItems.length > 0 ? (
                      <span className="text-xs bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                        ✓ Chaîne 100% équilibrée
                      </span>
                    ) : null}

                    <span className="text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-700 font-mono">
                      {showFlowPanel ? '▲ Masquer' : '▼ Déplier'}
                    </span>
                  </div>
                </div>

                {/* Contenu rétractable */}
                {showFlowPanel && (
                  <div className="p-3 sm:p-4 space-y-3">
                    {/* Barre d'outils et réglages */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/60 text-xs">
                      {/* Curseur Efficacité Aniimo */}
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-slate-300 font-semibold flex items-center gap-1 whitespace-nowrap">
                          🐾 <span>Efficacité Aniimo :</span>
                          <strong className="text-amber-400 font-mono text-sm">{aniimoEfficiency}%</strong>
                        </span>
                        <input
                          type="range"
                          min="80"
                          max="250"
                          step="5"
                          value={aniimoEfficiency}
                          onChange={e => setAniimoEfficiency(parseInt(e.target.value) || 100)}
                          className="w-24 sm:w-32 accent-amber-500 cursor-pointer"
                          title="Ajustez pour simuler le boost de productivité de vos Aniimo"
                        />
                        <button
                          type="button"
                          onClick={() => setAniimoEfficiency(100)}
                          className={`px-2 py-0.5 rounded font-bold text-[10px] transition cursor-pointer ${
                            aniimoEfficiency === 100 ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          100% Base
                        </button>
                      </div>

                      {/* Boutons d'action d'équilibrage */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={completeMissingProduction}
                          className="bg-lime-600 hover:bg-lime-500 text-white border border-lime-400/50 px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition shadow cursor-pointer hover:scale-105 active:scale-95 whitespace-nowrap"
                          title="Place automatiquement les ateliers ou fermes manquants dans les cases libres pour combler les pénuries"
                        >
                          <span>🧩</span>
                          <span>Compléter le manquant</span>
                        </button>

                        {(() => {
                          const currentTarget = (selectedTool && selectedTool !== 'eraser' ? recettesDB.find(r => r.id === selectedTool) : null) || (() => {
                            const onGrid = [];
                            grid.forEach((row, r) => row.forEach((cell, c) => {
                              if (cell && cell.originR === r && cell.originC === c) {
                                const rec = recettesDB.find(x => x.id === cell.rId);
                                if (rec && !onGrid.some(x => x.id === rec.id)) onGrid.push(rec);
                              }
                            }));
                            onGrid.sort((a, b) => {
                              const aHasInput = a.input && Object.keys(a.input).length > 0 ? 1 : 0;
                              const bHasInput = b.input && Object.keys(b.input).length > 0 ? 1 : 0;
                              if (bHasInput !== aHasInput) return bHasInput - aHasInput;
                              return (b.profit || 0) - (a.profit || 0);
                            });
                            return onGrid[0] || recettesDB.find(r => r.id === 'r273') || recettesDB.find(r => r.id === 'r2');
                          })();

                          return (
                            <button
                              type="button"
                              onClick={() => rebalanceGridFull(currentTarget?.id)}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/40 px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition shadow cursor-pointer hover:scale-105 active:scale-95 whitespace-nowrap"
                              title={`Réorganise toute la grille pour ${currentTarget?.nom || 'la recette cible'}`}
                            >
                              <span>⚡</span>
                              <span>Réaménager à 100%{currentTarget ? ` (${currentTarget.nom})` : ''}</span>
                            </button>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Liste des flux par ressource */}
                    {allFlowItems.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-xs italic bg-slate-900/30 rounded-lg border border-slate-800">
                        Aucune installation active sur la grille. Placez des ateliers ou cliquez sur "Réaménager à 100%" pour calculer les débits.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {allFlowItems.map(item => {
                          const prod = Math.round((flow.produced[item] || 0) * 10) / 10;
                          const cons = Math.round((flow.consumed[item] || 0) * 10) / 10;
                          const net = Math.round((flow.net[item] || 0) * 10) / 10;
                          const isDeficit = net < -0.01;
                          const isBalanced = Math.abs(net) <= 0.01 && cons > 0;
                          const coverage = cons > 0 ? Math.min(100, Math.round((prod / cons) * 100)) : 100;

                          return (
                            <div 
                              key={item} 
                              className={`p-2.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition ${
                                isDeficit 
                                  ? 'bg-red-950/25 border-red-500/40' 
                                  : isBalanced 
                                  ? 'bg-emerald-950/20 border-emerald-500/40' 
                                  : 'bg-slate-900/40 border-slate-700/60'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                  isDeficit ? 'bg-red-400 animate-ping' : isBalanced ? 'bg-emerald-400' : 'bg-lime-400'
                                }`} />
                                <div className="truncate">
                                  <span className="font-bold text-white text-sm">{item}</span>
                                  {cons > 0 && (
                                    <span className="text-[10px] text-slate-400 ml-2">
                                      Autonomie : <strong className={isDeficit ? 'text-red-400 font-mono' : 'text-emerald-400 font-mono'}>{coverage}%</strong>
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                                <div className="flex items-center gap-2 font-mono text-[11px]">
                                  <span className="text-emerald-400" title="Production horaire">+{prod}/h</span>
                                  {cons > 0 && (
                                    <span className="text-orange-400" title="Consommation horaire">-{cons}/h</span>
                                  )}
                                </div>

                                <div className={`px-2.5 py-1 rounded font-bold font-mono text-xs text-right min-w-[90px] border ${
                                  isDeficit
                                    ? 'bg-red-900/40 border-red-500/50 text-red-300'
                                    : isBalanced
                                    ? 'bg-emerald-900/40 border-emerald-500/50 text-emerald-300'
                                    : 'bg-slate-800 border-slate-700 text-lime-400'
                                }`}>
                                  {net > 0 ? `+${net}/h` : `${net}/h`}
                                  <div className="text-[9px] font-sans font-medium text-slate-400">
                                    {isDeficit ? 'Déficit' : isBalanced ? 'Équilibré' : 'Surplus net'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Carte Économie & Progression du Logis */}
            <div className="lg:col-span-3 xl:col-span-3 bg-slate-900/95 p-4 sm:p-5 rounded-2xl border border-amber-600/40 shadow-xl sticky top-4 h-fit space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💰</span>
                  <h3 className="font-extrabold text-amber-400 text-sm sm:text-base tracking-wide">
                    Simulateur Économique
                  </h3>
                </div>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                  En direct
                </span>
              </div>

              {/* Revenu horaire et journalier */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-850 p-3.5 rounded-xl border border-slate-700 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                    <span>🟡</span> Rendement horaire net
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400">
                    {((Math.round(flow.profitHoraire) * 24) / 1000).toFixed(1)}k / jour
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-amber-300 font-mono tracking-tight flex items-baseline gap-1.5">
                  <span>+{Math.round(flow.profitHoraire).toLocaleString()}</span>
                  <span className="text-xs text-amber-400 font-bold">🟡 / h</span>
                </div>

                {/* Production de bois */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-700/60 text-xs text-slate-300 font-medium">
                  <span className="flex items-center gap-1">
                    <span>🪵</span> Blocs de bois :
                  </span>
                  <span className="font-mono font-bold text-lime-400">
                    +{Math.round(flow.produced['Bloc de bois'] || 0)} / h
                  </span>
                </div>

                {/* Capacité des cases occupées */}
                <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
                  <span className="flex items-center gap-1">
                    <span>🏡</span> Surface occupée :
                  </span>
                  <span className={`font-mono font-bold ${logis.surfaceUtilisee > logis.tailleMax ? 'text-red-400' : 'text-slate-200'}`}>
                    {logis.surfaceUtilisee} / {logis.tailleMax} cases
                  </span>
                </div>
              </div>

              {/* Jauge Objectif Niveau Suivant */}
              <div className="bg-gradient-to-br from-indigo-950/40 to-slate-850 p-3.5 rounded-xl border border-indigo-700/40 shadow-sm space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1">
                    <span>🎯</span> Objectif Logis
                  </span>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-slate-400 text-[11px]">Viser :</span>
                    <select
                      value={targetLevel}
                      onChange={e => setNiveauCible(parseInt(e.target.value))}
                      className="bg-slate-900 border border-indigo-500/60 text-indigo-200 font-bold text-xs rounded px-1.5 py-0.5 outline-none cursor-pointer"
                    >
                      {NIVEAUX.filter(n => n.niveau > logis.level).map(n => (
                        <option key={n.niveau} value={n.niveau}>
                          Niv. {n.niveau} ({((n.pieces || 0) / 1000).toFixed(0)}k 🟡)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Saisie directe du solde en banque */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                    <span>Solde en banque :</span>
                    <span className="font-mono text-slate-300">
                      Cible : {targetCost.toLocaleString()} 🟡
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <span className="absolute left-2.5 text-xs text-amber-400">🟡</span>
                    <input
                      type="number"
                      value={logis.pieces || 0}
                      onChange={e => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        const updated = { ...logis, pieces: val };
                        setLogis(updated);
                        localStorage.setItem('aniimo_logis', JSON.stringify(updated));
                      }}
                      className="w-full bg-slate-900/90 border border-slate-700 focus:border-amber-400 rounded-lg pl-7 pr-16 py-1.5 text-xs font-mono font-bold text-amber-200 outline-none transition"
                      placeholder="Solde en pièces"
                    />
                    <div className="absolute right-1 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...logis, pieces: (logis.pieces || 0) + 50000 };
                          setLogis(updated);
                          localStorage.setItem('aniimo_logis', JSON.stringify(updated));
                        }}
                        className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded text-[9.5px] font-bold border border-slate-700 transition cursor-pointer"
                        title="Ajouter 50k"
                      >
                        +50k
                      </button>
                    </div>
                  </div>
                </div>

                {/* Barre de progression */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-slate-400">Progression</span>
                    <span className="font-bold text-indigo-300">{completionPct}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700/80 shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-300 shadow-sm"
                      style={{ width: `${completionPct}%` }}
                    />
                  </div>
                </div>

                {/* Compte à rebours estimé */}
                <div className="pt-2 border-t border-indigo-900/50 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold flex items-center gap-1">
                    <span>⏳</span> Temps restant :
                  </span>
                  <span className={`font-mono font-extrabold px-2 py-0.5 rounded ${
                    missingPieces === 0
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/60'
                      : 'bg-indigo-900/60 text-indigo-200 border border-indigo-500/50'
                  }`}>
                    {timeRemainingText}
                  </span>
                </div>
              </div>

              {/* Bilan Net des Ressources */}
              <div className="pt-2 border-t border-slate-700/80">
                <div className="text-xs font-bold text-slate-300 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span>⚖️</span> Flux nets de matières
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {Object.keys(bilan.ressources).length} types
                  </span>
                </div>
                {Object.keys(bilan.ressources).length === 0 ? (
                  <div className="text-slate-500 text-xs italic bg-slate-950/40 p-2.5 rounded-lg border border-slate-800 text-center">
                    Aucune ressource en transit
                  </div>
                ) : (
                  <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1 text-xs">
                    {Object.entries(bilan.ressources).map(([item, qte]) => (
                      <li key={item} className="flex justify-between items-center bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/50">
                        <span className="font-semibold truncate max-w-[140px]" title={item}>{item}</span>
                        <span className={`font-mono font-bold ${qte > 0 ? 'text-emerald-400' : qte < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                          {qte > 0 ? '+' : ''}{Math.round(qte * 10) / 10}/h
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            
          </div>
        </section>

        {showRecipeModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-600 shadow-2xl max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Créer une Nouvelle Recette</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nom (ex: Thé Citron)</label>
                  <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:border-indigo-500 outline-none" value={newRecipe.nom} onChange={e => setNewRecipe({...newRecipe, nom: e.target.value})} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Structure</label>
                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:border-indigo-500 outline-none" placeholder="ex: Barbecue" value={newRecipe.structure} onChange={e => setNewRecipe({...newRecipe, structure: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Temps (min)</label>
                    <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:border-indigo-500 outline-none" value={newRecipe.tempsMin} onChange={e => setNewRecipe({...newRecipe, tempsMin: parseInt(e.target.value)||0})} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Largeur (L)</label>
                    <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:border-indigo-500 outline-none" value={newRecipe.w || 1} min="1" max="5" onChange={e => setNewRecipe({...newRecipe, w: parseInt(e.target.value)||1})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Hauteur (H)</label>
                    <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:border-indigo-500 outline-none" value={newRecipe.h || 1} min="1" max="5" onChange={e => setNewRecipe({...newRecipe, h: parseInt(e.target.value)||1})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Aura Requise</label>
                    <select className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:border-indigo-500 outline-none" value={newRecipe.needsAura || ''} onChange={e => setNewRecipe({...newRecipe, needsAura: e.target.value})}>
                       <option value="">Aucune</option>
                       <option value="Frais">Frais (Clim)</option>
                       <option value="Chaud">Chaud (Four)</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Ressource Produite</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Nom" className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 outline-none" value={newRecipe.outputName} onChange={e => setNewRecipe({...newRecipe, outputName: e.target.value})} />
                    <input type="number" placeholder="Qté" className="w-20 bg-slate-900 border border-slate-700 rounded p-2 outline-none" value={newRecipe.outputQty} onChange={e => setNewRecipe({...newRecipe, outputQty: parseInt(e.target.value)||0})} />
                  </div>
                </div>

                <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Ressource Consommée (Optionnel)</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Nom" className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 outline-none" value={newRecipe.inputName} onChange={e => setNewRecipe({...newRecipe, inputName: e.target.value})} />
                    <input type="number" placeholder="Qté" className="w-20 bg-slate-900 border border-slate-700 rounded p-2 outline-none" value={newRecipe.inputQty} onChange={e => setNewRecipe({...newRecipe, inputQty: parseInt(e.target.value)||0})} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Profit direct à la vente (Optionnel)</label>
                  <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded p-2 outline-none" value={newRecipe.profit} onChange={e => setNewRecipe({...newRecipe, profit: parseInt(e.target.value)||0})} />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setShowRecipeModal(false)} className="px-4 py-2 rounded text-slate-300 hover:bg-slate-700">Annuler</button>
                <button 
                  onClick={() => {
                    if(!newRecipe.nom || !newRecipe.structure || !newRecipe.outputName) return alert("Veuillez remplir le nom, la structure et la ressource produite.");
                    const inputObj = {};
                    if (newRecipe.inputName && newRecipe.inputQty > 0) inputObj[newRecipe.inputName] = newRecipe.inputQty;
                    const newR = {
                      id: 'custom_' + Date.now(),
                      nom: newRecipe.nom,
                      structure: newRecipe.structure,
                      tempsMin: newRecipe.tempsMin,
                      w: newRecipe.w || 1,
                      h: newRecipe.h || 1,
                      input: inputObj,
                      output: { [newRecipe.outputName]: newRecipe.outputQty },
                      profit: newRecipe.profit,
                      color: 'bg-indigo-600'
                    };
                    if (newRecipe.needsAura) newR.needsAura = newRecipe.needsAura;
                    setRecettesDB([...recettesDB, newR]);
                    setShowRecipeModal(false);
                  }} 
                  className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 font-bold"
                >
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        )}

{/* ===== SUIVI DE PROGRESSION ===== */}
        <ProgressionTracker
          niveaux={NIVEAUX}
          level={logis.level}
          pieces={logis.pieces || 0}
          onPiecesChange={(v) => updateLogis('pieces', v)}
          onLevelChange={(lvl) => updateLogis('level', lvl)}
          rates={flow.net}
          profitHoraire={flow.profitHoraire}
        />

{/* ===== MON ÉQUIPE ANIIMO ===== */}
        <section className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700">
          <details>
            <summary className="cursor-pointer flex items-center justify-between select-none">
              <h2 className="text-2xl font-bold">🐾 Mon Équipe Aniimo</h2>
              <span className="text-slate-400 text-sm">{monEquipe.length} sélectionné{monEquipe.length > 1 ? "s" : ""} — cliquer pour {monEquipe.length > 0 ? "modifier" : "configurer"}</span>
            </summary>

            {/* Légende des tiers */}
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              <span className="px-2 py-1 rounded bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 font-bold">★ S — Loisir Niv.4 · 150/135/120 travail/min</span>
              <span className="px-2 py-1 rounded bg-slate-600/40 border border-slate-500/50 text-slate-300 font-bold">★ A — Porter Niv.3 · 120/105/90 travail/min</span>
              <span className="px-2 py-1 rounded bg-amber-700/20 border border-amber-600/50 text-amber-300 font-bold">★ A — Artisanat Niv.3 · 240/180/60 travail/min</span>
              <span className="px-2 py-1 rounded bg-purple-700/20 border border-purple-500/50 text-purple-300 font-bold">★ A — Parfumerie Niv.3 · 240/180/60 travail/min</span>
            </div>

            {/* Recommandations pour la grille courante */}
            {(() => {
              const capNeeded = {};
              grid.forEach((row, r) => row.forEach((cell, c) => {
                if (cell && cell.originR === r && cell.originC === c) {
                  const rec = recettesDB.find(x => x.id === cell.rId);
                  if (rec?.capacite) {
                    const cap = CAPACITE_MAP[rec.capacite] || rec.capacite;
                    if (!capNeeded[cap]) capNeeded[cap] = [];
                    if (!capNeeded[cap].includes(rec.structure)) capNeeded[cap].push(rec.structure);
                  }
                }
              }));
              if (!Object.keys(capNeeded).length) return null;
              return (
                <div className="mt-5 p-4 bg-slate-900/60 rounded-xl border border-slate-700">
                  <h3 className="font-bold text-sm text-slate-300 mb-3">⚡ Meilleurs choix pour votre grille actuelle</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(capNeeded).map(([cap, structures]) => {
                      const best = ANIIMO_DB.filter(a => a.capacite === cap).sort((a,b) => b.score - a.score);
                      const tier = cap === 'Loisir' ? 'S' : 'A';
                      const tierColor = cap === 'Loisir' ? 'text-yellow-300 bg-yellow-500/20 border-yellow-500/50' : 'text-slate-300 bg-slate-700/50 border-slate-600';
                      return best.slice(0,5).map(a => {
                        const isOwned = monEquipe.includes(a.nom);
                        const elemEmoji = {Feu:'🔥',Eau:'🌊',Plante:'🌿',Terre:'🪨',Vent:'💨',Foudre:'⚡',Glace:'❄️',Obscurité:'🌑',Lumière:'✨'}[a.element] || '';
                        const workRates = a.capacite === 'Porter' ? ['120','105','90'] : a.capacite === 'Loisir' ? ['150','135','120'] : ['240','180','60'];
                        return (
                          <div key={a.nom} className="relative group">
                            <button
                              onClick={() => setMonEquipe(prev => isOwned ? prev.filter(n => n !== a.nom) : [...prev, a.nom])}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-bold transition-all ${isOwned ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-900/50' : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white hover:border-slate-400'}`}
                            >
                              <span className={`text-xs font-black px-1 rounded ${tierColor} border`}>{tier}</span>
                              {elemEmoji} {a.nom}
                              {isOwned && <span className="text-green-400">✓</span>}
                            </button>
                            {/* Overlay stats */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-slate-900 border border-slate-600 rounded-xl p-3 shadow-2xl z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity text-xs">
                              <div className="font-bold text-white mb-1">{elemEmoji} {a.nom}</div>
                              <div className="text-slate-400 mb-2">{a.capacite} · Niv. max {a.nivMax} · {a.element}</div>
                              <div className="text-slate-400 mb-1 font-semibold">Travail/min à Niv.{a.nivMax} :</div>
                              <div className="grid grid-cols-3 gap-1 text-center">
                                <div className="bg-slate-800 rounded p-1"><div className="text-slate-500 text-[9px]">Recette Niv.1</div><div className="text-green-400 font-bold">{workRates[0]}</div></div>
                                <div className="bg-slate-800 rounded p-1"><div className="text-slate-500 text-[9px]">Recette Niv.2</div><div className="text-yellow-400 font-bold">{workRates[1]}</div></div>
                                <div className="bg-slate-800 rounded p-1"><div className="text-slate-500 text-[9px]">Recette Niv.3</div><div className="text-orange-400 font-bold">{workRates[2]}</div></div>
                              </div>
                              <div className="mt-2 text-[9px] text-slate-500">+20% si lettre de perso. correspondante</div>
                              <div className="mt-1 text-[9px] text-indigo-400">Pour : {structures.slice(0,3).join(', ')}</div>
                              <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-r border-b border-slate-600 rotate-45"></div>
                            </div>
                          </div>
                        );
                      });
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Sélection complète par capacité */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {['Loisir', 'Artisanat', 'Porter', 'Parfumerie'].map(cap => {
                const capStyle = {
                  Loisir:     { color: 'text-yellow-300', border: 'border-yellow-500/40', bg: 'bg-yellow-900/10', emoji: '🎉', tier: 'S', tierStyle: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50' },
                  Artisanat:  { color: 'text-amber-400',  border: 'border-amber-600/40',  bg: 'bg-amber-900/10',  emoji: '🔨', tier: 'A', tierStyle: 'bg-slate-700 text-slate-300 border-slate-500' },
                  Porter:     { color: 'text-blue-400',   border: 'border-blue-600/40',   bg: 'bg-blue-900/10',   emoji: '🚚', tier: 'A', tierStyle: 'bg-slate-700 text-slate-300 border-slate-500' },
                  Parfumerie: { color: 'text-purple-400', border: 'border-purple-600/40', bg: 'bg-purple-900/10', emoji: '🌸', tier: 'A', tierStyle: 'bg-slate-700 text-slate-300 border-slate-500' },
                }[cap];
                const aniimosOfCap = ANIIMO_DB.filter(a => a.capacite === cap);
                const selectedCount = aniimosOfCap.filter(a => monEquipe.includes(a.nom)).length;
                const workRates = cap === 'Porter' ? ['120','105','90'] : cap === 'Loisir' ? ['150','135','120'] : ['240','180','60'];
                const workLabel = cap === 'Porter' ? 'Champs/Mine/Puits' : 'Atelier/Cuisine/Repos';
                return (
                  <div key={cap} className={`p-4 rounded-xl border ${capStyle.border} ${capStyle.bg}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black px-1.5 py-0.5 rounded border ${capStyle.tierStyle}`}>{capStyle.tier}</span>
                        <span className={`font-bold ${capStyle.color}`}>{capStyle.emoji} {cap}</span>
                        <span className="text-slate-500 text-xs">Niv.max {aniimosOfCap[0]?.nivMax ?? '?'} · {workRates[0]}/{workRates[1]}/{workRates[2]}/min</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-xs">{selectedCount}/{aniimosOfCap.length}</span>
                        <button onClick={() => setMonEquipe(prev => [...new Set([...prev, ...aniimosOfCap.map(a => a.nom)])])} className="text-[10px] text-slate-400 hover:text-white bg-slate-700 px-2 py-0.5 rounded">Tous</button>
                        <button onClick={() => setMonEquipe(prev => prev.filter(n => !aniimosOfCap.find(a => a.nom === n)))} className="text-[10px] text-slate-400 hover:text-white bg-slate-700 px-2 py-0.5 rounded">Aucun</button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {aniimosOfCap.map(a => {
                        const isSelected = monEquipe.includes(a.nom);
                        const elemEmoji = {Feu:'🔥',Eau:'🌊',Plante:'🌿',Terre:'🪨',Vent:'💨',Foudre:'⚡',Glace:'❄️',Obscurité:'🌑',Lumière:'✨'}[a.element] || '';
                        return (
                          <div key={a.nom} className="relative group">
                            <button
                              onClick={() => setMonEquipe(prev => isSelected ? prev.filter(n => n !== a.nom) : [...prev, a.nom])}
                              className={`text-xs px-2 py-1 rounded border transition-all flex items-center gap-1 ${isSelected ? 'bg-indigo-600 border-indigo-400 text-white font-bold shadow-sm' : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white hover:border-slate-400'}`}
                            >
                              <span>{elemEmoji}</span>
                              <span>{a.nom}</span>
                            </button>
                            {/* Tooltip stats */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-slate-900 border border-slate-600 rounded-xl p-3 shadow-2xl z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity text-xs">
                              <div className="font-bold text-white mb-1">{elemEmoji} {a.nom}</div>
                              <div className="text-slate-400 mb-1">{a.capacite} · {a.element} · Niv. max {a.nivMax}</div>
                              <div className="text-slate-500 text-[9px] mb-1">{workLabel}</div>
                              <div className="grid grid-cols-3 gap-1 text-center">
                                <div className="bg-slate-800 rounded p-1"><div className="text-slate-500 text-[9px]">Recipe Niv.1</div><div className="text-green-400 font-bold">{workRates[0]}</div></div>
                                <div className="bg-slate-800 rounded p-1"><div className="text-slate-500 text-[9px]">Recipe Niv.2</div><div className="text-yellow-400 font-bold">{workRates[1]}</div></div>
                                <div className="bg-slate-800 rounded p-1"><div className="text-slate-500 text-[9px]">Recipe Niv.3</div><div className="text-orange-400 font-bold">{workRates[2]}</div></div>
                              </div>
                              <div className="mt-2 text-[9px] text-slate-500">+20% si lettre de personnalité correspondante à l'installation</div>
                              <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-r border-b border-slate-600 rotate-45"></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

          </details>
        </section>

        {/* ===== MODAL MAX NIVEAU ===== */}
        {showLevelModal && (() => {
          // Calculer les stats de la grille actuelle pour le niveau
          const scored = recettesDB
            .filter(r => !r.needsAura && r.tempsMin > 0)
            .map(r => ({
              ...r,
              cyclesH: 60 / r.tempsMin,
              densite: (60 / r.tempsMin) / ((r.w||1) * (r.h||1)),
            }))
            .sort((a, b) => b.densite - a.densite);
          
          const top10 = scored.slice(0, 10);

          // Stats de la grille actuelle
          let totalCycles = 0, totalItems = 0, uniqueItems = new Set();
          grid.forEach((row, r) => row.forEach((cell, c) => {
            if (cell && cell.originR === r && cell.originC === c) {
              const rec = recettesDB.find(x => x.id === cell.rId);
              if (rec) {
                const cycles = 60 / Math.max(0.1, rec.tempsMin);
                totalCycles += cycles;
                const outQty = Object.values(rec.output || {})[0] || 1;
                totalItems += cycles * outQty;
                Object.keys(rec.output || {}).forEach(k => uniqueItems.add(k));
              }
            }
          }));

          return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowLevelModal(false)}>
              <div className="bg-slate-800 rounded-2xl border border-slate-600 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-emerald-400">⬆️ Optimisation Max Niveau</h2>
                      <p className="text-slate-400 text-sm mt-1">Maximise les cycles de production/heure pour remplir le plus de commandes</p>
                    </div>
                    <button onClick={() => setShowLevelModal(false)} className="text-slate-400 hover:text-white text-2xl">✕</button>
                  </div>

                  {/* Stats de la grille optimisée */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-emerald-900/30 border border-emerald-600/40 rounded-xl p-3 text-center">
                      <div className="text-2xl font-black text-emerald-400">{totalCycles.toFixed(0)}</div>
                      <div className="text-xs text-slate-400">cycles/heure</div>
                    </div>
                    <div className="bg-emerald-900/30 border border-emerald-600/40 rounded-xl p-3 text-center">
                      <div className="text-2xl font-black text-emerald-400">{totalItems.toFixed(0)}</div>
                      <div className="text-xs text-slate-400">items produits/heure</div>
                    </div>
                    <div className="bg-emerald-900/30 border border-emerald-600/40 rounded-xl p-3 text-center">
                      <div className="text-2xl font-black text-emerald-400">{uniqueItems.size}</div>
                      <div className="text-xs text-slate-400">types de ressources</div>
                    </div>
                  </div>

                  {/* Top recettes par densité de production */}
                  <h3 className="font-bold text-slate-300 uppercase text-xs tracking-wider mb-3">🏆 Top 10 recettes les plus efficaces pour le niveau</h3>
                  <div className="space-y-2">
                    {top10.map((r, i) => {
                      const outQty = Object.values(r.output || {})[0] || 1;
                      const itemsH = r.cyclesH * outQty;
                      const barW = Math.round((r.densite / top10[0].densite) * 100);
                      return (
                        <div key={r.id} className="bg-slate-900 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-black w-5 text-center ${i === 0 ? 'text-yellow-400' : i < 3 ? 'text-slate-300' : 'text-slate-500'}`}>#{i+1}</span>
                              <div className={`w-3 h-3 rounded ${r.color || 'bg-slate-600'}`}></div>
                              <span className="font-bold text-sm">{r.nom}</span>
                              <span className="text-xs text-slate-500">{r.structure}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-emerald-400 font-bold text-sm">{r.cyclesH.toFixed(1)} cycles/h</span>
                              <span className="text-slate-500 text-xs ml-2">· {itemsH.toFixed(0)} items/h</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                              <div className="bg-emerald-500 rounded-full h-1.5 transition-all" style={{width: barW + "%"}}></div>
                            </div>
                            <span className="text-[10px] text-slate-500">{r.tempsMin}min · {r.w||1}×{r.h||1}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 p-3 bg-emerald-900/20 border border-emerald-700/40 rounded-lg text-xs text-slate-400">
                    💡 <strong className="text-emerald-400">Conseil :</strong> Plus de cycles = plus de commandes remplies = plus de points d'index (XP). 
                    Préférez les recettes avec un temps court et une petite surface. La grille a été optimisée automatiquement — cliquez ailleurs pour fermer.
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

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
                const runs = 60 / Math.max(0.1, rec.tempsMin);
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

        {/* ===== MODAL OPTIMISATION DES GRAINES ===== */}
        {showGrainesModal && (() => {
          const maxYield = GRAINES_DB[0]?.pieces_h || 2790;
          const currentLevel = logis.level || 1;

          let list = [...GRAINES_DB];
          if (graineFilter === 'unlocked') list = list.filter(g => (g.niveau_requis || 1) <= currentLevel);
          else if (graineFilter === 'ferme') list = list.filter(g => g.structure === 'Ferme');
          else if (graineFilter === 'pepiniere') list = list.filter(g => g.structure === 'Pépinière');
          else if (graineFilter === 'no_aura') list = list.filter(g => !g.aura);

          const unlockedList = GRAINES_DB.filter(g => (g.niveau_requis || 1) <= currentLevel);
          const bestUnlockedPepiniere = unlockedList.filter(g => g.structure === 'Pépinière').sort((a, b) => b.pieces_h - a.pieces_h)[0] || GRAINES_DB.find(g => g.structure === 'Pépinière');
          const bestUnlockedClim = unlockedList.filter(g => g.structure === 'Ferme' && g.aura === 'Frais').sort((a, b) => b.pieces_h - a.pieces_h)[0] || GRAINES_DB.find(g => g.structure === 'Ferme' && g.aura === 'Frais');
          const bestUnlockedNoClim = unlockedList.filter(g => g.structure === 'Ferme' && !g.aura).sort((a, b) => b.pieces_h - a.pieces_h)[0] || GRAINES_DB.find(g => g.structure === 'Ferme' && !g.aura);

          const applyGraine = (g) => {
            const cName = g.culture.toLowerCase().trim();
            const match = recettesDB.find(r => {
              const rName = r.nom.toLowerCase().trim();
              return rName === cName || rName === `champ ${cName}` || rName === `arbre à ${cName}` || rName.includes(cName);
            });
            if (match) {
              autoOptimize('custom', match.id);
              setShowGrainesModal(false);
            }
          };

          return (
            <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4" onClick={() => setShowGrainesModal(false)}>
              <div className="bg-slate-800 rounded-2xl border border-lime-500/50 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-5 border-b border-slate-700 bg-slate-900/80 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🌱</span>
                      <h2 className="text-xl sm:text-2xl font-bold text-lime-400">Optimisation des Graines & Rendements</h2>
                    </div>
                    <p className="text-slate-400 text-xs sm:text-sm mt-1">
                      Classement officiel par rentabilité horaire (Pièces et Bois). Votre niveau actuel de Logis : <strong className="text-lime-300">Niv. {currentLevel}</strong>.
                    </p>
                  </div>
                  <button onClick={() => setShowGrainesModal(false)} className="text-slate-400 hover:text-white text-2xl font-bold p-1">✕</button>
                </div>

                {/* Top 3 Quick Summary adapté au niveau */}
                <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/40 border-b border-slate-700 text-xs">
                  {/* Carte 1 : Pépinière / Bois */}
                  <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between font-bold text-amber-300 mb-1">
                        <span>🌳 Top Pépinière {currentLevel < 18 ? `(Niv. ≤ ${currentLevel})` : 'Global'}</span>
                        <span className="text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30">Niv. {bestUnlockedPepiniere?.niveau_requis}</span>
                      </div>
                      <div className="font-extrabold text-white text-sm">{bestUnlockedPepiniere?.graine}</div>
                      <div className="text-slate-400 text-[11px] mt-0.5">Culture : {bestUnlockedPepiniere?.culture} (Pépinière)</div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-amber-900/40">
                      <div className="flex justify-between items-baseline">
                        <span className="text-amber-400 font-black text-base">{bestUnlockedPepiniere?.pieces_h.toLocaleString('fr-FR')} pts/h</span>
                        {bestUnlockedPepiniere?.bois_h > 0 && (
                          <span className="text-amber-300 font-semibold text-[11px]">+{bestUnlockedPepiniere?.bois_h} bois/h</span>
                        )}
                      </div>
                      {currentLevel < 18 && (
                        <div className="text-[10px] text-slate-500 mt-1 italic">
                          🔒 Cacao (2 790/h, +183 bois) requiert Niv. 18
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Carte 2 : Ferme avec Clim */}
                  <div className="bg-cyan-950/30 border border-cyan-500/40 rounded-xl p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between font-bold text-cyan-300 mb-1">
                        <span>❄️ Top Ferme (avec Clim)</span>
                        <span className="text-[10px] bg-cyan-500/20 px-1.5 py-0.5 rounded border border-cyan-500/30">Niv. {bestUnlockedClim?.niveau_requis}</span>
                      </div>
                      <div className="font-extrabold text-white text-sm">{bestUnlockedClim?.graine}</div>
                      <div className="text-slate-400 text-[11px] mt-0.5">Culture : {bestUnlockedClim?.culture} (Ferme 2×2)</div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-cyan-900/40">
                      <div className="flex justify-between items-baseline">
                        <span className="text-cyan-400 font-black text-base">{bestUnlockedClim?.pieces_h.toLocaleString('fr-FR')} pts/h</span>
                        <span className="text-slate-400 text-[10px]">{bestUnlockedClim?.minutes} min</span>
                      </div>
                      <div className="text-[10px] text-cyan-400/80 mt-1">
                        {(bestUnlockedClim?.niveau_requis || 1) <= currentLevel ? '✓ Débloqué à votre niveau' : `🔒 Requiert Niv. ${bestUnlockedClim?.niveau_requis}`}
                      </div>
                    </div>
                  </div>

                  {/* Carte 3 : Ferme sans Clim */}
                  <div className="bg-lime-950/30 border border-lime-500/40 rounded-xl p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between font-bold text-lime-300 mb-1">
                        <span>☀️ Top Ferme sans Clim {currentLevel < 16 ? `(Niv. ≤ ${currentLevel})` : ''}</span>
                        <span className="text-[10px] bg-lime-500/20 px-1.5 py-0.5 rounded border border-lime-500/30">Niv. {bestUnlockedNoClim?.niveau_requis}</span>
                      </div>
                      <div className="font-extrabold text-white text-sm">{bestUnlockedNoClim?.graine}</div>
                      <div className="text-slate-400 text-[11px] mt-0.5">Culture : {bestUnlockedNoClim?.culture}</div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-lime-900/40">
                      <div className="flex justify-between items-baseline">
                        <span className="text-lime-400 font-black text-base">{bestUnlockedNoClim?.pieces_h.toLocaleString('fr-FR')} pts/h</span>
                        <span className="text-slate-400 text-[10px]">{bestUnlockedNoClim?.minutes} min</span>
                      </div>
                      {currentLevel < 16 && (
                        <div className="text-[10px] text-slate-500 mt-1 italic">
                          🔒 Canneberge (2 205/h) requiert Niv. 16
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Filters */}
                <div className="px-5 py-3 border-b border-slate-700 bg-slate-800/60 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'all', label: `Toutes (${GRAINES_DB.length})` },
                      { id: 'unlocked', label: `🔓 Débloquées (Niv. ≤ ${currentLevel})` },
                      { id: 'ferme', label: '🌾 Ferme' },
                      { id: 'pepiniere', label: '🌳 Pépinière' },
                      { id: 'no_aura', label: '☀️ Sans Aura / Sans Clim' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setGraineFilter(tab.id)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                          graineFilter === tab.id
                            ? 'bg-lime-500 text-slate-900 shadow-sm'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-slate-400">
                    {list.length} culture{list.length > 1 ? 's' : ''} affichée{list.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Table */}
                <div className="overflow-y-auto flex-1 p-3 sm:p-5 divide-y divide-slate-700/60">
                  {list.map((g, idx) => {
                    const barW = Math.round((g.pieces_h / maxYield) * 100);
                    const isLocked = (g.niveau_requis || 1) > currentLevel;

                    return (
                      <div key={g.culture + idx} className={`py-2.5 px-2 rounded-xl hover:bg-slate-700/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isLocked ? 'opacity-70 bg-slate-900/20' : ''}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-8 text-center font-black text-xs ${
                            idx === 0 ? 'text-amber-300 bg-amber-500/20 border border-amber-500/40 py-1 rounded' :
                            idx === 1 ? 'text-slate-200 bg-slate-600/40 border border-slate-500/40 py-1 rounded' :
                            idx === 2 ? 'text-orange-300 bg-orange-700/20 border border-orange-600/40 py-1 rounded' :
                            'text-slate-500'
                          }`}>
                            #{idx + 1}
                          </span>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white text-sm">🌱 {g.graine}</span>
                              <span className="text-xs text-slate-400">➔ récolte : <strong className="text-slate-200">{g.culture}</strong></span>
                              <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
                                {g.structure}
                              </span>
                              {g.niveau_requis && (
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold border flex items-center gap-0.5 ${
                                  !isLocked
                                    ? 'bg-lime-950/50 text-lime-400 border-lime-500/40'
                                    : 'bg-red-950/70 text-red-300 border-red-500/40'
                                }`}>
                                  {!isLocked ? `✓ Niv. ${g.niveau_requis}` : `🔒 Requis Niv. ${g.niveau_requis}`}
                                </span>
                              )}
                              {g.aura && (
                                <span className="text-[10px] bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/40 text-cyan-300 font-bold">
                                  ❄️ Requiert Clim ({g.aura})
                                </span>
                              )}
                            </div>

                            {/* Bar & timing */}
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="w-32 sm:w-48 bg-slate-900 rounded-full h-1.5 overflow-hidden">
                                <div className={`h-1.5 rounded-full ${isLocked ? 'bg-slate-600' : 'bg-lime-400'}`} style={{ width: `${barW}%` }} />
                              </div>
                              <span className="text-[10px] text-slate-400">{g.minutes} min de pousse</span>
                              {g.bois_h > 0 && (
                                <span className="text-[10px] text-amber-400 font-semibold">+{g.bois_h} bois/h</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                          <div className="text-right">
                            <div className="font-black text-lime-400 text-sm sm:text-base">{g.pieces_h.toLocaleString('fr-FR')} <span className="text-xs font-normal text-slate-400">pts/h</span></div>
                            <div className="text-[10px] text-slate-500">{g.pieces} pièces / récolte</div>
                          </div>

                          {isLocked ? (
                            <button
                              type="button"
                              disabled
                              className="bg-slate-700/60 text-slate-400 font-bold text-xs px-3 py-1.5 rounded-lg border border-slate-600/50 cursor-not-allowed whitespace-nowrap"
                              title={`Débloqué au niveau de logis ${g.niveau_requis}`}
                            >
                              🔒 Requis Niv. {g.niveau_requis}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => applyGraine(g)}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition shadow-sm cursor-pointer whitespace-nowrap"
                            >
                              Planter sur grille ➔
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer advice */}
                <div className="p-3 bg-slate-900/90 border-t border-slate-700 text-xs text-slate-400 flex items-center justify-between flex-wrap gap-2">
                  <span>💡 <strong>Conseil :</strong> Les cultures sont automatiquement filtrées selon votre niveau de camping-car (Niv. {currentLevel}). Au Niv. 11, le meilleur arbre à bois est l'Érable (+112 bois/h). Le Cacao (+183 bois/h) se débloque au Niv. 18.</span>
                  <button onClick={() => setShowGrainesModal(false)} className="text-xs text-slate-300 hover:text-white bg-slate-700 px-3 py-1 rounded">Fermer</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ===== MODAL : GESTIONNAIRE DE PLANS & EXPORT/IMPORT ===== */}
        {showPresetModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl my-auto animate-in fade-in duration-200 max-h-[90vh] flex flex-col">
              
              {/* Header */}
              <div className="p-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">📁</span>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                      Gestionnaire de Plans d'aménagement
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Enregistrez, basculez, dupliquez, exportez ou importez vos configurations de logis
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPresetModal(false);
                    setEditingPresetId(null);
                  }}
                  className="text-slate-400 hover:text-white p-1 text-base rounded-lg hover:bg-slate-700 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Body défilable */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-6 flex-1 text-xs">

                {/* Section 1 : Liste des plans enregistrés */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <span>📑</span>
                      <span>Vos Plans ({presets.length})</span>
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCreatePreset()}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition shadow-sm"
                      >
                        <span>➕</span>
                        <span>Nouveau plan</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleResetBuiltinPresets}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 rounded-lg font-medium text-xs flex items-center gap-1 cursor-pointer transition"
                        title="Recharger les modèles officiels sans toucher à vos créations"
                      >
                        <span>🔄</span>
                        <span>Réinitialiser modèles</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {presets.map(p => {
                      const isActive = p.id === activePresetId;
                      const stats = getPresetStats(p);
                      const isEditing = editingPresetId === p.id;

                      return (
                        <div
                          key={p.id}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isActive
                              ? 'bg-gradient-to-br from-slate-800 to-emerald-950/40 border-emerald-500/70 shadow-lg ring-1 ring-emerald-500/50'
                              : 'bg-slate-800/80 border-slate-700/80 hover:border-slate-600'
                          }`}
                        >
                          {/* Titre et badges */}
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="flex-1">
                              {isEditing ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={editingPresetName}
                                    onChange={(e) => setEditingPresetName(e.target.value)}
                                    className="bg-slate-900 border border-indigo-500 px-2 py-1 rounded text-white text-xs font-bold w-full"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleRenamePreset(p.id, editingPresetName);
                                      if (e.key === 'Escape') setEditingPresetId(null);
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRenamePreset(p.id, editingPresetName)}
                                    className="bg-indigo-600 text-white px-2 py-1 rounded font-bold hover:bg-indigo-500 text-xs"
                                  >
                                    ✓
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-extrabold text-sm text-white">{p.name}</span>
                                  {p.isBuiltIn && (
                                    <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-600/40 px-1.5 py-0.5 rounded font-bold">
                                      Modèle
                                    </span>
                                  )}
                                  {isActive && (
                                    <span className="text-[10px] bg-emerald-900/90 text-emerald-300 border border-emerald-500/50 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                                      <span>●</span> Actif
                                    </span>
                                  )}
                                </div>
                              )}
                              {p.description && !isEditing && (
                                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{p.description}</p>
                              )}
                            </div>
                          </div>

                          {/* Stats clés */}
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700/60 text-[11px] text-slate-300 flex-wrap">
                            <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700/50">
                              🏛️ {stats.count} bâtiments
                            </span>
                            <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700/50">
                              🟩 {stats.occupied}/100 cases
                            </span>
                            <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700/50 text-amber-300 font-semibold">
                              ⭐ Niv. {p.level || 11}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center justify-between gap-1.5 mt-3 pt-2 border-t border-slate-700/60 flex-wrap">
                            <div className="flex items-center gap-1">
                              {!isActive && (
                                <button
                                  type="button"
                                  onClick={() => handleSelectPreset(p.id)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] cursor-pointer transition shadow-sm"
                                >
                                  ✓ Charger
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPresetId(p.id);
                                  setEditingPresetName(p.name);
                                }}
                                className="px-2 py-1 bg-slate-700 hover:bg-slate-650 text-slate-200 rounded-lg font-semibold text-[11px] cursor-pointer"
                                title="Renommer ce plan"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicatePreset(p.id)}
                                className="px-2 py-1 bg-slate-700 hover:bg-slate-650 text-slate-200 rounded-lg font-semibold text-[11px] cursor-pointer"
                                title="Dupliquer ce plan"
                              >
                                📋 Copier
                              </button>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleCopyPresetCode(p)}
                                className="px-2 py-1 bg-slate-750 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded-lg text-[11px] font-medium cursor-pointer"
                                title="Copier le code de partage JSON dans le presse-papier"
                              >
                                📤 Partager
                              </button>
                              <button
                                type="button"
                                onClick={() => handleExportJSON(p)}
                                className="px-2 py-1 bg-slate-755 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded-lg text-[11px] font-medium cursor-pointer"
                                title="Télécharger le fichier .json"
                              >
                                💾 .json
                              </button>
                              {presets.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeletePreset(p.id)}
                                  className="px-2 py-1 bg-red-950/70 hover:bg-red-900 border border-red-800/60 text-red-300 rounded-lg text-[11px] font-bold cursor-pointer"
                                  title="Supprimer ce plan"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section 2 : Importer un plan */}
                <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
                  <h3 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
                    <span>📥</span>
                    <span>Importer un plan (Code partagé ou fichier .json)</span>
                  </h3>
                  <p className="text-slate-400 text-[11px] mb-3">
                    Collez le code JSON d'un plan partagé par un ami ou sélectionnez un fichier <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300">.json</code> téléchargé précédemment.
                  </p>

                  <div className="space-y-3">
                    <textarea
                      rows={3}
                      value={presetImportText}
                      onChange={(e) => setPresetImportText(e.target.value)}
                      placeholder='Collez ici le code JSON du plan (ex: {"name": "Rush...", "grid": [...]})'
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
                    />

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleImportPreset(presetImportText)}
                          disabled={!presetImportText.trim()}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-bold text-xs cursor-pointer transition shadow"
                        >
                          📥 Importer le code collé
                        </button>
                        {presetImportText && (
                          <button
                            type="button"
                            onClick={() => setPresetImportText('')}
                            className="px-2 py-1.5 text-slate-400 hover:text-white text-xs cursor-pointer"
                          >
                            Effacer
                          </button>
                        )}
                      </div>

                      {/* Import fichier input */}
                      <label className="px-3 py-1.5 bg-slate-700 hover:bg-slate-650 text-slate-200 rounded-lg font-semibold text-xs cursor-pointer flex items-center gap-1.5 border border-slate-600 transition">
                        <span>📁</span>
                        <span>Charger fichier .json</span>
                        <input
                          type="file"
                          accept=".json"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const content = event.target?.result;
                              if (content && typeof content === 'string') {
                                handleImportPreset(content);
                              }
                            };
                            reader.readAsText(file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-3 bg-slate-850 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400 flex-shrink-0">
                <span>💡 <strong>Astuce :</strong> Les modifications effectuées sur la grille sont automatiquement enregistrées en temps réel dans votre plan actif.</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowPresetModal(false);
                    setEditingPresetId(null);
                  }}
                  className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold cursor-pointer"
                >
                  Fermer
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
