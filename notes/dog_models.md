# Three.js用 リアル寄り犬3Dモデル（glTF/GLB）調査メモ

書式: `犬種 / 直接DLのURL / ライセンス / 作者 / アニメーション名 / リアルさ(1-5)`

1. ハスキー (Husky) / https://static.poly.pizza/611d25c7-430f-4bb5-ab2c-d8f5f3cb9712.glb / CC0 1.0 / Quaternius / AnimalArmature系12種以上（Idle, Idle_2, Walk, Gallop, Eating, Attack, Death 等） / 2
2. 柴犬 (Shiba Inu) / https://static.poly.pizza/ba6d0ee3-bcc0-4ef0-9d3c-a3e245b41c77.glb / CC0 1.0 / Quaternius / AnimalArmature系12種以上（Idle, Idle_2, Walk, Gallop, Eating, Attack, Death 等） / 2
3. ビーグル (Beagle) / https://static.poly.pizza/75de184c-31e8-4343-8ce3-ffaaf256c32e.glb / CC-BY 3.0 / Poly by Google / なし（静止モデル） / 2
4. コーギー (Corgi) / https://static.poly.pizza/152ff42e-dc8f-4e84-b129-ef54fadf8916.glb / CC-BY 3.0 / madtrollstudio / なし（静止モデル） / 2
5. プードル (Poodle) / https://static.poly.pizza/421e8fcb-9053-40e6-9cc2-0919ca8bc8f8.glb / CC-BY 3.0 / Poly by Google / なし（静止モデル） / 2
6. 犬・汎用 (Dog) / https://static.poly.pizza/4b21c628-19ae-40e0-b23e-f00ab684b001.glb / CC-BY 3.0 / Poly by Google / なし（静止モデル） / 2
7. 柴犬・動作拡張版 (Shiba Inu - Extended) / https://raw.githubusercontent.com/lhns/steam-frame-nix/main/modules/pet/models/shiba/model.glb / CC0 1.0 / Quaternius（改変: lhns） / AnimalArmature系基本クリップ＋追加（sitting, lying down, sleeping, held-by-the-scruff, wagging tail, breathing） / 2
8. 柴犬・別造形 (Shiba Inu) / https://static.poly.pizza/7a55c0e1-bf30-483b-9bf4-f499580834d6.glb / CC-BY 3.0 / Pat Siefring / なし（静止モデル） / 2

## 補足メモ
- **GitHub Rawミラー（Cloudflare回避用）**: `static.poly.pizza` は自動取得時にCloudflare制限がかかることがあるため、#1・#2（Quaternius製CC0）は以下のGitHub Raw直リンクも利用可能（実在確認済み）:
  - ハスキー: https://raw.githubusercontent.com/trebeljahr/quaternius-showcase/main/public/glb/animals_pack/Husky.glb
  - 柴犬: https://raw.githubusercontent.com/trebeljahr/quaternius-showcase/main/public/glb/animals_pack/ShibaInu.glb
- **リアルさ（4〜5）のモデルについての調査所見**:
  - ログイン不要の直接DL URL（GitHub raw / jsDelivr / Poly Pizza / Khronos / three.js examples等）かつ CC0/CC-BY 条件を同時に満たす犬のglTF/GLBは、実在確認できた範囲ではすべてローポリ寄り（リアルさ 2/5）でした。
  - よりリアル寄り・高品質アニメーション付きのCC-BY犬モデル（例: Sketchfab の CC-BY 4.0 モデル、Blender Studio の *Project Dogwalk*「Chocomel」等）は、ダウンロードにログインやサブスクリプションが必要なため条件外として除外しています。
  - Poly Pizza 上には他にも *3 Dreams of Black*（Google Data Arts Team, CC-BY）の Golden Retriever / Running Chow Chow や、Quaternius の German Shepard（`https://poly.pizza/m/Hssa6NPc6W`）、Workshop apelab の Pug（`https://poly.pizza/m/f1YBNg2R0nj`）等が存在しますが、直接DL用の `static.poly.pizza/<UUID>.glb` を検索結果から実在確認できなかったため本リストには含めていません（ブラウザからモデルページを開けばログイン不要でGLB取得可能）。
