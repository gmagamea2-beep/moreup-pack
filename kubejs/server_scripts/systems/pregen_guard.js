// priority: 0
// ============================================================
// More Up: 빈 서버일 때만 월드 미리 생성 (Chunky) — 2026-10-29, 1.5.3
// 경로: kubejs/server_scripts/systems/pregen_guard.js
//
// 2026-10-24 렉(최대 13초 멈춤)은 플레이 중에 Chunky 미리 생성이 같이 돌아서 생겼다.
// 그래서 접속자가 있으면 미리 생성을 멈추고(chunky pause), 모두 나간 뒤 5분이 지나면 이어서 한다(chunky continue).
// - 10초마다 접속자 수만 확인한다 (가벼움). 진행 상황은 Chunky 가 저장하므로 서버를 껐다 켜도 이어진다
//   (config/chunky/config.json 의 continueOnRestart = true 가 필요)
// - 작업이 없을 때 pause / continue 를 보내도 Chunky 가 "작업 없음" 만 알리고 아무 일도 하지 않는다
// - 접속자가 있을 때 관리자가 직접 chunky start 로 시작한 작업은 멈추지 않는다 (다음에 빈 서버가 됐다가 누가 들어오면 멈춤)
// 전용 서버 + Chunky 가 있을 때만 동작한다
// ============================================================

const MOREUP_PREGEN_CHECK_TICKS = 200            // 10초마다 확인
const MOREUP_PREGEN_RESUME_EMPTY_TICKS = 6000    // 모두 나간 뒤 5분 지나면 다시 진행 (잠깐 나갔다 들어오는 경우 대비)

const $MoreUpPregenLog = Java.loadClass('org.slf4j.LoggerFactory').getLogger('More Up')
const $MoreUpPregenDedicated = Java.loadClass('net.minecraft.server.dedicated.DedicatedServer')
const MOREUP_PREGEN_ENABLED = Platform.isLoaded('chunky')

let moreupPregenTimer = 0
let moreupPregenPaused = false
let moreupPregenEmptyTicks = 0
let moreupPregenFailed = false

ServerEvents.tick(event => {
    if (!MOREUP_PREGEN_ENABLED || moreupPregenFailed) return
    if (++moreupPregenTimer < MOREUP_PREGEN_CHECK_TICKS) return
    moreupPregenTimer = 0
    try {
        let server = event.server
        if (!(server instanceof $MoreUpPregenDedicated)) return
        let online = server.playerList.getPlayerCount()
        if (online > 0) {
            moreupPregenEmptyTicks = 0
            if (!moreupPregenPaused) {
                moreupPregenPaused = true
                server.runCommandSilent('chunky pause')
                $MoreUpPregenLog.info('접속자가 있어 월드 미리 생성(Chunky)을 잠시 멈춥니다')
            }
            return
        }
        if (!moreupPregenPaused) return
        moreupPregenEmptyTicks += MOREUP_PREGEN_CHECK_TICKS
        if (moreupPregenEmptyTicks < MOREUP_PREGEN_RESUME_EMPTY_TICKS) return
        moreupPregenPaused = false
        moreupPregenEmptyTicks = 0
        server.runCommandSilent('chunky continue')
        $MoreUpPregenLog.info('서버가 비어 월드 미리 생성(Chunky)을 이어서 합니다')
    } catch (e) {
        // 같은 tick 의 다른 스크립트까지 막지 않도록 여기서 끝내고, 이후로는 이 기능만 끈다
        moreupPregenFailed = true
        console.error(`[MoreUp] 미리 생성 관리 실패 (이 기능을 끕니다): ${e}`)
    }
})
