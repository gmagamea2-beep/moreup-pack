// priority: 0
// ============================================================
// More Up: 별자리 각인석 7종 조합법 (More Up Core 1.4, 2026-11-04)
// 경로: kubejs/server_scripts/recipes/constellation.js
// 설계: MoreUp/docs/constellation_system.md (아이템은 모드가 등록, 조합법은 팩)
//
// 모양:  .A.      A = 자수정 조각, X = 별자리 재료, E = 중급 보스 정수
//        AXA
//        .E.
// 재료 ID 는 레지스트리 덤프(MoreUp/quests_src/registry/reg_items.txt)에서 확인했다.
// 결과(모드 아이템)가 없으면 조용히 건너뛰고, 재료가 하나도 없으면 오류를 남긴다 (endgame_relics.js 와 같은 방식).
// 재료 칸에 배열을 주면 그중 무엇이든 쓸 수 있다 (있는 것만 남긴다).
// ============================================================

const MOREUP_ENGRAVING_RECIPES = [
    // 용비늘자리: 드래곤 비늘 아무거나 (엔더 드래곤 비늘·Ice and Fire 용 비늘·Forbidden Arcanus 용 비늘)
    { id: 'dragon', material: ['dragonloot:dragon_scale', 'forbidden_arcanus:dragon_scale',
        'iceandfire:dragonscales_red', 'iceandfire:dragonscales_green', 'iceandfire:dragonscales_bronze', 'iceandfire:dragonscales_gray',
        'iceandfire:dragonscales_blue', 'iceandfire:dragonscales_white', 'iceandfire:dragonscales_sapphire', 'iceandfire:dragonscales_silver',
        'iceandfire:dragonscales_electric', 'iceandfire:dragonscales_amythest', 'iceandfire:dragonscales_copper', 'iceandfire:dragonscales_black'] },
    { id: 'flame', material: ['minecraft:blaze_rod'] },              // 불꽃검자리
    { id: 'sky', material: ['minecraft:feather'] },                  // 하늘활자리
    { id: 'hammer', material: ['minecraft:iron_block'] },            // 망치자리
    { id: 'lamp', material: ['minecraft:lapis_block'] },             // 등불자리
    { id: 'compass', material: ['minecraft:compass'] },              // 나침반자리
    { id: 'spring', material: ['minecraft:glistering_melon_slice'] } // 샘물자리
]
const MOREUP_ENGRAVING_ESSENCE = 'moreup:boss_essence_mid'
const MOREUP_ENGRAVING_SHARD = 'minecraft:amethyst_shard'

ServerEvents.recipes(event => {
    let applied = 0
    MOREUP_ENGRAVING_RECIPES.forEach(r => {
        let result = `moreup:engraving_${r.id}`
        try {
            if (Item.of(result).isEmpty()) return   // 모드가 1.4 이전
            let materials = r.material.filter(id => !Item.of(id).isEmpty())
            if (materials.length === 0 || Item.of(MOREUP_ENGRAVING_ESSENCE).isEmpty()) {
                console.error(`[MoreUp] 각인석 레시피 ${r.id} 재료 없음: ${r.material.join(', ')}`)
                return
            }
            event.shaped(result, [' A ', 'AXA', ' E '], {
                A: MOREUP_ENGRAVING_SHARD,
                X: materials.length === 1 ? materials[0] : materials,
                E: MOREUP_ENGRAVING_ESSENCE
            }).id(`moreup:constellation/engraving_${r.id}`)
            applied++
        } catch (e) {
            console.error(`[MoreUp] 각인석 레시피 등록 실패 (${r.id}): ${e}`)
        }
    })
    console.info(`[MoreUp] 각인석 레시피 ${applied}/${MOREUP_ENGRAVING_RECIPES.length}개 등록`)
})
