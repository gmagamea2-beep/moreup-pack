// priority: 0
// ============================================================
// More Up: AE2 초반 완화 (2026-11-07 사용자 요청 "ae2 초반에 쉽게 할 수 있게", 1.12.0)
// 경로: kubejs/server_scripts/recipes/ae2_early.js
// 설계: MoreUp/docs/ae2_early.md
//
// 1) 운석 없이 시작: 인스크라이버 프레스 4종 조합법 + Create 혼합기로 서티스 석영 결정
//    (원래 첫 프레스·서티스는 운석에서만 나온다. 프레스 복제(인스크라이버 + 철 블록)는 AE2 원래 레시피 그대로)
// 2) 초반 용량: 저장 부품 4k·16k 대체 조합법(처리기 없이 아래 부품 4개),
//    AE2 Things DISK(종류 수 제한 없는 저장 장치)의 네더라이트 주괴 → 다이아몬드 (하우징·1k·4k·16k)
// 3) 컨트롤러·분자 조립기는 cross_links.js 에서 팩 변경을 빼서 AE2 원래 레시피로 돌아갔다
// 결과 아이템이 없으면 조용히 건너뛰고, 재료가 없으면 오류를 남긴다.
// ============================================================

const MOREUP_AE2_PRESSES = [
    // [결과, 가장자리 재료, 메모]
    ['ae2:silicon_press', '#forge:dusts/redstone', '실리콘 프레스: 레드스톤'],
    ['ae2:logic_processor_press', '#forge:ingots/gold', '논리 프레스: 금'],
    ['ae2:calculation_processor_press', 'minecraft:quartz', '연산 프레스: 네더 석영'],
    ['ae2:engineering_processor_press', '#forge:gems/diamond', '공학 프레스: 다이아몬드']
]

// AE2 Things DISK: 네더라이트 주괴 → 다이아몬드 (그 밖의 재료·모양은 원래 그대로)
const MOREUP_AE2_DISK_RECIPES = ['ae2things:cells/disk_housing', 'ae2things:cells/disk_drive_1k',
    'ae2things:cells/disk_drive_4k', 'ae2things:cells/disk_drive_16k']

function moreupAe2Missing(id) {
    return id.charAt(0) !== '#' && Item.of(id).isEmpty()
}

ServerEvents.recipes(event => {
    if (moreupAe2Missing('ae2:controller')) return
    let added = 0

    // 1) 프레스: 가운데 철 블록, 십자에 서티스 석영, 모서리에 프레스별 재료
    MOREUP_AE2_PRESSES.forEach(p => {
        try {
            if (moreupAe2Missing(p[0]) || moreupAe2Missing(p[1])) { console.error(`[MoreUp] AE2 프레스 레시피 재료 없음: ${p[0]}`); return }
            event.shaped(p[0], ['XAX', 'ABA', 'XAX'], {
                X: p[1], A: '#ae2:all_certus_quartz', B: '#forge:storage_blocks/iron'
            }).id(`moreup:ae2_early/${p[0].substring(4)}`)
            added++
        } catch (e) { console.error(`[MoreUp] AE2 프레스 레시피 실패 (${p[0]}): ${e}`) }
    })

    // 1) 서티스 석영: Create 혼합기 (열 필요 없음) — 네더 석영 + 레드스톤 + 물 250mB
    try {
        event.custom({
            type: 'create:mixing',
            ingredients: [{ item: 'minecraft:quartz' }, { tag: 'forge:dusts/redstone' }, { fluid: 'minecraft:water', amount: 250 }],
            results: [{ item: 'ae2:certus_quartz_crystal' }]
        }).id('moreup:ae2_early/mixing_certus_quartz')
        added++
    } catch (e) { console.error(`[MoreUp] 서티스 석영 혼합 레시피 실패: ${e}`) }

    // 2) 저장 부품 대체 조합법: 아래 단계 부품 4개 + 석영 유리 (원래 조합법도 남는다)
    ;[['ae2:cell_component_4k', 'ae2:cell_component_1k'], ['ae2:cell_component_16k', 'ae2:cell_component_4k']].forEach(c => {
        try {
            event.shaped(c[0], [' C ', 'CGC', ' C '], { C: c[1], G: 'ae2:quartz_glass' })
                .id(`moreup:ae2_early/${c[0].substring(4)}_from_parts`)
            added++
        } catch (e) { console.error(`[MoreUp] 저장 부품 대체 레시피 실패 (${c[0]}): ${e}`) }
    })

    // 2) DISK 네더라이트 → 다이아몬드
    if (!moreupAe2Missing('ae2things:disk_housing')) {
        MOREUP_AE2_DISK_RECIPES.forEach(id => {
            try {
                event.replaceInput({ id: id }, 'minecraft:netherite_ingot', '#forge:gems/diamond')
                added++
            } catch (e) { console.error(`[MoreUp] DISK 재료 교체 실패 (${id}): ${e}`) }
        })
    }
    console.info(`[MoreUp] AE2 초반 완화 레시피 ${added}개`)
})
