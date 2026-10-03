import sys
sys.stdout.reconfigure(encoding='utf-8')
import json

db_path = r"c:\IA\Projets\Aniimo\logis-manager\src\data\recettes.json"
with open(db_path, 'r', encoding='utf-8') as f:
    recettesDB = json.load(f)

level = 11
MAX_STRUCTURES_PER_LEVEL = 5
maxStructs = min(100, level * MAX_STRUCTURES_PER_LEVEL)

def getLimitForStructure(structureName, level):
    if structureName == 'Ferme': return int(level * 2.1819)
    if structureName == 'Pépinière': return int(level * 1.5)
    if structureName == 'Zone de coupe': return int(level * 1.5)
    if structureName in ['Climatisation', 'Fournaise']: return int(level / 10) or 1
    if structureName in ['Établi artisanal', 'Établi phonolfactif']: return 2
    return int(level * 1.0) + 1

def simulate(target_id):
    structuresToPlace = []
    tempUsages = {}

    def tryAdd(recId):
        rec = next((r for r in recettesDB if r['id'] == recId), None)
        if not rec: return False
        limit = getLimitForStructure(rec['structure'], level)
        usage = tempUsages.get(rec['structure'], 0)
        if usage < limit:
            structuresToPlace.append(recId)
            tempUsages[rec['structure']] = usage + 1
            return True
        return False

    def getNetResource(resName, tempList):
        net = 0
        for id in tempList:
            r = next((x for x in recettesDB if x['id'] == id), None)
            if r:
                runs = 60 / max(1, r['tempsMin'])
                for req, qte in r.get('input', {}).items():
                    if req.lower() == resName.lower():
                        net -= qte * runs
                for out, qte in r.get('output', {}).items():
                    if out.lower() == resName.lower():
                        net += qte * runs
        return net

    for i in range(maxStructs):
        deficits = {}
        for id in structuresToPlace:
            r = next((x for x in recettesDB if x['id'] == id), None)
            if r and r.get('input'):
                for req in r['input'].keys():
                    net = getNetResource(req, structuresToPlace)
                    if net < 0:
                        deficits[req] = net

        added = False
        sortedDeficits = sorted(deficits.keys(), key=lambda k: deficits[k])
        for defRes in sortedDeficits:
            # find producer
            producer = next((r for r in recettesDB if any(out.lower() == defRes.lower() for out in r.get('output', {}).keys())), None)
            if producer:
                if tryAdd(producer['id']):
                    added = True
                    break

        if not added:
            added = tryAdd(target_id)
        if not added:
            break

    print(f"=== Simulation for {target_id} ===")
    from collections import Counter
    counts = Counter(structuresToPlace)
    for rec_id, cnt in counts.items():
        r = next(x for x in recettesDB if x['id'] == rec_id)
        print(f"  {cnt}x {r['nom']} ({r['structure']})")
    print(f"Total structures: {len(structuresToPlace)} / {maxStructs}")

    # Check net resource rates
    all_res = set()
    for id in structuresToPlace:
        r = next(x for x in recettesDB if x['id'] == id)
        all_res.update(r.get('input', {}).keys())
        all_res.update(r.get('output', {}).keys())
    print("Net resource balances (/h):")
    for res in sorted(all_res):
        bal = getNetResource(res, structuresToPlace)
        status = "OK (+)" if bal >= 0 else "DEFICIT (-)"
        print(f"  {res}: {bal:.1f}/h [{status}]")

simulate('r273') # Planches standard
simulate('r14')  # Pain
