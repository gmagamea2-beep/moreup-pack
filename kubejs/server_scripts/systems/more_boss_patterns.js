// priority: 0
// ============================================================
// More Up: 최종 보스 모어(castle_keeper) 추가 전투 패턴 + 평타 강화
// 경로: kubejs/server_scripts/systems/more_boss_patterns.js
// 설계·수치: MoreUp/docs/boss_fight_more.md
//
// 모드 원래 공격(발구르기, 화염구, 위더 해골, 소멸의 큐브)은 그대로 두고,
// 그 위에 예고(파티클·소리·액션바)가 있는 패턴을 몇 초마다 하나씩 쓴다.
//   1단계(체력 100~66%): 황혼 낙인, 유성우, 별의 고리, 그림자 도약, 황혼의 창, 월식
//   2단계(66~33%)     : + 중력 붕괴, 영혼 사슬, 황혼의 장막, 흩어지는 별빛, 황혼의 눈
//   3단계(33% 이하)   : + 시간 역행, 심판의 운석, 기존 패턴 강화
//   체력 20%·8%       : 최후의 황혼 (안전 지대 밖에 있으면 큰 피해, 한 번씩)
//
// 1.14.2 (2026-11-13 사용자 요청 "평타 데미지 2.5배, 공격 빈도 2배, 기술 5개 추가, 하수인 없애줘"):
//   - 평타(근접) 공격력 x2.5: 공격력 속성에 고정 UUID 수정치(MULTIPLY_TOTAL +1.5)를 등록할 때 건다
//   - 평타 빈도 x2: 근접 공격 대기 시간(MeleeAttackGoal, 20틱)을 틱마다 1씩 더 줄여 10틱으로
//   - 기술 5개 추가: 황혼의 창, 월식, 흩어지는 별빛, 황혼의 눈, 심판의 운석
//   - 하수인 제거: 황혼의 수호병(망령 소환) 끔. 모드 쪽 하수인 소환 4종(하빈저 큐브·추종자·
//     황혼의 숲 주요 보스·미니 보스)은 config/TwilightForestFinalBoss-common.toml 에서 끔
//
// 피해는 커스텀 피해 타입 moreup:dusk_judgment (방어력·방패 무시, 보호 마법 부여는 적용,
// 난이도 배율 없음)으로 "by 보스"를 붙여 준다. startup_scripts/moreup_boss_damage.js 의 보스 피해 x2 가
// 그대로 곱해지므로 아래 표의 damage 는 x2 전 값이다.
//
// 안정성:
//   - 보스·플레이어 객체는 보관하지 않고 UUID로 매번 다시 찾는다. 보스가 사라지면 예약된 동작은 버린다.
//   - 전역 tick 핸들러 하나. 예약 큐 상한 MOREUP_MORE_QUEUE_LIMIT. 핸들러 전체를 try/catch 로 감싼다.
//   - 좌표 명령은 모두 "execute in <보스 차원>" 으로 실행한다 (서버 명령 기본 차원은 오버월드).
//
// 관리자 테스트: /moreup_more <패턴 ID> (권한 2) — 64블록 안의 모어가 그 패턴을 바로 쓴다.
// 표를 바꾼 뒤 /reload 하면 적용된다.
// ============================================================

const MOREUP_MORE_ID = 'twilight_forest_final_boss:castle_keeper'
const MOREUP_MORE_DAMAGE_TYPE = 'moreup:dusk_judgment'

// 전투 범위·간격
const MOREUP_MORE_ARENA_RADIUS = 40          // 이 거리 안의 플레이어만 대상
const MOREUP_MORE_ARENA_HEIGHT = 24          // 위아래 허용 높이
const MOREUP_MORE_SCAN_INTERVAL = 10         // 보스 상태 확인 간격(틱)
const MOREUP_MORE_FIRST_DELAY = 100          // 플레이어가 처음 들어온 뒤 첫 패턴까지(틱)
const MOREUP_MORE_PATTERN_GAP = { 1: 180, 2: 140, 3: 110 } // 패턴 끝 → 다음 패턴(틱), 단계별
const MOREUP_MORE_PHASE2 = 0.66
const MOREUP_MORE_PHASE3 = 0.33
const MOREUP_MORE_LAST_DUSK_AT = [0.20, 0.08] // 최후의 황혼 발동 체력 비율 (각각 한 번)
const MOREUP_MORE_QUEUE_LIMIT = 3000
const MOREUP_MORE_RING_POINTS_MAX = 40       // 원 하나에 찍는 파티클 명령 수 상한
const MOREUP_MORE_LINE_POINTS_MAX = 24       // 선 하나에 찍는 파티클 명령 수 상한
// KubeJS 6 Rhino 에서는 Math.PI 가 undefined 다 (테스트 서버에서 확인). 직접 상수로 둔다
const MOREUP_MORE_TAU = 6.283185307179586
const MOREUP_MORE_DEG = MOREUP_MORE_TAU / 360
const MOREUP_MORE_EYE_HEIGHT = 3.0           // 모어 눈 높이 (몸 크기 1 x 3.6)

// 평타(근접) 강화. 1 이면 끈다 (수정치를 떼고 대기 시간도 건드리지 않는다)
const MOREUP_MORE_MELEE_DAMAGE = 2.5         // 공격력 속성 배율 (원래 6 → 15, 보스 피해 x2·난이도 배율 전)
const MOREUP_MORE_MELEE_SPEED = 2            // 근접 공격 빈도 배율 (정수). 대기 20틱 → 20/배율 틱
const MOREUP_MORE_MELEE_ID = '7d3c2a91-5b6e-4f08-9c1d-2e4f6a8b0c55'
const MOREUP_MORE_MELEE_NAME = 'More Up Mor melee'

// 패턴 표. damage 는 보스 피해 x2 전 값, cooldown 은 초
const MOREUP_MORE_PATTERNS = {
    dusk_brand:   { enabled: true, weight: 10, minPhase: 1, cooldown: 14, damage: 9,  radius: 3.0, delay: 40 },
    starfall:     { enabled: true, weight: 10, minPhase: 1, cooldown: 16, damage: 6,  radius: 2.5, delay: 30, spread: 4 },
    star_ring:    { enabled: true, weight: 10, minPhase: 1, cooldown: 15, damage: 7,  maxRadius: 26, charge: 20 },
    shadow_leap:  { enabled: true, weight: 8,  minPhase: 1, cooldown: 18, damage: 10, radius: 4.5, delay: 30 },
    gravity_well: { enabled: true, weight: 8,  minPhase: 2, cooldown: 22, damage: 10, radius: 7.0, pullRange: 32, duration: 40 },
    soul_chain:   { enabled: true, weight: 7,  minPhase: 2, cooldown: 30, damage: 3,  maxDistance: 10, duration: 120 },
    dusk_veil:    { enabled: true, weight: 6,  minPhase: 2, cooldown: 35, darkness: 8, invisible: 6 },
    // 1.14.2: 하수인 소환이라 끔 (사용자 요청 "스폰하는 하수인들 없애줘"). 다시 쓰려면 enabled: true
    dusk_guard:   { enabled: false, weight: 5, minPhase: 2, cooldown: 60, maxGuards: 5, duration: 400, entity: 'twilightforest:wraith' },
    time_rewind:  { enabled: true, weight: 7,  minPhase: 3, cooldown: 40, delay: 100 },
    last_dusk:    { enabled: true, damage: 25, channel: 160, zoneRadius: 3.2 }, // 체력 비율로 발동, 무작위 선택에서 제외
    // 1.14.2 추가 기술 5종
    dusk_lance:      { enabled: true, weight: 10, minPhase: 1, cooldown: 14, damage: 8,  length: 28, width: 1.3, delay: 30 },
    eclipse:         { enabled: true, weight: 9,  minPhase: 1, cooldown: 18, damage: 10, delay: 50, flipDelay: 35 },
    star_scatter:    { enabled: true, weight: 8,  minPhase: 2, cooldown: 22, damage: 8,  radius: 4.0, delay: 60, maxMarks: 8 },
    dusk_gaze:       { enabled: true, weight: 8,  minPhase: 2, cooldown: 28, damage: 9,  delay: 50, angle: 60, slowSeconds: 3 },
    judgment_meteor: { enabled: true, weight: 8,  minPhase: 3, cooldown: 26, damage: 10, radius: 4.0, delay: 70, need: 3, failMultiplier: 1.5, minShare: 0.3 }
}

// 테스트 서버 전용: 이 태그가 붙은 엔티티도 대상에 넣는다 (평소에는 null)
let MOREUP_MORE_DEBUG_TAG = null

const $MoreUpMoreRegistries = Java.loadClass('net.minecraftforge.registries.ForgeRegistries')
const $MoreUpMoreRL = Java.loadClass('net.minecraft.resources.ResourceLocation')

// key: 보스 UUID 문자열 → 전투 기록 (숫자·문자열만 담는다)
let moreupMoreBosses = {}
let moreupMoreQueue = []
let moreupMoreTick = 0
let moreupMoreServer = null
let moreupMoreErrorCount = 0
let moreupMorePendingKills = [] // tick 에서 정리할 수호병 태그

