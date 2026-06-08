/**
 * world-cup-2026.js
 * Composición oficial de los grupos de la Copa Mundial FIFA 2026.
 *
 * Los grupos usan IDs reales de la tabla Equipo. Los nombres quedan en
 * WORLD_CUP_2026_TEAMS solo para renderizar filas sin depender de string matching.
 */

const WORLD_CUP_2026_SLUG = 'copa-mundial-fifa';

const WORLD_CUP_2026_TEAMS = {
  cmoxxz3jf0011ag5qdl00xw60: { nombre: 'Portugal', nombreEn: 'Portugal' },
  cmpkkdyol000dg8odjs7mbyh4: { nombre: 'Suiza', nombreEn: 'Switzerland' },
  cmpkkdylb0006g8oddpqkb65m: { nombre: 'Canadá', nombreEn: 'Canada' },
  cmpkkdyli0007g8odm7sbuz9b: { nombre: 'Bosnia-H.', nombreEn: 'Bosnia-H.' },
  cmpkkdytk000og8odyrzqilmg: { nombre: 'Alemania', nombreEn: 'Germany' },
  cmpkkdyto000pg8odbz03r56m: { nombre: 'Curaçao', nombreEn: 'Curaçao' },
  cmpkkdzbt001mg8odztmvq0x4: { nombre: 'Congo RD', nombreEn: 'Congo DR' },
  cmpkkdyv6000vg8odgdksgl4s: { nombre: 'Ecuador', nombreEn: 'Ecuador' },
  cmpkkdzcd001pg8odbnd7ms6x: { nombre: 'Croacia', nombreEn: 'Croatia' },
  cmpkkdyya0013g8od30ayzea4: { nombre: 'Bélgica', nombreEn: 'Belgium' },
  cmpkkdz3z001bg8od9l80w28y: { nombre: 'Francia', nombreEn: 'France' },
  cmpkkdz6h001fg8odve75w18z: { nombre: 'Noruega', nombreEn: 'Norway' },
  cmpkkdz5x001eg8odke6mh14p: { nombre: 'Irak', nombreEn: 'Iraq' },
  cmpkkdzcw001rg8odz4hmb14l: { nombre: 'Ghana', nombreEn: 'Ghana' },
  cmpkkdywt0010g8odkh64xc0w: { nombre: 'España', nombreEn: 'Spain' },
  cmpkkdz41001cg8odg1un4nmo: { nombre: 'Senegal', nombreEn: 'Senegal' },
  cmpkkdyir0000g8odvn98frju: { nombre: 'México', nombreEn: 'Mexico' },
  cmpkkdzb7001kg8odrcgnj1vu: { nombre: 'Jordania', nombreEn: 'Jordan' },
  cmpkkdyyh0014g8odg4czt7kg: { nombre: 'Egipto', nombreEn: 'Egypt' },
  cmpkkdyyt0016g8odoxtqwnkk: { nombre: 'Arabia Saudita', nombreEn: 'Saudi Arabia' },
  cmoxxz2fo000uag5qzf7rf4z3: { nombre: 'Argentina', nombreEn: 'Argentina' },
  cmpkkdz9k001hg8odsgty97xc: { nombre: 'Argelia', nombreEn: 'Algeria' },
  cmpkkdzan001jg8odowh16m1s: { nombre: 'Austria', nombreEn: 'Austria' },
  cmpkkdyj10001g8odhex51qvd: { nombre: 'Sudáfrica', nombreEn: 'South Africa' },
  cmpkkdz0z0019g8odm96o9lba: { nombre: 'Nueva Zelanda', nombreEn: 'New Zealand' },
  cmpkkdz0x0018g8odcjf3lcz8: { nombre: 'Irán', nombreEn: 'Iran' },
  cmpkkdzdr001vg8odb3rgjc1p: { nombre: 'Colombia', nombreEn: 'Colombia' },
  cmpkkdzdh001ug8odaw74qe21: { nombre: 'Uzbekistán', nombreEn: 'Uzbekistan' },
  cmpkkdzcy001sg8od4ob1kkkp: { nombre: 'Panamá', nombreEn: 'Panama' },
  cmpkkdyo1000cg8odqcvoomni: { nombre: 'Qatar', nombreEn: 'Qatar' },
  cmpkkdzcb001og8od7itfcbmc: { nombre: 'Inglaterra', nombreEn: 'England' },
  cmpkkdypx000gg8odw22u5qec: { nombre: 'Marruecos', nombreEn: 'Morocco' },
  cmpkkdyr2000ig8odh3n51smy: { nombre: 'Haití', nombreEn: 'Haiti' },
  cmpkkdyrb000jg8odx5i2p5tx: { nombre: 'Escocia', nombreEn: 'Scotland' },
  cmpkkdypo000fg8odf04rr7yr: { nombre: 'Brasil', nombreEn: 'Brazil' },
  cmpkkdykg0003g8od358yryx6: { nombre: 'Corea del Sur', nombreEn: 'Korea Republic' },
  cmpkkdyuy000ug8odzi6opev9: { nombre: 'Costa de Marfil', nombreEn: 'Ivory Coast' },
  cmpkkdyvt000yg8odqgbbsgfg: { nombre: 'Túnez', nombreEn: 'Tunisia' },
  cmpkkdyu6000rg8odzoswp2cc: { nombre: 'Países Bajos', nombreEn: 'Netherlands' },
  cmpkkdyud000sg8odn3vngly5: { nombre: 'Japón', nombreEn: 'Japan' },
  cmpkkdyvr000xg8odcbhnqw74: { nombre: 'Suecia', nombreEn: 'Sweden' },
  cmpkkdyrx000mg8odz3csr8qo: { nombre: 'Turquía', nombreEn: 'Turkey' },
  cmpkkdymd0009g8odksfmpl1c: { nombre: 'EE. UU.', nombreEn: 'USA' },
  cmpkkdymm000ag8odikqfnaed: { nombre: 'Paraguay', nombreEn: 'Paraguay' },
  cmpkkdyrv000lg8odcalod2ht: { nombre: 'Australia', nombreEn: 'Australia' },
  cmpkkdyko0004g8odkwz3rh8t: { nombre: 'Chequia', nombreEn: 'Czechia' },
  cmoxxz2qz000wag5qd4b9u7v5: { nombre: 'Uruguay', nombreEn: 'Uruguay' },
  cmpkkdyx30011g8odivqlsvj4: { nombre: 'Cabo Verde', nombreEn: 'Cape Verde' },
};

