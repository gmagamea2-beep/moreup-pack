// priority: 0
// ============================================================
// More Up: 별의 갑주 레시피 (1.14.4, 2026-11-25)
// 경로: kubejs/server_scripts/recipes/stellar_armor.js
// 설계: MoreUp/docs/stellar_armor.md / 아이템: startup_scripts/moreup_stellar_armor.js
//
// 별의 조각 1개 = 서로 다른 보스 8종의 광물·방어구 재료 1개씩 + 상급 보스 정수 1 (사용자 결정 "여러 보스 재료를 섞어 조각 1개")
// 별의 갑주 한 부위 = 네더라이트 방어구 + 별의 조각 2 (대장장이 작업대, 마법 부여·이름 유지) → 한 벌 조각 8개
// 별의 장신구 6종 = 별의 조각 1 + 바닐라 재료 (2026-11-26, 조합대 3x3)
// 재료가 레지스트리에 없으면 그 레시피는 등록하지 않고 오류를 남긴다.
// ============================================================

// 별의 조각 재료 (ID 는 MoreUp/quests_src/registry/reg_items.txt 에서 확인)
const MOREUP_STELLAR_SHARD_KEY = {
    I: 'cataclysm:ignitium_ingot',       // 이그니스
    W: 'cataclysm:witherite_ingot',      // 하빈저
    C: 'cataclysm:cursium_ingot',        // 말레딕투스
    A: 'cataclysm:ancient_metal_ingot',  // 고대 레넌트
    D: '#moreup:stellar_dragonsteel',    // 불·얼음·번개 드래곤 (드래곤스틸 주괴 아무거나, tags/stellar_tags.js)
    F: 'twilightforest:fiery_ingot',     // 히드라·우르 가스트 (화염 피)
    H: 'deeperdarker:warden_carapace',   // 워든
    N: 'minecraft:nether_star',          // 위더
    E: 'moreup:boss_essence_high'        // 상급 보스 정수
}
const MOREUP_STELLAR_SHARD_PATTERN = ['IWC', 'DEA', 'FHN']

// 네더라이트 방어구 → 별의 갑주
const MOREUP_STELLAR_UPGRADES = [
    ['minecraft:netherite_helmet', 'moreup:stellar_helmet'],
    ['minecraft:netherite_chestplate', 'moreup:stellar_chestplate'],
    ['minecraft:netherite_leggings', 'moreup:stellar_leggings'],
    ['minecraft:netherite_boots', 'moreup:stellar_boots']
]

// 별의 장신구 (S = 별의 조각)
const MOREUP_STELLAR_RELIC_RECIPES = [
    { result: 'moreup:stellar_ring', pattern: [' N ', 'DSD', ' N '],
      key: { N: 'minecraft:netherite_ingot', D: 'minecraft:diamond', S: 'moreup:stellar_shard' } },
    { result: 'moreup:stellar_pendant', pattern: ['CCC', 'C C', 'DSD'],
      key: { C: 'minecraft:chain', D: 'minecraft:diamond', S: 'moreup:stellar_shard' } },
    { result: 'moreup:stellar_belt', pattern: ['LNL', 'LSL', 'LNL'],
      key: { L: 'minecraft:leather', N: 'minecraft:netherite_ingot', S: 'moreup:stellar_shard' } },
    { result: 'moreup:stellar_gauntlet', pattern: ['NSN', 'NBN'],
      key: { N: 'minecraft:netherite_ingot', B: 'minecraft:blaze_rod', S: 'moreup:stellar_shard' } },
    { result: 'moreup:stellar_anklet', pattern: ['RFR', 'FSF'],
      key: { R: 'minecraft:rabbit_foot', F: 'minecraft:feather', S: 'moreup:stellar_shard' } },
    { result: 'moreup:stellar_charm', pattern: ['GAG', 'ASA', 'GAG'],
      key: { G: 'minecraft:glowstone_dust', A: 'minecraft:amethyst_shard', S: 'moreup:stellar_shard' } }
]

ServerEvents.recipes(event => {
    let applied = 0
    let total = 1 + MOREUP_STELLAR_UPGRADES.length
    try {
        let missing = []
        for (let k in MOREUP_STELLAR_SHARD_KEY) {
            let id = MOREUP_STELLAR_SHARD_KEY[k]
            if (id.startsWith('#')) continue   // 태그는 tags/stellar_tags.js 가 재료 확인
            if (Item.of(id).isEmpty()) missing.push(`${k}=${id}`)
        }
        if (Item.of('moreup:stellar_shard').isEmpty()) missing.push('결과 moreup:stellar_shard')
        if (missing.length > 0) {
            console.error(`[MoreUp] 별의 조각 레시피 재료 없음: ${missing.join(', ')}`)
        } else {
            event.shaped('moreup:stellar_shard', MOREUP_STELLAR_SHARD_PATTERN, MOREUP_STELLAR_SHARD_KEY).id('moreup:stellar/stellar_shard')
            applied++
        }
    } catch (e) {
        console.error(`[MoreUp] 별의 조각 레시피 등록 실패: ${e}`)
    }
    MOREUP_STELLAR_UPGRADES.forEach(u => {
        try {
            if (Item.of(u[0]).isEmpty() || Item.of(u[1]).isEmpty()) {
                console.error(`[MoreUp] 별의 갑주 레시피 재료 없음: ${u[0]} → ${u[1]}`)
                return
            }
            event.custom({
                type: 'minecraft:smithing_transform',
                template: { item: 'moreup:stellar_shard' },
                base: { item: u[0] },
                addition: { item: 'moreup:stellar_shard' },
                result: { item: u[1] }
            }).id(`moreup:stellar/${u[1].substring(u[1].indexOf(':') + 1)}`)
            applied++
        } catch (e) {
            console.error(`[MoreUp] 별의 갑주 레시피 등록 실패 (${u[1]}): ${e}`)
        }
    })
    MOREUP_STELLAR_RELIC_RECIPES.forEach(r => {
        total++
        try {
            let missing = []
            for (let k in r.key) if (Item.of(r.key[k]).isEmpty()) missing.push(`${k}=${r.key[k]}`)
            if (Item.of(r.result).isEmpty()) missing.push(`결과 ${r.result}`)
            if (missing.length > 0) {
                console.error(`[MoreUp] 별의 장신구 레시피 재료 없음 (${r.result}): ${missing.join(', ')}`)
                return
            }
            event.shaped(r.result, r.pattern, r.key).id(`moreup:stellar/${r.result.substring(r.result.indexOf(':') + 1)}`)
            applied++
        } catch (e) {
            console.error(`[MoreUp] 별의 장신구 레시피 등록 실패 (${r.result}): ${e}`)
        }
    })
    console.info(`[MoreUp] 별의 갑주·장신구 레시피 ${applied}/${total}개 등록`)
})
