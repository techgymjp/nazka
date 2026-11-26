// 実在するナスカの地上絵をモチーフにした線画データ
// 形は簡略化した再現です。座標は任意単位（y は下向き）で、読み込み時に [-1,1] に正規化します。

const E = (cx, cy, rx, ry, n = 20) => {
  const p = [];
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return p;
};
const SP = (cx, cy, r0, r1, turns, a0, n = 48) => {
  const p = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n, a = a0 + k * turns * Math.PI * 2, r = r0 + (r1 - r0) * k;
    p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return p;
};
const mirY = pts => pts.map(([x, y]) => [x, -y]);
const mirX = pts => pts.map(([x, y]) => [-x, y]);
const rotUp = paths => paths.map(p => p.map(([x, y]) => [y, -x])); // 右向き → 上向き

function hummingbird() {
  const wing = [[-2, -5], [-14, -42], [-8, -46], [-6, -36], [-2, -46], [2, -36], [6, -45], [9, -5]];
  return rotUp([
    [[-20, 0], [-6, -7], [10, -5], [17, 0], [10, 5], [-6, 7], [-20, 0]],
    [[17, -1], [52, 0], [17, 1]],
    wing, mirY(wing),
    [[-20, 0], [-36, -10], [-31, -2], [-40, 0], [-31, 2], [-36, 10], [-20, 0]],
  ]);
}
function monkey() {
  const arm = [[6, -9], [14, -24], [22, -26]];
  const hand5 = [[27, -33], [22, -26], [30, -30], [22, -26], [31, -26], [22, -26], [30, -22], [22, -26], [26, -19]];
  const hand4 = mirY([[27, -33], [22, -26], [30, -29], [22, -26], [31, -24], [22, -26], [27, -19]]);
  const leg = [[-12, -8], [-19, -22], [-12, -29]];
  const foot = [[-8, -34], [-12, -29], [-6, -30], [-12, -29], [-6, -25]];
  return [
    E(0, 0, 16, 11), E(22, 0, 8, 7, 14),
    arm, hand5, mirY(arm), hand4, leg, foot, mirY(leg), mirY(foot),
    [[-16, 0]].concat(SP(-32, 0, 14, 2, 2.3, 0)),
  ];
}
function spider() {
  const out = [E(-14, 0, 15, 12), E(8, 0, 8, 7, 14), [[16, -3], [22, -6]], [[16, 3], [22, 6]]];
  for (let i = 0; i < 4; i++) {
    const k = i / 3;
    const leg = [[12 - k * 10, 6], [18 - k * 22, 24 + k * 2], [30 - k * 44, 34 + k * 6]];
    out.push(leg, mirY(leg));
  }
  out[out.length - 1] = out[out.length - 1].concat([[-28, -52]]); // 1本だけ長い脚
  return rotUp(out);
}
function condor() {
  const wing = [[12, -6], [14, -30], [9, -58], [4, -50], [1, -60], [-3, -51], [-7, -58], [-9, -46], [-11, -30], [-13, -7]];
  return rotUp([
    [[36, 0], [28, -5], [16, -6], [-16, -7], [-24, 0], [-16, 7], [16, 6], [28, 5], [36, 0]],
    E(26, 0, 3, 3, 8), wing, mirY(wing),
    [[-24, 0], [-40, -14], [-37, -5], [-44, 0], [-37, 5], [-40, 14], [-24, 0]],
  ]);
}
function orca() {
  return [
    E(0, 0, 36, 12, 28),
    [[-34, -3], [-46, 0], [-56, -14], [-51, 0], [-56, 14], [-46, 0], [-34, 3]],
    [[-4, -11], [-14, -27], [6, -12]], [[12, 10], [4, 23], [18, 11]],
    E(24, -4, 2.2, 2.2, 8), [[36, 1], [20, 5]],
  ];
}
function astronaut() {
  return [
    E(0, -30, 16, 16, 24), E(-6, -32, 4.5, 4.5, 10), E(6, -32, 4.5, 4.5, 10),
    [[-12, -14], [12, -14], [12, 20], [-12, 20], [-12, -14]],
    [[-10, 20], [-10, 44], [-2, 44], [0, 26], [2, 44], [10, 44], [10, 20]],
    [[12, -10], [24, -16], [28, -34]], [[24, -40], [28, -34], [31, -41], [28, -34], [34, -37]],
    [[-12, -10], [-24, -2], [-28, 12]], [[-33, 15], [-28, 12], [-30, 19], [-28, 12], [-24, 18]],
  ];
}
function pelican() {
  return [
    E(0, 10, 22, 14), [[14, 0], [20, -14], [16, -28]], E(18, -32, 6, 5, 12),
    [[22, -34], [58, -20], [50, -15], [22, -28]],
    [[-6, 2], [-30, -24], [-42, -22], [-14, 6]],
    [[-20, 14], [-38, 22], [-22, 20]],
    [[0, 24], [-2, 38], [-8, 40]], [[6, 24], [8, 38], [2, 40]],
  ];
}
function heron() {
  return [
    E(0, 20, 20, 10), [[14, 14], [26, 6], [10, -2], [26, -10], [10, -18], [26, -26], [12, -34]],
    E(10, -38, 5, 4, 10), [[14, -38], [44, -46]],
    [[-2, 30], [-4, 56], [-10, 58]], [[6, 30], [8, 56], [2, 58]], [[-20, 20], [-34, 28]],
  ];
}
function parrot() {
  return [
    E(0, 0, 12, 20), E(4, -24, 9, 8, 16), [[12, -26], [21, -22], [16, -13], [12, -18]],
    E(6, -26, 1.8, 1.8, 6), [[-10, -8], [-19, 10], [-8, 22]],
    [[-6, 18], [-12, 54], [-4, 46], [0, 58], [4, 46], [12, 54], [6, 18]],
  ];
}
function dog() {
  return [
    [[-24, -6], [20, -6], [24, 0], [20, 6], [-24, 6], [-28, 0], [-24, -6]],
    [[20, -6], [26, -20], [36, -20], [41, -14], [30, -10], [24, 0]], [[26, -20], [24, -30], [30, -21]],
    [[16, 6], [18, 28], [23, 28]], [[10, 6], [8, 28], [13, 28]],
    [[-18, 6], [-20, 28], [-15, 28]], [[-24, 4], [-28, 28], [-23, 28]],
    [[-28, -2], [-38, -18], [-34, -27]],
  ];
}
function lizard() {
  const fl = [[-5, -18], [-20, -26], [-24, -36]], bl = [[-5, 16], [-20, 24], [-24, 34]];
  const toes = (x, y) => [[x - 4, y - 4], [x, y], [x + 4, y - 3], [x, y], [x - 1, y + 5]];
  return [
    E(0, 0, 6, 30, 24), E(0, -36, 6, 8, 14),
    [[0, 30], [3, 50], [-3, 68], [2, 86]],
    fl, mirX(fl), bl, mirX(bl), toes(-24, -36), mirX(toes(-24, -36)), toes(-24, 34), mirX(toes(-24, 34)),
  ];
}
function tree() {
  return [
    [[0, 40], [0, -10]], [[0, 12], [-18, -2], [-26, -20]], [[0, 2], [16, -12], [22, -30]],
    [[0, -10], [-8, -32]], [[0, -10], [6, -36]],
    E(-26, -24, 4, 4, 10), E(22, -34, 4, 4, 10), E(-8, -36, 4, 4, 10), E(6, -40, 4, 4, 10),
    [[0, 40], [-14, 50]], [[0, 40], [14, 50]], [[0, 40], [0, 54]],
  ];
}
function hands() {
  const hand = (cx, nf) => {
    const p = [[cx - 12, 20], [cx - 12, -10]];
    const w = 24 / nf;
    for (let i = 0; i < nf; i++) {
      const x0 = cx - 12 + i * w, x1 = x0 + w * 0.75;
      p.push([x0, -34], [x1, -34], [x1, -10]);
      if (i < nf - 1) p.push([x0 + w, -10]);
    }
    p.push([cx + 12, -10], [cx + 12, 20]);
    return p;
  };
  return [hand(-16, 4), hand(16, 5), [[-28, 20], [-28, 40], [28, 40], [28, 20]], [[-4, 20], [4, 20]]];
}
function flower() {
  const out = [[[0, 54], [0, 0]], [[0, 34], [-16, 24], [0, 27]], [[0, 22], [16, 12], [0, 15]], E(0, -16, 5, 5, 12)];
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const p = (r, o) => [c * r - s * o, -16 + s * r + c * o];
    out.push([p(5, 0), p(12, -5), p(20, 0), p(12, 5), p(5, 0)]);
  }
  return out;
}
function seaweed() {
  const stem = [];
  for (let y = 54; y >= -54; y -= 6) stem.push([Math.sin(y * 0.12) * 6, y]);
  const out = [stem];
  for (let i = 0; i < 7; i++) {
    const y = 40 - i * 14, s = i % 2 ? 1 : -1, x0 = Math.sin(y * 0.12) * 6;
    out.push([[x0, y], [x0 + s * 12, y - 8], [x0 + s * 18, y - 18], [x0 + s * 26, y - 22]]);
  }
  return out;
}
function fish() {
  return [
    [[-30, 0], [-10, -14], [18, -12], [34, 0], [18, 12], [-10, 14], [-30, 0]],
    [[-30, 0], [-46, -14], [-42, 0], [-46, 14], [-30, 0]],
    E(22, -3, 2.5, 2.5, 8), [[0, -13], [6, -24], [12, -12]], [[0, 13], [6, 22], [10, 12]], [[14, -10], [12, 0], [14, 10]],
  ];
}
function spiral() {
  return [SP(-18, 0, 20, 2, 2.4, 0), [[2, 0], [-2, 0]], SP(18, 0, 20, 2, 2.4, Math.PI)];
}
function cat() {
  return [
    E(0, 6, 26, 12, 24), E(30, -10, 11, 10, 16), [[22, -17], [24, -28], [30, -20], [36, -28], [38, -17]],
    E(26, -12, 2.5, 2.5, 8), E(34, -12, 2.5, 2.5, 8),
    [[18, 16], [18, 30]], [[10, 17], [10, 30]], [[-14, 16], [-14, 30]], [[-20, 15], [-22, 30]],
    [[-26, 4], [-40, -6], [-44, -24]], [[-37, -9], [-43, -7]], [[-41, -16], [-47, -16]],
    [[-10, -5], [-10, 17]], [[0, -6], [0, 18]], [[10, -5], [10, 17]],
  ];
}
function frigatebird() {
  const wing = [[-5, -6], [-24, -14], [-52, -4], [-28, -2], [-5, 4]];
  return [
    E(0, 0, 6, 16), E(0, -22, 5, 5, 10), [[0, -27], [0, -37], [3, -34]], E(0, -13, 4, 3, 10),
    wing, mirX(wing), [[-3, 16], [-11, 42]], [[3, 16], [11, 42]],
  ];
}


