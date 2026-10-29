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
// 애니메이션 정의: { objects: 개수, make(i) → 처음 오브젝트(type 등), frame(i, k, e) → 바꿀 속성, cues: [{ at, sound, particle }] }
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
    shard: 'moreup:textures/cutscene/shard.png'
}

// ---------------------------------------------------------- 도구

function moreupCsClamp01(x) { return Math.max(0, Math.min(1, x)) }
function moreupCsWin(k, a, b) { return moreupCsClamp01((k - a) / (b - a)) }
function moreupCsOut(x) { let y = 1 - moreupCsClamp01(x); return 1 - y * y * y }
function moreupCsInOut(k, fadeIn, fadeOut) { return moreupCsClamp01(Math.min(k / fadeIn, (1 - k) / fadeOut)) }

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
