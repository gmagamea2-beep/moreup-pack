// More Up: 지옥문 고정 연결 (2026-11-10 사용자 요청 "네더포탈 안꼬이게 하는거 추가해줘")
// 등록한 상자(차원 + 두 모서리) 안의 지옥문으로 들어간 대상은 바닐라 연결(가장 가까운 문 찾기/새 문 만들기) 대신
// 정해 둔 도착점으로 바로 간다. 주변에 다른 지옥문이 생겨도 연결이 바뀌지 않는다.
//  - 금 농장: 네더 천장 문 더미(몹) → 오버월드 수신부 구덩이, 수신부 문(플레이어) → 네더 AFK 발판
//  - 명령(누구나): /포탈고정 추가 <몹|플레이어|모두> <모서리1> <모서리2> <이름>   … 지금 있는 차원의 상자
//                  /포탈고정 도착 <이름>   … 지금 서 있는 곳(차원 포함)을 도착점으로
//                  /포탈고정 목록, /포탈고정 삭제 <이름>
//  - 유저 명령으로 바꿈 (2026-11-21 사용자 요청 "포탈고정은 유저 명령어로 바꾸고"). 전에는 관리자(권한 2)만 썼다
//    관리자가 아닌 사람은 자기가 만든 연결만 고치고 지우고 목록에서 볼 수 있다 (다른 사람 포탈 좌표가 보이지 않게)
//    한 사람당 MOREUP_PL_USER_MAX_LINKS 개, 상자 한 변 MOREUP_PL_USER_MAX_SPAN 칸까지
//    관리자는 전처럼 모든 연결을 다룬다. 만든 사람이 없는 예전 연결(금 농장 등)은 관리자만 고칠 수 있다
//  - 저장: server.persistentData 의 moreupPortalLinks (JSON 문자열). 도착점이 없는 연결은 무시한다(바닐라 그대로)
//    연결마다 owner(만든 사람 UUID)·ownerName 을 남긴다. 상자가 겹치면 먼저 만든 연결이 이긴다
//  - 연결부: startup_scripts/moreup_portal_links.js (EntityTravelToDimensionEvent 를 취소하고 다음 틱에 이동)
const MOREUP_PL_KEY = 'moreupPortalLinks'
const MOREUP_PL_MAX_LINKS = 64 // 서버 전체 (유저 명령이 되면서 32 → 64, 2026-11-21)
const MOREUP_PL_MAX_NAME = 32
const MOREUP_PL_MAX_SPAN = 512 // 관리자 상자 한 변 최대 길이 (실수로 너무 넓게 잡지 않게)
const MOREUP_PL_USER_MAX_LINKS = 4 // 관리자가 아닌 사람 1명이 만들 수 있는 연결 수
const MOREUP_PL_USER_MAX_SPAN = 32 // 관리자가 아닌 사람의 상자 한 변 최대 길이 (지옥문은 가장 커도 23칸)
const MOREUP_PL_ADMIN_LEVEL = 2
let moreupPlLinks = []
let moreupPlBusy = false // 우리가 옮기는 중에 같은 이벤트가 다시 와도 무시
let moreupPlPending = {} // 이동 예약된 엔티티 UUID

function moreupPlLoad(server) {
    try {
        let raw = String(server.persistentData.getString(MOREUP_PL_KEY))
        moreupPlLinks = raw ? JSON.parse(raw) : []
    } catch (e) {
        console.error('[MoreUp] 지옥문 고정 연결 불러오기 실패, 비움: ' + e)
        moreupPlLinks = []
    }
}

function moreupPlSave(server) {
    server.persistentData.putString(MOREUP_PL_KEY, JSON.stringify(moreupPlLinks))
}

function moreupPlFind(dim, x, y, z, isPlayer) {
    for (let link of moreupPlLinks) {
        if (!link.to || link.dim !== dim) continue
        if (link.who === 'mob' && isPlayer) continue
        if (link.who === 'player' && !isPlayer) continue
        if (x < link.min[0] || x > link.max[0] || y < link.min[1] || y > link.max[1] || z < link.min[2] || z > link.max[2]) continue
        return link
    }
    return null
}