function twoHeadSnake() {
  const top = [], bot = [];
  for (let x = -40; x <= 40; x += 4) { const y = Math.sin(x * .16) * 8; top.push([x, y - 4]); bot.push([x, y + 4]); }
  const head = (cx, s) => [
    [[cx, -5], [cx + s * 8, -9], [cx + s * 14, -4], [cx + s * 14, 4], [cx + s * 8, 9], [cx, 5]],
    E(cx + s * 9, -3, 1.6, 1.6, 6),
    [[cx + s * 14, 0], [cx + s * 22, 0], [cx + s * 26, -3]], [[cx + s * 22, 0], [cx + s * 26, 3]],
  ];
  const yl = Math.sin(-40 * .16) * 8, yr = Math.sin(40 * .16) * 8;
  return [top, bot, ...head(-40, -1).map(p => p.map(([x, y]) => [x, y + yl])), ...head(40, 1).map(p => p.map(([x, y]) => [x, y + yr]))];
}
function humanoidAI() {
  return [
    E(0, -30, 10, 11, 18), E(-4, -31, 2, 2, 6), E(4, -31, 2, 2, 6), [[-3, -25], [3, -25]],
    [[-6, -19], [-16, 18], [16, 18], [6, -19]],
    [[-9, -10], [-24, 4], [-26, 14]], [[9, -10], [24, 4], [26, 14]],
    [[-6, 18], [-8, 42], [-14, 44]], [[6, 18], [8, 42], [14, 44]],
  ];
}
function knifeOrca() {
  return [
    E(0, 0, 34, 12, 28),
    [[-32, -3], [-44, 0], [-54, -14], [-49, 0], [-54, 14], [-44, 0], [-32, 3]],
    [[-4, -11], [-12, -26], [6, -12]],
    E(22, -4, 2.2, 2.2, 8), [[34, 1], [20, 5]],
    [[10, 10], [16, 22], [22, 26]],                       // 腕（ひれ）
    [[22, 26], [28, 22]], [[24, 24], [40, 40], [44, 44], [36, 42], [22, 28]], // ナイフ
  ];
}
function llama() {
  return [
    [[-24, -2], [14, -4], [18, 4], [14, 10], [-22, 10], [-28, 4], [-24, -2]],
    [[14, -2], [18, -30], [24, -34], [32, -32], [32, -28], [24, -26], [20, 2]],
    [[22, -34], [20, -42], [24, -35]], [[26, -34], [27, -42], [28, -34]],
    [[10, 10], [12, 32]], [[4, 10], [3, 32]], [[-16, 10], [-17, 32]], [[-22, 9], [-26, 32]],
    [[-28, 2], [-34, 6], [-32, 10]],
  ];
}
function palpaFamily() {
  const person = (cx, sc) => {
    const out = [E(cx, -18 * sc, 6 * sc, 6 * sc, 14)];
    for (let k = 0; k < 7; k++) { const a = -Math.PI + .3 + k * (Math.PI - .6) / 6; out.push([[cx + Math.cos(a) * 7 * sc, -18 * sc + Math.sin(a) * 7 * sc], [cx + Math.cos(a) * 13 * sc, -18 * sc + Math.sin(a) * 13 * sc]]); }
    out.push([[cx - 5 * sc, -11 * sc], [cx - 6 * sc, 12 * sc], [cx + 6 * sc, 12 * sc], [cx + 5 * sc, -11 * sc]]);
    out.push([[cx - 5 * sc, -8 * sc], [cx - 12 * sc, 2 * sc]], [[cx + 5 * sc, -8 * sc], [cx + 12 * sc, 2 * sc]]);
    out.push([[cx - 3 * sc, 12 * sc], [cx - 4 * sc, 26 * sc]], [[cx + 3 * sc, 12 * sc], [cx + 4 * sc, 26 * sc]]);
    return out.map(p => p.map(([x, y]) => [x, y + (1 - sc) * 26]));
  };
  return [...person(-32, 1), ...person(0, 1), ...person(28, .7)];
}
function candelabra() {
  const fork = (x, y) => [[x - 6, y - 10], [x - 6, y], [x + 6, y], [x + 6, y - 10], [x + 6, y], [x, y], [x, y - 14]];
  return [
    [[0, 48], [0, -44]], [[-6, 48], [6, 48]],
    [[0, 18], [-22, 18], [-22, -24]], [[0, 18], [22, 18], [22, -24]],
    fork(-22, -24), fork(22, -24), [[-6, -44], [6, -44], [0, -44], [0, -54]], [[-6, -44], [-6, -52]], [[6, -44], [6, -52]],
    [[-22, 0], [-30, 0], [-30, -8]], [[22, 0], [30, 0], [30, -8]],
  ];
}
function trapezoid() {
  return [
    [[-12, 46], [12, 46], [30, -46], [-30, -46], [-12, 46]],
    [[0, 46], [0, -46]], [[-50, -46], [50, -46]], [[-6, 20], [6, 20]],
  ];
}
function needleThread() {
  return [
    [[-8, -50], [-3, -46], [8, 40], [0, 54], [-8, 40], [3, -46], [8, -50]].map(([x, y]) => [x * .5 - 20, y]),
    E(-20, -40, 1.6, 4, 8),
    [[-20, -40], [-6, -46], [10, -30], [-4, -14], [14, 2], [-2, 18], [18, 30], [6, 44]].concat(SP(22, 40, 2, 14, 1.5, Math.PI, 24).reverse()),
  ];
}