const WORLD_CUP_2026_GROUPS = {
  A: ['cmpkkdyir0000g8odvn98frju', 'cmpkkdyj10001g8odhex51qvd', 'cmpkkdykg0003g8od358yryx6', 'cmpkkdyko0004g8odkwz3rh8t'],
  B: ['cmpkkdylb0006g8oddpqkb65m', 'cmpkkdyol000dg8odjs7mbyh4', 'cmpkkdyo1000cg8odqcvoomni', 'cmpkkdyli0007g8odm7sbuz9b'],
  C: ['cmpkkdypo000fg8odf04rr7yr', 'cmpkkdypx000gg8odw22u5qec', 'cmpkkdyr2000ig8odh3n51smy', 'cmpkkdyrb000jg8odx5i2p5tx'],
  D: ['cmpkkdymd0009g8odksfmpl1c', 'cmpkkdymm000ag8odikqfnaed', 'cmpkkdyrv000lg8odcalod2ht', 'cmpkkdyrx000mg8odz3csr8qo'],
  E: ['cmpkkdytk000og8odyrzqilmg', 'cmpkkdyto000pg8odbz03r56m', 'cmpkkdyuy000ug8odzi6opev9', 'cmpkkdyv6000vg8odgdksgl4s'],
  F: ['cmpkkdyu6000rg8odzoswp2cc', 'cmpkkdyud000sg8odn3vngly5', 'cmpkkdyvr000xg8odcbhnqw74', 'cmpkkdyvt000yg8odqgbbsgfg'],
  G: ['cmpkkdyya0013g8od30ayzea4', 'cmpkkdyyh0014g8odg4czt7kg', 'cmpkkdz0x0018g8odcjf3lcz8', 'cmpkkdz0z0019g8odm96o9lba'],
  H: ['cmpkkdywt0010g8odkh64xc0w', 'cmpkkdyx30011g8odivqlsvj4', 'cmpkkdyyt0016g8odoxtqwnkk', 'cmoxxz2qz000wag5qd4b9u7v5'],
  I: ['cmpkkdz3z001bg8od9l80w28y', 'cmpkkdz41001cg8odg1un4nmo', 'cmpkkdz6h001fg8odve75w18z', 'cmpkkdz5x001eg8odke6mh14p'],
  J: ['cmoxxz2fo000uag5qzf7rf4z3', 'cmpkkdz9k001hg8odsgty97xc', 'cmpkkdzan001jg8odowh16m1s', 'cmpkkdzb7001kg8odrcgnj1vu'],
  K: ['cmoxxz3jf0011ag5qdl00xw60', 'cmpkkdzdr001vg8odb3rgjc1p', 'cmpkkdzdh001ug8odaw74qe21', 'cmpkkdzbt001mg8odztmvq0x4'],
  L: ['cmpkkdzcb001og8od7itfcbmc', 'cmpkkdzcd001pg8odbnd7ms6x', 'cmpkkdzcw001rg8odz4hmb14l', 'cmpkkdzcy001sg8od4ob1kkkp'],
};
