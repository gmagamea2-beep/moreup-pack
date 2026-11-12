// More Up: 엔더 드래곤이 안 나오는 문제 복구 (2026-11-10 사용자 보고 "엔더드래곤이 안나오는 버그")
// 원인 (서버 월드·jar 조사, 테스트 서버에서 재현):
//  - Stellarity(엔드 개편)는 바닐라 드래곤 전투를 쓰지 않는다. (0,255,0)에 흙을 놓아 바닐라 출구 포탈을 월드 꼭대기에 생기게 하고,
//    바닐라 드래곤은 죽인 뒤, 메인 섬 (0.5,61,0.5)의 엔드 수정을 5초마다 찾아 "출구 포탈 표식"(marker, fe.exit_portal)으로 바꾼다.
//    드래곤은 이 표식이 소환한다.
//  - 이 팩에서는 그 수정이 생성되지 않는다 (실서버 엔드 엔티티 전수 조사 + 새로 만든 시험 월드도 같음) → 드래곤이 영영 안 나온다.
//    실서버 바닐라 기록은 PreviouslyKilled 0 / DragonKilled 1, 출구 포탈은 y=254~255 에 남아 있었다.
// 복구: 엔드에 플레이어가 있는데 표식이 없으면
//  1) 꼭대기의 바닐라 출구 포탈 잔해를 지운다 (Stellarity 자체 처리와 같은 범위)
//  2) (0.5,61,0.5)에 엔드 수정을 놓는다 → Stellarity 가 5초 안에 표식으로 바꾸고 출구 포탈 구조물을 만든다
//  3) 표식이 생기면 Stellarity 공식 리셋(cmd:stellarity/ender_dragon.reset)으로 드래곤을 부른다
// 표식이 이미 있으면(정상 진행 중, 드래곤을 잡은 뒤 포함) 아무것도 하지 않는다.
// 기다림은 server.scheduleInTicks 대신 이 스크립트의 틱 계산으로 한다 (시험에서 scheduleInTicks 가 일찍 실행됨).
// 관리자 명령: /드래곤복구 (조건과 상관없이 위 과정을 한 번 실행)
// 2026-11-11: 중앙 청크가 로드돼 있을 때만, 연속 두 번 표식이 안 보일 때만 복구 (재접속 직후 오판 방지), 겹친 표식 정리, 지난 처치 보상 1회 이동
const MOREUP_EDF_CHECK_TICKS = 200          // 10초마다 확인 (엔드에 플레이어가 있을 때만)
const MOREUP_EDF_POLL_TICKS = 20            // 복구 중에는 1초마다 표식이 생겼는지 본다
const MOREUP_EDF_TIMEOUT_TICKS = 400        // 20초 안에 표식이 안 생기면 실패로 기록
const MOREUP_EDF_MAX_TRIES = 3              // 한 번 서버가 켜진 동안 자동 시도 횟수 (무한 반복 방지)
let moreupEdfTick = 0
let moreupEdfTries = 0
let moreupEdfJob = null                     // { waited, reason }
const MOREUP_EDF_MISSING_CHECKS = 2         // 표식이 연속 이만큼 안 보여야 복구
const MOREUP_EDF_RESCUE_KEY = 'moreupDragonLootRescue20261111'
let moreupEdfMissing = 0

// 표식이 2개 이상이면 Stellarity 가 위치를 매긴 것(fe.location_1)만 남긴다. 그런 표식이 없으면 건드리지 않는다
function moreupEdfDedupe(server, markers) {
    if (moreupEdfCount(server, 'if entity @e[type=minecraft:marker,tag=fe.exit_portal,tag=fe.location_1]') === 0) return
    let removed = moreupEdfCount(server, 'run kill @e[type=minecraft:marker,tag=fe.exit_portal,tag=!fe.location_1]')
    console.info(`[MoreUp] 출구 포탈 표식 ${markers}개 → 겹친 ${removed}개 정리`)
}

