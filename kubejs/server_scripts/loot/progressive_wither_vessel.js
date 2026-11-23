// priority: 0
// ============================================================
// More Up: Progressive Bosses 위더의 Paraglider 생명의 그릇(하트 그릇) 복구 (2026-11-22 사용자 요청 "모든 몹의 루팅 테이블 확인")
// 경로: kubejs/server_scripts/loot/progressive_wither_vessel.js
//
// Paraglider 는 전역 드롭 수정자(data/paraglider/loot_modifiers/wither.json)로 위더에 하트 그릇 1개를 붙인다.
// 조건이 "엔티티 종류 = minecraft:wither + 플레이어 처치 + 설정" 이라서, 이 팩에서 소환되는 progressivebosses:wither 에는
// 한 번도 붙지 않는다 (실서버 통계상 플레이어 위더 처치 12번은 모두 생명의 그릇 없이 끝남).
// progressivebosses:wither 는 드롭 표 자체가 없어서(시험 서버 확인) 수정자 조건만 고쳐서는 붙지 않는다 → 직접 떨군다.
//   - 플레이어가 잡았을 때만 (원래 조건 killed_by_player 와 같게, 화살 등 플레이어가 쏜 것 포함)
//   - 1마리당 1개 (원래 count 1). 바닥 아이템 자동 청소에서 빠지게 moreup_keep 태그, 무적
// Paraglider 설정에서 하트 그릇을 끄면(heartContainers=false) 이 스크립트도 지워야 한다.
// ============================================================

const MOREUP_PBV_ITEM = 'paraglider:heart_container'
const MOREUP_PBV_COUNT = 1
const $MoreUpPbvPlayer = Java.loadClass('net.minecraft.world.entity.player.Player')
const moreupPbvDone = new Set()

// 처치한 플레이어: 직접 원인(화살이면 쏜 사람) → 없으면 마지막으로 때린 플레이어(kill credit)
function moreupPbvKiller(event) {
    let actual = null
    try { actual = event.source.actual } catch (e) { }
    if (actual instanceof $MoreUpPbvPlayer) return actual
    let credit = null
    try { credit = event.entity.getKillCredit() } catch (e) { }
    if (credit instanceof $MoreUpPbvPlayer) return credit
    return null
}

EntityEvents.death('progressivebosses:wither', event => {
    try {
        let entity = event.entity
        let uuid = String(entity.stringUuid)
        // 한 번 죽을 때 사망 이벤트가 두 번 오는 보스가 있다
        if (moreupPbvDone.has(uuid)) return
        moreupPbvDone.add(uuid)
        if (moreupPbvDone.size > 64) moreupPbvDone.clear()   // 무한히 쌓이지 않게

        let killer = moreupPbvKiller(event)
        if (killer === null) {
            console.info('[MoreUp] 위더 하트 그릇: 플레이어 처치가 아니라 떨구지 않음')
            return
        }
        let dim = String(entity.level.dimension)
        let x = entity.x.toFixed(2), y = (entity.y + 0.5).toFixed(2), z = entity.z.toFixed(2)
        let ok = entity.server.runCommandSilent(`execute in ${dim} run summon minecraft:item ${x} ${y} ${z} {Item:{id:"${MOREUP_PBV_ITEM}",Count:${MOREUP_PBV_COUNT}b},Tags:["moreup_keep"],Invulnerable:1b,PickupDelay:20s}`)
        if (!ok) {
            console.error(`[MoreUp] 위더 하트 그릇 summon 실패 (${dim} ${x} ${y} ${z})`)
            return
        }
        console.info(`[MoreUp] 위더 하트 그릇 ${MOREUP_PBV_COUNT}개 드롭 (처치: ${killer.username})`)
    } catch (e) {
        console.error(`[MoreUp] 위더 하트 그릇 드롭 실패: ${e}`)
    }
})
