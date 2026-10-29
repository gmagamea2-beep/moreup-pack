// priority: 5
// ============================================================
// More Up: 컷씬 애니메이션 (2026-10-29, 1.5.4)
// 경로: kubejs/server_scripts/story/cutscene_anims.js   엔진: cutscene.js   대본: cutscene_scenes.js
//
// 방식: KubeJS Painter 2D 모션 그래픽. 서버가 2틱마다 그 플레이어 화면의 그림 오브젝트(위치·크기·색·회전)를 바꿔 보내
//       움직이는 그림을 만든다. 클라이언트 모드 추가 없음, 화면 그림이라 월드·다른 플레이어에게 영향 없음.
//   - 그림 재료: 흰색 스프라이트 PNG(kubejs/assets/moreup/textures/cutscene/*.png, 색은 그릴 때 입힘)와 아이템 아이콘
//   - 대본의 단계에 anim: '<이름>' 을 붙이면 그 단계(내레이션)가 나오는 동안 재생한다. 장면에 ambient: 'stars' 면 배경 별빛
//   - 좌표: 화면 가운데 기준 GUI 픽셀. 아래 띠(내레이션)와 겹치지 않게 MOREUP_CS_ANIM_CY 만큼 위에 그린다
//
// 애니메이션 정의: { objects: 개수, make(i, st) → 처음 오브젝트(type 등), frame(i, k, e, st) → 바꿀 속성, layer(i) → 그리는 층, cues: [{ at, sound, particle }] }
//   st = 재생 상태 (st.scene.accent 로 장면 색을 쓴다)
//   그리는 순서: 한 번에 보낸 오브젝트끼리는 순서가 뒤섞인다(NBT 가 HashMap). 그래서 엔진이 layer 낮은 것부터 따로 보내 아래에 깔리게 한다
//   k = 그 단계 안에서의 진행 0~1, e = 그 단계가 시작된 뒤 지난 틱
//   아이템 아이콘은 투명도를 못 바꿔서 visible 로 나타나고 사라진다. 아이콘 rotation 단위는 라디안(Painter ItemObject)
// ============================================================

const MOREUP_CS_ANIM_CY = -18
const MOREUP_CS_TAU = 6.283185307179586          // Math.PI 가 KubeJS 6 에서 undefined
const MOREUP_CS_TEX = {
    glow: 'moreup:textures/cutscene/glow.png',
    dot: 'moreup:textures/cutscene/dot.png',
    star: 'moreup:textures/cutscene/star.png',
    ring: 'moreup:textures/cutscene/ring.png',
    shard: 'moreup:textures/cutscene/shard.png',
    beam: 'moreup:textures/cutscene/beam.png',
    flare: 'moreup:textures/cutscene/flare.png',
    cardFront: 'moreup:textures/cutscene/card_front.png',
    cardBack: 'moreup:textures/cutscene/card_back.png'
}

// ---------------------------------------------------------- 도구

function moreupCsClamp01(x) { return Math.max(0, Math.min(1, x)) }
function moreupCsWin(k, a, b) { return moreupCsClamp01((k - a) / (b - a)) }
function moreupCsOut(x) { let y = 1 - moreupCsClamp01(x); return 1 - y * y * y }
function moreupCsInOut(k, fadeIn, fadeOut) { return moreupCsClamp01(Math.min(k / fadeIn, (1 - k) / fadeOut)) }
// 살짝 넘쳤다가 돌아오는 확대 (ease-out-back)
function moreupCsBack(x) { let t = moreupCsClamp01(x) - 1; return 1 + t * t * (2.2 * t + 1.2) }

function moreupCsSprite(tex) {
    return { type: 'rectangle', texture: MOREUP_CS_TEX[tex], w: 1, h: 1, alignX: 'center', alignY: 'center', x: 0, y: MOREUP_CS_ANIM_CY, color: '#00FFFFFF', draw: 'always' }
}

