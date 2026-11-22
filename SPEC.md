# 犬観察サイト 設計書

見る人は観察するだけ。操作は「犬種選択」と「音を出す」ボタンだけ。
庭にいる1匹の犬が自分の意思で暮らしていて、カメラが自動で追いかける。

## 技術
- 静的サイト。ビルドなし。`index.html` を開けば動く（ES Modules）。
- Three.js `0.170.0` を importmap で読む:
  ```html
  <script type="importmap">{"imports":{
    "three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
    "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"}}</script>
  ```
- 外部の画像・音声・モデルは使わない。テクスチャはCanvasやシェーダーで、音はWebAudioで生成する。
- 画質優先: `ACESFilmicToneMapping`、`SRGBColorSpace`、PCFSoftShadowMap、影 2048、PMREMで空から環境光、EffectComposer（RenderPass → UnrealBloomPass 弱め → OutputPass）。`devicePixelRatio` は最大2。
- 座標: Y が上、1単位 = 1m。庭は x,z とも -15〜+15。

## ファイルと担当インターフェース

### `src/time.js` — 世界時計
```js
export class WorldClock {
  constructor(speed = 30)          // 現実の30倍。開始時刻 = 現実の現在時刻
  update(realDtSec)                // 世界時間を speed*realDtSec 秒進める
  date                              // Date（世界時刻）
  hours                             // 0〜24 の小数
  dayOfYear                         // 0〜365
  season                            // 'spring'|'summer'|'autumn'|'winter'（日本・北半球。3-5月春,6-8夏,9-11秋,12-2冬）
  seasonWeights                     // {spring,summer,autumn,winter} 合計1。境目の前後10日でなめらかに混ざる
  sunElevation, sunAzimuth          // ラジアン。緯度35度として季節と時刻から計算
  isNight                           // 太陽高度 < -4度
  gameDtFromReal(realDt)            // = realDt*speed（世界秒）
}
```

### `src/environment.js` — 庭・空・季節・天気
```js
export class Garden {
  constructor(scene, renderer)
  update(realDt, clock)             // 空・光・季節の見た目・天気・粒子を更新
  weather                           // 'clear'|'cloudy'|'rain'|'snow'（雪は冬のみ）。世界時間で数時間ごとに季節に応じた確率で変わる。徐々に切り替わる
  weatherIntensity                  // 0〜1
  wetness, snowCover                // 0〜1 地面の濡れ・積雪（ゆっくり増減）
  windStrength                      // 0〜1
  getGroundHeight(x, z)             // 地面の高さ（ゆるい起伏）
  isInside(x, z, margin)            // 歩ける範囲か（柵・家・犬小屋・木・池を避ける）
  randomWalkablePoint()             // {x,z}
  poi                               // 行き先。各値は {x,z} と必要なら向き rotY
    // doghouse(入口の前), doghouseInside(寝る位置), waterBowl, foodBowl,
    // tree(木の根元), flowerbed, porch(縁側), pond(池のほとり), toy(ボール)
  getSunnySpot()                    // 今の太陽で日なたになっている歩ける点 {x,z}（夜・雨は null）
  butterflies                       // Object3D[]（春夏の日中だけ見える。犬が追う）
  birds                             // Object3D[]（地面に降りてくる小鳥。昼のみ）
  fallingThings                     // 花びら/葉/雪/雨 の粒子
  foodLevel                         // 0〜1。世界時刻 7:00 と 18:00 に1へ戻る（誰かがごはんを入れる）
}
```
庭の中身: 一面の芝（InstancedMeshの草の葉 数万本、風で揺れるシェーダー、季節で色: 春は若緑、夏は濃い緑、秋は黄緑〜枯れ色、冬は枯れ色+雪）、北側に和風の家の壁と縁側、木の柵、犬小屋、水入れとごはん皿、大きな木1本（春は桜で満開→葉桜、夏は濃い緑、秋は紅葉、冬は枝だけ）、花壇（春はチューリップ、夏はひまわり、秋はコスモス、冬は土）、小さな池、ボール、飛び石。
空: three/addons の Sky + 時刻で太陽、夜は星と月、夕焼け。曇り・雨では暗く。霧（Fog）も天気で変える。
夜は縁側の灯りと庭の灯篭がともる（PointLight、影なし）。

### `src/dog/breeds.js` — 犬種データ
```js
export const BREEDS = [ { id, name(日本語), ...params }, ... ]
```
8種: shiba 柴犬, corgi コーギー, golden ゴールデンレトリバー, labrador ラブラドール, husky ハスキー, dachshund ダックスフンド, poodle トイプードル, beagle ビーグル。
params: 体格(肩高・胴の長さ・胸の太さ・脚の太さ/長さ)、頭(大きさ・マズルの長さと太さ・額の段差)、耳(立ち耳/垂れ耳/折れ耳 と大きさ)、尾(巻き尾/ふさふさ/まっすぐ/短い)、毛(長さ・ふわふわ度・カール)、色(基本色・副色・模様: 裏白/トライカラー/鞍型/単色/マスク)、目の色、性格 {energy, curiosity, laziness, sociability, vocal} 0〜1。

