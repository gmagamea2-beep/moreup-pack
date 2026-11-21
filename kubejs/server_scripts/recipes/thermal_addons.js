// priority: 0
// ============================================================
// More Up: Thermal 애드온 연동 (Thermal Extra 3.3.3 · Thermal Endergy 1.0.0 · Thermal Unlimited 2.0.0, 2026-11-21)
// 경로: kubejs/server_scripts/recipes/thermal_addons.js
// 사용자 요청: "Thermal Extra 추가 및 번역, 최적화", "Thermal Endergy, Thermal Unlimited 도 추가하고 방식은 같게
//              지금 커스텀 조합법을 모두 확인하고 그거에 맞게 조합법까지 수정 유저팩도 확인하고 Polymorph 모드가 있음"
// 번역: kubejs/assets/thermal_extra/lang/ko_kr.json (357줄), kubejs/assets/thermalendergy/lang/ko_kr.json (32줄)
//
// 팩 커스텀 조합법 규칙에 맞춘 것 (규칙이 있는 파일에 같이 넣었다)
//   - 테크 관문(tech_gating.js): Thermal 강화재 3(상급 정수)보다 위 단계 강화재 5종 → 전설 정수
//     (Mekanism Extras 설치기처럼 "기본 모드 최고 단계 위"는 모두 전설)
//   - 테크 모드 무기 금지(startup_scripts/moreup_disabled_items.js): Thermal Extra 검 8종. 도구는 그대로
//   - 압축 다이나모 연료 기준(tech_compat.js: 정제 연료 200만 RF 보다 낮게, 만들기 어려울수록 높게): 아래 목록
//
// 바꾸지 않은 것
//   - 겹치는 조합법(Thermal Extra 철 막대 ↔ Immersive Engineering 철 막대, 같은 모양): Polymorph 로 플레이어가 고른다
//   - Thermal Extra·Endergy 새 기계: Thermal 기계 프레임(cross_links.js 에서 Create 안산암 케이스로 이어 둠)을 써서 그 연결을 따른다.
//     Thermal 기계는 관문 대상이 아니므로(tech_gating.js) 새 기계도 막지 않는다
//   - Thermal Extra·Endergy 일반 강화(속도·출력·무효화 등): Thermal 일반 강화처럼 막지 않는다.
//     Endergy "무효화" 강화는 이름과 달리 0이 아니다 (연료 무효화 = 다이나모 출력 x3·연료당 전력 x0.8, jar 확인)
//   - 장비: Thermal Extra 최고 등급(심연) 방어구 방어력 28·강도 2 (팩 배율 x1.5 가 그대로 걸림). 검은 위에서 막았다
//   - 렉: 세 모드 모두 월드 생성이 없다. 작물 수확기는 작업 한 번마다 주변 5x5칸만 본다
//   - Thermal Unlimited: 조합법·아이템 없음. 플레이어가 기계를 놓을 때만 에너지 입출력 한도를 없애고,
//     기계가 다시 불러와지면(청크 다시 불러오기·서버 재시작·강화 교체) Thermal 이 원래 한도로 되돌린다 (jar 확인)
// Thermal Extra 가 없으면 건너뛴다.
// ============================================================

// [Thermal Extra 원래 연료 레시피 ID, 액체, 1000mB 당 전력, 이유]  양은 원래처럼 1000mB 단위
const MOREUP_THERMAL_ADDON_FUELS = [
    ['thermal_extra:fuels/compression/diesel', 'thermal_extra:diesel', 800000, '원래 200만(정제 연료와 같음) → PneumaticCraft 디젤과 같게'],
    ['thermal_extra:fuels/compression/gasoline', 'thermal_extra:gasoline', 1400000, '원래 250만(정제 연료보다 높음) → PneumaticCraft 휘발유와 같게'],
    ['thermal_extra:fuels/compression/refined_sunflower_oil', 'thermal_extra:refined_sunflower_oil', 500000, '원래 100만(디젤보다 높음) → 바이오디젤과 같게']
]

ServerEvents.recipes(event => {
    if (!Platform.isLoaded('thermal_extra')) return
    let added = 0
    MOREUP_THERMAL_ADDON_FUELS.forEach(f => {
        try {
            if (Fluid.of(f[1]).isEmpty()) return
            event.remove({ id: f[0] })
            event
                .custom({ type: 'thermal:compression_fuel', ingredient: { fluid: f[1], amount: 1000 }, energy: f[2] })
                .id(`moreup:compat/fuel_${f[1].replace(':', '_')}`)
            added++
        } catch (e) {
            console.error(`[MoreUp] Thermal 애드온 연료 레시피 실패 (${f[1]}): ${e}`)
        }
    })
    console.info(`[MoreUp] Thermal 애드온 압축 연료 ${added}/${MOREUP_THERMAL_ADDON_FUELS.length}개 조정`)
})
