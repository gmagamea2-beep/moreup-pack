// priority: 0
// ============================================================
// More Up: 제작 불가 아이템 레시피 제거
// 경로: kubejs/server_scripts/recipes/disabled_items.js
//
// 목록은 startup_scripts/moreup_disabled_items.js (global.MOREUP_DISABLED_ITEMS) 에서 관리한다.
// 구 recipes/mekanism.js, recipes/ae2.js, recipes/create_creative.js 를 이 파일로 합쳤다.
// ============================================================

ServerEvents.recipes(event => {
    let groups = global.MOREUP_DISABLED_ITEMS
    if (!groups) {
        console.error('[MoreUp] global.MOREUP_DISABLED_ITEMS 가 없습니다. startup_scripts/moreup_disabled_items.js 를 확인하세요.')
        return
    }

    for (let g = 0; g < groups.length; g++) {
        let group = groups[g]
        let skipped = []

        for (let i = 0; i < group.items.length; i++) {
            let itemId = group.items[i]
            // 없는 아이템 ID로 출력 필터를 만들면 의도치 않은 레시피가 지워질 수 있어 존재 여부부터 확인한다
            if (Item.of(itemId).isEmpty()) {
                skipped.push(itemId)
                continue
            }
            event.remove({ output: itemId })
        }

        for (let i = 0; i < group.recipeIds.length; i++) {
            event.remove({ id: group.recipeIds[i] })
        }

        console.info(`[MoreUp] 레시피 제거: ${group.group} - 아이템 ${group.items.length - skipped.length}종, 레시피 ID ${group.recipeIds.length}개`)
        if (skipped.length > 0) {
            console.warn(`[MoreUp] 레지스트리에 없어 건너뛴 아이템 (${group.group}): ${skipped.join(', ')}`)
        }
    }
})
