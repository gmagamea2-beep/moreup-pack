// priority: 0
// ============================================================
// More Up: 메인 스토리 컷씬 엔진 (2026-10-27)
// 경로: kubejs/server_scripts/story/cutscene.js   대본: cutscene_scenes.js
//
// 연출 (KubeJS Painter 로 그 플레이어 화면에만 그린다. 클라이언트 모드 추가 없음)
//   검은 화면에서 밝아지며 위아래 영화 띠가 내려온다 → 가운데 제목 카드(서서히 나타났다 사라짐)
//   → 아래 띠에 내레이션이 한 글자씩 써진다(타자 소리) → 띠가 걷히며 끝난다
//   끝나면 채팅에 대사 기록과 [다시 보기] 버튼을 남긴다
//   1.5.4: 2D 애니메이션 — 단계마다 화면 가운데에 움직이는 그림(빛·별·파편·톱니바퀴·별자리 등), 장면 배경 별빛,
//          제목 카드 확대→제자리·밑줄 펼침. 정의는 cutscene_anims.js, 대본에서 anim / ambient 로 지정
//
// 명령어 (권한 0)
//   /story              본 이야기 목록 (눌러서 다시 보기)
//   /story play <장면>  다시 보기. 아직 열리지 않은 장면은 권한 2 이상(퀘스트 보상)만 재생할 수 있다
//   /story skip         지금 보고 있는 컷씬 끝내기 (Shift 를 1.5초 누르고 있어도 된다)
//   /story unlock <플레이어> <장면|all>   (권한 2) 컷씬 도입 전에 퀘스트를 지난 플레이어에게 장면 열기
//
// 퀘스트 연결: 메인 스토리 보상 → /function scene:actN_start (elevate_perms) → story play actN
//   재생하면 그 플레이어와 같은 FTB 팀 전체에 장면이 열린다. 접속 중인 팀원에게는 [보기] 알림을 보낸다
//
// 안전장치: 컷씬 중 피해를 입으면 바로 끝낸다(무적을 주지 않는다). 퇴장하면 상태를 지운다.
//   상태는 UUID 문자열로만 들고, 플레이어 객체는 매 틱 다시 찾는다.
// ============================================================

const MOREUP_CS_OBJECTS = ['mu_cs_top', 'mu_cs_bottom', 'mu_cs_fade', 'mu_cs_title', 'mu_cs_line', 'mu_cs_sub', 'mu_cs_text', 'mu_cs_hint']
const MOREUP_CS_BAR = '$screenH/7'          // 영화 띠 높이 (화면 높이 기준)
const MOREUP_CS_INTRO_TICKS = 24
const MOREUP_CS_OUTRO_TICKS = 24
const MOREUP_CS_TITLE_FADE_TICKS = 15
const MOREUP_CS_TICKS_PER_CHAR = 1          // 타자 속도 (1 = 초당 20글자)
const MOREUP_CS_TEXT_FADE_TICKS = 8
const MOREUP_CS_UPDATE_EVERY = 2            // 화면 갱신 간격 (틱)
const MOREUP_CS_TYPE_SOUND_EVERY = 4
const MOREUP_CS_SKIP_HOLD_TICKS = 30
const MOREUP_CS_LINE_CHARS = 30             // 한 줄 최대 글자 수 (GUI 크기 4 에서도 화면 안에 들어오게)
const MOREUP_CS_MIN_TEXT_ALPHA = 10         // 글자 알파가 4 미만이면 마인크래프트가 불투명으로 그려서 최소값을 둔다
const MOREUP_CS_TEAM_KEY_PREFIX = 'moreupStoryTeam_'
const MOREUP_CS_PLAYER_KEY = 'moreupStorySeen'
// 1.5.4 애니메이션 (정의는 cutscene_anims.js). 오브젝트 ID: mu_cs_a0.. (단계 애니메이션), mu_cs_s0.. (배경 별빛)
const MOREUP_CS_ANIM_MAX = 40
const MOREUP_CS_AMBIENT_MAX = 16
const MOREUP_CS_AMBIENT_UPDATE_EVERY = 4
const MOREUP_CS_TITLE_ZOOM_TICKS = 24        // 제목 카드가 커진 상태에서 제자리로 줄어드는 시간
const MOREUP_CS_TITLE_SCALE = 2.6
const MOREUP_CS_TITLE_SCALE_FROM = 3.3
const MOREUP_CS_TITLE_LINE_W = 140
// 컷씬 동안 월드를 살짝 어둡게 남겨 둔다 (밝은 낮 하늘에서도 빛·별 애니메이션과 글자가 보이게). 0 이면 예전처럼 완전히 밝아짐
const MOREUP_CS_DIM_ALPHA = 105

