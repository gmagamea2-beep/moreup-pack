// priority: 0
// ============================================================
// More Up: 황혼 장비 태그
// 경로: kubejs/server_scripts/tags/dusk_gear.js
// 황혼의 망토를 Curios "back"(등) 슬롯에 낄 수 있게 한다. 슬롯 자체는 config/curios-common.toml 에서 1칸 추가.
// ============================================================

ServerEvents.tags('item', event => {
    event.add('curios:back', 'moreup:dusk_cape')
})