// 출구 포탈 받침 (2026-11-11 사용자 보고 "출구도 좀 땅에서 떠있더라")
// Stellarity 출구 포탈 구조물은 표식(y=61) 기준 y=59~ 에 13x13 으로 지어지는데, 이 팩의 엔드 중앙 땅은 y=53~54 라 5칸 떠 있다
// (실서버 엔드 지형 파일 확인). 표식 높이는 Stellarity 가 y=61 로 고정해 쓰므로 포탈을 내리지 않고,
// 아래 빈 공간을 엔드 돌 계단식 언덕(한 층 내려갈 때마다 한 칸 넓게)으로 채운다. 공기만 채운다 (기존 블록·포탈은 그대로).
// 포탈 바로 아래(0,58,0)가 비어 있고 구조물(0,59,0)이 있을 때만 → 한 번 채우면 다시 하지 않는다.
const MOREUP_EDF_BASE_TOP = 58              // 구조물 바로 아래 층
const MOREUP_EDF_BASE_HALF = 6              // 구조물 반폭 (13x13)
const MOREUP_EDF_BASE_LAYERS = 7            // y=58 ~ 52 (땅 y=53~54 의 패인 곳까지)
function moreupEdfBaseOnce(server) {
    let level = server.getLevel('minecraft:the_end')
    if (String(level.getBlock(0, MOREUP_EDF_BASE_TOP, 0).id) !== 'minecraft:air') return
    if (String(level.getBlock(0, MOREUP_EDF_BASE_TOP + 1, 0).id) === 'minecraft:air') return
    let reach = MOREUP_EDF_BASE_HALF + MOREUP_EDF_BASE_LAYERS
    // 받침이 걸치는 청크가 모두 불러와져 있어야 중간에 끊기지 않는다
    for (let sx = -1; sx <= 1; sx += 2) for (let sz = -1; sz <= 1; sz += 2) {
        if (moreupEdfCount(server, `if loaded ${sx * reach} ${MOREUP_EDF_BASE_TOP} ${sz * reach}`) === 0) return
    }
    let filled = 0
    for (let i = 0; i < MOREUP_EDF_BASE_LAYERS; i++) {
        let y = MOREUP_EDF_BASE_TOP - i
        let h = MOREUP_EDF_BASE_HALF + i
        let r2 = (h + 2.5) * (h + 2.5)       // 모서리를 둥글게
        for (let z = -h; z <= h; z++) {
            let dx = Math.min(h, Math.floor(Math.sqrt(Math.max(0, r2 - z * z))))
            filled += moreupEdfCount(server, `run fill ${-dx} ${y} ${z} ${dx} ${y} ${z} minecraft:end_stone replace minecraft:air`)
        }
    }
    console.info(`[MoreUp] 출구 포탈 받침: 떠 있던 아래를 엔드 돌 ${filled}칸으로 채움`)
}
// 1회: 2026-11-11 Gonkor1018 의 드래곤 처치 보상이 출구 포탈 웅덩이(y=60)와 기둥 위 공중(y=92)에 남아 주울 수 없었다
// (실서버 엔드 저장 파일 확인). 중앙이 로드되면 기둥 주변의 아이템을 기둥 위로 옮긴다. 이후 처치는 loot/ender_dragon_drops_fix.js 가 처리
function moreupEdfRescueOnce(server) {
    let data = server.persistentData
    if (data.getBoolean(MOREUP_EDF_RESCUE_KEY)) return
    data.putBoolean(MOREUP_EDF_RESCUE_KEY, true)
    let top = 65
    let level = server.getLevel('minecraft:the_end')
    for (let y = 120; y > 0; y--) {
        let id = String(level.getBlock(0, y, 0).id)
        if (id !== 'minecraft:air' && id !== 'minecraft:void_air' && id !== 'minecraft:cave_air') { top = y + 1; break }
    }
    let box = 'x=-6,y=58,z=-6,dx=13,dy=72,dz=13'
    moreupEdfCount(server, `as @e[type=minecraft:item,${box}] run data merge entity @s {NoGravity:1b,Motion:[0.0d,0.0d,0.0d],Age:0s}`)
    let moved = moreupEdfCount(server, `run tp @e[type=minecraft:item,${box}] 0.5 ${top} 0.5`)
    console.info(`[MoreUp] 지난 드래곤 처치 보상 ${moved}개를 기둥 위(y=${top})로 옮김 (1회)`)
}

function moreupEdfCount(server, cmd) {
    return server.runCommandSilent('execute in minecraft:the_end ' + cmd)
}