function moreupCsIcon(item) {
    return { type: 'item', item: item, w: 16, h: 16, alignX: 'center', alignY: 'center', x: 0, y: MOREUP_CS_ANIM_CY, visible: false, draw: 'always' }
}

// 스프라이트 한 장의 위치·크기·색. 투명도 4 미만은 마인크래프트가 불투명으로 그리므로 아예 0 으로 둔다
function moreupCsSpr(x, y, size, alpha, rgb) {
    let a = alpha < 4 ? 0 : alpha
    let s = Math.max(1, Math.round(size))
    return { x: Math.round(x), y: Math.round(MOREUP_CS_ANIM_CY + y), w: s, h: s, color: moreupCsColor(a, rgb) }
}

function moreupCsLerpRgb(a, b, t) {
    let out = ''
    for (let i = 0; i < 3; i++) {
        let va = parseInt(a.substring(i * 2, i * 2 + 2), 16)
        let vb = parseInt(b.substring(i * 2, i * 2 + 2), 16)
        out += moreupCsHex2(va + (vb - va) * t)
    }
    return out
}

// 용 모양 별자리 (꼬리 → 머리)
const MOREUP_CS_DRAGON = [[-120, 34], [-82, 12], [-46, 24], [-10, -2], [26, -22], [62, -10], [98, -40]]
const MOREUP_CS_DRAGON_DOTS = 5

// ---------------------------------------------------------- 애니메이션