function moreupMoreError(context, e) {
    if (moreupMoreErrorCount >= 20) return
    moreupMoreErrorCount++
    console.error(`[MoreUp] 모어 패턴 오류 (${context}, ${moreupMoreErrorCount}/20): ${e}`)
}

// ---------- 기본 도구 ----------

function moreupMoreF(n) { return Number(n).toFixed(2) }

function moreupMoreRun(command) {
    return moreupMoreServer ? moreupMoreServer.runCommandSilent(command) : 0
}

function moreupMoreIn(rec, command) {
    return moreupMoreRun(`execute in ${rec.dim} run ${command}`)
}

function moreupMoreLevel(dim) {
    let found = null
    moreupMoreServer.allLevels.forEach(l => { if (found == null && String(l.dimension) === dim) found = l })
    return found
}

// UUID로 같은 차원의 살아 있는 엔티티를 찾는다
function moreupMoreFind(rec, uuid) {
    let level = moreupMoreLevel(rec.dim)
    if (level == null) return null
    let e = level.getEntity(uuid)
    return e != null && e.isAlive() ? e : null
}

function moreupMoreDist2(ax, az, bx, bz) {
    let dx = ax - bx
    let dz = az - bz
    return dx * dx + dz * dz
}

function moreupMoreShuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1))
        let t = arr[i]; arr[i] = arr[j]; arr[j] = t
    }
    return arr
}

// 대상: 범위 안의 생존·서바이벌 플레이어 (+ 테스트 태그 엔티티)
function moreupMoreTargets(boss) {
    let out = []
    let r2 = MOREUP_MORE_ARENA_RADIUS * MOREUP_MORE_ARENA_RADIUS
    boss.level.players.forEach(p => {
        if (!p.isAlive() || p.isSpectator() || p.isCreative()) return
        if (Math.abs(p.y - boss.y) > MOREUP_MORE_ARENA_HEIGHT) return
        if (moreupMoreDist2(p.x, p.z, boss.x, boss.z) <= r2) out.push(p)
    })
    if (MOREUP_MORE_DEBUG_TAG != null) {
        let r = MOREUP_MORE_ARENA_RADIUS
        boss.level.getEntitiesWithin(AABB.of(boss.x - r, boss.y - 24, boss.z - r, boss.x + r, boss.y + 24, boss.z + r)).forEach(e => {
            if (e.isAlive() && e.tags.contains(MOREUP_MORE_DEBUG_TAG)) out.push(e)
        })
    }
    return out
}

// 점 (x,y,z) 반경 r 안의 대상 (수평 거리 기준, 높이 차 3 이내)
function moreupMoreTargetsNear(boss, x, y, z, r) {
    return moreupMoreTargets(boss).filter(t => Math.abs(t.y - y) <= 3 && moreupMoreDist2(t.x, t.z, x, z) <= r * r)
}

function moreupMoreHurt(rec, target, amount) {
    moreupMoreRun(`damage ${target.stringUuid} ${moreupMoreF(amount)} ${MOREUP_MORE_DAMAGE_TYPE} by ${rec.key}`)
}

// 플레이어는 hurtMarked 를 켜야 이동 벡터가 클라이언트로 전송된다
function moreupMorePush(target, vx, vy, vz) {
    try {
        target.addDeltaMovement(new Vec3d(vx, vy, vz))
        target.hurtMarked = true
    } catch (e) {
        moreupMoreError('push', e)
    }
}

function moreupMorePushFrom(target, x, z, horizontal, up) {
    let dx = target.x - x
    let dz = target.z - z
    let len = Math.sqrt(dx * dx + dz * dz)
    if (len < 0.01) { dx = 1; dz = 0; len = 1 }
    moreupMorePush(target, dx / len * horizontal, up, dz / len * horizontal)
}

function moreupMoreParticle(rec, type, x, y, z, dx, dy, dz, speed, count) {
    moreupMoreIn(rec, `particle ${type} ${moreupMoreF(x)} ${moreupMoreF(y)} ${moreupMoreF(z)} ${dx} ${dy} ${dz} ${speed} ${count} force`)
}

function moreupMoreCircle(rec, type, x, y, z, r, points) {
    let n = Math.min(MOREUP_MORE_RING_POINTS_MAX, Math.max(8, Math.ceil(points)))
    for (let i = 0; i < n; i++) {
        let a = MOREUP_MORE_TAU * i / n
        moreupMoreParticle(rec, type, x + Math.cos(a) * r, y, z + Math.sin(a) * r, 0, 0, 0, 0, 1)
    }
}

// 호(arc): 각도 a0 → a1 (라디안)
function moreupMoreArc(rec, type, x, y, z, r, a0, a1, points) {
    let n = Math.min(MOREUP_MORE_RING_POINTS_MAX, Math.max(6, Math.ceil(points)))
    for (let i = 0; i <= n; i++) {
        let a = a0 + (a1 - a0) * i / n
        moreupMoreParticle(rec, type, x + Math.cos(a) * r, y, z + Math.sin(a) * r, 0, 0, 0, 0, 1)
    }
}

// 수평 선분 l = {x1, z1, x2, z2, y}
function moreupMoreLine(rec, type, l, spacing, count) {
    let dx = l.x2 - l.x1
    let dz = l.z2 - l.z1
    let len = Math.sqrt(dx * dx + dz * dz)
    let n = Math.min(MOREUP_MORE_LINE_POINTS_MAX, Math.max(2, Math.ceil(len / spacing)))
    for (let i = 0; i <= n; i++) {
        moreupMoreParticle(rec, type, l.x1 + dx * i / n, l.y + 0.2, l.z1 + dz * i / n, 0.05, 0.05, 0.05, 0, count || 1)
    }
}

// 점에서 수평 선분까지 거리의 제곱
function moreupMoreSegDist2(px, pz, l) {
    let dx = l.x2 - l.x1
    let dz = l.z2 - l.z1
    let len2 = dx * dx + dz * dz
    let t = len2 > 0 ? ((px - l.x1) * dx + (pz - l.z1) * dz) / len2 : 0
    t = Math.max(0, Math.min(1, t))
    return moreupMoreDist2(px, pz, l.x1 + dx * t, l.z1 + dz * t)
}

// 대상이 모어(눈 높이)를 바라보고 있는지: 시선과 모어 방향 사이 각이 cosLimit 의 각보다 작으면 true
function moreupMoreLooksAt(t, boss, cosLimit) {
    let yaw = Number(t.yaw) * MOREUP_MORE_DEG
    let pitch = Number(t.pitch) * MOREUP_MORE_DEG
    let lx = -Math.sin(yaw) * Math.cos(pitch)
    let ly = -Math.sin(pitch)
    let lz = Math.cos(yaw) * Math.cos(pitch)
    let bx = boss.x - t.x
    let by = boss.y + MOREUP_MORE_EYE_HEIGHT - (t.y + 1.6)
    let bz = boss.z - t.z
    let len = Math.sqrt(bx * bx + by * by + bz * bz)
    if (len < 0.5) return true
    return (lx * bx + ly * by + lz * bz) / len >= cosLimit
}

function moreupMoreSound(rec, sound, x, y, z, volume, pitch) {
    moreupMoreIn(rec, `playsound ${sound} hostile @a[x=${moreupMoreF(x)},y=${moreupMoreF(y)},z=${moreupMoreF(z)},distance=..64] ${moreupMoreF(x)} ${moreupMoreF(y)} ${moreupMoreF(z)} ${volume} ${pitch}`)
}

// 액션바 경고 (플레이어가 아니면 명령이 그냥 실패한다)
function moreupMoreWarn(targets, key, args) {
    let json = { translate: key, color: 'light_purple', bold: true }
    if (args) json['with'] = args
    let text = JSON.stringify(json)
    targets.forEach(t => moreupMoreRun(`title ${t.stringUuid} actionbar ${text}`))
}

function moreupMoreTitle(targets, titleKey, subtitleKey) {
    let title = JSON.stringify({ translate: titleKey, color: 'dark_purple', bold: true })
    let sub = JSON.stringify({ translate: subtitleKey, color: 'light_purple' })
    targets.forEach(t => {
        moreupMoreRun(`title ${t.stringUuid} times 10 50 20`)
        moreupMoreRun(`title ${t.stringUuid} subtitle ${sub}`)
        moreupMoreRun(`title ${t.stringUuid} title ${title}`)
    })
}

function moreupMoreIsAir(level, x, y, z) {
    let id = String(level.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)).id)
    return id === 'minecraft:air' || id === 'minecraft:cave_air' || id === 'minecraft:void_air'
}

// (x,z) 에서 기준 높이 근처의 서 있을 수 있는 바닥(발 위치 y)을 찾는다. 없으면 기준 높이
function moreupMoreGroundY(level, x, baseY, z) {
    let top = Math.floor(baseY) + 4
    for (let y = top; y >= Math.floor(baseY) - 8; y--) {
        if (!moreupMoreIsAir(level, x, y - 1, z) && moreupMoreIsAir(level, x, y, z) && moreupMoreIsAir(level, x, y + 1, z)) return y
    }
    return Math.floor(baseY)
}

// ---------- 예약 실행 ----------

// delay 틱 뒤 fn(boss) 실행. 그때 보스가 없으면 버린다
function moreupMoreLater(rec, delay, fn) {
    if (moreupMoreQueue.length >= MOREUP_MORE_QUEUE_LIMIT) return
    moreupMoreQueue.push({ at: moreupMoreTick + Math.max(1, delay), key: rec.key, fn: fn })
}