global.moreupPortalTravel = event => {
    if (moreupPlBusy || moreupPlLinks.length === 0) return
    let entity = event.getEntity()
    if (entity == null || entity.level.isClientSide()) return
    let link = moreupPlFind(String(entity.level.dimension), Math.floor(entity.x), Math.floor(entity.y), Math.floor(entity.z), entity.isPlayer())
    if (link == null) return
    event.setCanceled(true) // 바닐라 이동 취소 (문 대기 시간은 이미 걸려 있어 다음 틱에 또 오지 않는다)
    let id = String(entity.stringUuid)
    if (moreupPlPending[id]) return
    moreupPlPending[id] = true
    let to = link.to
    entity.server.scheduleInTicks(1, () => {
        delete moreupPlPending[id]
        try {
            if (!entity.isAlive()) return
            moreupPlBusy = true
            entity.teleportTo(to.dim, to.x + 0.5, to.y, to.z + 0.5, entity.yaw, entity.pitch)
        } catch (e) {
            console.error(`[MoreUp] 지옥문 고정 연결 이동 실패 (${link.name}, ${entity.type}): ${e}`)
        } finally {
            moreupPlBusy = false
        }
    })
}

ServerEvents.loaded(event => moreupPlLoad(event.server))

function moreupPlByName(name) {
    for (let i = 0; i < moreupPlLinks.length; i++) if (moreupPlLinks[i].name === name) return i
    return -1
}

function moreupPlIsAdmin(src) {
    return src.hasPermission(MOREUP_PL_ADMIN_LEVEL)
}

// 명령을 쓴 플레이어 { uuid, name }. 콘솔·명령 블록이면 둘 다 null
function moreupPlMe(src) {
    try {
        let p = src.player
        if (p != null) return { uuid: String(p.stringUuid), name: String(p.username) }
    } catch (e) {
        /* 플레이어가 아니면 null */
    }
    return { uuid: null, name: null }
}

// 관리자는 모든 연결, 나머지는 자기가 만든 연결만
function moreupPlCanEdit(src, link) {
    if (moreupPlIsAdmin(src)) return true
    let me = moreupPlMe(src).uuid
    return me != null && link.owner === me
}

// 다른 사람의 연결이면 안내하고 true
function moreupPlDenied(src, link) {
    if (moreupPlCanEdit(src, link)) return false
    src.sendFailure(Text.translate('message.moreup.portal_link.not_owner', link.name))
    return true
}

function moreupPlAdd(ctx, who, Arguments) {
    let src = ctx.source
    let admin = moreupPlIsAdmin(src)
    let name = String(Arguments.GREEDY_STRING.getResult(ctx, 'name')).trim()
    if (!name || name.length > MOREUP_PL_MAX_NAME) {
        src.sendFailure(Text.translate('message.moreup.portal_link.bad_name', MOREUP_PL_MAX_NAME))
        return 0
    }
    let a = Arguments.BLOCK_POS.getResult(ctx, 'from'),
        b = Arguments.BLOCK_POS.getResult(ctx, 'to')
    let min = [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z)]
    let max = [Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z)]
    let maxSpan = admin ? MOREUP_PL_MAX_SPAN : MOREUP_PL_USER_MAX_SPAN
    if (max[0] - min[0] > maxSpan || max[2] - min[2] > maxSpan) {
        src.sendFailure(Text.translate('message.moreup.portal_link.too_big', maxSpan))
        return 0
    }
    let idx = moreupPlByName(name)
    let old = idx >= 0 ? moreupPlLinks[idx] : null
    if (old != null && moreupPlDenied(src, old)) return 0
    let me = moreupPlMe(src)
    if (old == null) {
        if (moreupPlLinks.length >= MOREUP_PL_MAX_LINKS) {
            src.sendFailure(Text.translate('message.moreup.portal_link.full', MOREUP_PL_MAX_LINKS))
            return 0
        }
        if (!admin && moreupPlLinks.filter(l => l.owner === me.uuid).length >= MOREUP_PL_USER_MAX_LINKS) {
            src.sendFailure(Text.translate('message.moreup.portal_link.full', MOREUP_PL_USER_MAX_LINKS))
            return 0
        }
    }
    // 고쳐 쓸 때는 도착점과 만든 사람을 그대로 둔다 (관리자가 고쳐도 원래 주인이 계속 다룰 수 있게)
    let link = {
        name: name,
        who: who,
        dim: String(src.level.dimension),
        min: min,
        max: max,
        to: old != null ? old.to : null,
        owner: old != null ? old.owner || null : me.uuid,
        ownerName: old != null ? old.ownerName || null : me.name
    }
    if (idx >= 0) moreupPlLinks[idx] = link
    else moreupPlLinks.push(link)
    moreupPlSave(src.server)
    src.sendSuccess(Text.translate('message.moreup.portal_link.added', name, link.dim, min.join(' '), max.join(' ')), true)
    return 1
}

