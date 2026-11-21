// priority: 0
// ============================================================
// More Up: Thermal Extra 연동 (2026-11-21 사용자 요청 "Thermal Extra 추가 및 번역, 최적화")
// 경로: kubejs/server_scripts/recipes/thermal_extra.js
// 번역: kubejs/assets/thermal_extra/lang/ko_kr.json (모드에 든 한국어는 357줄 중 112줄뿐이라 팩 용어로 새로 만듦)
//
// 조합대 철 막대 충돌 정리
//   Thermal Extra 철 막대(철 주괴 2개 세로 → 2개)와 Immersive Engineering 철 막대(같은 모양 → 4개)가 겹쳐
//   조합대에서 어느 쪽이 나올지 정해지지 않는다. Thermal Extra 쪽 조합대 조합법만 지운다.
//   - Thermal Extra 철 막대는 다목적 압착기 + 막대 금형으로 계속 만들 수 있다
//   - 두 막대 모두 forge:rods/iron 태그라, 막대를 재료로 쓰는 조합법은 어느 쪽이든 받는다
//   - 다른 금속 막대는 IE·Create Crafts & Additions·Create Stuff Additions·AllTheOres 와 겹치지 않았다 (jar 조사)
//
// 확인만 하고 바꾸지 않은 것
//   - 렉: 월드 생성(광석)이 없고, 작물 수확기는 작업 한 번마다 주변 5×5칸만 본다
//   - 진행: 강화재 4(드래곤스틸)는 Thermal 강화재 3(상급 정수 관문, tech_gating.js)을 재료로 써서 관문을 따른다
//   - 장비: 최고 등급(심연) 검 공격력 10.5, 방어구 방어력 28·강도 2. 드래곤스틸(Ice and Fire)·Cataclysm 장비보다 낮다
// Thermal Extra 가 없으면 건너뛴다.
// ============================================================

ServerEvents.recipes(event => {
    if (!Platform.isLoaded('thermal_extra')) return
    event.remove({ id: 'thermal_extra:crafting/iron_rod' })
})