// size: ゲーム内の大きさ (m)。実寸の比率をおおよそ反映しつつ遊びやすく調整
export const GLYPHS = [
  { id: 'hummingbird', nameEn: 'Hummingbird', descEn: 'About 96 m long. One of the best-known Nazca Lines, with a long beak and wings spread wide.', name: 'ハチドリ', size: 52, shape: hummingbird,
    desc: '全長約96m。ナスカを代表する地上絵で、長いくちばしと左右に広げた翼が特徴です。' },
  { id: 'monkey', nameEn: 'Monkey', descEn: 'Famous for its spiral tail. One hand has four fingers and the other five, nine in all.', name: 'サル', size: 56, shape: monkey,
    desc: 'くるくると渦を巻く尾が印象的。手の指は片方が4本、もう片方が5本で、合わせて9本です。' },
  { id: 'spider', nameEn: 'Spider', descEn: 'About 46 m long. Drawn with a single unbroken line, with one leg stretched out longer than the rest.', name: 'クモ', size: 38, shape: spider,
    desc: '全長約46m。途切れない1本の線で描かれ、脚の1本だけが長く伸びています。' },
  { id: 'condor', nameEn: 'Condor', descEn: 'About 135 m from wingtip to wingtip. The condor was a sacred bird to the people of the Andes.', name: 'コンドル', size: 64, shape: condor,
    desc: '翼を広げた全長は約135m。アンデスの人々が神聖視した大きな鳥です。' },
  { id: 'orca', nameEn: 'Orca', descEn: 'Sea creatures were drawn in the desert too. The orca is thought to have stood for the power of the sea.', name: 'シャチ', size: 46, shape: orca,
    desc: '砂漠の中に海の生き物も描かれました。シャチは海の力の象徴だったと考えられています。' },
  { id: 'astronaut', nameEn: '"Astronaut"', descEn: 'A figure about 30 m tall on a hillside. Its round head and big eyes earned it the names "Astronaut" and "Owl Man".', name: '宇宙飛行士', size: 38, shape: astronaut,
    desc: '丘の斜面に描かれた約30mの人物像。丸い頭と大きな目から「宇宙飛行士」「フクロウ男」と呼ばれます。' },
  { id: 'pelican', nameEn: 'Pelican', descEn: 'A seabird with a large beak. Many Nazca Lines show seabirds.', name: 'ペリカン', size: 60, shape: pelican,
    desc: '大きなくちばしを持つ海鳥。ナスカには海鳥をモチーフにした地上絵が数多くあります。' },
  { id: 'heron', nameEn: 'Heron (Flamingo)', descEn: 'A giant bird with a very long, zigzag neck. It is also called the flamingo.', name: 'サギ（フラミンゴ）', size: 66, shape: heron,
    desc: 'ジグザグに折れ曲がったとても長い首が特徴の巨大な鳥。フラミンゴとも呼ばれます。' },
  { id: 'parrot', nameEn: 'Parrot', descEn: 'A curved beak and long tail feathers. Birds of the Amazon rainforest were drawn in the desert too.', name: 'オウム', size: 42, shape: parrot,
    desc: '曲がったくちばしと長い尾羽。アマゾンの森にすむような鳥も、砂漠に描かれました。' },
  { id: 'dog', nameEn: 'Dog', descEn: 'A four-legged animal with long legs and a raised tail, thought to be a dog.', name: 'イヌ', size: 42, shape: dog,
    desc: '長い脚と、ぴんと立った尾をもつ四つ足の動物。イヌを描いたものと考えられています。' },
  { id: 'lizard', nameEn: 'Lizard', descEn: 'About 180 m long. The Pan-American Highway, built much later, cuts right through its body.', name: 'トカゲ', size: 60, shape: lizard,
    desc: '全長約180m。のちに建設されたパンアメリカン・ハイウェイが、胴体を横切ってしまいました。' },
  { id: 'tree', nameEn: 'Tree', descEn: 'Right next to the observation tower (mirador), where you can see it from the ground together with the "Hands".', name: '木', size: 44, shape: tree,
    desc: '観測やぐら（ミラドール）のすぐそばにあり、「手」と並んで地上から眺めることができます。' },
  { id: 'hands', nameEn: 'Hands', descEn: 'A geoglyph near the mirador. Look closely: one hand has only four fingers.', name: '手', size: 40, shape: hands,
    desc: 'ミラドールの近くにある地上絵。よく見ると、片方の手は指が4本しかありません。' },
  { id: 'flower', nameEn: 'Flower', descEn: 'Plants were drawn too, with a straight stem, leaves and petals spreading out in a circle.', name: '花', size: 34, shape: flower,
    desc: '植物も描かれました。まっすぐな茎と葉、放射状に広がる花びらが見られます。' },
  { id: 'seaweed', nameEn: 'Seaweed', descEn: 'A branching plant that looks like seaweed, a sign of how much the sea meant to the Nazca people.', name: '海藻', size: 40, shape: seaweed,
    desc: '枝分かれした海藻（藻）のような植物の地上絵。海の恵みとの深い関わりを感じさせます。' },
  { id: 'fish', nameEn: 'Fish', descEn: 'A fish with fins and a tail. The sea was important to the Nazca people living near the coast.', name: '魚', size: 36, shape: fish,
    desc: 'ひれと尾をもつ魚の地上絵。海岸に近いナスカの人々にとって、海は大切な存在でした。' },
  { id: 'spiral', nameEn: 'Spiral', descEn: 'Besides animals, there are many geometric figures: spirals, straight lines and trapezoids.', name: '渦巻き', size: 36, shape: spiral,
    desc: '動物だけでなく、渦巻き・直線・台形などの幾何学模様も数多く描かれています。' },
  { id: 'cat', nameEn: 'Cat', descEn: 'A 37 m figure found on a hillside in 2020. It is thought to be older than the Nazca culture.', name: 'ネコ', size: 34, shape: cat,
    desc: '2020年に丘の斜面で見つかった約37mの地上絵。ナスカ文化より前の時代に描かれたとされます。' },
  { id: 'frigatebird', nameEn: 'Frigatebird', descEn: 'A seabird with long, sharp wings and a forked tail, still seen on the coast of Peru.', name: 'グンカンドリ', size: 56, shape: frigatebird,
    desc: '大きく鋭い翼と二股に分かれた尾をもつ海鳥。ペルーの海岸でも見られる鳥です。' },
  { id: 'humanoid', nameEn: 'Humanoid found by AI', descEn: 'Found in 2019 by Yamagata University and IBM using AI analysis. It is said to be the first geoglyph discovered with AI.', name: 'AIが見つけた人型', size: 38, shape: humanoidAI,
    desc: '2019年、山形大学とIBMがAI（人工知能）を使った解析で見つけた人型の地上絵。AIで見つかった最初の地上絵とされます。' },
  { id: 'knifeorca', nameEn: 'Orca with a knife', descEn: 'An orca holding a knife, reported in 2024 by a survey that used AI. Orcas also often appear on Nazca pottery.', name: 'ナイフを持つシャチ', size: 46, shape: knifeOrca,
    desc: '2024年にAIを活用した調査で報告された、ナイフを手にしたシャチの地上絵。シャチはナスカの土器にもよく描かれました。' },
  { id: 'snake', nameEn: 'Two-headed snake', descEn: 'A snake with a head at each end of its body. Snakes are a common motif among recently found geoglyphs.', name: '双頭のヘビ', size: 48, shape: twoHeadSnake,
    desc: '胴の両端に頭をもつヘビ。近年の調査で見つかった地上絵にも、ヘビのモチーフが数多く含まれています。' },
  { id: 'llama', nameEn: 'Llama (camelid)', descEn: 'A camelid, the animal that supported life in the Andes. Geoglyphs of llama-like animals have been found too.', name: 'リャマ（ラクダ科）', size: 40, shape: llama,
    desc: 'アンデスの暮らしを支えたラクダ科の動物。リャマのような動物を描いた地上絵も見つかっています。' },
  { id: 'family', nameEn: 'The "Family" of Palpa', descEn: 'Figures on a hillside in Palpa, north of Nazca. They stand in a row with rays coming from their heads, and are called the "Family".', name: 'パルパの「家族」', size: 48, shape: palpaFamily,
    desc: 'ナスカの北、パルパの丘の斜面に描かれた人物たち。頭から光のような線がのびた姿が並び「家族」と呼ばれます。' },
  { id: 'candelabra', nameEn: 'Paracas Candelabra', descEn: 'A huge candelabra-like figure on a sandy slope of the Paracas Peninsula, on the coast of Peru. It can be seen from the sea.', name: 'パラカスの燭台', size: 60, shape: candelabra,
    desc: 'ペルーの海岸、パラカス半島の砂の斜面に描かれた燭台（カンデラブラ）のような巨大な絵。海の上から見ることができます。' },
  { id: 'trapezoid', nameEn: 'Trapezoid', descEn: 'Nazca has many huge trapezoids and triangles, some of them hundreds of meters long.', name: '台形', size: 56, shape: trapezoid,
    desc: 'ナスカには巨大な台形や三角形の図形も数多く、中には長さ数百mにおよぶものもあります。' },
  { id: 'needle', nameEn: 'Needle and Thread', descEn: 'A long needle with a thread-like line. Many Nazca figures still keep the mystery of why they were drawn.', name: '針と糸', size: 40, shape: needleThread,
    desc: '細長い針と、そこから続く糸のような線を思わせる図形。ナスカには何のために描かれたのか謎めいた図形がたくさんあります。' },
];

// 表示中の言語の名前・説明（i18n.js の I18N.lang に合わせる）
export const gName = g => (window.I18N && I18N.lang === 'en' ? g.nameEn : g.name);
export const gDesc = g => (window.I18N && I18N.lang === 'en' ? g.descEn : g.desc);

// 正規化した線データを付与
for (const g of GLYPHS) {
  const paths = g.shape();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of paths) for (const [x, y] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, s = 2 / Math.max(x1 - x0, y1 - y0);
  g.paths = paths.map(p => p.map(([x, y]) => [(x - cx) * s, (y - cy) * s]));
}

// 線画をキャンバスに描く
export function drawGlyph(ctx, g, N, opt = {}) {
  const m = N * (opt.margin ?? 0.06), s = N / 2 - m;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const stroke = () => {
    for (const p of g.paths) {
      ctx.beginPath();
      p.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, N / 2 + x * s, N / 2 + y * s));
      ctx.stroke();
    }
  };
  if (opt.outline) { ctx.strokeStyle = opt.outline; ctx.lineWidth = opt.width * 2.4; stroke(); }
  ctx.strokeStyle = opt.color || '#fff'; ctx.lineWidth = opt.width; stroke();
}
