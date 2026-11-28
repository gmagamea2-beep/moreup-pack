// priority: 0
// ============================================================
// More Up: 일식의 장신구 6종 레시피 (1.14.4, 2026-11-26) — 모어 이후 장신구
// 경로: kubejs/server_scripts/recipes/eclipse_relics.js
// 효과·칸: startup_scripts/moreup_eclipse_relics.js, 설계 MoreUp/docs/eclipse_relics.md
//
// 공통 모양 (조합대 3x3)          F = 황혼의 파편 2 (모어 처치)
//   X F X                        E = 전설 보스 정수 2
//   E S E                        S = 별의 조각 1 (별의 갑주 재료)
//   X F X                        X = 장신구마다 다른 후반 재료 4
// 재료 ID 는 레지스트리 덤프(MoreUp/quests_src/registry/reg_items.txt)에서 확인했다. 없으면 등록하지 않고 오류를 남긴다.
// ============================================================

const MOREUP_ECLIPSE_RECIPES = [
    ['moreup:eclipse_brand', 'minecraft:nether_star'],                 // 일식의 낙인 — 보스
    ['moreup:eclipse_chain', 'powah:crystal_nitro'],                   // 연격의 성흔 — 니트로 결정
    ['moreup:eclipse_mirror', 'deeperdarker:reinforced_echo_shard'],   // 응보의 거울 — 강화 메아리 조각
    ['moreup:eclipse_core', 'mekanism:pellet_polonium'],               // 붕괴의 핵 — 폴로늄 알갱이
    ['moreup:eclipse_ward', 'deeperdarker:soul_crystal'],              // 경험의 방벽 — 영혼 결정
    ['moreup:eclipse_banner', 'mekanism:ultimate_control_circuit']     // 결속의 깃발 — 궁극 제어 회로
]

ServerEvents.recipes(event => {
    let applied = 0
    MOREUP_ECLIPSE_RECIPES.forEach(r => {
        try {
            let key = { X: r[1], F: 'moreup:dusk_fragment', E: 'moreup:boss_essence_legendary', S: 'moreup:stellar_shard' }
            let missing = []
            for (let k in key) if (Item.of(key[k]).isEmpty()) missing.push(`${k}=${key[k]}`)
            if (Item.of(r[0]).isEmpty()) missing.push(`결과 ${r[0]}`)
            if (missing.length > 0) {
                console.error(`[MoreUp] 일식의 장신구 레시피 재료 없음 (${r[0]}): ${missing.join(', ')}`)
                return
            }
            event.shaped(r[0], ['XFX', 'ESE', 'XFX'], key).id(`moreup:eclipse/${r[0].substring(7)}`)
            applied++
        } catch (e) {
            console.error(`[MoreUp] 일식의 장신구 레시피 등록 실패 (${r[0]}): ${e}`)
        }
    })
    console.info(`[MoreUp] 일식의 장신구 레시피 ${applied}/${MOREUP_ECLIPSE_RECIPES.length}개 등록`)
})