### `src/dog/body.js` — 犬の体を作る
```js
export function buildDog(breed) -> {
  root,                 // Object3D。足元が y=0、+Z が前
  joints,               // 名前付き Object3D: pelvis, spine1, spine2, chest, neck, head, jaw, earL, earR,
                        //  tail1..tail5, 各脚 [shoulder/hip, upper, lower, paw] x4 (FL FR BL BR), eyelidL, eyelidR, tongue
  eyes,                 // 目のメッシュ（瞳がカメラや対象を見る用）
  setFurWetness(w), setSnowOnFur(s), setDirtiness(d)
  dispose()
}
```
作り方: 関節階層（Object3D）に、なめらかな形（LatheGeometryやカプセル、頂点を変形した球）を付ける。継ぎ目が見えないよう部位を重ねる。
毛並み: シェル法（同じ形を少しずつ外側に膨らませた半透明の層 16〜24枚、ノイズで毛の先を抜く、下ほど暗く）。毛の流れの向きと長さは犬種に合わせ、色の模様もシェーダーで塗る（部位ごとの位置で裏白・トライカラーなど）。目は濡れたツヤ（MeshPhysicalMaterial clearcoat）、鼻は湿った黒。
影を落とす/受ける。

### `src/dog/animator.js` — 動き（手続き的アニメーション）
```js
export class DogAnimator {
  constructor(dogParts, breed)
  setGait(speed)          // 0=止まる, ~1.2 歩き, ~3 小走り, ~6 全力疾走（m/s）。歩様を自動で切り替え（walk/trot/gallop）
  setPose(name)           // 'stand'|'sit'|'lie'|'sleepCurl'|'sleepSide'|'bellyUp'|'play_bow'|'sniffGround'|'dig'|'drink'|'eat'|'scratch'|'shake'|'stretch'|'roll'|'howl'|'bark'|'jump'|'pounce'
                          // 姿勢は0.3〜1秒でなめらかに遷移
  lookAt(worldPosOrNull)  // 首と目で見る（体の向きの範囲内で）
  setTail(mode)           // 'wag'|'happyWag'|'relaxed'|'down'|'tucked'
  setEars(mode)           // 'alert'|'relaxed'|'back'
  update(dt)              // 呼吸、まばたき、耳のぴくっ、尻尾、舌（暑い・走った後はハアハア）などの細かい動きも常に入れる
  onEvent                 // (name)=>void。足音 'step'、'bark'、'snore'、'lap'(水を飲む)、'dig'、'shake' のタイミングで呼ぶ
}
```

### `src/dog/brain.js` — 行動の決定（できるだけ複雑に）
```js
export class DogBrain {
  constructor(breed)
  needs     // hunger, thirst, energy, boredom, curiosity, comfort(暑さ寒さ), bladder, social  各0〜1
  mood      // happy, calm, excited, sleepy など
  action    // 今の行動。{ id, label(日本語。画面に出す 例「日なたぼっこ中」) }
  update(worldDt, ctx)  // ctx = { clock, garden, dog(位置・向き), cameraPos, animator }
}
```
- 欲求は世界時間で変化（運動で疲れる・のどが渇く、寝ると回復、ごはんで満腹）。
- 行動は効用スコア（欲求・時刻・季節・天気・性格・直前の行動・ゆらぎ）で選ぶ。行動の途中で強い刺激（蝶、鳥、落ち葉、雷のない雨の降り始め）があれば割り込む。
- 行動は数ステップの小さな流れでできている（例: ごはん = 皿へ歩く → 匂いを嗅ぐ → 食べる → 口のまわりを舐める → 満足してあくび）。
- 行動の例（全部入れる）: うろうろ散歩、匂いを辿る、地面を掘る、ボールで一人遊び、全力ダッシュ（ズーミー）、蝶を追う、鳥に向かって吠える/そっと近づく、舞う葉や花びらを追う、水を飲む、ごはんを食べる、犬小屋で寝る、日なたで昼寝、日陰で涼む（夏）、縁側でくつろぐ、座ってまわりを眺める、伏せてぼーっとする、カメラ(観察者)の方をじっと見て首をかしげる、体をかく、ブルブル体を振る（雨や池のあと）、伸び、あくび、仰向けでごろごろ、木の根元をマーキング、池をのぞきこむ、雪の中ではしゃぐ/雪に顔をつっこむ、雨の日は犬小屋で外を眺める、夜は月に遠吠え（ハスキーは多め）、寝言・寝ながら脚をぴくぴく、ぐるぐる回ってから寝る、土の上で転がる。
- 夜（だいたい22時〜6時）は主に犬小屋で寝て、たまに起きて水を飲む・見回り。早朝と夕方は元気。真夏の昼はぐったり日陰。
- 性格パラメータで行動の頻度が変わる。
- 移動は `garden.isInside` で障害物を避ける簡単な経路（ステアリング + 迂回点）。走るときは加減速をなめらかに。