function moreupEdfStart(server, reason) {
    if (moreupEdfJob != null) return false
    console.info(`[MoreUp] 엔더 드래곤 복구 시작 (${reason})`)
    try {
        server.runCommandSilent('execute in minecraft:the_end run forceload add 0 0')
        // 1) 바닐라 출구 포탈 잔해 (y 253~255) — Stellarity butcher/kill 과 같은 범위
        server.runCommandSilent('execute in minecraft:the_end positioned 0 255 0 run fill ~3 ~ ~3 ~-3 ~-2 ~-3 minecraft:air')
        // 2) 표식이 될 엔드 수정 (이미 있으면 그대로)
        if (moreupEdfCount(server, 'if entity @e[type=minecraft:end_crystal,x=0,y=60,z=0,dx=1,dy=2,dz=1]') === 0) {
            server.runCommandSilent('execute in minecraft:the_end run summon minecraft:end_crystal 0.5 61 0.5 {ShowBottom:0b}')
        }
    } catch (e) {
        console.error('[MoreUp] 엔더 드래곤 복구 1단계 실패: ' + e)
        return false
    }
    moreupEdfJob = { waited: 0, reason: reason }
    return true
}

function moreupEdfFinish(server) {
    moreupEdfJob = null
    server.runCommandSilent('execute in minecraft:the_end run forceload remove 0 0')
}

// 복구 중: 표식이 생기면 드래곤을 부르고 끝낸다
function moreupEdfPoll(server) {
    moreupEdfJob.waited += MOREUP_EDF_POLL_TICKS
    let marker = moreupEdfCount(server, 'if entity @e[type=minecraft:marker,tag=fe.exit_portal]')
    if (marker > 0) {
        if (moreupEdfCount(server, 'if entity @e[type=minecraft:ender_dragon]') === 0) {
            server.runCommandSilent('execute in minecraft:the_end positioned 0 64 0 run function cmd:stellarity/ender_dragon.reset')
        }
        console.info(`[MoreUp] 엔더 드래곤 복구 완료: 표식 ${marker}개, ${moreupEdfJob.waited / 20}초 걸림, 드래곤 소환 요청`)
        moreupEdfFinish(server)
    } else if (moreupEdfJob.waited >= MOREUP_EDF_TIMEOUT_TICKS) {
        console.error('[MoreUp] 엔더 드래곤 복구: 20초 안에 Stellarity 출구 포탈 표식이 생기지 않음 (Stellarity 가 켜져 있는지 확인)')
        moreupEdfFinish(server)
    }
}

ServerEvents.tick(event => {
    try {
        moreupEdfTick++
        let server = event.server
        if (moreupEdfJob != null) {
            if (moreupEdfTick % MOREUP_EDF_POLL_TICKS === 0) moreupEdfPoll(server)
            return
        }
        if (moreupEdfTick % MOREUP_EDF_CHECK_TICKS !== 0) return
        // 가장 싼 검사부터: 엔드에 플레이어가 없으면 끝
        if (server.runCommandSilent('execute in minecraft:the_end if entity @a[x=0,y=0,z=0,distance=..400]') === 0) {
            moreupEdfMissing = 0
            return
        }
        // 중앙 청크가 로드되지 않았으면 표식이 "안 보일" 뿐이다 → 판단하지 않는다
        // (2026-11-11 실서버: 플레이어가 재접속한 직후 이것 때문에 복구가 한 번 더 돌아 표식이 2개가 됨)
        if (moreupEdfCount(server, 'if loaded 0 61 0') === 0) {
            moreupEdfMissing = 0
            return
        }
        let markers = moreupEdfCount(server, 'if entity @e[type=minecraft:marker,tag=fe.exit_portal]')
        if (markers > 1) moreupEdfDedupe(server, markers)
        moreupEdfRescueOnce(server)
        if (markers > 0) moreupEdfBaseOnce(server)
        if (markers > 0) {
            moreupEdfMissing = 0
            return
        }
        // 청크가 막 로드된 틱에는 엔티티가 아직 안 붙어 있을 수 있어, 연속 두 번(10초 간격) 없을 때만 복구
        moreupEdfMissing++
        if (moreupEdfMissing < MOREUP_EDF_MISSING_CHECKS || moreupEdfTries >= MOREUP_EDF_MAX_TRIES) return
        moreupEdfMissing = 0
        moreupEdfTries++
        moreupEdfStart(server, '엔드에 플레이어가 있는데 출구 포탈 표식이 없음')
    } catch (e) {
        console.error('[MoreUp] 엔더 드래곤 확인 실패: ' + e)
        moreupEdfJob = null
    }
})

ServerEvents.commandRegistry(event => {
    const { commands: Commands } = event
    event.register(Commands.literal('드래곤복구').requires(src => src.hasPermission(2)).executes(ctx => {
        let ok = moreupEdfStart(ctx.source.server, '관리자 명령')
        ctx.source.sendSuccess(() => Text.translate(ok ? 'message.moreup.end_dragon_fix.started' : 'message.moreup.end_dragon_fix.busy'), true)
        return ok ? 1 : 0
    }))
})