const $MoreUpCsUUID = Java.loadClass('java.util.UUID')
const $MoreUpCsTeams = (() => {
    try { return Java.loadClass('dev.ftb.mods.ftbteams.api.FTBTeamsAPI') } catch (e) { return null }
})()

const moreupCsActive = {}   // UUID 문자열 → 재생 상태
let moreupCsErrors = 0

// ---------------------------------------------------------- 공통 도구

function moreupCsLog(msg) {
    if (moreupCsErrors < 20) {
        moreupCsErrors++
        console.error(`[MoreUp] 컷씬: ${msg}`)
    }
}

function moreupCsHex2(n) {
    let v = Math.max(0, Math.min(255, Math.floor(n)))
    let s = v.toString(16).toUpperCase()
    return s.length < 2 ? '0' + s : s
}

function moreupCsColor(alpha, rgb) {
    return '#' + moreupCsHex2(alpha) + rgb
}

function moreupCsEase(k) {
    let x = Math.max(0, Math.min(1, k))
    return x * x * (3 - 2 * x)
}

// 띄어쓰기 기준 줄바꿈
function moreupCsWrap(text, max) {
    let words = String(text).split(' ')
    let lines = []
    let cur = ''
    for (let i = 0; i < words.length; i++) {
        let w = words[i]
        if (cur.length === 0) cur = w
        else if (cur.length + 1 + w.length <= max) cur = cur + ' ' + w
        else {
            lines.push(cur)
            cur = w
        }
    }
    if (cur.length > 0) lines.push(cur)
    return lines
}

// 앞에서 n 글자만 보이게. 줄 수는 유지해서(빈 줄은 ' ') 글자가 늘어도 위치가 흔들리지 않게 한다
function moreupCsReveal(lines, n) {
    let out = []
    let left = n
    for (let i = 0; i < lines.length; i++) {
        let l = lines[i]
        if (left <= 0) out.push(' ')
        else if (left >= l.length) {
            out.push(l)
            left -= l.length
        } else {
            out.push(l.substring(0, left))
            left = 0
        }
    }
    return out
}

function moreupCsPlayer(server, uuid) {
    try {
        return server.playerList.getPlayer($MoreUpCsUUID.fromString(uuid))
    } catch (e) {
        return null
    }
}

function moreupCsPaint(player, obj) {
    try {
        player.paint(obj)
    } catch (e) {
        moreupCsLog(`paint 실패 (${player.name.string}): ${e}`)
    }
}

function moreupCsClearAll(player) {
    let obj = {}
    MOREUP_CS_OBJECTS.forEach(id => { obj[id] = { remove: true } })
    for (let i = 0; i < MOREUP_CS_ANIM_MAX; i++) obj['mu_cs_a' + i] = { remove: true }
    for (let i = 0; i < MOREUP_CS_AMBIENT_MAX; i++) obj['mu_cs_s' + i] = { remove: true }
    moreupCsPaint(player, obj)
}

// ---------------------------------------------------------- 애니메이션 (cutscene_anims.js 정의를 재생)

function moreupCsMerge(a, b) {
    let out = {}
    for (let key in a) out[key] = a[key]
    for (let key in b) out[key] = b[key]
    return out
}

function moreupCsAnimStop(player, st) {
    if (!st.anim) return
    let obj = {}
    for (let i = 0; i < st.anim.n; i++) obj['mu_cs_a' + i] = { remove: true }
    moreupCsPaint(player, obj)
    st.anim = null
}

function moreupCsAnimStart(player, st, seg) {
    let name = seg.step.anim
    let def = typeof MOREUP_CS_ANIMS !== 'undefined' ? MOREUP_CS_ANIMS[name] : null
    if (!def) {
        moreupCsLog(`없는 애니메이션: ${name} (${st.id})`)
        return
    }
    let n = Math.min(def.objects, MOREUP_CS_ANIM_MAX)
    let obj = {}
    for (let i = 0; i < n; i++) obj['mu_cs_a' + i] = moreupCsMerge(def.make(i), def.frame(i, 0, 0))
    moreupCsPaint(player, obj)
    st.anim = { def: def, n: n, start: seg.start, dur: seg.end - seg.start, fired: {} }
}