const MOREUP_CS_ANIMS = {
    // 거대한 빛의 용: 큰 빛이 숨 쉬듯 커졌다 작아진다
    breath: {
        objects: 2,
        layer: i => i,
        make: i => moreupCsSprite('glow'),
        frame: (i, k, e) => {
            let pulse = 0.86 + 0.14 * Math.sin(e * 0.12)
            let a = moreupCsInOut(k, 0.15, 0.2)
            return i === 0 ? moreupCsSpr(0, 0, 120 * pulse, 210 * a, 'FFE27A') : moreupCsSpr(0, 0, 44 * pulse, 240 * a, 'FFFFFF')
        }
    },
    // 정체된 우주: 빛이 작아지며 차가운 색으로 식는다
    cooling: {
        objects: 1,
        make: i => moreupCsSprite('glow'),
        frame: (i, k, e) => moreupCsSpr(0, 0, 118 - 58 * moreupCsOut(k), (200 - 80 * k) * moreupCsInOut(k, 0.08, 0.2), moreupCsLerpRgb('FFE27A', '8FA3BF', moreupCsOut(k)))
    },
    // 용이 스스로를 부순다: 빛이 부풀어 떨리다 번쩍이며 일곱 파편으로 흩어진다
    shatter: {
        objects: 9,
        layer: i => i === 1 ? 2 : i === 0 ? 0 : 1,
        make: i => i === 1
            ? { type: 'rectangle', x: 0, y: 0, w: '$screenW', h: '$screenH', color: '#00FFFFFF', draw: 'always' }
            : moreupCsSprite(i === 0 ? 'glow' : 'star'),
        cues: [{ at: 0.38, sound: ['minecraft:entity.generic.explode', 0.45, 0.6] }],
        frame: (i, k, e) => {
            if (i === 0) {
                if (k < 0.38) {
                    let g = moreupCsOut(k / 0.38)
                    return moreupCsSpr(Math.sin(e * 1.3) * 4 * g, 0, 40 + 70 * g, 235, 'FFF3B0')
                }
                let s = moreupCsWin(k, 0.38, 0.5)
                return moreupCsSpr(0, 0, 110 * (1 - s), 235 * (1 - s), 'FFF3B0')
            }
            if (i === 1) {
                let f = k < 0.38 ? 0 : 220 * (1 - moreupCsWin(k, 0.38, 0.52))
                return { color: moreupCsColor(f < 4 ? 0 : f, 'FFFFFF') }
            }
            let n = i - 2
            let ang = n * MOREUP_CS_TAU / 7 - MOREUP_CS_TAU / 4
            let p = moreupCsOut(moreupCsWin(k, 0.38, 0.85))
            let dist = 8 + 125 * p
            let a = k < 0.38 ? 0 : 255 * (1 - moreupCsWin(k, 0.78, 1))
            return moreupCsSpr(Math.cos(ang) * dist, Math.sin(ang) * dist * 0.72, 20 - 6 * p, a, 'FFF3B0')
        }
    },
    // 일곱 파편이 흩어진다: 별똥별 일곱 개가 차례로 떨어진다 (별 + 꼬리)
    starfall: {
        objects: 14,
        make: i => moreupCsSprite(i < 7 ? 'star' : 'dot'),
        frame: (i, k, e) => {
            let n = i % 7
            let lag = i < 7 ? 0 : 0.05
            let t0 = n * 0.08
            let p = moreupCsWin(k, t0 + lag, t0 + lag + 0.45)
            let x0 = -160 + n * 40
            let x = x0 + 70 * p
            let y = -70 + 120 * p * p
            let a = p <= 0 || p >= 1 ? 0 : 255 * (1 - moreupCsWin(p, 0.8, 1))
            return i < 7 ? moreupCsSpr(x, y, 18, a, 'CFE8FF') : moreupCsSpr(x, y, 8, a * 0.6, '9FC6FF')
        }
    },
    // 일곱 영혼이 눈을 뜬다: 일곱 빛이 하나씩 켜진다
    awaken: {
        objects: 7,
        make: i => moreupCsSprite('glow'),
        frame: (i, k, e) => {
            let t0 = 0.08 + i * 0.09
            let on = moreupCsOut(moreupCsWin(k, t0, t0 + 0.12))
            let boost = 1 + 0.35 * moreupCsWin(k, 0.82, 0.92)
            let a = 235 * on * (1 - moreupCsWin(k, 0.92, 1))
            return moreupCsSpr((i - 3) * 34, 0, (26 + 4 * Math.sin(e * 0.2 + i)) * boost, a, 'AEEFFF')
        }
    },
    // 첫 번째 파편이 진동한다
    tremor: {
        objects: 2,
        layer: i => i,
        make: i => moreupCsSprite(i === 0 ? 'glow' : 'shard'),
        frame: (i, k, e) => {
            let a = moreupCsInOut(k, 0.12, 0.2)
            let shake = Math.sin(e * 2.1) * 3.5 * (1 - k * 0.6)
            return i === 0 ? moreupCsSpr(0, 0, 70 + 12 * Math.sin(e * 0.3), 170 * a, 'B48CFF') : moreupCsSpr(shake, 0, 30, 255 * a, 'E6D9FF')
        }
    },
    // 강철의 뼈대와 톱니바퀴: 톱니바퀴 셋이 맞물려 돈다
    gears: {
        objects: 4,
        layer: i => i === 0 ? 0 : 1,
        make: i => i === 0 ? moreupCsSprite('glow')
            : moreupCsIcon(i === 1 ? 'create:large_cogwheel' : 'create:cogwheel'),
        frame: (i, k, e) => {
            if (i === 0) return moreupCsSpr(0, 4, 130, 120 * moreupCsInOut(k, 0.12, 0.15), 'FFAA00')
            let show = k > 0.04 * i && k < 0.97
            let spec = [null, [0, 0, 56, 0.06], [-48, -8, 34, -0.11], [48, 10, 34, -0.11]][i]
            return { visible: show, x: spec[0], y: MOREUP_CS_ANIM_CY + spec[1], w: spec[2], h: spec[2], rotation: e * spec[3] + (i === 3 ? 0.3 : 0) }
        }
    },
    // 권능이 차원으로 흩어진다: 빛의 고리 둘레를 엔더의 눈이 돈다
    portal: {
        objects: 7,
        layer: i => i === 0 ? 0 : 1,
        make: i => i === 0 ? moreupCsSprite('ring') : moreupCsIcon('minecraft:ender_eye'),
        frame: (i, k, e) => {
            if (i === 0) return moreupCsSpr(0, 0, 74 + 10 * Math.sin(e * 0.15), 220 * moreupCsInOut(k, 0.1, 0.15), 'AA77FF')
            let ang = e * 0.05 + (i - 1) * MOREUP_CS_TAU / 6
            let depth = (Math.sin(ang) + 1) / 2
            let size = Math.round(12 + 10 * depth)
            return { visible: k > 0.05 && k < 0.95, x: Math.round(Math.cos(ang) * 78), y: Math.round(MOREUP_CS_ANIM_CY + Math.sin(ang) * 22), w: size, h: size }
        }
    },
    // 일곱 갈래의 톱니바퀴: 일곱 별이 원을 그리며 돌고, 하나씩 붉게 켜진다
    seven: {
        objects: 8,
        make: i => moreupCsSprite(i === 7 ? 'ring' : 'star'),
        frame: (i, k, e) => {
            let fade = moreupCsInOut(k, 0.08, 0.15)
            let lit = Math.floor(moreupCsWin(k, 0.1, 0.8) * 7 + 0.0001)
            if (i === 7) return moreupCsSpr(0, 0, 40 + lit * 6, (90 + lit * 20) * fade, 'FF5555')
            let ang = i * MOREUP_CS_TAU / 7 + e * 0.02
            let on = i < lit
            return moreupCsSpr(Math.cos(ang) * 58, Math.sin(ang) * 42, on ? 22 : 14, (on ? 255 : 90) * fade, on ? 'FF7777' : 'AAAAAA')
        }
    },
    // 황혼의 군주: 검은 원이 태양을 가리며 보랏빛 코로나가 번진다
    eclipse: {
        objects: 3,
        layer: i => i,
        make: i => moreupCsSprite(i === 0 ? 'glow' : i === 1 ? 'ring' : 'dot'),
        frame: (i, k, e) => {
            let fade = moreupCsInOut(k, 0.1, 0.12)
            let cover = moreupCsOut(moreupCsWin(k, 0.1, 0.7))
            if (i === 0) return moreupCsSpr(0, 0, 96, 220 * fade * (1 - 0.5 * cover), 'FFD27A')
            if (i === 1) return moreupCsSpr(0, 0, 70 + 8 * Math.sin(e * 0.2), 230 * fade * cover, 'DD66DD')
            return moreupCsSpr(-95 * (1 - cover), 0, 62, 255 * fade, '000000')
        }
    },
    // 일곱 궤적이 새로운 빛의 성룡을 그린다: 별이 하나씩 켜지고 점선으로 이어져 용 모양 별자리가 된다
    constellation: {
        objects: 7 + (MOREUP_CS_DRAGON.length - 1) * MOREUP_CS_DRAGON_DOTS + 1,
        make: i => moreupCsSprite(i < 7 ? 'star' : 'dot'),
        frame: (i, k, e) => {
            let fade = 1 - moreupCsWin(k, 0.93, 1)
            let total = 7 + (MOREUP_CS_DRAGON.length - 1) * MOREUP_CS_DRAGON_DOTS
            if (i < 7) {
                let p = MOREUP_CS_DRAGON[i]
                let on = moreupCsOut(moreupCsWin(k, 0.05 + i * 0.07, 0.12 + i * 0.07))
                let tw = 1 + 0.15 * Math.sin(e * 0.25 + i * 1.7)
                return moreupCsSpr(p[0], p[1], 20 * tw, 255 * on * fade, 'FFE9A0')
            }
            if (i < total) {
                let n = i - 7
                let seg = Math.floor(n / MOREUP_CS_DRAGON_DOTS)
                let d = (n % MOREUP_CS_DRAGON_DOTS + 1) / (MOREUP_CS_DRAGON_DOTS + 1)
                let a = MOREUP_CS_DRAGON[seg], b = MOREUP_CS_DRAGON[seg + 1]
                let t0 = 0.18 + seg * 0.08 + d * 0.06
                let on = moreupCsWin(k, t0, t0 + 0.04)
                return moreupCsSpr(a[0] + (b[0] - a[0]) * d, a[1] + (b[1] - a[1]) * d, 6, 200 * on * fade, 'FFD700')
            }
            // 마지막: 별자리 전체가 한 번 크게 빛난다
            let glow = moreupCsWin(k, 0.72, 0.82) * (1 - moreupCsWin(k, 0.85, 1))
            return moreupCsSpr(-10, -2, 260, 150 * glow, 'FFD700')
        }
    },
    // 일곱 각자가 별이 되어 떠오른다
    ascend: {
        objects: 7,
        make: i => moreupCsSprite('glow'),
        frame: (i, k, e) => {
            let t0 = i * 0.07
            let p = moreupCsWin(k, t0, t0 + 0.6)
            let x = (i - 3) * 38 + Math.sin(e * 0.08 + i) * 6
            let y = 55 - 120 * moreupCsOut(p)
            let a = p <= 0 ? 0 : 240 * moreupCsClamp01(p * 6) * (1 - moreupCsWin(p, 0.75, 1))
            return moreupCsSpr(x, y, 26 + 6 * Math.sin(e * 0.3 + i), a, i % 2 === 0 ? 'FFE9A0' : 'FFFFFF')
        }
    },
    // 다시 팽창하는 우주: 빛의 고리가 연달아 퍼져 나간다
    expand: {
        objects: 3,
        make: i => moreupCsSprite('ring'),
        frame: (i, k, e) => {
            let p = moreupCsWin(k, i * 0.2, i * 0.2 + 0.6)
            let a = p <= 0 || p >= 1 ? 0 : 220 * (1 - p)
            return moreupCsSpr(0, 0, 10 + 230 * moreupCsOut(p), a, '55FF55')
        }
    }
}