// count 번, interval 틱마다 fn(boss, i). 함수 인자로 i 를 묶어 Rhino 반복문 클로저 문제를 피한다
function moreupMoreRepeat(rec, start, count, interval, fn) {
    for (let i = 0; i < count; i++) moreupMoreLaterIndexed(rec, start + i * interval, i, fn)
}
function moreupMoreLaterIndexed(rec, delay, i, fn) {
    moreupMoreLater(rec, delay, boss => fn(boss, i))
}

function moreupMoreRunQueue() {
    if (moreupMoreQueue.length === 0) return
    let due = []
    let keep = []
    moreupMoreQueue.forEach(item => { if (item.at <= moreupMoreTick) due.push(item); else keep.push(item) })
    if (due.length === 0) return
    moreupMoreQueue = keep
    due.forEach(item => {
        let rec = moreupMoreBosses[item.key]
        if (!rec) return
        let boss = moreupMoreFind(rec, rec.uuid)
        if (boss == null) return
        try {
            item.fn(boss)
        } catch (e) {
            moreupMoreError('예약 동작', e)
        }
    })
}

// ---------- 패턴 ----------
// 각 함수는 (rec, boss, targets, phase) 를 받고 "다음 패턴을 막을 시간(틱)"을 돌려준다. 0이면 실패(다른 패턴을 고른다)

const MOREUP_MORE_PATTERN_FNS = {}

// 1. 황혼 낙인: 플레이어 발밑에 낙인을 찍고 2초 뒤 폭발. 피하려면 자리를 벗어난다
MOREUP_MORE_PATTERN_FNS.dusk_brand = (rec, boss, targets, phase) => {
    let cfg = MOREUP_MORE_PATTERNS.dusk_brand
    let n = phase >= 3 ? targets.length : Math.min(targets.length, 1 + Math.floor(targets.length / 3))
    let marks = moreupMoreShuffle(targets.slice()).slice(0, n).map(t => ({ x: t.x, y: t.y, z: t.z }))
    moreupMoreWarn(targets, 'message.moreup.more.dusk_brand')
    marks.forEach(m => moreupMoreSound(rec, 'minecraft:block.beacon.activate', m.x, m.y, m.z, 1.5, 0.6))
    moreupMoreRepeat(rec, 0, Math.floor(cfg.delay / 5), 5, (b, i) => {
        marks.forEach(m => moreupMoreCircle(rec, 'minecraft:dust 0.55 0.15 0.85 1.6', m.x, m.y + 0.15, m.z, cfg.radius, cfg.radius * 6))
    })
    moreupMoreLater(rec, cfg.delay, b => {
        marks.forEach(m => {
            moreupMoreParticle(rec, 'minecraft:explosion', m.x, m.y + 0.5, m.z, 1, 0.3, 1, 0, 6)
            moreupMoreParticle(rec, 'minecraft:witch', m.x, m.y + 0.5, m.z, 1.2, 0.8, 1.2, 0.1, 40)
            moreupMoreSound(rec, 'minecraft:entity.generic.explode', m.x, m.y, m.z, 1.5, 0.7)
            moreupMoreTargetsNear(b, m.x, m.y, m.z, cfg.radius).forEach(t => moreupMoreHurt(rec, t, cfg.damage))
        })
    })
    return cfg.delay + 10
}

// 2. 유성우: 플레이어 주변에 떨어질 자리를 표시하고 1.5초 뒤 낙하. 3단계에서는 두 번
MOREUP_MORE_PATTERN_FNS.starfall = (rec, boss, targets, phase) => {
    let cfg = MOREUP_MORE_PATTERNS.starfall
    let level = boss.level
    moreupMoreWarn(targets, 'message.moreup.more.starfall')
    let waves = phase >= 3 ? 2 : 1
    for (let w = 0; w < waves; w++) moreupMoreStarfallWave(rec, level, targets, w * (cfg.delay + 10), cfg)
    return waves * (cfg.delay + 10) + 10
}
function moreupMoreStarfallWave(rec, level, targets, start, cfg) {
    let count = Math.min(16, 4 + targets.length * 2)
    let points = []
    for (let i = 0; i < count; i++) {
        let t = targets[i % targets.length]
        let x = t.x + (Math.random() * 2 - 1) * cfg.spread
        let z = t.z + (Math.random() * 2 - 1) * cfg.spread
        points.push({ x: x, y: moreupMoreGroundY(level, x, t.y, z), z: z })
    }
    moreupMoreRepeat(rec, start, Math.floor(cfg.delay / 10), 10, (b, i) => {
        points.forEach(p => {
            moreupMoreCircle(rec, 'minecraft:dust 1.0 0.45 0.2 1.4', p.x, p.y + 0.15, p.z, cfg.radius, cfg.radius * 5)
            moreupMoreParticle(rec, 'minecraft:end_rod', p.x, p.y + 12 - i * 4, p.z, 0.2, 0.5, 0.2, 0, 4)
        })
        if (i === 0) moreupMoreSound(rec, 'minecraft:entity.firework_rocket.launch', points[0].x, points[0].y, points[0].z, 1.5, 0.5)
    })
    moreupMoreLater(rec, start + cfg.delay, b => {
        points.forEach(p => {
            moreupMoreParticle(rec, 'minecraft:explosion', p.x, p.y + 0.3, p.z, 0.6, 0.2, 0.6, 0, 3)
            moreupMoreParticle(rec, 'minecraft:end_rod', p.x, p.y + 0.5, p.z, 0.3, 0.3, 0.3, 0.2, 15)
            moreupMoreTargetsNear(b, p.x, p.y, p.z, cfg.radius).forEach(t => {
                moreupMoreHurt(rec, t, cfg.damage)
                moreupMorePushFrom(t, p.x, p.z, 0.3, 0.4)
            })
        })
        moreupMoreSound(rec, 'minecraft:entity.generic.explode', points[0].x, points[0].y, points[0].z, 2, 1.2)
    })
}

// 3. 별의 고리: 보스 중심에서 퍼지는 충격파. 바닥에 서 있으면 맞는다 → 점프로 피한다. 3단계에서는 두 겹
MOREUP_MORE_PATTERN_FNS.star_ring = (rec, boss, targets, phase) => {
    let cfg = MOREUP_MORE_PATTERNS.star_ring
    let cx = boss.x
    let cy = boss.y
    let cz = boss.z
    moreupMoreWarn(targets, 'message.moreup.more.star_ring')
    moreupMoreSound(rec, 'minecraft:block.conduit.activate', cx, cy, cz, 2, 0.6)
    moreupMoreRepeat(rec, 0, Math.floor(cfg.charge / 5), 5, (b, i) => {
        moreupMoreParticle(rec, 'minecraft:enchant', b.x, b.y + 1.5, b.z, 1.5, 1.5, 1.5, 1, 30)
    })
    let rings = phase >= 3 ? 2 : 1
    for (let k = 0; k < rings; k++) moreupMoreRingWave(rec, cx, cy, cz, cfg, cfg.charge + k * 16)
    return cfg.charge + rings * 16 + 40
}
function moreupMoreRingWave(rec, cx, cy, cz, cfg, start) {
    let hit = {}
    let steps = Math.ceil((cfg.maxRadius - 2) / 1.2)
    moreupMoreLater(rec, start, b => moreupMoreSound(rec, 'minecraft:entity.warden.sonic_boom', cx, cy, cz, 2, 0.8))
    moreupMoreRepeat(rec, start, steps, 2, (b, i) => {
        let r = 2 + i * 1.2
        moreupMoreCircle(rec, 'minecraft:dust 0.95 0.8 0.3 2.0', cx, cy + 0.2, cz, r, r * 1.6)
        moreupMoreTargets(b).forEach(t => {
            let key = String(t.stringUuid)
            if (hit[key]) return
            if (Math.abs(t.y - cy) > 2.5 || !t.onGround()) return
            let d = Math.sqrt(moreupMoreDist2(t.x, t.z, cx, cz))
            if (Math.abs(d - r) > 0.9) return
            hit[key] = true
            moreupMoreHurt(rec, t, cfg.damage)
            moreupMorePushFrom(t, cx, cz, 0.8, 0.4)
        })
    })
}

