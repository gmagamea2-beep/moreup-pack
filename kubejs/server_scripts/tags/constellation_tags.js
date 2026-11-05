// priority: 0
// ============================================================
// More Up: 별자리 각인 대상 무기 태그 (More Up Core 1.4, 2026-11-04)
// 경로: kubejs/server_scripts/tags/constellation_tags.js
//
// 모드는 검·도끼·곡괭이 등(DiggerItem)·활·쇠뇌·삼지창·forge:tools 를 이미 무기로 본다.
// 여기서는 그 밖의 "들고 쓰는 마법 무기"(지팡이·홀)를 moreup:engravable_weapons 에 넣는다 — 등불자리 무기 각인(들고 있으면 주문 피해)용.
// ID 는 레지스트리 덤프(MoreUp/quests_src/registry/reg_items.txt)에서 확인했다. 정규식이라 모드가 없으면 아무것도 안 들어간다.
// 이동·편의용 홀(Celestial 엔더 도약 홀, Enigmatic 홀, L2 지팡이)은 무기가 아니라 넣지 않는다.
// ============================================================

ServerEvents.tags('item', event => {
    try {
        event.add('moreup:engravable_weapons', /^ebwizardry:wand_/)
        event.add('moreup:engravable_weapons', /^myth_wizardry:(staff|wand)_/)
        event.add('moreup:engravable_weapons', /^forbidden_arcanus:draco_arcanus_(staff|scepter)$/)
        event.add('moreup:engravable_weapons', /^bossominium:(pure_staff|rose_staff|sand_staff|warped_wand)$/)
    } catch (e) {
        console.error(`[MoreUp] 각인 무기 태그 실패: ${e}`)
    }
})