// ---------------------------------------------------------- 배경 별빛 (장면 전체)

const MOREUP_CS_AMBIENTS = {
    stars: {
        objects: 14,
        // 화면 비율로 흩어 둔다 (가운데 기준, 위아래 영화 띠 안쪽). 같은 장면은 늘 같은 자리
        make: i => {
            let fx = Math.sin(i * 12.9898) * 0.46
            let fy = -0.3 + ((Math.sin(i * 78.233) + 1) / 2) * 0.5
            let ex = (v, axis) => v < 0 ? `0-$${axis}*${(-v).toFixed(3)}` : `$${axis}*${v.toFixed(3)}`
            return { type: 'rectangle', texture: MOREUP_CS_TEX.dot, w: 4, h: 4, alignX: 'center', alignY: 'center', x: ex(fx, 'screenW'), y: ex(fy, 'screenH'), color: '#00FFFFFF', draw: 'always' }
        },
        frame: (i, e) => {
            let tw = (Math.sin(e * (0.06 + (i % 5) * 0.015) + i * 2.1) + 1) / 2
            let size = 3 + (i % 3)
            return { w: size, h: size, color: moreupCsColor(40 + 130 * tw, i % 4 === 0 ? 'FFE9A0' : 'DDEEFF') }
        }
    }
}

