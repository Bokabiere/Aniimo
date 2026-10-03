#!/usr/bin/env python3
"""Génère scripts/reference/recettes_overrides.json (r100–r281) à partir des relevés
aniimotools.dev (travail + rachat par recette) et de graines_db.json (cultures).
tempsMin = travail / 60 (cadence 60 travail/min au niveau recommandé).
Usage : python scripts/build_gabarits_overrides.py"""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA, REF = ROOT/"src/data", ROOT/"scripts/reference"
S = lambda s: [tuple(x.split("|")) for x in s.strip().split("\n")]
# (nom local | travail | rachat)
T = {
"Établi artisanal": S("""Plateau des moissons|405|5290
Sculpture en bois|54|90
Vaisselle en bambou|54|190
Pierres polies de rivière premium|108|360
Pierres polies de rivière|108|300
Poterie|135|630
Désodorisant à la rose premium|203|1420
Désodorisant à la rose|203|1270
Bouquet de fleurs|135|1120
Sachet de lavande|135|1580
Coquillage décoratif|135|1190
Attrape-rêve|162|1730
Lanterne à vœu stellaire|162|2140
Carillon à vent|243|3180
Collier de perles|162|3210
Porcelaine|162|2960
Canard en caoutchouc|81|1540
Jouet tressé|81|1580
Teinture|162|4280
Fleurs en bouteille|243|7700
Poussière de gemme|162|4600
Poupée|324|11110"""),
"Cuisinière flamboyante": S("""Boule de riz à la fleur de cerisier|203|1410
Soupe onctueuse de pomme de terre|135|750
Tranches de radis de rosée lunaire|203|2370
Soupe de pommes de terre premium|135|880
Riz frit à la sauce soja|203|1280
Ragoût ombral|203|2150
Tofu à la sauce soja|203|1470
Châtaignes grillées au sucre|203|2470
Tanghulu|203|2260
Gâteau au ginseng et à la châtaigne|162|2510
Rouleau de vermicelles à la vapeur|162|2510
Gâteau aux noix|243|3550
Gelée|243|4790
Gelée premium|243|5520
Compote de raisin gourmande|243|5050
Bonbon à la fraise|324|6840
Chocolat à la canneberge|405|13480
Chou à la crème à la fraise|243|5650"""),
"Trempo-barils": S("""Thé vert au riz grillé|135|740
Thé au blé|135|330
Jus de pomme|135|1000
Kvass de pomme de terre|270|2640
Jus de fraise|135|1180
Jus de canne à sucre|68|650
Eau de ginseng|162|2670
Jus de raisin|162|2390
Boisson au raisin citronnée|243|2970
Lait de noix|162|2270
Boisson fraîche à la noix de coco|81|1650
Jus de canneberge|162|4060
Boisson à l'agave|243|6610
Lait de coco au cacao|162|4930
Chocolat chaud|162|5330
Rosée de fleur d'oranger|162|4700"""),
"Attrape-popote": S("""Pain premium|108|330
Piment de lune croissante rôti|162|1520
Graines de soja grillées|108|450
Tarte aux pommes|135|590
Pommes de terre rôties au bonbon à l'érable|203|850
Sablé à la rose|203|1310
Bonbon à la pomme|203|1980
Biscuits à la lavande|135|1040
Chips de noix au caramel|243|3130
Bonbon au raisin|243|2850
Cookies à la noix de coco|162|3700
Bonbon en étoile à l'érable|162|2810
Pudding chococo à la fraise|567|17890
Pain aux fleurs|162|4610
Pudding chococo à la fraise premium|567|20270"""),
"Marmite à mijoter": S("""Bouillie de riz nature|108|660
Sauce sucrée-épicée ombrale|243|2390
Concentré de rose|135|770
Confiture de pomme au bonbon à l'érable|135|950
Bille de sucre|135|1180
Confiture de fraise|68|650
Purée de châtaignes|81|980
Bouillie de ginseng|162|2440
Confiture de raisin|81|1120
Sucre de malt|243|3440
Morceau de sucre d'érable|81|1060
Sirop d'agave|162|3080
Pâte à tartiner au cacao|324|8350
Confiture de canneberge|324|7350"""),
"Séchoir jukebox": S("""Chips de pomme de terre|54|110
Tranches de citron séché|54|190
Tofu séché|68|330
Fleur de cerisier séchée|68|410
Tranches de pomme séchée|68|510
Fraises séchées|68|690
Ginseng séché|81|1120
Raisins secs|81|1210
Noix de coco râpée|81|1470
Canneberges séchées|81|2080
Fleurs séchées|81|1990"""),
"Établi phonolfactif": S("""Bâton d'encens au bambou|135|470
Encens à la cerise|135|840
Encens à la rose|135|790
Encens à la lavande|135|1270
Encens au citron|135|700
Arôme herbacé de ginseng|162|2360
Savon premium|243|6320
Savon|243|5500
Lotion|162|7030
Parfum composite|162|4850
Encens à la fleur d'oranger|162|3640
Parfum composite premium|162|5520"""),
"Bocal à pickles": S("""Fleur de cerisier salée|135|780
Sauce soja|135|650
Pickles ombral|203|2290
Vinaigre de cidre|68|510
Vin de riz sucré premium|270|2980
Boisson de riz sucrée|270|2580
Citron salé premium|162|1440
Vinaigre de riz|162|2510
Citron salé|162|1110
Fraises confites|162|2090
Fleur d'oranger confite|243|6950"""),
"Moulin-carrousel": S("""Farine complète|54|70
Riz décortiqué|54|240
Tofu|54|230
Poudre de lavande|68|650
Poudre de ginseng|81|1160
Boisson au riz|162|1860
Huile de coco|81|1580
Farine raffinée|81|1260
Poudre de cacao|81|2470
Lait de coco|162|3820"""),
"Grande roue à tisser": S("""Fil de coton|68|410
Tissu en coton|68|610
Pelote de laine|68|760
Corde de palmier|81|1150
Tissu en laine|81|1190
Tissu en coton teint|243|6920"""),
"Four de cheminée": S("""Minerai grossièrement tamisé|34|0
Brique de minerai frittée|34|0
Minerai raffiné|41|0
Plaque de minerai microcristallin|41|0"""),
"Établi de menuiserie": S("""Bois brut|34|0
Planches standard|34|0
Poutres lamellées|41|0
Élément en bois densifié|41|0"""),
}
# Stations à durée explicite : (minutes, quantité produite)
EXPL = {("Machine à Aniipod","Aniipod"):(30,1),("Machine à Aniipod","Aniipod pro"):(30,1),
        ("Machine à Aniipod","Aniipod méga"):(30,1),("Polissoir dansant","Bourgeon de croissance"):(20,3),
        ("Polissoir dansant","Fleur de croissance"):(40,2),("Polissoir dansant","Fruit de croissance"):(60,1)}
