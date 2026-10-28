// priority: 0
// ============================================================
// More Up: 서버 콘솔 한국어 안내 + /restart (2026-10-28, 1.5.1)
// 경로: kubejs/server_scripts/systems/server_console.js   짝: 서버 폴더 run.bat / moreup_server_check.ps1 (원본 MoreUp/server_tools/)
//
// - 서버가 다 켜지면 콘솔에 "서버가 켜졌습니다!" 안내를 찍는다
// - /restart [초] : 남은 시간을 채팅·화면으로 알린 뒤 서버를 끈다. 로그에 MOREUP_RESTART_MARKER 를 남기면
//   run.bat 이 그걸 보고 서버를 바로 다시 켠다 (run.bat 없이 켠 서버는 꺼지기만 한다)
//   /restart cancel : 예약 취소.   콘솔에서는 / 없이 restart 30
// 전용 서버에서만 동작한다 (싱글플레이 통합 서버에서는 안내도 명령도 쓰지 않는다)
// ============================================================

const MOREUP_RESTART_DEFAULT_SECONDS = 30
const MOREUP_RESTART_MIN_SECONDS = 5
const MOREUP_RESTART_MAX_SECONDS = 600
const MOREUP_RESTART_ANNOUNCE = [600, 300, 120, 60, 30, 20, 10, 5, 4, 3, 2, 1]
const MOREUP_RESTART_TITLE_FROM = 10          // 이 초부터는 화면 가운데에도 숫자를 띄운다
const MOREUP_RESTART_PERMISSION = 4           // 바닐라 /stop 과 같은 권한
// run.bat(moreup_server_check.ps1) 이 logs/latest.log 에서 찾는 문자열. 바꾸면 그쪽도 같이 바꾼다
const MOREUP_RESTART_MARKER = 'MOREUP_RESTART_REQUEST'
const MOREUP_SERVER_ADDRESS = 'more-up1121.kro.kr'

const $MoreUpConsoleLog = Java.loadClass('org.slf4j.LoggerFactory').getLogger('More Up')
const $MoreUpConsoleDedicated = Java.loadClass('net.minecraft.server.dedicated.DedicatedServer')

let moreupRestartTicks = -1     // 재시작까지 남은 틱. -1 이면 예약 없음

function moreupIsDedicated(server) {
    return server != null && server instanceof $MoreUpConsoleDedicated
}

ServerEvents.loaded(event => {
    if (!moreupIsDedicated(event.server)) return
    $MoreUpConsoleLog.info('============================================================')
    $MoreUpConsoleLog.info('  서버가 켜졌습니다! 이제 접속할 수 있어요.')
    $MoreUpConsoleLog.info(`  접속 주소: ${MOREUP_SERVER_ADDRESS}`)
    $MoreUpConsoleLog.info('  명령어는 / 없이 입력합니다.')
    $MoreUpConsoleLog.info('    stop           서버 끄기 (월드 저장 후 종료)')
    $MoreUpConsoleLog.info(`    restart [초]    다시 켜기 (기본 ${MOREUP_RESTART_DEFAULT_SECONDS}초 뒤, 접속자에게 알림)`)
    $MoreUpConsoleLog.info('    restart cancel 다시 켜기 취소')
    $MoreUpConsoleLog.info('    list           접속자 보기')
    $MoreUpConsoleLog.info('============================================================')
})

function moreupRestartAnnounce(server, seconds) {
    let label = seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60}분` : `${seconds}초`
    server.tell(Text.of(`[서버] ${label} 뒤 서버를 다시 시작합니다. 잠시 뒤 다시 접속해 주세요.`).yellow())
    if (seconds <= MOREUP_RESTART_TITLE_FROM) {
        server.runCommandSilent('title @a times 0 25 5')
        server.runCommandSilent(`title @a subtitle {"text":"서버 재시작","color":"yellow"}`)
        server.runCommandSilent(`title @a title {"text":"${seconds}","color":"gold"}`)
    }
    $MoreUpConsoleLog.info(`서버 재시작까지 ${label}`)
}

function moreupRestartSchedule(ctx, seconds) {
    let server = ctx.source.server
    if (!moreupIsDedicated(server)) {
        ctx.source.sendFailure(Text.of('싱글플레이에서는 쓸 수 없습니다'))
        return 0
    }
    seconds = Math.floor(Number(seconds))
    if (!(seconds >= MOREUP_RESTART_MIN_SECONDS && seconds <= MOREUP_RESTART_MAX_SECONDS)) {
        ctx.source.sendFailure(Text.of(`시간은 ${MOREUP_RESTART_MIN_SECONDS}~${MOREUP_RESTART_MAX_SECONDS}초로 입력하세요`))
        return 0
    }
    let replaced = moreupRestartTicks >= 0
    moreupRestartTicks = seconds * 20
    ctx.source.sendSuccess(() => Text.of(replaced ? `재시작 예약을 ${seconds}초 뒤로 바꿨습니다` : `${seconds}초 뒤 서버를 다시 시작합니다 (취소: restart cancel)`), true)
    moreupRestartAnnounce(server, seconds)
    return 1
}

function moreupRestartCancel(ctx) {
    if (moreupRestartTicks < 0) {
        ctx.source.sendFailure(Text.of('예약된 재시작이 없습니다'))
        return 0
    }
    moreupRestartTicks = -1
    ctx.source.server.tell(Text.of('[서버] 서버 재시작이 취소되었습니다.').green())
    ctx.source.sendSuccess(() => Text.of('재시작 예약을 취소했습니다'), true)
    $MoreUpConsoleLog.info('서버 재시작이 취소되었습니다')
    return 1
}

ServerEvents.commandRegistry(event => {
    const { commands: Commands, arguments: Arguments } = event
    event.register(Commands.literal('restart')
        .requires(src => src.hasPermission(MOREUP_RESTART_PERMISSION))
        .executes(ctx => moreupRestartSchedule(ctx, MOREUP_RESTART_DEFAULT_SECONDS))
        .then(Commands.literal('cancel').executes(ctx => moreupRestartCancel(ctx)))
        .then(Commands.argument('seconds', Arguments.INTEGER.create(event))
            .executes(ctx => moreupRestartSchedule(ctx, Arguments.INTEGER.getResult(ctx, 'seconds')))))
})

// 같은 tick 의 다른 스크립트 핸들러까지 막지 않도록 반드시 try 로 감싼다
ServerEvents.tick(event => {
    if (moreupRestartTicks < 0) return
    try {
        moreupRestartTicks--
        if (moreupRestartTicks % 20 !== 0) return
        let seconds = moreupRestartTicks / 20
        let server = event.server
        if (seconds > 0) {
            if (MOREUP_RESTART_ANNOUNCE.indexOf(seconds) >= 0) moreupRestartAnnounce(server, seconds)
            return
        }
        moreupRestartTicks = -1
        server.tell(Text.of('[서버] 서버를 다시 시작합니다. 1~2분 뒤 다시 접속해 주세요!').gold())
        $MoreUpConsoleLog.info(`${MOREUP_RESTART_MARKER} 서버를 다시 시작합니다 (월드 저장 후 종료 → run.bat 이 다시 켬)`)
        server.runCommandSilent('stop')
    } catch (e) {
        moreupRestartTicks = -1
        console.error(`[MoreUp] 서버 재시작 처리 실패: ${e}`)
    }
})
