// priority: 0
// ============================================================
// More Up: Progressive Bosses 위더의 "위더의 눈" 드롭 복구 (2026-11-07, 1.12.2)
// 경로: kubejs/server_scripts/loot/wither_eye_fix.js
//
// 이 팩에서 소환한 위더는 Progressive Bosses 의 progressivebosses:wither 이고, 드롭 표가 progressivebosses:entities/wither 다.
// End Remastered 는 minecraft:entities/wither 에만 위더의 눈(90% x 2번)을 붙이므로 위더의 눈이 나오지 않았다 (시험 서버에서 확인).
// 같은 확률로 직접 떨군다. 한 번 죽을 때 이벤트가 두 번 오는 보스가 있어 UUID 로 막는다.
// ============================================================

const MOREUP_WITHER_EYE_ROLLS = 2
const MOREUP_WITHER_EYE_CHANCE = 0.9
const moreupWitherEyeDone = new Set()

EntityEvents.death('progressivebosses:wither', event => {
    try {
        let entity = event.entity
        let uuid = String(entity.stringUuid)
        if (moreupWitherEyeDone.has(uuid)) return
        moreupWitherEyeDone.add(uuid)
        if (moreupWitherEyeDone.size > 64) moreupWitherEyeDone.clear()   // 무한히 쌓이지 않게
        let count = 0
        for (let i = 0; i < MOREUP_WITHER_EYE_ROLLS; i++) {
            if (Math.random() < MOREUP_WITHER_EYE_CHANCE) count++
        }
        // spawnAtLocation 은 ItemStack/ItemLike 오버로드를 Rhino 가 못 고른다 (시험 서버에서 확인) → summon 으로 떨군다.
        // moreup_keep 태그: 바닥 아이템 자동 청소(item_cleanup.js)가 지우지 않게
        if (count > 0) {
            let dim = String(entity.level.dimension)
            let x = entity.x.toFixed(2), y = (entity.y + 0.5).toFixed(2), z = entity.z.toFixed(2)
            let ok = entity.server.runCommandSilent(`execute in ${dim} run summon minecraft:item ${x} ${y} ${z} {Item:{id:"endrem:wither_eye",Count:${count}b},Tags:["moreup_keep"],Invulnerable:1b,PickupDelay:10s}`)
            if (!ok) console.error(`[MoreUp] 위더의 눈 summon 실패 (${dim} ${x} ${y} ${z})`)
        }
        console.info(`[MoreUp] 위더의 눈 ${count}개 드롭 (${entity.x.toFixed(0)}, ${entity.y.toFixed(0)}, ${entity.z.toFixed(0)})`)
    } catch (e) {
        console.error(`[MoreUp] 위더의 눈 드롭 실패: ${e}`)
    }
})
