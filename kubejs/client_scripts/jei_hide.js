// priority: 0
// ============================================================
// More Up: JEI에서 제작 불가 아이템 숨김
// 경로: kubejs/client_scripts/jei_hide.js
//
// 목록은 startup_scripts/moreup_disabled_items.js (global.MOREUP_DISABLED_ITEMS) 에서 관리한다.
// server_scripts/recipes/disabled_items.js 가 같은 목록으로 레시피를 제거한다.
//
// MOREUP_JEI_EXTRA_HIDDEN: 제작 불가 목록과 상관없이 JEI 에서만 숨길 아이템
//   - minecraft:knowledge_book (지식의 책, 2026-10-26 사용자 요청): 일반 플레이에서 쓸 일이 없는 명령어용 아이템.
//     아이템 자체는 지우지 않는다. Stellarity 가 이 아이템에 NBT 를 붙여 주문서 4종(빛·운반·상승 기류·자연의 분노)으로
//     쓰기 때문이다 (stellarity loot_tables/items/spellbooks). JEI 숨김은 그 주문서 동작에 영향이 없다.
// ============================================================

const MOREUP_JEI_EXTRA_HIDDEN = ['minecraft:knowledge_book']

JEIEvents.hideItems(event => {
    MOREUP_JEI_EXTRA_HIDDEN.forEach(id => {
        if (!Item.of(id).isEmpty()) event.hide(id)
    })

    let groups = global.MOREUP_DISABLED_ITEMS
    if (!groups) {
        console.error('[MoreUp] global.MOREUP_DISABLED_ITEMS 가 없어 JEI 숨김을 건너뜁니다.')
        return
    }

    let hidden = []
    for (let g = 0; g < groups.length; g++) {
        for (let i = 0; i < groups[g].items.length; i++) {
            let itemId = groups[g].items[i]
            if (!Item.of(itemId).isEmpty()) hidden.push(itemId)
        }
    }
    event.hide(hidden)
    console.info(`[MoreUp] JEI 숨김 ${hidden.length}종 + 추가 ${MOREUP_JEI_EXTRA_HIDDEN.length}종`)
})
