// priority: 0
// ============================================================
// More Up: 모드 데이터 오류로 통째로 무시되는 태그 복구
// 경로: kubejs/server_scripts/tags/data_fixes.js
//
// 태그 안에 존재하지 않는 항목이 하나라도 있으면 바닐라는 그 태그 전체를 버린다.
// (로그: "Couldn't load tag ... as it is missing following references")
// 문제가 되는 항목만 빼서 태그의 나머지가 다시 동작하게 한다.
// ============================================================

// Integrated Villages 1.3.2가 minecraft:village 에 자기 jar에 없는 구조물(swamp_village)을 넣어서
// 바닐라 마을 태그 전체가 무시되고, 이를 참조하는 Supplementaries의 모험 지도·길 표지판 목적지도 깨진다.
const MOREUP_TAG_REMOVALS = {
    'worldgen/structure': [
        ['minecraft:village', 'integrated_villages:swamp_village']
    ]
}

Object.keys(MOREUP_TAG_REMOVALS).forEach(registry => {
    ServerEvents.tags(registry, event => {
        MOREUP_TAG_REMOVALS[registry].forEach(([tag, entry]) => {
            event.remove(tag, entry)
        })
    })
})
