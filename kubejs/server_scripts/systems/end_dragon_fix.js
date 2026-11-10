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
const MOREUP_EDF_CHECK_TICKS = 200          // 10초마다 확인 (엔드에 플레이어가 있을 때만)
const MOREUP_EDF_POLL_TICKS = 20            // 복구 중에는 1초마다 표식이 생겼는지 본다
const MOREUP_EDF_TIMEOUT_TICKS = 400        // 20초 안에 표식이 안 생기면 실패로 기록
const MOREUP_EDF_MAX_TRIES = 3              // 한 번 서버가 켜진 동안 자동 시도 횟수 (무한 반복 방지)
let moreupEdfTick = 0
let moreupEdfTries = 0
let moreupEdfJob = null                     // { waited, reason }

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
        if (moreupEdfTick % MOREUP_EDF_CHECK_TICKS !== 0 || moreupEdfTries >= MOREUP_EDF_MAX_TRIES) return
        // 가장 싼 검사부터: 엔드에 플레이어가 없으면 끝
        if (server.runCommandSilent('execute in minecraft:the_end if entity @a[x=0,y=0,z=0,distance=..400]') === 0) return
        if (moreupEdfCount(server, 'if entity @e[type=minecraft:marker,tag=fe.exit_portal]') > 0) return
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