// ---------------------------------------------------------- 빛기둥 마법진 (1.5.4, 사용자 참고 영상의 분위기를 따른 독자 디자인)
// 하늘에서 내려오는 빛기둥 + 그 둘레에 겹겹이 뜬 원근 고리 3개(가운데 룬 띠 고리 A, 위·아래 가벼운 고리 B)
// - 고리는 3D 로 미리 그린 회전 프레임 PNG(textures/cutscene/ring/, 10장 = 30도 주기)를 바꿔 끼워 돌아가게 한다
//   (Painter 사각형은 회전이 안 된다). 고리 그림 생성기: MoreUp/textures_src/gen_cutscene_rings.ps1
// - 고리마다 뒤쪽 반/앞쪽 반을 나눠 뒤쪽 → 빛기둥 → 앞쪽 순서로 그려 기둥이 고리를 꿰뚫는 깊이감을 낸다
// - 빛 표현: 번지는 빛(glow, 장면 색) 위에 선명한 심(core, 흰색에 가까운 색)을 겹친다
// 소환: 빛기둥이 위에서 내려오고 → 고리가 가운데·위·아래 순서로 살짝 넘치며 펼쳐짐 / 유지: 위아래 고리는 서로 반대로 회전
// 소멸(0.86~1): 고리가 커지며 사라지고 기둥이 가늘어진다