function moreupCsAnimFrame(server, player, st) {
    let a = st.anim
    let e = st.t - a.start
    let k = Math.max(0, Math.min(1, e / a.dur))
    // 효과음·파티클 신호 (애니메이션의 특정 순간, 예: 파편이 터지는 때)
    if (a.def.cues) {
        a.def.cues.forEach((cue, idx) => {
            if (a.fired[idx] || k < cue.at) return
            a.fired[idx] = true
            moreupCsSound(server, st.uuid, cue.sound)
            moreupCsParticle(server, st.uuid, cue.particle)
        })
    }
    let obj = {}
    for (let i = 0; i < a.n; i++) obj['mu_cs_a' + i] = a.def.frame(i, k, e)
    moreupCsPaint(player, obj)
}

function moreupCsAmbientStart(player, st) {
    let name = st.scene.ambient
    let def = name && typeof MOREUP_CS_AMBIENTS !== 'undefined' ? MOREUP_CS_AMBIENTS[name] : null
    if (!def) return
    let n = Math.min(def.objects, MOREUP_CS_AMBIENT_MAX)
    let obj = {}
    for (let i = 0; i < n; i++) obj['mu_cs_s' + i] = moreupCsMerge(def.make(i), def.frame(i, 0))
    moreupCsPaint(player, obj)
    st.amb = { def: def, n: n }
}

function moreupCsAmbientFrame(player, st) {
    let obj = {}
    for (let i = 0; i < st.amb.n; i++) obj['mu_cs_s' + i] = st.amb.def.frame(i, st.t)
    moreupCsPaint(player, obj)
}

function moreupCsAmbientStop(player, st) {
    if (!st.amb) return
    let obj = {}
    for (let i = 0; i < st.amb.n; i++) obj['mu_cs_s' + i] = { remove: true }
    moreupCsPaint(player, obj)
    st.amb = null
}

function moreupCsRun(server, cmd) {
    try {
        server.runCommandSilent(cmd)
    } catch (e) {
        moreupCsLog(`명령 실패 "${cmd}": ${e}`)
    }
}

function moreupCsSound(server, uuid, sound) {
    if (!sound) return
    moreupCsRun(server, `execute as ${uuid} at @s run playsound ${sound[0]} master @s ~ ~ ~ ${sound[1]} ${sound[2]}`)
}

function moreupCsParticle(server, uuid, particle) {
    if (!particle) return
    moreupCsRun(server, `execute as ${uuid} at @s run particle ${particle[0]} ~ ~1.2 ~ 1.4 0.8 1.4 0.02 ${particle[1]} normal @s`)
}

function moreupCsEffect(server, uuid, effect) {
    if (!effect) return
    moreupCsRun(server, `effect give ${uuid} ${effect[0]} ${effect[1]} 0 true`)
}

function moreupCsCrouching(p) {
    try { if (typeof p.isCrouching === 'function') return !!p.isCrouching() } catch (e) { }
    try { if (typeof p.isShiftKeyDown === 'function') return !!p.isShiftKeyDown() } catch (e) { }
    try { return !!p.crouching } catch (e) { }
    return false
}

function moreupCsTellraw(server, uuid, parts) {
    moreupCsRun(server, `tellraw ${uuid} ${JSON.stringify(parts)}`)
}

// ---------------------------------------------------------- 열린 장면 기록 (플레이어 + FTB 팀)

function moreupCsTeam(player) {
    if (!$MoreUpCsTeams) return null
    try {
        let opt = $MoreUpCsTeams.api().getManager().getTeamForPlayer(player)
        return opt.isPresent() ? opt.get() : null
    } catch (e) {
        return null
    }
}

function moreupCsSplit(s) {
    let str = String(s)
    return str === '' ? [] : str.split(',')
}

function moreupCsUnlocked(server, player) {
    let set = {}
    moreupCsSplit(player.persistentData.getString(MOREUP_CS_PLAYER_KEY)).forEach(id => { set[id] = true })
    let team = moreupCsTeam(player)
    if (team) {
        moreupCsSplit(server.persistentData.getString(MOREUP_CS_TEAM_KEY_PREFIX + team.getId())).forEach(id => { set[id] = true })
    }
    return set
}