// 4. 그림자 도약: 플레이어(가장 먼 사람 우선) 자리에 표시 후 1.5초 뒤 그곳으로 순간 이동해 내려찍는다. 3단계에서는 연속 2번
MOREUP_MORE_PATTERN_FNS.shadow_leap = (rec, boss, targets, phase) => {
    let cfg = MOREUP_MORE_PATTERNS.shadow_leap
    let level = boss.level
    let sorted = targets.slice().sort((a, b) =>
        moreupMoreDist2(b.x, b.z, boss.x, boss.z) - moreupMoreDist2(a.x, a.z, boss.x, boss.z))
    let spots = []
    let leaps = phase >= 3 ? 2 : 1
    for (let i = 0; i < sorted.length && spots.length < leaps; i++) {
        let t = sorted[i]
        // 보스 키만큼(발 위 3칸) 비어 있어야 한다. 아니면 벽에 끼므로 이 자리는 쓰지 않는다
        if (moreupMoreIsAir(level, t.x, t.y + 2, t.z) && moreupMoreIsAir(level, t.x, t.y + 3, t.z)) spots.push({ x: t.x, y: t.y, z: t.z })
    }
    if (spots.length === 0) return 0
    moreupMoreWarn(targets, 'message.moreup.more.shadow_leap')
    spots.forEach((s, idx) => moreupMoreLeap(rec, s, cfg, idx * (cfg.delay + 15)))
    return spots.length * (cfg.delay + 15) + 10
}
function moreupMoreLeap(rec, s, cfg, start) {
    moreupMoreLater(rec, start, b => moreupMoreSound(rec, 'minecraft:entity.enderman.stare', s.x, s.y, s.z, 1.5, 0.5))
    moreupMoreRepeat(rec, start, Math.floor(cfg.delay / 5), 5, (b, i) => {
        moreupMoreCircle(rec, 'minecraft:dust 0.6 0.0 0.2 1.8', s.x, s.y + 0.15, s.z, cfg.radius, cfg.radius * 5)
        moreupMoreParticle(rec, 'minecraft:portal', s.x, s.y + 2, s.z, 0.4, 2, 0.4, 0.5, 20)
    })
    moreupMoreLater(rec, start + cfg.delay, b => {
        moreupMoreParticle(rec, 'minecraft:reverse_portal', b.x, b.y + 1, b.z, 0.6, 1.5, 0.6, 0.1, 40)
        moreupMoreIn(rec, `tp ${rec.key} ${moreupMoreF(s.x)} ${moreupMoreF(s.y)} ${moreupMoreF(s.z)}`)
        moreupMoreSound(rec, 'minecraft:entity.enderman.teleport', s.x, s.y, s.z, 2, 0.5)
        moreupMoreParticle(rec, 'minecraft:explosion_emitter', s.x, s.y + 0.5, s.z, 0, 0, 0, 0, 1)
        moreupMoreTargetsNear(b, s.x, s.y, s.z, cfg.radius).forEach(t => {
            moreupMoreHurt(rec, t, cfg.damage)
            moreupMorePushFrom(t, s.x, s.z, 0.6, 0.9)
        })
    })
}

// 5. 중력 붕괴: 2초 동안 보스 쪽으로 끌어당긴 뒤 보스 주변 폭발. 끌려가지 않게 반대로 달린다
MOREUP_MORE_PATTERN_FNS.gravity_well = (rec, boss, targets, phase) => {
    let cfg = MOREUP_MORE_PATTERNS.gravity_well
    moreupMoreWarn(targets, 'message.moreup.more.gravity_well')
    moreupMoreSound(rec, 'minecraft:block.respawn_anchor.deplete', boss.x, boss.y, boss.z, 2, 0.5)
    let pull = phase >= 3 ? 0.42 : 0.34
    moreupMoreRepeat(rec, 0, Math.floor(cfg.duration / 4), 4, (b, i) => {
        moreupMoreParticle(rec, 'minecraft:reverse_portal', b.x, b.y + 1.5, b.z, 4, 1.5, 4, 0.3, 60)
        moreupMoreCircle(rec, 'minecraft:dust 0.3 0.0 0.5 1.5', b.x, b.y + 0.2, b.z, cfg.radius, cfg.radius * 4)
        moreupMoreTargets(b).forEach(t => {
            let dx = b.x - t.x
            let dz = b.z - t.z
            let d = Math.sqrt(dx * dx + dz * dz)
            if (d < 1.5 || d > cfg.pullRange) return
            moreupMorePush(t, dx / d * pull, 0, dz / d * pull)
        })
    })
    moreupMoreLater(rec, cfg.duration, b => {
        moreupMoreParticle(rec, 'minecraft:explosion_emitter', b.x, b.y + 1, b.z, 0, 0, 0, 0, 1)
        moreupMoreParticle(rec, 'minecraft:dragon_breath', b.x, b.y + 1, b.z, cfg.radius / 2, 0.5, cfg.radius / 2, 0.05, 120)
        moreupMoreSound(rec, 'minecraft:entity.generic.explode', b.x, b.y, b.z, 3, 0.5)
        moreupMoreTargetsNear(b, b.x, b.y, b.z, cfg.radius).forEach(t => {
            moreupMoreHurt(rec, t, cfg.damage)
            moreupMorePushFrom(t, b.x, b.z, 1.2, 0.5)
        })
    })
    return cfg.duration + 15
}

// 6. 영혼 사슬: 두 사람을 6초 동안 묶는다. 10블록보다 멀어지면 둘 다 피해. 혼자면 보스와 묶인다(12블록)
//    다른 패턴과 겹쳐 진행되도록 막는 시간은 짧게 돌려준다
MOREUP_MORE_PATTERN_FNS.soul_chain = (rec, boss, targets, phase) => {
    let cfg = MOREUP_MORE_PATTERNS.soul_chain
    let list = moreupMoreShuffle(targets.slice())
    let pairs = []
    if (list.length === 1) pairs.push({ a: list[0].uuid, b: null })
    else {
        let pairCount = phase >= 3 && list.length >= 4 ? 2 : 1
        for (let i = 0; i < pairCount; i++) pairs.push({ a: list[i * 2].uuid, b: list[i * 2 + 1].uuid })
    }
    moreupMoreWarn(targets, 'message.moreup.more.soul_chain')
    moreupMoreSound(rec, 'minecraft:block.chain.place', boss.x, boss.y, boss.z, 2, 0.5)
    moreupMoreRepeat(rec, 0, Math.floor(cfg.duration / 5), 5, (b, i) => {
        pairs.forEach(pair => {
            let ea = moreupMoreFind(rec, pair.a)
            let eb = pair.b == null ? b : moreupMoreFind(rec, pair.b)
            if (ea == null || eb == null) return
            let limit = pair.b == null ? cfg.maxDistance + 2 : cfg.maxDistance
            let dx = eb.x - ea.x
            let dy = eb.y - ea.y
            let dz = eb.z - ea.z
            let d = Math.sqrt(dx * dx + dy * dy + dz * dz)
            let snapped = d > limit
            let seg = Math.min(16, Math.max(4, Math.ceil(d)))
            let color = snapped ? 'minecraft:dust 1.0 0.1 0.1 1.2' : 'minecraft:dust 0.4 0.9 1.0 1.0'
            for (let s = 0; s <= seg; s++) {
                moreupMoreParticle(rec, color, ea.x + dx * s / seg, ea.y + 1 + dy * s / seg, ea.z + dz * s / seg, 0, 0, 0, 0, 1)
            }
            if (snapped && i % 2 === 1) {
                moreupMoreHurt(rec, ea, cfg.damage)
                if (pair.b != null) moreupMoreHurt(rec, eb, cfg.damage)
                moreupMoreSound(rec, 'minecraft:block.chain.break', ea.x, ea.y, ea.z, 1, 0.6)
            }
        })
    })
    return 40
}

// 7. 황혼의 장막: 어둠을 내리고 보스가 잠시 투명해지며 빨라진다
MOREUP_MORE_PATTERN_FNS.dusk_veil = (rec, boss, targets, phase) => {
    let cfg = MOREUP_MORE_PATTERNS.dusk_veil
    moreupMoreWarn(targets, 'message.moreup.more.dusk_veil')
    moreupMoreSound(rec, 'minecraft:entity.wither.ambient', boss.x, boss.y, boss.z, 2, 0.5)
    moreupMoreParticle(rec, 'minecraft:large_smoke', boss.x, boss.y + 1.5, boss.z, 3, 2, 3, 0.02, 150)
    targets.forEach(t => moreupMoreRun(`effect give ${t.stringUuid} minecraft:darkness ${cfg.darkness} 0 true`))
    moreupMoreRun(`effect give ${rec.key} minecraft:invisibility ${cfg.invisible} 0 true`)
    moreupMoreRun(`effect give ${rec.key} minecraft:speed ${cfg.invisible} 1 true`)
    // 투명한 동안 위치를 알 수 있게 발밑에 희미한 연기를 남긴다
    moreupMoreRepeat(rec, 10, Math.floor(cfg.invisible * 20 / 10), 10, (b, i) => {
        moreupMoreParticle(rec, 'minecraft:smoke', b.x, b.y + 0.1, b.z, 0.4, 0, 0.4, 0, 6)
    })
    return 40
}