const MOREUP_CS_RING_FRAMES = 10
const MOREUP_CS_RING_ASPECT = 240 / 512            // 고리 텍스처 세로/가로
const MOREUP_CS_RING_CENTER = 0.58                 // 텍스처 안에서 고리 중심의 세로 위치 (생성기 Cy)
// [종류, 가운데 기준 y, 너비, 밝기, 회전 방향, 나타나는 시작 k]
const MOREUP_CS_PILLAR_RINGS = [['a', 2, 280, 1.0, 1, 0.12], ['b', -60, 150, 0.7, -1, 0.18], ['b', 66, 190, 0.85, -1, 0.24]]
const MOREUP_CS_PILLAR_SPARKS = 10
const MOREUP_CS_PILLAR_COUNT = MOREUP_CS_PILLAR_RINGS.length * 4 + 3 + MOREUP_CS_PILLAR_SPARKS

function moreupCsRingTex(kind, side, part, frame) {
    let f = ((frame % MOREUP_CS_RING_FRAMES) + MOREUP_CS_RING_FRAMES) % MOREUP_CS_RING_FRAMES
    return `moreup:textures/cutscene/ring/ring${kind}_${side}_${part}_${f < 10 ? '0' + f : f}.png`
}

// 오브젝트 번호: [0~2] 뒤 빛, [3~5] 뒤 심, 6 빛기둥, 7 가운데 섬광, 8 아래 지평선 빛, [9~11] 앞 빛, [12~14] 앞 심, 그 뒤 반짝이
function moreupCsPillarSlot(i) {
    let n = MOREUP_CS_PILLAR_RINGS.length
    if (i < n * 2) return { ring: i % n, side: 'back', part: i < n ? 'glow' : 'core', layer: i < n ? 0 : 1 }
    if (i < n * 2 + 3) return { extra: i - n * 2, layer: 2 }
    let j = i - (n * 2 + 3)
    if (j < n * 2) return { ring: j % n, side: 'front', part: j < n ? 'glow' : 'core', layer: j < n ? 3 : 4 }
    return { spark: j - n * 2, layer: 5 }
}

function moreupCsPillarMake(i) {
    let slot = moreupCsPillarSlot(i)
    if (slot.spark != null) return moreupCsSprite(slot.spark % 3 === 0 ? 'star' : 'dot')
    if (slot.extra != null) return moreupCsSprite(slot.extra === 0 ? 'beam' : 'flare')
    let r = MOREUP_CS_PILLAR_RINGS[slot.ring]
    let o = moreupCsSprite('glow')
    o.texture = moreupCsRingTex(r[0], slot.side, slot.part, 0)
    return o
}