function moreupCsAddTo(tag, key, sceneId) {
    let list = moreupCsSplit(tag.getString(key))
    if (list.indexOf(sceneId) >= 0) return false
    list.push(sceneId)
    tag.putString(key, list.join(','))
    return true
}

// 그 플레이어와 팀에 장면을 연다. 새로 열린 접속 중 팀원 목록을 돌려준다
function moreupCsUnlock(server, player, sceneId) {
    moreupCsAddTo(player.persistentData, MOREUP_CS_PLAYER_KEY, sceneId)
    let others = []
    let team = moreupCsTeam(player)
    if (!team) return others
    moreupCsAddTo(server.persistentData, MOREUP_CS_TEAM_KEY_PREFIX + team.getId(), sceneId)
    try {
        team.getOnlineMembers().forEach(m => {
            if (String(m.stringUuid) !== String(player.stringUuid)) others.push(m)
        })
    } catch (e) {
        moreupCsLog(`팀원 조회 실패: ${e}`)
    }
    return others
}

// ---------------------------------------------------------- 타임라인

function moreupCsTextHold(step) {
    if (step.hold) return step.hold
    return Math.max(50, Math.floor(String(step.text).length * 1.4))
}

function moreupCsBuild(scene) {
    let segs = []
    let t = 0
    let push = (kind, dur, step) => {
        segs.push({ kind: kind, start: t, end: t + dur, step: step })
        t += dur
    }
    if (scene.delay) push('wait', scene.delay, null)
    push('intro', MOREUP_CS_INTRO_TICKS, null)
    scene.steps.forEach(step => {
        if (step.title) push('title', MOREUP_CS_TITLE_FADE_TICKS * 2 + (step.hold || 50), step)
        else if (step.text) {
            step._lines = moreupCsWrap(step.text, MOREUP_CS_LINE_CHARS)
            step._len = String(step.text).length
            push('text', step._len * MOREUP_CS_TICKS_PER_CHAR + moreupCsTextHold(step), step)
        } else push('pause', step.pause || 20, step)
    })
    push('outro', MOREUP_CS_OUTRO_TICKS, null)
    return { segs: segs, total: t }
}

// ---------------------------------------------------------- 재생

function moreupCsBars(player, k) {
    let h = `${MOREUP_CS_BAR}*${moreupCsEase(k).toFixed(3)}`
    moreupCsPaint(player, { mu_cs_top: { h: h }, mu_cs_bottom: { h: h } })
}

function moreupCsClearCenter(player, st) {
    if (!st.center) return
    moreupCsPaint(player, { mu_cs_title: { remove: true }, mu_cs_line: { remove: true }, mu_cs_sub: { remove: true }, mu_cs_text: { remove: true } })
    st.center = false
}