# Cultures : rang de palier voulu (clé = id) — "rapide" = recette de module (palier le plus haut avec « module »)
CROP_TIER = {"r107":("Pomme de terre",46),"r115":("Riz",79),"r118":("Fraise",26),"r130":("Sirop d'érable",30)}
rows = json.load(open(DATA/"recettes.json", encoding="utf-8"))
gr = json.load(open(DATA/"graines_db.json", encoding="utf-8"))
def qty(g): return int(g["raw_text"].split("×")[1].split("Bloc")[0].split("recette")[0].strip().split()[0]) if "×" in g["raw_text"] else 0
out, rapport = {}, []
for r in rows:
    n = int(r["id"][1:]) if r["id"][1:].isdigit() else 0
    if n < 100 or r["id"] in ("r1","r2","r4"): continue
    st, nom = r["structure"], r["nom"]
    if st in ("Ferme","Pépinière"):
        if r["id"] in CROP_TIER:
            c, q = CROP_TIER[r["id"]]; cand = [g for g in gr if g["culture"]==c and qty(g)==q]
        else:
            cand = sorted([g for g in gr if g["culture"]==nom and g["structure"]==st], key=lambda g: g["pieces"])[:1]
        if not cand: rapport.append(f"{r['id']} {nom} : culture introuvable"); continue
        g = cand[0]; q = qty(g)
        d = {"tempsMin": g["minutes"], "output": {g["culture"]: q}, "profit": g["pieces"]}
        d["capacite"] = "Culture"
        if g.get("aura"): d["needsAura"] = g["aura"]
    elif (st, nom) in EXPL:
        m, q = EXPL[(st, nom)]; d = {"tempsMin": m, "output": {nom: q}, "profit": 0}
    else:
        hit = [x for x in T.get(st, []) if x[0] == nom]
        if not hit: rapport.append(f"{r['id']} {nom} ({st}) : non relevée"); continue
        w, p = int(hit[0][1]), int(hit[0][2])
        d = {"tempsMin": round(w/60, 2), "output": {nom: 1}, "profit": p}
    out[r["id"]] = d
ov = json.load(open(REF/"recettes_overrides.json", encoding="utf-8"))
for k in [k for k in ov["recettes"] if k not in ("r1","r2","r4")]: del ov["recettes"][k]
ov["recettes"].update(out)
ov["_source"] = "wikily.gg + aniimotools.dev (stations, travail/60 = minutes, rachat = profit) + graines_db.json"
ov["_note"] = ("r1/r2/r4 + r100–r281 vérifiés/dérivés le 2026-10-03. w/h non modifiés (non vérifiés). "
               "Recettes rapides = paliers « module ». Régénérer avec build_gabarits_overrides.py.")
json.dump(ov, open(REF/"recettes_overrides.json","w",encoding="utf-8",newline="\n"), ensure_ascii=False, indent=2)
print(len(out), "recettes ;", len(rapport), "non couvertes"); print("\n".join(rapport))
