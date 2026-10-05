// Miniatures des Aniimo : nom français → identifiant de l'image (aniimotools.dev).
// Ordre de repli : image locale (public/aniimo/<id>.webp) → image distante → pastille colorée avec initiale.

export const SLUGS = {
  Loufeuteau: 'emberpup', Jappardent: 'flameruff', Hurlebrasier: 'scorchhowl', Inferlupin: 'inferlupa',
  Célestia: 'celestis', Stellaria: 'stellarys', Cuicui: 'chirpi', Trombec: 'tromber', Clairbec: 'cornet',
  Tubabec: 'tubster', Iris: 'iris', Valsiris: 'irisal', Tilotus: 'skippy', Filoutus: 'pranky',
  Givrotus: 'glacy', Voilotus: 'leafy', Cumulaine: 'nimbi', Turbulaine: 'turbo', Lainirique: 'dreaple',
  Fredon: 'hummin', Sorcelonde: 'witchin', Nutrion: 'tuckin', Crabourgeon: 'budclaw', Crabiflore: 'shrubclaw',
  Cristocrabe: 'geoclaw', Farfafeu: 'sparki', Flamirage: 'flamerion', Fluoretti: 'flutternym',
  Voletti: 'gracewing', Vitti: 'somniwing', Eko: 'eko', Ekolombo: 'eklue', Bourgeonnet: 'budsquire',
  Rapiéronce: 'thornblade', Méliflore: 'melloblum', Pomœuf: 'pomegg', Pomawk: 'pomawk', Plumiel: 'dewy',
  Fragrancier: 'fragrancier', Flammi: 'wisptis', Igniti: 'ignitis', Osky: 'bonesky', Glaivrier: 'fenrier',
  Molosabre: 'glynsera', Voltige: 'bolty', Voltignasse: 'blazen', Écurixe: 'squarrel', Écurouste: 'squashel',
  Louloutre: 'susuta', Bulloutre: 'popota', Ondeloutre: 'piopiota', Terriloutre: 'panpanta', Astrid: 'shelly',
  Astor: 'sheldon', Astrophel: 'sherro', Balabée: 'baleetle', Coléobée: 'waleetle', Boulabée: 'bouldus',
  Touffu: 'fentuft', Fulgucrin: 'fenmane', Casquimou: 'helmut', Casquipreux: 'pawney', Casquillon: 'rookey',
  Mandibouille: 'jawling', Casquimord: 'helmwhelp', Cuiragon: 'helgon', Infergon: 'infergon', Ourso: 'cubbo',
  Grizzo: 'grizbo', Silexodon: 'pebbling', Lavasaure: 'lavazar', Magmarex: 'magmarex', Géodosaure: 'geodeback',
  Cristorex: 'minespine', Cabaroc: 'cozite', Bastiroc: 'bailite', Bulbi: 'bulbly', Voilueur: 'veilfloat',
  Luminelle: 'luminelle', Falou: 'fahloo', Fabulle: 'erlath', Pulsato: 'besauce', Coracroc: 'reefish',
  Coraleurre: 'coraliz', Cheekie: 'cheekie', Wavwal: 'wavwal', Algobulle: 'bubbeep', Algoglam: 'glameep',
  Poulplash: 'popapus', Gachapoulpe: 'gachapus', Malange: 'malangel', Malaglace: 'malevsera',
  Crustabasse: 'jabster', Mutaspiole: 'morphling', Lumiris: 'irisalis', Danzard: 'dazmand', Fulmi: 'fulmintis',
  'Elfe solidaire': 'sparkelf', Lunara: 'lunara', Hélion: 'helion',
};

const HOTE = 'https://aniimotools.dev/assets/creatures/thumb/';

export function slugAniimo(nom) {
  return SLUGS[nom] || null;
}

/** Liste ordonnée des sources à essayer (locale puis distante). `base` = import.meta.env.BASE_URL. */
export function sourcesMiniature(nom, base = '/') {
  const slug = slugAniimo(nom);
  if (!slug) return [];
  return [`${base}aniimo/${slug}.webp`, `${HOTE}${slug}.webp`];
}