function moreupCsEnter(server, player, st, seg) {
    let uuid = st.uuid
    let step = seg.step
    let accent = st.scene.accent || 'FFFFFF'
    // 앞 단계의 애니메이션은 단계가 바뀌면 지운다
    moreupCsAnimStop(player, st)
    if (seg.kind !== 'intro' && !st.introDone) {
        // 인트로 마지막 갱신이 2틱 간격이라 띠·페이드가 덜 끝난 채 남지 않게 마무리한다
        st.introDone = true
        moreupCsPaint(player, { mu_cs_top: { h: MOREUP_CS_BAR }, mu_cs_bottom: { h: MOREUP_CS_BAR }, mu_cs_fade: { color: moreupCsColor(MOREUP_CS_DIM_ALPHA, '000000') } })
        moreupCsAmbientStart(player, st)
    }
    if (step) {
        moreupCsSound(server, uuid, step.sound)
        moreupCsParticle(server, uuid, step.particle)
        moreupCsEffect(server, uuid, step.effect)
    }
    if (seg.kind === 'intro') {
        moreupCsPaint(player, {
            mu_cs_top: { type: 'rectangle', x: 0, y: 0, w: '$screenW', h: 0, color: '#FF000000', draw: 'always' },
            mu_cs_bottom: { type: 'rectangle', x: 0, y: 0, w: '$screenW', h: 0, color: '#FF000000', alignY: 'bottom', draw: 'always' },
            mu_cs_fade: { type: 'rectangle', x: 0, y: 0, w: '$screenW', h: '$screenH', color: '#FF000000', draw: 'always' },
            mu_cs_hint: { type: 'text', text: '[Shift] 길게 눌러 건너뛰기', x: -6, y: 5, alignX: 'right', scale: 0.75, color: '#FF8A8A8A', shadow: true, draw: 'always' }
        })
    } else if (seg.kind === 'title') {
        moreupCsClearCenter(player, st)
        moreupCsPaint(player, {
            mu_cs_title: { type: 'text', text: step.title, alignX: 'center', alignY: 'center', centered: true, y: -16, scale: MOREUP_CS_TITLE_SCALE_FROM, shadow: true, color: moreupCsColor(MOREUP_CS_MIN_TEXT_ALPHA, accent), draw: 'always' },
            mu_cs_line: { type: 'rectangle', w: 0, h: 1, alignX: 'center', alignY: 'center', y: 4, color: moreupCsColor(0, accent), draw: 'always' },
            mu_cs_sub: { type: 'text', text: step.sub || ' ', alignX: 'center', alignY: 'center', centered: true, y: 14, scale: 1.2, shadow: true, color: moreupCsColor(MOREUP_CS_MIN_TEXT_ALPHA, 'FFFFFF'), draw: 'always' }
        })
        st.center = true
    } else if (seg.kind === 'text') {
        moreupCsClearCenter(player, st)
        let n = step._lines.length
        moreupCsPaint(player, {
            mu_cs_text: {
                type: 'text', textLines: moreupCsReveal(step._lines, 0), alignX: 'center', alignY: 'bottom', centered: true,
                y: `${n * 5}-$screenH/14`, lineSpacing: 10, shadow: true, color: moreupCsColor(255, step.color || 'EEEEEE'), draw: 'always'
            }
        })
        st.center = true
        st.shown = 0
    } else if (seg.kind === 'pause' || seg.kind === 'outro') {
        moreupCsClearCenter(player, st)
        if (seg.kind === 'outro') {
            moreupCsPaint(player, { mu_cs_hint: { remove: true } })
            moreupCsAmbientStop(player, st)
        }
    }
    if (step && step.anim) moreupCsAnimStart(player, st, seg)
}

function moreupCsUpdate(server, player, st, seg, e) {
    let dur = seg.end - seg.start
    let step = seg.step
    if (seg.kind === 'intro') {
        let k = e / dur
        moreupCsBars(player, k)
        moreupCsPaint(player, { mu_cs_fade: { color: moreupCsColor(255 - (255 - MOREUP_CS_DIM_ALPHA) * moreupCsEase(k), '000000') } })
    } else if (seg.kind === 'outro') {
        moreupCsBars(player, 1 - e / dur)
        let dim = MOREUP_CS_DIM_ALPHA * (1 - moreupCsEase(e / dur))
        moreupCsPaint(player, { mu_cs_fade: { color: moreupCsColor(dim < 4 ? 0 : dim, '000000') } })
    } else if (seg.kind === 'title') {
        let a = 1
        if (e < MOREUP_CS_TITLE_FADE_TICKS) a = e / MOREUP_CS_TITLE_FADE_TICKS
        else if (e > dur - MOREUP_CS_TITLE_FADE_TICKS) a = (dur - e) / MOREUP_CS_TITLE_FADE_TICKS
        a = moreupCsEase(a)
        let ta = MOREUP_CS_MIN_TEXT_ALPHA + (255 - MOREUP_CS_MIN_TEXT_ALPHA) * a
        let accent = st.scene.accent || 'FFFFFF'
        // 1.5.4: 제목이 크게 나타나 제자리로 줄어들고, 밑줄이 가운데서 양옆으로 펼쳐진다
        let zoom = moreupCsEase(Math.min(1, e / MOREUP_CS_TITLE_ZOOM_TICKS))
        moreupCsPaint(player, {
            mu_cs_title: { color: moreupCsColor(ta, accent), scale: Number((MOREUP_CS_TITLE_SCALE + (MOREUP_CS_TITLE_SCALE_FROM - MOREUP_CS_TITLE_SCALE) * (1 - zoom)).toFixed(3)) },
            mu_cs_line: { color: moreupCsColor(200 * a, accent), w: Math.round(MOREUP_CS_TITLE_LINE_W * zoom) },
            mu_cs_sub: { color: moreupCsColor(ta, 'FFFFFF') }
        })
    } else if (seg.kind === 'text') {
        let n = Math.min(step._len, Math.floor(e / MOREUP_CS_TICKS_PER_CHAR))
        let upd = {}
        if (n !== st.shown) {
            upd.textLines = moreupCsReveal(step._lines, n)
            st.shown = n
        }
        let left = dur - e
        if (left < MOREUP_CS_TEXT_FADE_TICKS) {
            let a = MOREUP_CS_MIN_TEXT_ALPHA + (255 - MOREUP_CS_MIN_TEXT_ALPHA) * (left / MOREUP_CS_TEXT_FADE_TICKS)
            upd.color = moreupCsColor(a, step.color || 'EEEEEE')
        }
        if (Object.keys(upd).length > 0) moreupCsPaint(player, { mu_cs_text: upd })
    }
}

