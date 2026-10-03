import sys
sys.stdout.reconfigure(encoding='utf-8')
import json

recettesDB = json.load(open('src/data/recettes.json', encoding='utf-8'))
GRAINES_DB = json.load(open('src/data/graines_db.json', encoding='utf-8'))

def getRecommendedSeedsForRecipe(recette):
    if not recette: return []
    if recette['structure'] in ['Ferme', 'Pépinière']:
        cName = recette['nom'].lower().strip()
        g = next((x for x in GRAINES_DB if cName == x['culture'].lower().strip() or cName == f'champ {x["culture"].lower().strip()}' or cName == f'arbre à {x["culture"].lower().strip()}' or x['culture'].lower().strip() in cName), None)
        if g:
            return [{'graine': g['graine'], 'structure': g['structure'], 'bois_h': g.get('bois_h', 0), 'rendement': f'{g["pieces_h"]} pts/h'}]
    
    recNomLower = recette['nom'].lower().strip()
    if recette['structure'] == 'Zone de coupe' or 'bois' in recNomLower or 'planche' in recNomLower:
        woodTree = sorted([g for g in GRAINES_DB if g.get('bois_h', 0) > 0], key=lambda x: (x.get('bois_h', 0), x['pieces_h']), reverse=True)[0]
        if woodTree:
            return [{'graine': woodTree['graine'], 'structure': woodTree['structure'], 'bois_h': woodTree.get('bois_h', 0), 'rendement': f'{woodTree["pieces_h"]} pts/h'}]

    def findRoots(recId, visited=None):
        if visited is None: visited = set()
        if recId in visited: return {}
        visited.add(recId)
        r = next((x for x in recettesDB if x['id'] == recId), None)
        if not r or not r.get('input'): return {}
        roots = {}
        for inp, qty in r['input'].items():
            producer = next((x for x in recettesDB if any(k.lower() == inp.lower() for k in x.get('output', {}).keys())), None)
            if not producer or not producer.get('input'):
                roots[inp] = roots.get(inp, 0) + qty
            else:
                sub = findRoots(producer['id'], visited)
                for sInp, sQty in sub.items():
                    roots[sInp] = roots.get(sInp, 0) + sQty * qty
        return roots

    roots = findRoots(recette['id'])
    results = []
    seen = set()
    for resName in roots.keys():
        resLower = resName.lower().strip()
        if 'bois' in resLower or 'planche' in resLower:
            woodTree = sorted([g for g in GRAINES_DB if g.get('bois_h', 0) > 0], key=lambda x: (x.get('bois_h', 0), x['pieces_h']), reverse=True)[0]
            if woodTree and woodTree['graine'] not in seen:
                seen.add(woodTree['graine'])
                results.append({'graine': woodTree['graine'], 'structure': woodTree['structure'], 'bois_h': woodTree.get('bois_h', 0), 'rendement': f'{woodTree["pieces_h"]} pts/h'})
        else:
            g = next((x for x in GRAINES_DB if x['culture'].lower().strip() in resLower or resLower in x['culture'].lower().strip()), None)
            if g and g['graine'] not in seen:
                seen.add(g['graine'])
                results.append({'graine': g['graine'], 'structure': g['structure'], 'bois_h': g.get('bois_h', 0), 'rendement': f'{g["pieces_h"]} pts/h'})
    return results

test_cases = ['base_bois_bloc', 'r272', 'r273', 'r1', 'r2', 'r14', 'r11', 'r12']
for tid in test_cases:
    r = next(x for x in recettesDB if x['id'] == tid)
    seeds = getRecommendedSeedsForRecipe(r)
    s_strs = [f"{s['graine']} ({s['structure']})" for s in seeds]
    print(f"{r['nom']} ({r['structure']}) -> {s_strs}")
