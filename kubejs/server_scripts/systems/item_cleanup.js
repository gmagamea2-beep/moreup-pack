// priority: 0
// ============================================================
// More Up: 바닥 아이템 자동 정리
// 경로: kubejs/server_scripts/systems/item_cleanup.js
// (구 server_scripts/item_cleanup.js 개선판)
//
// - 10분마다 로드된 청크의 바닥 아이템(item 엔티티)을 삭제한다. 기존과 동일.
// - 1분 전, 10초 전에 경고한다. (기존: 1분 전만)
// - 전용 서버에서만 동작한다. 싱글플레이·LAN에서는 동작하지 않는다.
//   (기존 스크립트는 서버에만 있었으므로 싱글플레이 동작은 원래 없었다)
// - moreup_keep 태그가 붙은 아이템(보스 보상 등)은 지우지 않는다.
// ============================================================

const MOREUP_CLEANUP_INTERVAL_TICKS = 20 * 60 * 10 // 10분
const MOREUP_CLEANUP_WARNINGS = [
    { ticksBefore: 20 * 60, label: '1분' },
    { ticksBefore: 20 * 10, label: '10초' }
]

// 싱글플레이(통합 서버)에서도 클래스 자체는 존재하므로 instanceof 판정에 안전하게 쓸 수 있다.
// (MinecraftServer#isDedicatedServer 는 KubeJS 6 에서 이름이 매핑되지 않아 호출할 수 없다)
const $MoreUpDedicatedServer = Java.loadClass('net.minecraft.server.dedicated.DedicatedServer')

let moreupCleanupTick = 0
let moreupCleanupEnabled = null
let moreupCleanupFailed = false

ServerEvents.tick(event => {
    // 한 tick 핸들러에서 예외가 나면 같은 이벤트의 다른 스크립트 핸들러까지 멈추므로 반드시 경계에서 잡는다
    if (moreupCleanupFailed) return
    try {
        let server = event.server
        if (moreupCleanupEnabled === null) moreupCleanupEnabled = server instanceof $MoreUpDedicatedServer
        if (!moreupCleanupEnabled) return

        moreupCleanupTick++

        for (let i = 0; i < MOREUP_CLEANUP_WARNINGS.length; i++) {
            let warning = MOREUP_CLEANUP_WARNINGS[i]
            if (moreupCleanupTick === MOREUP_CLEANUP_INTERVAL_TICKS - warning.ticksBefore) {
                server.tell(`§e[자동 청소] §f${warning.label} 후 바닥 아이템이 자동 삭제됩니다!`)
            }
        }

        if (moreupCleanupTick >= MOREUP_CLEANUP_INTERVAL_TICKS) {
            moreupCleanupTick = 0
            let removed = Number(server.runCommandSilent('kill @e[type=item,tag=!moreup_keep]'))
            if (isNaN(removed)) {
                server.tell('§a[자동 청소] §f바닥 아이템을 정리했습니다.')
            } else {
                server.tell(`§a[자동 청소] §f바닥 아이템 ${removed}개를 정리했습니다.`)
            }
        }
    } catch (e) {
        // 매 틱 로그가 쌓이지 않도록 한 번만 기록하고 기능을 끈다 (/reload 시 다시 켜짐)
        moreupCleanupFailed = true
        console.error(`[MoreUp] 자동 청소 비활성화됨 (오류): ${e}`)
    }
})