// scale: 전체 크기 배율, cy: 세로 위치 이동
function moreupCsPillarFrame(i, k, e, rgb, scale, cy) {
    let slot = moreupCsPillarSlot(i)
    let gone = moreupCsWin(k, 0.86, 1)
    let coreRgb = moreupCsLerpRgb(rgb, 'FFFFFF', 0.8)
    let beamRgb = moreupCsLerpRgb(rgb, 'FFFFFF', 0.65)
    let base = cy - MOREUP_CS_ANIM_CY
    if (slot.spark != null) {
        // 빛기둥을 따라 떠오르는 반짝이
        let n = slot.spark
        let period = 46 + (n % 4) * 9
        let p = ((e + n * 17) % period) / period
        let x = (Math.sin(n * 7.3) * 46 + Math.sin(e * 0.05 + n) * 6) * scale
        let y = base + (70 - 150 * p) * scale
        let a = 220 * Math.sin(p * MOREUP_CS_TAU / 2) * moreupCsWin(k, 0.25, 0.4) * (1 - gone)
        return moreupCsSpr(x, y, (n % 3 === 0 ? 9 : 4) * scale, a, n % 2 === 0 ? coreRgb : rgb)
    }
    if (slot.extra === 0) {
        // 빛기둥: 화면 위쪽 끝에서 아래로 내려온다 (가운데 정렬이라 높이의 절반만큼 내려 둔다)
        let drop = moreupCsOut(moreupCsWin(k, 0, 0.18))
        let h = Math.max(1, Math.round(300 * drop))
        // 제목 글자를 가로지르므로 너무 밝지 않게 (글자가 읽히도록 폭·밝기를 억제)
        let w = Math.max(1, Math.round((32 + 3 * Math.sin(e * 0.3)) * scale * (1 - 0.85 * gone)))
        let ba = 190 * (1 - gone)
        return { x: 0, y: Math.round(-150 + h / 2), w: w, h: h, color: moreupCsColor(ba < 4 ? 0 : ba, beamRgb) }
    }
    if (slot.extra === 1) {
        // 기둥이 가운데 고리를 꿰뚫는 자리의 가로 섬광: 고리가 펼쳐질 때 번쩍였다가 은은하게
        let flash = moreupCsWin(k, 0.12, 0.16) * (1 - moreupCsWin(k, 0.16, 0.32))
        let a = (120 + 135 * flash) * moreupCsWin(k, 0.1, 0.14) * (1 - gone)
        let r0 = MOREUP_CS_PILLAR_RINGS[0]
        return { x: 0, y: Math.round(MOREUP_CS_ANIM_CY + base + r0[1] * scale), w: Math.round((220 + 120 * flash) * scale), h: Math.round(26 * scale), color: moreupCsColor(a < 4 ? 0 : a, coreRgb) }
    }
    if (slot.extra === 2) {
        let a = 130 * moreupCsWin(k, 0.15, 0.3) * (1 - gone)
        return { x: 0, y: Math.round(MOREUP_CS_ANIM_CY + base + 100 * scale), w: Math.round(420 * scale), h: Math.round(24 * scale), color: moreupCsColor(a < 4 ? 0 : a, rgb) }
    }
    let r = MOREUP_CS_PILLAR_RINGS[slot.ring]
    let open = moreupCsBack(moreupCsWin(k, r[5], r[5] + 0.18))
    let s = Math.max(0.02, (0.55 + 0.45 * open) * (1 + 0.18 * gone)) * scale
    let A = moreupCsWin(k, r[5], r[5] + 0.08) * (1 - gone) * r[3]
    let w = Math.round(r[2] * s)
    let h = Math.round(r[2] * s * MOREUP_CS_RING_ASPECT)
    let frame = Math.floor(e / MOREUP_CS_UPDATE_EVERY) * r[4]
    let glow = slot.part === 'glow'
    let a = (glow ? 235 : 255) * A
    // 텍스처 안의 고리 중심이 가운데보다 아래(0.58)에 있어서 그만큼 올려 맞춘다
    let y = MOREUP_CS_ANIM_CY + base + r[1] * scale - (MOREUP_CS_RING_CENTER - 0.5) * h
    return { x: 0, y: Math.round(y), w: Math.max(1, w), h: Math.max(1, h), texture: moreupCsRingTex(r[0], slot.side, slot.part, frame), color: moreupCsColor(a < 4 ? 0 : a, glow ? rgb : coreRgb) }
}