// 8. 황혼의 수호병: 망령을 소환하고, 하나라도 살아 있으면 보스가 받는 피해 80% 감소 (최대 20초)
MOREUP_MORE_PATTERN_FNS.dusk_guard = (rec, boss, targets, phase) => {
    let cfg = MOREUP_MORE_PATTERNS.dusk_guard
    if (moreupMoreRun(`execute if entity @e[tag=${rec.guardTag}]`) > 0) return 0
    let count = Math.min(cfg.maxGuards, 2 + Math.floor(targets.length / 3))
    moreupMoreWarn(targets, 'message.moreup.more.dusk_guard')
    moreupMoreSound(rec, 'minecraft:entity.evoker.prepare_summon', boss.x, boss.y, boss.z, 2, 0.6)
    for (let i = 0; i < count; i++) {
        let a = MOREUP_MORE_TAU * i / count
        let x = boss.x + Math.cos(a) * 4
        let z = boss.z + Math.sin(a) * 4
        // 처치 보상 없음(DeathLootTable 비움) — 수호병 사냥으로 아이템이 쌓이지 않게
        moreupMoreIn(rec, `summon ${cfg.entity} ${moreupMoreF(x)} ${moreupMoreF(boss.y + 1.5)} ${moreupMoreF(z)} {Tags:["moreup_more_guard","${rec.guardTag}"],DeathLootTable:"minecraft:empty",PersistenceRequired:1b}`)
        moreupMoreParticle(rec, 'minecraft:soul', x, boss.y + 1.5, z, 0.4, 0.8, 0.4, 0.02, 20)
    }
    moreupMoreRepeat(rec, 10, Math.floor(cfg.duration / 10), 10, (b, i) => {
        if (moreupMoreRun(`execute if entity @e[tag=${rec.guardTag}]`) <= 0) return
        moreupMoreRun(`effect give ${rec.key} minecraft:resistance 1 3 true`)
        moreupMoreParticle(rec, 'minecraft:enchanted_hit', b.x, b.y + 1.5, b.z, 1, 1.2, 1, 0.1, 12)
    })
    moreupMoreLater(rec, cfg.duration + 10, b => moreupMoreRun(`kill @e[tag=${rec.guardTag}]`))
    return 60
}

// 9. 시간 역행: 지금 자리를 기억(잔상)하고 5초 뒤 모두 그 자리로 되돌린다. 다른 패턴과 겹쳐 진행된다
MOREUP_MORE_PATTERN_FNS.time_rewind = (rec, boss, targets, phase) => {
    let cfg = MOREUP_MORE_PATTERNS.time_rewind
    let echoes = targets.map(t => ({ uuid: t.uuid, x: t.x, y: t.y, z: t.z }))
    moreupMoreWarn(targets, 'message.moreup.more.time_rewind')
    moreupMoreSound(rec, 'minecraft:block.bell.resonate', boss.x, boss.y, boss.z, 2, 0.5)
    moreupMoreRepeat(rec, 0, Math.floor(cfg.delay / 10), 10, (b, i) => {
        echoes.forEach(e => moreupMoreParticle(rec, 'minecraft:soul_fire_flame', e.x, e.y + 1, e.z, 0.2, 0.6, 0.2, 0.01, 8))
    })
    moreupMoreLater(rec, cfg.delay, b => {
        echoes.forEach(e => {
            let t = moreupMoreFind(rec, e.uuid)
            // 죽었다 살아나 멀리 있거나 다른 차원이면 되돌리지 않는다
            if (t == null || moreupMoreDist2(t.x, t.z, e.x, e.z) > 64 * 64) return
            moreupMoreIn(rec, `tp ${t.stringUuid} ${moreupMoreF(e.x)} ${moreupMoreF(e.y)} ${moreupMoreF(e.z)}`)
            moreupMoreRun(`effect give ${t.stringUuid} minecraft:slowness 2 1 true`)
            moreupMoreParticle(rec, 'minecraft:reverse_portal', e.x, e.y + 1, e.z, 0.3, 0.8, 0.3, 0.1, 30)
        })
        moreupMoreSound(rec, 'minecraft:entity.illusioner.mirror_move', b.x, b.y, b.z, 2, 0.7)
    })
    return 30
}

// 10. 최후의 황혼: 8초 동안 보스가 무적이 되어 힘을 모으고, 끝날 때 빛기둥(안전 지대) 밖에 있으면 큰 피해
MOREUP_MORE_PATTERN_FNS.last_dusk = (rec, boss, targets, phase) => {
    let cfg = MOREUP_MORE_PATTERNS.last_dusk
    let level = boss.level
    let n = Math.min(4, Math.max(2, Math.ceil(targets.length / 2)))
    let offset = Math.random() * MOREUP_MORE_TAU
    let zones = []
    for (let i = 0; i < n; i++) {
        let a = offset + MOREUP_MORE_TAU * i / n
        let r = 10 + Math.random() * 4
        let x = boss.x + Math.cos(a) * r
        let z = boss.z + Math.sin(a) * r
        zones.push({ x: x, y: moreupMoreGroundY(level, x, boss.y, z), z: z })
    }
    moreupMoreTitle(targets, 'message.moreup.more.last_dusk.title', 'message.moreup.more.last_dusk.subtitle')
    moreupMoreSound(rec, 'minecraft:entity.wither.spawn', boss.x, boss.y, boss.z, 3, 0.5)
    moreupMoreRepeat(rec, 0, Math.floor(cfg.channel / 5), 5, (b, i) => {
        moreupMoreRun(`effect give ${rec.key} minecraft:resistance 1 4 true`)
        moreupMoreRun(`effect give ${rec.key} minecraft:slowness 1 6 true`)
        moreupMoreParticle(rec, 'minecraft:dragon_breath', b.x, b.y + 2, b.z, 2, 2, 2, 0.02, 30)
        zones.forEach(zn => {
            moreupMoreCircle(rec, 'minecraft:dust 1.0 0.9 0.4 1.6', zn.x, zn.y + 0.15, zn.z, cfg.zoneRadius, cfg.zoneRadius * 5)
            moreupMoreParticle(rec, 'minecraft:end_rod', zn.x, zn.y + 4, zn.z, 0.15, 4, 0.15, 0, 12)
        })
        if (i % 4 === 0) {
            let left = Math.ceil((cfg.channel - i * 5) / 20)
            moreupMoreWarn(moreupMoreTargets(b), 'message.moreup.more.last_dusk.count', [String(left)])
        }
    })
    moreupMoreLater(rec, cfg.channel, b => {
        moreupMoreSound(rec, 'minecraft:entity.lightning_bolt.thunder', b.x, b.y, b.z, 3, 0.6)
        moreupMoreParticle(rec, 'minecraft:flash', b.x, b.y + 2, b.z, 0, 0, 0, 0, 1)
        moreupMoreParticle(rec, 'minecraft:sonic_boom', b.x, b.y + 1.5, b.z, 6, 1, 6, 0, 20)
        moreupMoreTargets(b).forEach(t => {
            let safe = zones.some(zn => Math.abs(t.y - zn.y) <= 3 &&
                moreupMoreDist2(t.x, t.z, zn.x, zn.z) <= cfg.zoneRadius * cfg.zoneRadius)
            if (!safe) moreupMoreHurt(rec, t, cfg.damage)
        })
    })
    return cfg.channel + 20
}

// 11. 황혼의 창 (1.14.2): 모어에서 플레이어 쪽으로 보라색 선을 긋고 1.5초 뒤 그 선을 따라 창이 꿰뚫는다.
//     옆으로 비켜야 한다. 2단계부터 창 하나 더, 3단계는 다시 조준해 두 번
MOREUP_MORE_PATTERN_FNS.dusk_lance = (rec, boss, targets, phase) => {
    let cfg = MOREUP_MORE_PATTERNS.dusk_lance
    moreupMoreWarn(targets, 'message.moreup.more.dusk_lance')
    moreupMoreSound(rec, 'minecraft:item.trident.return', boss.x, boss.y, boss.z, 2, 0.5)
    let waves = phase >= 3 ? 2 : 1
    for (let w = 0; w < waves; w++) moreupMoreLanceWave(rec, w * (cfg.delay + 12), cfg, phase)
    return waves * (cfg.delay + 12) + 10
}
function moreupMoreLanceWave(rec, start, cfg, phase) {
    // 조준은 물결이 시작할 때의 플레이어 위치로 한다 (3단계 두 번째 물결은 다시 겨눈다)
    moreupMoreLater(rec, start, b => {
        let ts = moreupMoreTargets(b)
        if (ts.length === 0) return
        let max = phase >= 2 ? 5 : 3
        let n = Math.min(max, ts.length + (phase >= 2 ? 1 : 0))
        let picks = moreupMoreShuffle(ts.slice())
        let lances = []
        for (let i = 0; i < n; i++) {
            let t = picks[i % picks.length]
            let a = Math.atan2(t.z - b.z, t.x - b.x)
            if (moreupMoreDist2(t.x, t.z, b.x, b.z) < 0.25) a = Math.random() * MOREUP_MORE_TAU
            // 같은 사람을 두 번째로 겨눌 때는 각도를 비틀어 퍼뜨린다
            if (i >= picks.length) a += (i % 2 === 0 ? 0.45 : -0.45)
            lances.push({ x1: b.x, z1: b.z, x2: b.x + Math.cos(a) * cfg.length, z2: b.z + Math.sin(a) * cfg.length, y: b.y })
        }
        moreupMoreSound(rec, 'minecraft:entity.evoker.prepare_attack', b.x, b.y, b.z, 1.5, 0.6)
        moreupMoreRepeat(rec, 0, Math.floor(cfg.delay / 5), 5, (b2, i) => {
            lances.forEach(l => moreupMoreLine(rec, 'minecraft:dust 0.45 0.1 0.75 1.4', l, 1.6))
        })
        moreupMoreLater(rec, cfg.delay, b2 => {
            let hit = {}
            moreupMoreSound(rec, 'minecraft:item.trident.thunder', b2.x, b2.y, b2.z, 2, 1.2)
            lances.forEach(l => {
                moreupMoreLine(rec, 'minecraft:end_rod', l, 1.2, 2)
                moreupMoreTargets(b2).forEach(t => {
                    let key = String(t.stringUuid)
                    if (hit[key] || Math.abs(t.y - l.y) > 3) return
                    if (moreupMoreSegDist2(t.x, t.z, l) > cfg.width * cfg.width) return
                    hit[key] = true
                    moreupMoreHurt(rec, t, cfg.damage)
                    // 창 방향과 수직으로 밀어 낸다
                    let dx = l.x2 - l.x1
                    let dz = l.z2 - l.z1
                    let len = Math.sqrt(dx * dx + dz * dz)
                    let side = ((t.x - l.x1) * -dz + (t.z - l.z1) * dx) >= 0 ? 1 : -1
                    moreupMorePush(t, -dz / len * 0.6 * side, 0.3, dx / len * 0.6 * side)
                })
            })
        })
    })
}