function moreupCsFinish(server, uuid, reason) {
    let st = moreupCsActive[uuid]
    if (!st) return
    delete moreupCsActive[uuid]
    let player = moreupCsPlayer(server, uuid)
    if (!player) return
    moreupCsClearAll(player)
    let scene = st.scene
    let accent = '#' + (scene.accent || 'FFFFFF')
    if (reason === 'hurt') {
        moreupCsTellraw(server, uuid, [
            { text: '✦ 피해를 입어 컷씬을 멈췄습니다. ', color: 'gray' },
            { text: '[▶ 다시 보기]', color: 'aqua', clickEvent: { action: 'run_command', value: `/story play ${st.id}` }, hoverEvent: { action: 'show_text', contents: '안전한 곳에서 다시 봅니다' } }
        ])
        return
    }
    // 채팅 기록: 대사 전체 + 다시 보기
    let parts = [{ text: `\n✦ ${scene.name}\n`, color: accent, bold: true }]
    scene.steps.forEach(step => {
        if (step.text) parts.push({ text: `  ${step.text}\n`, color: 'gray', bold: false })
    })
    parts.push({ text: '  [▶ 다시 보기]', color: 'aqua', bold: false, clickEvent: { action: 'run_command', value: `/story play ${st.id}` }, hoverEvent: { action: 'show_text', contents: '이 컷씬을 다시 재생합니다' } })
    parts.push({ text: '  [📜 이야기 목록]', color: 'gold', bold: false, clickEvent: { action: 'run_command', value: '/story' }, hoverEvent: { action: 'show_text', contents: '지금까지 열린 이야기' } })
    moreupCsTellraw(server, uuid, parts)
}

function moreupCsTickOne(server, uuid) {
    let st = moreupCsActive[uuid]
    let player = moreupCsPlayer(server, uuid)
    if (!player) {
        delete moreupCsActive[uuid]
        return
    }
    st.t++
    // 건너뛰기: Shift 를 계속 누르고 있으면
    if (st.t > (st.scene.delay || 0)) {
        if (moreupCsCrouching(player)) {
            st.skip++
            if (st.skip % 5 === 0) {
                let bars = Math.min(6, Math.floor(st.skip / 5))
                let gauge = '▮▮▮▮▮▮'.substring(0, bars) + '▯▯▯▯▯▯'.substring(0, 6 - bars)
                moreupCsPaint(player, { mu_cs_hint: { text: `건너뛰는 중 ${gauge}` } })
            }
            if (st.skip >= MOREUP_CS_SKIP_HOLD_TICKS) {
                moreupCsFinish(server, uuid, 'skip')
                return
            }
        } else if (st.skip > 0) {
            st.skip = 0
            moreupCsPaint(player, { mu_cs_hint: { text: '[Shift] 길게 눌러 건너뛰기' } })
        }
    }
    let segs = st.timeline.segs
    while (st.seg < segs.length && st.t >= segs[st.seg].end) {
        st.seg++
        st.entered = false
    }
    if (st.seg >= segs.length) {
        moreupCsFinish(server, uuid, 'done')
        return
    }
    let seg = segs[st.seg]
    if (seg.kind === 'wait') return
    if (!st.entered) {
        st.entered = true
        moreupCsEnter(server, player, st, seg)
    }
    let e = st.t - seg.start
    if (seg.kind === 'text' && e % MOREUP_CS_TYPE_SOUND_EVERY === 0 && Math.floor(e / MOREUP_CS_TICKS_PER_CHAR) < seg.step._len) {
        moreupCsSound(server, uuid, ['minecraft:block.note_block.hat', 0.12, 1.9])
    }
    if (e % MOREUP_CS_UPDATE_EVERY === 0) {
        moreupCsUpdate(server, player, st, seg, e)
        if (st.anim) moreupCsAnimFrame(server, player, st)
    }
    if (st.amb && st.t % MOREUP_CS_AMBIENT_UPDATE_EVERY === 0) moreupCsAmbientFrame(player, st)
}