// 제목 카드 뒤 빛기둥 마법진 (모든 장면의 제목에 자동으로 붙는다, cutscene.js MOREUP_CS_TITLE_ANIM)
MOREUP_CS_ANIMS.pillar = {
    objects: MOREUP_CS_PILLAR_COUNT,
    layer: i => moreupCsPillarSlot(i).layer,
    make: moreupCsPillarMake,
    frame: (i, k, e, st) => moreupCsPillarFrame(i, k, e, (st && st.scene.accent) || '6E8CFF', 1, 0),
    cues: [{ at: 0.01, sound: ['minecraft:block.beacon.activate', 0.5, 1.6] }, { at: 0.13, sound: ['minecraft:block.amethyst_block.resonate', 0.8, 1.2] }]
}

// 일곱 장의 마법 카드: 빛기둥 마법진 둘레를 카드 일곱 장이 돌다가 차례로 뒤집히며 앞면이 빛난다 (4막 "분업하고 연대하십시오")
// 카드는 마법진 뒤쪽 반과 앞쪽 반 사이 층에 그려 고리 사이를 지나가는 것처럼 보인다
const MOREUP_CS_CARDS = 7
MOREUP_CS_ANIMS.arcana = {
    objects: MOREUP_CS_PILLAR_COUNT + MOREUP_CS_CARDS * 2,
    layer: i => i < MOREUP_CS_PILLAR_COUNT ? moreupCsPillarSlot(i).layer : 2.5,
    make: i => {
        if (i < MOREUP_CS_PILLAR_COUNT) return moreupCsPillarMake(i)
        return moreupCsSprite(i < MOREUP_CS_PILLAR_COUNT + MOREUP_CS_CARDS ? 'glow' : 'cardBack')
    },
    cues: [0, 1, 2, 3, 4, 5, 6].map(n => ({ at: 0.2 + n * 0.085, sound: ['minecraft:item.book.page_turn', 0.9, 1.3 + n * 0.05] })),
    frame: (i, k, e, st) => {
        let rgb = (st && st.scene.accent) || 'FFFFFF'
        if (i < MOREUP_CS_PILLAR_COUNT) return moreupCsPillarFrame(i, k, e, rgb, 0.72, -10)
        let glowCard = i < MOREUP_CS_PILLAR_COUNT + MOREUP_CS_CARDS
        let n = (i - MOREUP_CS_PILLAR_COUNT) % MOREUP_CS_CARDS
        let fade = moreupCsWin(k, 0.05 + n * 0.02, 0.14 + n * 0.02) * (1 - moreupCsWin(k, 0.9, 1))
        let ang = n * MOREUP_CS_TAU / MOREUP_CS_CARDS + e * 0.012
        let depth = (Math.sin(ang) + 1) / 2
        let size = 0.72 + 0.42 * depth
        let x = Math.cos(ang) * 118
        let y = -10 + Math.sin(ang) * 32 - MOREUP_CS_ANIM_CY
        let t0 = 0.2 + n * 0.085
        let f = moreupCsWin(k, t0, t0 + 0.05)
        let flip = Math.abs(Math.cos(f * MOREUP_CS_TAU / 2))
        let front = f >= 0.5
        if (glowCard) return moreupCsSpr(x, y, 46 * size, (front ? 150 : 0) * fade, rgb)
        let w = Math.max(1, Math.round(18 * size * Math.max(0.06, flip)))
        let h = Math.round(27 * size)
        let a = 255 * fade
        return { x: Math.round(x), y: Math.round(MOREUP_CS_ANIM_CY + y), w: w, h: h, texture: front ? MOREUP_CS_TEX.cardFront : MOREUP_CS_TEX.cardBack, color: moreupCsColor(a < 4 ? 0 : a, front ? rgb : 'B8C2DC') }
    }
}