// 12. 월식 (1.14.2): 모어를 지나는 금빛 선으로 투기장을 반으로 가르고, 그림자 쪽 절반이 2.5초 뒤 무너진다.
//     금빛 선 반대편(밝은 쪽)으로 건너가야 한다. 3단계는 곧바로 반대쪽도 무너진다
MOREUP_MORE_PATTERN_FNS.eclipse = (rec, boss, targets, phase) => {
    let cfg = MOREUP_MORE_PATTERNS.eclipse
    let c = { x: boss.x, y: boss.y, z: boss.z }
    let a = Math.random() * MOREUP_MORE_TAU
    moreupMoreWarn(targets, 'message.moreup.more.eclipse')
    moreupMoreSound(rec, 'minecraft:block.beacon.deactivate', c.x, c.y, c.z, 2, 0.5)
    moreupMoreEclipseWave(rec, c, a, 0, cfg.delay, cfg)
    if (phase < 3) return cfg.delay + 15
    moreupMoreEclipseWave(rec, c, a + MOREUP_MORE_TAU / 2, cfg.delay + 10, cfg.flipDelay, cfg)
    return cfg.delay + 10 + cfg.flipDelay + 15
}
function moreupMoreEclipseWave(rec, c, a, start, delay, cfg) {
    let nx = Math.cos(a)
    let nz = Math.sin(a)
    let border = { x1: c.x - nz * 24, z1: c.z + nx * 24, x2: c.x + nz * 24, z2: c.z - nx * 24, y: c.y }
    moreupMoreRepeat(rec, start, Math.max(1, Math.floor(delay / 10)), 10, (b, i) => {
        if (i === 0 && start > 0) moreupMoreWarn(moreupMoreTargets(b), 'message.moreup.more.eclipse')
        for (let r = 6; r <= 20; r += 7) {
            moreupMoreArc(rec, 'minecraft:dust 0.15 0.0 0.25 2.0', c.x, c.y + 0.2, c.z, r, a - MOREUP_MORE_TAU / 4, a + MOREUP_MORE_TAU / 4, r * 1.2)
        }
        moreupMoreLine(rec, 'minecraft:dust 1.0 0.85 0.4 1.6', border, 2)
        moreupMoreParticle(rec, 'minecraft:squid_ink', c.x + nx * 10, c.y + 1, c.z + nz * 10, 6, 1, 6, 0.01, 30)
    })
    moreupMoreLater(rec, start + delay, b => {
        moreupMoreSound(rec, 'minecraft:entity.generic.explode', c.x + nx * 10, c.y, c.z + nz * 10, 3, 0.5)
        moreupMoreParticle(rec, 'minecraft:large_smoke', c.x + nx * 12, c.y + 1, c.z + nz * 12, 8, 1.5, 8, 0.02, 120)
        moreupMoreParticle(rec, 'minecraft:explosion', c.x + nx * 12, c.y + 1, c.z + nz * 12, 8, 1, 8, 0, 12)
        moreupMoreTargets(b).forEach(t => {
            if ((t.x - c.x) * nx + (t.z - c.z) * nz <= 0) return
            moreupMoreHurt(rec, t, cfg.damage)
            moreupMoreRun(`effect give ${t.stringUuid} minecraft:darkness 2 0 true`)
        })
    })
}

// 13. 흩어지는 별빛 (1.14.2): 여러 사람 발밑에 푸른 별 원이 따라붙고 3초 뒤 터진다.
//     원 안에 다른 사람이 있으면 그 사람과 원 주인이 함께 맞는다 → 서로 떨어져야 한다. 혼자일 때는 쓰지 않는다
MOREUP_MORE_PATTERN_FNS.star_scatter = (rec, boss, targets, phase) => {
    let cfg = MOREUP_MORE_PATTERNS.star_scatter
    if (targets.length < 2) return 0
    let r = phase >= 3 ? cfg.radius + 1 : cfg.radius
    let marked = moreupMoreShuffle(targets.slice()).slice(0, cfg.maxMarks).map(t => t.uuid)
    moreupMoreWarn(targets, 'message.moreup.more.star_scatter')
    moreupMoreSound(rec, 'minecraft:block.amethyst_block.resonate', boss.x, boss.y, boss.z, 2, 0.8)
    moreupMoreRepeat(rec, 0, Math.floor(cfg.delay / 5), 5, (b, i) => {
        marked.forEach(u => {
            let t = moreupMoreFind(rec, u)
            if (t == null) return
            moreupMoreCircle(rec, 'minecraft:dust 0.4 0.8 1.0 1.4', t.x, t.y + 0.15, t.z, r, r * 4)
            moreupMoreParticle(rec, 'minecraft:end_rod', t.x, t.y + 2.4, t.z, 0.1, 0.1, 0.1, 0, 2)
        })
    })
    moreupMoreLater(rec, cfg.delay, b => {
        let all = moreupMoreTargets(b)
        let hits = {}
        marked.forEach(u => {
            let m = moreupMoreFind(rec, u)
            if (m == null) return
            let mk = String(m.stringUuid)
            moreupMoreParticle(rec, 'minecraft:firework', m.x, m.y + 1, m.z, r / 2, 0.5, r / 2, 0.05, 40)
            moreupMoreSound(rec, 'minecraft:entity.firework_rocket.blast', m.x, m.y, m.z, 1.5, 0.7)
            let others = all.filter(t => String(t.stringUuid) !== mk && Math.abs(t.y - m.y) <= 3 &&
                moreupMoreDist2(t.x, t.z, m.x, m.z) <= r * r)
            if (others.length === 0) return
            hits[mk] = (hits[mk] || 0) + 1
            others.forEach(t => { let k = String(t.stringUuid); hits[k] = (hits[k] || 0) + 1 })
        })
        // 여러 원이 겹쳐도 한 사람에게 최대 3번까지만
        all.forEach(t => {
            let n = hits[String(t.stringUuid)]
            if (n) moreupMoreHurt(rec, t, cfg.damage * Math.min(n, 3))
        })
    })
    return cfg.delay + 10
}

// 14. 황혼의 눈 (1.14.2): 모어의 눈이 2.5초 동안 빛을 모은 뒤 열린다. 그때 모어를 바라보고 있으면
//     피해 + 구속. 고개를 돌리면 피한다. 3단계는 두 번
MOREUP_MORE_PATTERN_FNS.dusk_gaze = (rec, boss, targets, phase) => {
    let cfg = MOREUP_MORE_PATTERNS.dusk_gaze
    let cosLimit = Math.cos(cfg.angle * MOREUP_MORE_DEG)
    let times = phase >= 3 ? 2 : 1
    moreupMoreWarn(targets, 'message.moreup.more.dusk_gaze')
    moreupMoreSound(rec, 'minecraft:entity.elder_guardian.curse', boss.x, boss.y, boss.z, 2, 0.6)
    for (let k = 0; k < times; k++) moreupMoreGazeOnce(rec, k * (cfg.delay + 12), cfg, cosLimit)
    return times * (cfg.delay + 12) + 10
}
function moreupMoreGazeOnce(rec, start, cfg, cosLimit) {
    moreupMoreRepeat(rec, start, Math.floor(cfg.delay / 5), 5, (b, i) => {
        moreupMoreParticle(rec, 'minecraft:dust 1.0 0.2 0.3 2.5', b.x, b.y + MOREUP_MORE_EYE_HEIGHT + 0.6, b.z, 0.25, 0.25, 0.25, 0, 6)
        moreupMoreParticle(rec, 'minecraft:enchant', b.x, b.y + MOREUP_MORE_EYE_HEIGHT, b.z, 1.5, 1, 1.5, 1, 20)
        if (i % 4 === 0) {
            let left = Math.max(1, Math.ceil((cfg.delay - i * 5) / 20))
            moreupMoreWarn(moreupMoreTargets(b), 'message.moreup.more.dusk_gaze.count', [String(left)])
        }
    })
    moreupMoreLater(rec, start + cfg.delay, b => {
        moreupMoreSound(rec, 'minecraft:entity.warden.sonic_boom', b.x, b.y, b.z, 2, 1.4)
        moreupMoreParticle(rec, 'minecraft:flash', b.x, b.y + MOREUP_MORE_EYE_HEIGHT, b.z, 0, 0, 0, 0, 1)
        moreupMoreTargets(b).forEach(t => {
            if (!moreupMoreLooksAt(t, b, cosLimit)) return
            moreupMoreHurt(rec, t, cfg.damage)
            moreupMoreRun(`effect give ${t.stringUuid} minecraft:slowness ${cfg.slowSeconds} 1 true`)
        })
    })
}