// 외부에서 부르는 재생 함수. 성공하면 true
function moreupCsPlay(server, player, sceneId) {
    let scene = MOREUP_SCENES[sceneId]
    if (!scene || !player) return false
    let uuid = String(player.stringUuid)
    if (moreupCsActive[uuid]) moreupCsClearAll(player)
    moreupCsActive[uuid] = { id: sceneId, uuid: uuid, scene: scene, timeline: moreupCsBuild(scene), t: 0, seg: 0, entered: false, skip: 0, center: false, shown: 0, introDone: false, anim: null, amb: null }
    return true
}

// ---------------------------------------------------------- 명령어

function moreupCsSceneIds() {
    return Object.keys(MOREUP_SCENES).sort((a, b) => MOREUP_SCENES[a].order - MOREUP_SCENES[b].order)
}

function moreupCsList(server, player) {
    let open = moreupCsUnlocked(server, player)
    let uuid = String(player.stringUuid)
    let parts = [{ text: '\n📜 More Up: Remaster 0 — 이야기\n', color: 'gold', bold: true }]
    let count = 0
    moreupCsSceneIds().forEach(id => {
        let scene = MOREUP_SCENES[id]
        if (open[id]) {
            count++
            parts.push({ text: `  ▶ ${scene.name}\n`, color: '#' + (scene.accent || 'FFFFFF'), bold: false, clickEvent: { action: 'run_command', value: `/story play ${id}` }, hoverEvent: { action: 'show_text', contents: '눌러서 다시 보기' } })
        } else {
            parts.push({ text: '  ✧ ??? (아직 열리지 않은 이야기)\n', color: 'dark_gray', bold: false })
        }
    })
    if (count === 0) parts.push({ text: '  메인 스토리 퀘스트를 진행하면 이야기가 열립니다.\n', color: 'gray', bold: false })
    moreupCsTellraw(server, uuid, parts)
    return 1
}

function moreupCsCommandPlay(ctx, sceneId) {
    let source = ctx.source
    let player = source.player
    let server = source.server
    if (!player) {
        source.sendFailure(Text.of('플레이어만 쓸 수 있는 명령어입니다.'))
        return 0
    }
    if (!MOREUP_SCENES[sceneId]) {
        player.tell(Text.red(`없는 장면입니다: ${sceneId}`))
        return 0
    }
    let open = moreupCsUnlocked(server, player)
    let elevated = source.hasPermission(2)
    if (!open[sceneId] && !elevated) {
        player.tell(Text.gray('아직 열리지 않은 이야기입니다. 메인 스토리 퀘스트를 진행하세요.'))
        return 0
    }
    if (elevated && !open[sceneId]) {
        // 퀘스트 보상으로 처음 열리는 장면: 팀에 열고, 접속 중인 팀원에게 알린다
        let others = moreupCsUnlock(server, player, sceneId)
        let scene = MOREUP_SCENES[sceneId]
        others.forEach(m => {
            moreupCsTellraw(server, String(m.stringUuid), [
                { text: '✦ ', color: 'gold' },
                { text: String(player.name.string), color: 'yellow' },
                { text: `님이 「${scene.name}」에 도달했습니다. `, color: 'white' },
                { text: '[▶ 보기]', color: 'aqua', clickEvent: { action: 'run_command', value: `/story play ${sceneId}` }, hoverEvent: { action: 'show_text', contents: '이 컷씬을 봅니다' } }
            ])
        })
    } else {
        moreupCsUnlock(server, player, sceneId)
    }
    moreupCsPlay(server, player, sceneId)
    return 1
}

