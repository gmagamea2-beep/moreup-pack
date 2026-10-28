// priority: -20
// ============================================================
// More Up: 일반 몬스터 처치 시 정수 (2026-10-24, 2026-10-27 대폭 상향)
// 경로: kubejs/server_scripts/systems/mob_essence.js
//
// 플레이어(또는 플레이어가 쏜 투사체)가 적대 몹을 처치하면 아래를 각각 따로 굴린다.
//   잠든 정수 : 기본 8% × (최대 체력 / 20), 최대 30%. 체력 60 이상이면 2개
//              (잠든 정수는 기계 손 + 하급 보스 트로피로 하급 정수가 된다: recipes/essence_exchange.js)
//   하급 정수 : 기본 2.5% × (최대 체력 / 20), 최대 12%
//   중급 정수 : 최대 체력 150 이상인 강한 몹만 3%
//   예) 좀비(20) 잠든 8%·하급 2.5%, 체력 60 몹 잠든 24%(2개)·하급 7.5%, 체력 200 몹 잠든 30%(2개)·하급 12%·중급 3%
// 보스 티어표(systems/boss_tiers.js)에 있는 보스는 boss_rewards.js 가 따로 보상하므로 제외
// 2026-10-27 이전: 하급만 1% × (체력/20), 최대 5%
// 표를 바꾼 뒤 /reload 하면 적용된다.
// ============================================================

const MOREUP_MOB_ESSENCE_DROPS = [
    // [아이템, 체력 20 기준 확률, 최대 확률, 최소 최대 체력, 개수, 개수 +1 이 되는 최대 체력(0 이면 항상 기본 개수)]
    ['moreup:dormant_essence', 0.08, 0.30, 0, 1, 60],
    ['moreup:boss_essence_low', 0.025, 0.12, 0, 1, 0],
    ['moreup:boss_essence_mid', 0.03, 0.03, 150, 1, 0]
]

const $MoreUpEnemy = Java.loadClass('net.minecraft.world.entity.monster.Enemy')
const $MoreUpMobPlayer = Java.loadClass('net.minecraft.world.entity.player.Player')

// 보스 ID 집합 (boss_tiers.js 의 MOREUP_BOSS_TIERS 를 공유)
const moreupMobEssenceBossIds = {}
if (typeof MOREUP_BOSS_TIERS !== 'undefined') {
    for (let tierKey in MOREUP_BOSS_TIERS) MOREUP_BOSS_TIERS[tierKey].forEach(id => { moreupMobEssenceBossIds[id] = true })
}

let moreupMobEssenceErrors = 0
EntityEvents.death(event => {
    try {
        let entity = event.entity
        // 가장 흔한 경우부터 빠르게 거른다: 적대 몹이 아니면 끝
        if (!(entity instanceof $MoreUpEnemy)) return
        let killer = event.source.getActual()
        if (killer == null || !(killer instanceof $MoreUpMobPlayer)) return
        if (moreupMobEssenceBossIds[String(entity.type)]) return
        let server = Utils.server
        if (!server) return
        let hp = entity.getMaxHealth()
        let scale = Math.max(1, hp / 20)
        MOREUP_MOB_ESSENCE_DROPS.forEach(d => {
            if (hp < d[3]) return
            let chance = Math.min(d[2], d[1] * scale)
            if (Math.random() >= chance) return
            let count = (d[5] > 0 && hp >= d[5]) ? d[4] + 1 : d[4]
            // boss_rewards.js 의 드롭 함수 (폭발·용암에 안 사라지고 자동 청소 제외)
            moreupDropItem(server, entity, d[0], count)
        })
    } catch (e) {
        if (moreupMobEssenceErrors < 5) {
            moreupMobEssenceErrors++
            console.error(`[MoreUp] 몹 정수 드롭 실패 (${moreupMobEssenceErrors}/5): ${e}`)
        }
    }
})

console.info(`[MoreUp] 몹 정수 드롭: ${MOREUP_MOB_ESSENCE_DROPS.map(d => `${d[0]} ${d[1] * 100}%~${d[2] * 100}%`).join(', ')}`)