// 15. 심판의 운석 (1.14.2): 한 사람 자리에 금빛 원을 그리고 3.5초 뒤 운석이 떨어진다.
//     원 안에 모인 사람끼리 피해를 나눈다 (need 명 기준, 적게 모이면 한 사람당 더 크게). 아무도 없으면 전원이 큰 피해.
//     3단계·4명 이상이면 원 두 개
MOREUP_MORE_PATTERN_FNS.judgment_meteor = (rec, boss, targets, phase) => {
    let cfg = MOREUP_MORE_PATTERNS.judgment_meteor
    let level = boss.level
    let count = phase >= 3 && targets.length >= 4 ? 2 : 1
    let spots = moreupMoreShuffle(targets.slice()).slice(0, count).map(t => ({ x: t.x, y: moreupMoreGroundY(level, t.x, t.y, t.z), z: t.z }))
    let need = Math.max(1, Math.min(cfg.need, Math.floor(targets.length / spots.length)))
    moreupMoreWarn(targets, 'message.moreup.more.judgment_meteor')
    moreupMoreSound(rec, 'minecraft:block.respawn_anchor.charge', boss.x, boss.y, boss.z, 2, 0.5)
    moreupMoreRepeat(rec, 0, Math.floor(cfg.delay / 5), 5, (b, i) => {
        spots.forEach(s => {
            moreupMoreCircle(rec, 'minecraft:dust 1.0 0.75 0.1 1.8', s.x, s.y + 0.15, s.z, cfg.radius, cfg.radius * 5)
            moreupMoreParticle(rec, 'minecraft:flame', s.x, s.y + 16 - i, s.z, 0.6, 0.6, 0.6, 0.02, 10)
        })
        if (i % 4 === 0) {
            let left = Math.max(1, Math.ceil((cfg.delay - i * 5) / 20))
            moreupMoreWarn(moreupMoreTargets(b), 'message.moreup.more.judgment_meteor.count', [String(left), String(need)])
        }
    })
    moreupMoreLater(rec, cfg.delay, b => {
        let all = moreupMoreTargets(b)
        spots.forEach(s => {
            moreupMoreParticle(rec, 'minecraft:explosion_emitter', s.x, s.y + 0.5, s.z, 0, 0, 0, 0, 1)
            moreupMoreParticle(rec, 'minecraft:lava', s.x, s.y + 0.5, s.z, cfg.radius / 2, 0.3, cfg.radius / 2, 0, 30)
            moreupMoreSound(rec, 'minecraft:entity.generic.explode', s.x, s.y, s.z, 3, 0.6)
            let inside = all.filter(t => Math.abs(t.y - s.y) <= 3 && moreupMoreDist2(t.x, t.z, s.x, s.z) <= cfg.radius * cfg.radius)
            if (inside.length === 0) {
                all.forEach(t => moreupMoreHurt(rec, t, cfg.damage * cfg.failMultiplier))
                return
            }
            let per = Math.max(cfg.damage * cfg.minShare, cfg.damage * need / inside.length)
            inside.forEach(t => {
                moreupMoreHurt(rec, t, per)
                moreupMorePushFrom(t, s.x, s.z, 0.3, 0.5)
            })
        })
    })
    return cfg.delay + 15
}

// ---------- 평타 강화 (1.14.2) ----------

const $MoreUpMoreUUID = Java.loadClass('java.util.UUID')
const $MoreUpMoreAttributes = Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes')
const $MoreUpMoreModifier = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier')
const $MoreUpMoreOperation = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier$Operation')
const $MoreUpMoreMeleeGoal = Java.loadClass('net.minecraft.world.entity.ai.goal.MeleeAttackGoal')
const MOREUP_MORE_MELEE_UUID = $MoreUpMoreUUID.fromString(MOREUP_MORE_MELEE_ID)

// 공격력 속성 수정치: 같은 UUID 를 쓰므로 여러 번 불러도 겹치지 않는다. 값이 바뀌었으면 교체
function moreupMoreApplyMeleeDamage(boss) {
    let inst = boss.getAttribute($MoreUpMoreAttributes.ATTACK_DAMAGE)
    if (!inst) return
    let amount = MOREUP_MORE_MELEE_DAMAGE - 1
    let existing = inst.getModifier(MOREUP_MORE_MELEE_UUID)
    if (existing && Math.abs(existing.getAmount() - amount) < 0.000001) return
    if (existing) inst.removeModifier(MOREUP_MORE_MELEE_UUID)
    if (Math.abs(amount) < 0.000001) return
    inst.addPermanentModifier(new $MoreUpMoreModifier(MOREUP_MORE_MELEE_UUID, MOREUP_MORE_MELEE_NAME, amount, $MoreUpMoreOperation.MULTIPLY_TOTAL))
}

// 근접 공격 대기 시간 리플렉션 (Forge 1.20.1 실행 환경 SRG 이름, 서버 jar 에서 확인):
//   Mob.goalSelector = f_21345_, GoalSelector.getAvailableGoals() = m_148105_, WrappedGoal.getGoal() = m_26015_,
//   MeleeAttackGoal.ticksUntilNextAttack = f_25548_ (공격 뒤 20, 틱마다 1씩 줄어 0 이면 다시 공격),
//   MeleeAttackGoal.lastCanUseCheck = f_25550_ (canUse 는 Level.getGameTime() = m_46467_ 기준 20틱에 한 번만 통과)
// 대상 옆에 서서 때릴 때는 길찾기가 끝나 목표가 멈췄다가 canUse 로 다시 시작하며(시작할 때 대기 0) 때린다.
// 그래서 공격 대기만 줄이면 움직이는 동안만 빨라지고 서서 때릴 때는 20틱에 한 번이다 (2026-11-13 시험 서버 확인).
// 두 대기를 같은 배율로 줄인다
let moreupMoreMeleeRefl = null // null = 아직, false = 쓸 수 없음
const MOREUP_MORE_CAN_USE_WAIT = 20 // MeleeAttackGoal 의 canUse 재검사 간격 (바닐라 상수)
function moreupMoreFindDeclared(className, name, isField) {
    let c = Java.loadClass(className).__javaObject__
    let list = isField ? c.getDeclaredFields() : c.getDeclaredMethods()
    for (let i = 0; i < list.length; i++) {
        if (String(list[i].getName()) === name) {
            list[i].setAccessible(true)
            return list[i]
        }
    }
    throw new Error(`${className}#${name} 없음`)
}
function moreupMoreMeleeReady() {
    if (moreupMoreMeleeRefl !== null) return moreupMoreMeleeRefl !== false
    try {
        moreupMoreMeleeRefl = {
            selector: moreupMoreFindDeclared('net.minecraft.world.entity.Mob', 'f_21345_', true),
            goals: moreupMoreFindDeclared('net.minecraft.world.entity.ai.goal.GoalSelector', 'm_148105_', false),
            goal: moreupMoreFindDeclared('net.minecraft.world.entity.ai.goal.WrappedGoal', 'm_26015_', false),
            cooldown: moreupMoreFindDeclared('net.minecraft.world.entity.ai.goal.MeleeAttackGoal', 'f_25548_', true),
            lastCheck: moreupMoreFindDeclared('net.minecraft.world.entity.ai.goal.MeleeAttackGoal', 'f_25550_', true),
            gameTime: moreupMoreFindDeclared('net.minecraft.world.level.Level', 'm_46467_', false)
        }
        return true
    } catch (e) {
        moreupMoreMeleeRefl = false
        console.error(`[MoreUp] 모어 평타 빈도 강화를 쓸 수 없습니다: ${e}`)
        return false
    }
}

// 매 틱: 전투 중인 모어의 근접 공격 대기와 canUse 재검사 대기를 (배율 - 1) 만큼 더 줄인다
// (시간이 1 흐르므로 합쳐서 배율만큼). 재검사 대기는 원래 간격(20틱)을 넘겨 당기지 않는다
function moreupMoreMeleeTick() {
    let extra = Math.round(MOREUP_MORE_MELEE_SPEED) - 1
    if (extra <= 0) return
    for (let key in moreupMoreBosses) {
        let rec = moreupMoreBosses[key]
        if (!rec.engaged) continue
        let boss = moreupMoreFind(rec, rec.uuid)
        if (boss == null) continue
        if (!moreupMoreMeleeReady()) return
        let R = moreupMoreMeleeRefl
        let now = Number(R.gameTime.invoke(boss.level))
        R.goals.invoke(R.selector.get(boss)).forEach(wrapped => {
            let g = R.goal.invoke(wrapped)
            if (!(g instanceof $MoreUpMoreMeleeGoal)) return
            let left = R.cooldown.getInt(g)
            if (left > 0) R.cooldown.setInt(g, Math.max(0, left - extra))
            let last = Number(R.lastCheck.getLong(g))
            let waited = now - last
            if (waited >= 0 && waited < MOREUP_MORE_CAN_USE_WAIT) {
                R.lastCheck.setLong(g, Math.max(now - MOREUP_MORE_CAN_USE_WAIT, last - extra))
            }
        })
    }
}