### `src/dog/dog.js` — まとめ役
```js
export class Dog {
  constructor(scene, garden, breed)  // body, animator, brain を作って庭に置く
  update(realDt, worldDt, ctx)
  position (Vector3), heading (ラジアン), action, animator
  onEvent // 音用に animator.onEvent を中継
  dispose()
}
```
犬種を変えたら、位置・欲求・行動はそのまま引き継いで体だけ作り直す。

### `src/camera.js` — 追いかけカメラ
```js
export class FollowCamera {
  constructor(camera, garden)
  update(realDt, dog)
}
```
犬を画面中央付近にとらえて、ゆっくり回り込む。高さ0.6〜2.5m・距離2.5〜7m を行動に応じて変える（寝ている時は近く低く、走る時は引いて追う）。数十秒ごとにアングルを変える（横・前から・少し俯瞰）。柵・家・木の中に入らない、地面より下に行かない。動きはとてもなめらか（ばね/減衰）。

### `src/audio.js` — 環境音（WebAudioで合成）
```js
export class Soundscape {
  start()                              // ボタンを押したとき
  update(realDt, clock, garden, dog, cameraPos)
  playDogEvent(name, position)          // 'step','bark','snore','lap','dig','shake','pant','howl','whine'
}
```
季節と時刻: 春夏の朝昼は鳥（スズメ・ウグイス風）、夏の昼はセミ、夏秋の夜は虫（コオロギ・鈴虫風）、風（強さに応じて）、雨音、冬は静か。犬の音は距離で音量を変える。全体の音量は控えめ。

### `src/ui.js` + `index.html` + `style.css` + `src/main.js`
- 左上: 世界の日付と時刻「2026年11月21日（土）14:32」と季節・天気のアイコン（例「秋 ☀」）。時刻は滑らかに進む。
- その下: 犬の今の行動「いま: 日なたぼっこ中」。
- 右下: 犬種を選ぶセレクト。右上: 🔇/🔊 音を出すボタン。
- UIは半透明の小さなガラス風パネル。スマホでも崩れない。
- `main.js`: renderer・scene・composer を作り、Garden・Dog・FollowCamera・Soundscape・UI をつないでループ。`realDt` は最大0.1秒に制限。犬種は localStorage に保存（try/catch）。
- 読み込み中は「庭の準備をしています…」を表示。

## 追加仕様: 2匹モード
- UI: 右下に「頭数」切り替え（1匹 / 2匹）。2匹のときは犬種セレクトが2つ（1匹目・2匹目）。初期値は1匹目=保存済み犬種、2匹目=別の犬種。頭数と犬種は localStorage に保存（try/catch）。
- 行動表示: 2匹のときは2行（「柴犬: 日なたぼっこ中」「コーギー: 水を飲んでいる」）。2匹で遊んでいる時は「2匹で追いかけっこ中」のように1行にまとめてもよい。
- `main.js` は `dogs` 配列で管理。頭数を変えたら2匹目を追加/削除（1匹目は位置・状態を保ったまま）。2匹目は1匹目から2〜3m離れた歩ける点に出す。
- `Dog.update(realDt, worldDt, ctx)` の ctx に `others: Dog[]`（自分以外の犬）を追加。Dog は外から `id`（0,1）と `breed` を読めるようにする。
- 衝突しない: dog.js で、ほかの犬の体（半径 = 体長の半分 + 0.1m）を障害物として扱い、移動後に重なっていたら押し戻す（めり込み禁止）。経路の前方チェックでも相手を避ける。寝る場所・水入れ・ごはん皿は片方が使っているときは順番待ち（近くで座って待つ）か別のことをする。
- 社会的な行動（brain.js、2匹のときだけ。相手の行動・欲求・性格から決める。片方が誘って相手が乗るかどうかは相手の気分で決まる。断られることもある）:
  追いかけっこ（交代で追う/逃げる）、取っ組み合い（立ち上がってじゃれる・プレイバウで誘う）、ボールの取り合い、お互いの匂いを嗅ぐ（あいさつ）、並んで日なたぼっこ、くっついて寝る（犬小屋のクッションは1匹分なので、もう1匹は犬小屋の前か縁側の下で寝る）、相手の毛づくろい（顔を舐める）、一緒に鳥や蝶を見つめる、片方が吠えるともう片方もつられて吠える、片方が遊びに夢中で相手は無視して昼寝、など。
  ふだんは別々に行動することも多く、社会的行動は全体の2〜3割程度。
- カメラ: 2匹が近い（6m以内）ときは2匹とも画面に入るように中間点を狙って引く。離れているときは、より動きのある方（または数十秒ごとに交代）を追う。切り替えはなめらかに。
- 音: 2匹とも足音・鳴き声を出す（既存の playDogEvent を両方から呼ぶ）。