// 관리자용: 컷씬이 생기기 전에 퀘스트를 지난 플레이어에게 장면을 열어 준다 (all = 전부). 그 플레이어의 팀에도 열린다
function moreupCsCommandUnlock(ctx, target, sceneId) {
    let server = ctx.source.server
    let ids = sceneId === 'all' ? moreupCsSceneIds() : [sceneId]
    if (sceneId !== 'all' && !MOREUP_SCENES[sceneId]) {
        ctx.source.sendFailure(Text.of(`없는 장면입니다: ${sceneId} (가능: ${moreupCsSceneIds().join(', ')}, all)`))
        return 0
    }
    ids.forEach(id => moreupCsUnlock(server, target, id))
    ctx.source.sendSuccess(() => Text.of(`${target.name.string} 님(팀 포함)에게 장면을 열었습니다: ${ids.join(', ')}`), true)
    target.tell(Text.gold('✦ 새 이야기가 열렸습니다. /story 로 볼 수 있습니다.'))
    return ids.length
}

ServerEvents.commandRegistry(event => {
    const { commands: Commands, arguments: Arguments } = event
    event.register(
        Commands.literal('story')
            .executes(ctx => {
                let p = ctx.source.player
                if (!p) return 0
                return moreupCsList(ctx.source.server, p)
            })
            .then(Commands.literal('play')
                .then(Commands.argument('scene', Arguments.STRING.create(event))
                    .executes(ctx => moreupCsCommandPlay(ctx, String(Arguments.STRING.getResult(ctx, 'scene'))))))
            .then(Commands.literal('unlock')
                .requires(src => src.hasPermission(2))
                .then(Commands.argument('player', Arguments.PLAYER.create(event))
                    .then(Commands.argument('scene', Arguments.STRING.create(event))
                        .executes(ctx => moreupCsCommandUnlock(ctx, Arguments.PLAYER.getResult(ctx, 'player'), String(Arguments.STRING.getResult(ctx, 'scene')))))))
            .then(Commands.literal('skip')
                .executes(ctx => {
                    let p = ctx.source.player
                    if (!p) return 0
                    moreupCsFinish(ctx.source.server, String(p.stringUuid), 'skip')
                    return 1
                }))
    )
})

// ---------------------------------------------------------- 이벤트

ServerEvents.tick(event => {
    try {
        let ids = Object.keys(moreupCsActive)
        if (ids.length === 0) return
        ids.forEach(uuid => {
            try {
                moreupCsTickOne(event.server, uuid)
            } catch (e) {
                moreupCsLog(`재생 오류 (${uuid}): ${e}`)
                delete moreupCsActive[uuid]
            }
        })
    } catch (e) {
        moreupCsLog(`tick 오류: ${e}`)
    }
})

EntityEvents.hurt(event => {
    try {
        let ent = event.entity
        if (!ent.isPlayer()) return
        let uuid = String(ent.stringUuid)
        if (moreupCsActive[uuid]) moreupCsFinish(Utils.server, uuid, 'hurt')
    } catch (e) {
        moreupCsLog(`hurt 처리 오류: ${e}`)
    }
})

PlayerEvents.loggedIn(event => {
    try {
        let player = event.player
        moreupCsClearAll(player)
        // 접속하지 않은 사이 팀원이 연 이야기 알림
        let server = Utils.server
        let own = {}
        moreupCsSplit(player.persistentData.getString(MOREUP_CS_PLAYER_KEY)).forEach(id => { own[id] = true })
        let open = moreupCsUnlocked(server, player)
        let fresh = moreupCsSceneIds().filter(id => open[id] && !own[id])
        if (fresh.length > 0) {
            let parts = [{ text: '✦ 팀이 새 이야기를 열었습니다: ', color: 'gold' }]
            fresh.forEach(id => {
                parts.push({ text: `[▶ ${MOREUP_SCENES[id].name}] `, color: 'aqua', clickEvent: { action: 'run_command', value: `/story play ${id}` }, hoverEvent: { action: 'show_text', contents: '눌러서 보기' } })
            })
            server.scheduleInTicks(60, () => moreupCsTellraw(server, String(player.stringUuid), parts))
        }
    } catch (e) {
        moreupCsLog(`접속 처리 오류: ${e}`)
    }
})

PlayerEvents.loggedOut(event => {
    try {
        delete moreupCsActive[String(event.player.stringUuid)]
    } catch (e) {
        moreupCsLog(`퇴장 처리 오류: ${e}`)
    }
})