// ---------- 전투 진행 ----------

function moreupMoreRegister(entity) {
    let key = String(entity.stringUuid)
    if (moreupMoreBosses[key]) return
    moreupMoreBosses[key] = {
        key: key,
        uuid: entity.uuid,
        dim: String(entity.level.dimension),
        guardTag: 'moreup_more_guard_' + key.substring(0, 8),
        phase: 1,
        engaged: false,
        nextAt: 0,
        busyUntil: 0,
        last: null,
        cooldowns: {},
        lastDuskUsed: {}
    }
    // 서버가 꺼질 때 남아 있던 이 보스의 수호병 정리 (같은 보스는 같은 태그).
    // 엔티티가 월드에 들어오는 도중에 명령을 돌리지 않도록 tick 에서 처리한다
    moreupMorePendingKills.push(moreupMoreBosses[key].guardTag)
    // 평타 공격력 (등록될 때마다 확인: 소환·청크 로드·/reload 뒤 첫 피격)
    try { moreupMoreApplyMeleeDamage(entity) } catch (e) { moreupMoreError('평타 공격력', e) }
}

function moreupMorePhaseOf(boss) {
    let max = boss.getMaxHealth()
    let ratio = max > 0 ? boss.getHealth() / max : 1
    return { ratio: ratio, phase: ratio <= MOREUP_MORE_PHASE3 ? 3 : ratio <= MOREUP_MORE_PHASE2 ? 2 : 1 }
}

function moreupMoreChoose(rec, targets, phase) {
    let pool = []
    let total = 0
    for (let id in MOREUP_MORE_PATTERNS) {
        if (id === 'last_dusk') continue
        let cfg = MOREUP_MORE_PATTERNS[id]
        if (!cfg.enabled || phase < cfg.minPhase || id === rec.last) continue
        if ((rec.cooldowns[id] || 0) > moreupMoreTick) continue
        pool.push(id)
        total += cfg.weight
    }
    if (pool.length === 0) return null
    let roll = Math.random() * total
    for (let i = 0; i < pool.length; i++) {
        roll -= MOREUP_MORE_PATTERNS[pool[i]].weight
        if (roll <= 0) return pool[i]
    }
    return pool[pool.length - 1]
}

function moreupMoreStart(rec, boss, targets, phase, id) {
    let duration = MOREUP_MORE_PATTERN_FNS[id](rec, boss, targets, phase)
    if (!duration || duration <= 0) {
        rec.cooldowns[id] = moreupMoreTick + 100 // 쓸 수 없는 상황이면 5초 뒤 다시 후보
        return false
    }
    rec.last = id
    rec.busyUntil = moreupMoreTick + duration
    rec.nextAt = rec.busyUntil + MOREUP_MORE_PATTERN_GAP[phase]
    let cd = MOREUP_MORE_PATTERNS[id].cooldown
    if (cd) rec.cooldowns[id] = moreupMoreTick + cd * 20
    return true
}

function moreupMoreScan() {
    for (let key in moreupMoreBosses) {
        let rec = moreupMoreBosses[key]
        let boss = moreupMoreFind(rec, rec.uuid)
        if (boss == null) {
            // 죽었거나 청크가 내려갔다. 다시 로드되면 spawned 이벤트로 새로 등록된다
            delete moreupMoreBosses[key]
            continue
        }
        let targets = moreupMoreTargets(boss)
        if (targets.length === 0) {
            rec.engaged = false
            continue
        }
        if (!rec.engaged) {
            rec.engaged = true
            rec.nextAt = Math.max(rec.nextAt, moreupMoreTick + MOREUP_MORE_FIRST_DELAY)
        }
        let st = moreupMorePhaseOf(boss)
        if (st.phase > rec.phase) {
            rec.phase = st.phase
            moreupMoreTitle(targets, `message.moreup.more.phase${st.phase}.title`, `message.moreup.more.phase${st.phase}.subtitle`)
            moreupMoreSound(rec, 'minecraft:entity.ender_dragon.growl', boss.x, boss.y, boss.z, 3, 0.6)
        }
        if (moreupMoreTick < rec.busyUntil) continue

        // 최후의 황혼은 간격과 상관없이 체력 기준으로 먼저 발동
        if (MOREUP_MORE_PATTERNS.last_dusk.enabled) {
            let fired = false
            for (let i = 0; i < MOREUP_MORE_LAST_DUSK_AT.length && !fired; i++) {
                let at = MOREUP_MORE_LAST_DUSK_AT[i]
                if (st.ratio <= at && !rec.lastDuskUsed[String(at)]) {
                    rec.lastDuskUsed[String(at)] = true
                    fired = moreupMoreStart(rec, boss, targets, rec.phase, 'last_dusk')
                }
            }
            if (fired) continue
        }
        if (moreupMoreTick < rec.nextAt) continue
        let id = moreupMoreChoose(rec, targets, rec.phase)
        if (id != null) moreupMoreStart(rec, boss, targets, rec.phase, id)
    }
}

// ---------- 이벤트 ----------

if ($MoreUpMoreRegistries.ENTITY_TYPES.containsKey(new $MoreUpMoreRL(MOREUP_MORE_ID))) {
    EntityEvents.spawned(MOREUP_MORE_ID, event => {
        try { moreupMoreRegister(event.entity) } catch (e) { moreupMoreError('등록', e) }
    })
    // /reload 뒤에는 spawned 가 다시 오지 않으므로 맞을 때도 등록을 확인한다
    EntityEvents.hurt(MOREUP_MORE_ID, event => {
        try { moreupMoreRegister(event.entity) } catch (e) { moreupMoreError('등록(피격)', e) }
    })
    EntityEvents.death(MOREUP_MORE_ID, event => {
        try {
            let key = String(event.entity.stringUuid)
            let rec = moreupMoreBosses[key]
            if (rec) moreupMorePendingKills.push(rec.guardTag)
            delete moreupMoreBosses[key]
        } catch (e) { moreupMoreError('사망 정리', e) }
    })

    ServerEvents.tick(event => {
        try {
            moreupMoreServer = event.server
            moreupMoreTick++
            if (moreupMorePendingKills.length > 0) {
                let tags = moreupMorePendingKills
                moreupMorePendingKills = []
                tags.forEach(tag => moreupMoreRun(`kill @e[tag=${tag}]`))
            }
            moreupMoreRunQueue()
            if (moreupMoreTick % MOREUP_MORE_SCAN_INTERVAL === 0) moreupMoreScan()
        } catch (e) {
            moreupMoreError('tick', e)
        }
        try {
            moreupMoreMeleeTick()
        } catch (e) {
            moreupMoreError('평타 빈도', e)
        }
    })

    ServerEvents.commandRegistry(event => {
        const { commands: Commands } = event
        let root = Commands.literal('moreup_more').requires(src => src.hasPermission(2))
        for (let id in MOREUP_MORE_PATTERN_FNS) root = root.then(moreupMoreTestCommand(Commands, id))
        event.register(root)
    })
    console.info(`[MoreUp] 모어 추가 패턴 ${Object.keys(MOREUP_MORE_PATTERN_FNS).filter(id => MOREUP_MORE_PATTERNS[id].enabled !== false).length}종 사용 (전체 ${Object.keys(MOREUP_MORE_PATTERN_FNS).length}), 평타 공격력 x${MOREUP_MORE_MELEE_DAMAGE}·빈도 x${MOREUP_MORE_MELEE_SPEED}`)
} else {
    console.warn(`[MoreUp] ${MOREUP_MORE_ID} 가 없어 모어 추가 패턴을 건너뜀`)
}

// /moreup_more <패턴>: 실행한 플레이어 64블록 안의 모어가 그 패턴을 바로 쓴다 (테스트용)
function moreupMoreTestCommand(Commands, id) {
    return Commands.literal(id).executes(ctx => {
        try {
            let player = ctx.source.player
            if (player == null) return 0
            moreupMoreServer = ctx.source.server
            if (MOREUP_MORE_PATTERNS[id].enabled === false) {
                player.tell(Text.translate('message.moreup.more.test.fail', id).lightPurple())
                return 0
            }
            let best = null
            for (let key in moreupMoreBosses) {
                let rec = moreupMoreBosses[key]
                if (rec.dim !== String(player.level.dimension)) continue
                let boss = moreupMoreFind(rec, rec.uuid)
                if (boss != null && moreupMoreDist2(boss.x, boss.z, player.x, player.z) <= 64 * 64) best = { rec: rec, boss: boss }
            }
            if (best == null) {
                player.tell(Text.translate('message.moreup.more.test.no_boss').red())
                return 0
            }
            let targets = moreupMoreTargets(best.boss)
            if (targets.length === 0) targets = [player]
            let phase = moreupMorePhaseOf(best.boss).phase
            let ok = moreupMoreStart(best.rec, best.boss, targets, Math.max(phase, MOREUP_MORE_PATTERNS[id].minPhase || 1), id)
            player.tell(Text.translate(ok ? 'message.moreup.more.test.ok' : 'message.moreup.more.test.fail', id).lightPurple())
            return ok ? 1 : 0
        } catch (e) {
            moreupMoreError(`테스트 명령 ${id}`, e)
            return 0
        }
    })
}
