// priority: 0
// ============================================================
// More Up: 일식의 장신구 → 전용 Curios 칸 「일식」 (1.14.4, 2026-11-26)
// 경로: kubejs/server_scripts/tags/eclipse_tags.js
// 칸 정의: kubejs/data/moreup/curios/slots/moreup_eclipse.json (3칸), 플레이어에 붙이기: kubejs/data/moreup/curios/entities/moreup_eclipse.json
// 이 칸에는 이 태그의 장신구만 들어간다 (Curios 기본 검사 = curios:<칸 ID> 태그).
// ============================================================

ServerEvents.tags('item', event => {
    ;['eclipse_brand', 'eclipse_chain', 'eclipse_mirror', 'eclipse_core', 'eclipse_ward', 'eclipse_banner'].forEach(id => {
        try {
            if (Item.of(`moreup:${id}`).isEmpty()) {
                console.error(`[MoreUp] 일식의 장신구 칸 태그: 아이템 없음 moreup:${id}`)
                return
            }
            event.add('curios:moreup_eclipse', `moreup:${id}`)
        } catch (e) {
            console.error(`[MoreUp] 일식의 장신구 칸 태그 실패 (${id}): ${e}`)
        }
    })
})
