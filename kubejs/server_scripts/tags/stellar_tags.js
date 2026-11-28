// priority: 0
// ============================================================
// More Up: 별의 조각 재료 태그 (1.14.4, 2026-11-25)
// 경로: kubejs/server_scripts/tags/stellar_tags.js
//
// moreup:stellar_dragonsteel = 드래곤스틸 주괴 3종 (불·얼음·번개 드래곤 아무거나). 레시피 recipes/stellar_armor.js
// curios:<칸> = 별의 장신구 6종이 들어갈 Curios 칸 (2026-11-26, 능력치는 startup_scripts/moreup_stellar_relics.js)
// ID 는 레지스트리 덤프(MoreUp/quests_src/registry/reg_items.txt)에서 확인했다. 없는 ID 는 넣지 않고 오류를 남긴다.
// ============================================================

ServerEvents.tags('item', event => {
    try {
        let added = 0
        ;['iceandfire:dragonsteel_fire_ingot', 'iceandfire:dragonsteel_ice_ingot', 'iceandfire:dragonsteel_lightning_ingot'].forEach(id => {
            if (Item.of(id).isEmpty()) {
                console.error(`[MoreUp] 별의 조각 태그: 아이템 없음 ${id}`)
                return
            }
            event.add('moreup:stellar_dragonsteel', id)
            added++
        })
        if (added === 0) console.error('[MoreUp] 별의 조각 태그가 비었습니다 — 별의 조각을 만들 수 없음')
    } catch (e) {
        console.error(`[MoreUp] 별의 조각 태그 실패: ${e}`)
    }
})

// 별의 장신구 → Curios 칸. 칸 이름은 플레이어 데이터에 실제로 있는 칸만 썼다(ring, necklace, belt, hands, feet, charm)
const MOREUP_STELLAR_RELIC_SLOTS = [
    ['curios:ring', 'moreup:stellar_ring'],
    ['curios:necklace', 'moreup:stellar_pendant'],
    ['curios:belt', 'moreup:stellar_belt'],
    ['curios:hands', 'moreup:stellar_gauntlet'],
    ['curios:feet', 'moreup:stellar_anklet'],
    ['curios:charm', 'moreup:stellar_charm']
]
ServerEvents.tags('item', event => {
    MOREUP_STELLAR_RELIC_SLOTS.forEach(t => {
        try {
            if (Item.of(t[1]).isEmpty()) {
                console.error(`[MoreUp] 별의 장신구 칸 태그: 아이템 없음 ${t[1]}`)
                return
            }
            event.add(t[0], t[1])
        } catch (e) {
            console.error(`[MoreUp] 별의 장신구 칸 태그 실패 (${t[1]}): ${e}`)
        }
    })
})