function moreupPlSetTo(ctx, Arguments) {
    let src = ctx.source
    let name = String(Arguments.GREEDY_STRING.getResult(ctx, 'name')).trim()
    let idx = moreupPlByName(name)
    if (idx < 0) {
        src.sendFailure(Text.translate('message.moreup.portal_link.no_such', name))
        return 0
    }
    if (moreupPlDenied(src, moreupPlLinks[idx])) return 0
    let p = src.position
    let to = { dim: String(src.level.dimension), x: Math.floor(p.x()), y: Math.floor(p.y()), z: Math.floor(p.z()) }
    moreupPlLinks[idx].to = to
    moreupPlSave(src.server)
    src.sendSuccess(Text.translate('message.moreup.portal_link.dest', name, to.dim, to.x + ' ' + to.y + ' ' + to.z), true)
    return 1
}

ServerEvents.commandRegistry(event => {
    const { commands: Commands, arguments: Arguments } = event
    let addFor = (literal, who) =>
        Commands.literal(literal).then(
            Commands.argument('from', Arguments.BLOCK_POS.create(event)).then(
                Commands.argument('to', Arguments.BLOCK_POS.create(event)).then(
                    Commands.argument('name', Arguments.GREEDY_STRING.create(event)).executes(ctx => moreupPlAdd(ctx, who, Arguments))
                )
            )
        )
    // 누구나 (플레이어 또는 관리자 권한이 있는 콘솔·명령 블록)
    event.register(
        Commands.literal('포탈고정')
            .requires(src => src.player != null || src.hasPermission(MOREUP_PL_ADMIN_LEVEL))
            .then(Commands.literal('추가').then(addFor('몹', 'mob')).then(addFor('플레이어', 'player')).then(addFor('모두', 'all')))
            .then(
                Commands.literal('도착').then(Commands.argument('name', Arguments.GREEDY_STRING.create(event)).executes(ctx => moreupPlSetTo(ctx, Arguments)))
            )
            .then(
                Commands.literal('목록').executes(ctx => {
                    let src = ctx.source
                    let admin = moreupPlIsAdmin(src)
                    let me = moreupPlMe(src).uuid
                    // 관리자는 전부(만든 사람 이름과 함께), 나머지는 자기 것만
                    let shown = admin ? moreupPlLinks : moreupPlLinks.filter(l => me != null && l.owner === me)
                    if (shown.length === 0) src.sendSuccess(Text.translate('message.moreup.portal_link.empty'), false)
                    shown.forEach(l => {
                        let label = admin && l.ownerName ? `${l.name} (${l.ownerName})` : l.name
                        let dest = l.to ? `${l.to.dim} ${l.to.x} ${l.to.y} ${l.to.z}` : '-'
                        src.sendSuccess(
                            Text.translate('message.moreup.portal_link.entry', label, l.who, l.dim, l.min.join(' '), l.max.join(' '), dest),
                            false
                        )
                    })
                    return shown.length
                })
            )
            .then(
                Commands.literal('삭제').then(
                    Commands.argument('name', Arguments.GREEDY_STRING.create(event)).executes(ctx => {
                        let src = ctx.source
                        let name = String(Arguments.GREEDY_STRING.getResult(ctx, 'name')).trim()
                        let idx = moreupPlByName(name)
                        if (idx < 0) {
                            src.sendFailure(Text.translate('message.moreup.portal_link.no_such', name))
                            return 0
                        }
                        if (moreupPlDenied(src, moreupPlLinks[idx])) return 0
                        moreupPlLinks.splice(idx, 1)
                        moreupPlSave(src.server)
                        src.sendSuccess(Text.translate('message.moreup.portal_link.removed', name), true)
                        return 1
                    })
                )
            )
    )
})
