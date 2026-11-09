// priority: 0
// ============================================================
// More Up: 테크 패치 조합법 (2026-11-09, 1.13.0)
// 경로: kubejs/server_scripts/recipes/tech_patch.js
// 설계: MoreUp/docs/tech_patch.md
//
// 사용자 요청: "테크 모드를 더 넣고 ... 조합법 섞고 저장쪽 모드 추가(큰 상자, 조합법이 쉽진 않지만 중반부에서는 만들 만한 정도)"
// 방식: 레시피의 모양은 그대로 두고, 그 레시피에 한 번(또는 같은 자리에만) 나오는 재료를 다른 모드 부품·보스 정수로 바꾼다 (replaceInput).
//   - 섞기: 각 모드 입구 기계에 이미 있는 다른 모드의 부품을 하나씩 넣어 진행이 이어지게 한다 (같거나 이른 단계 재료만)
//   - 관문: 한 번 만드는 상위 기계만 보스 정수로 막는다 (tech_gating.js 와 같은 원칙)
//   - 저장: Sophisticated Storage 상자 등급을 중반 재료(판·정밀 기계 장치·정수)로
// 재료 ID 는 테스트 서버 레시피 덤프(2026-11-09)에서 확인했다. 모드가 없으면 그 항목은 건너뛴다.
// ============================================================

const MOREUP_TP = [
    // ---------- 섞기 (모드 연결) ----------
    { why: 'IE 중급 공학 블록 ← Create 정밀 기계 장치 (가운데 일렉트럼 → 정밀 기계 장치)', needs: 'immersiveengineering:heavy_engineering',
      filter: { id: 'immersiveengineering:crafting/heavy_engineering' }, from: '#forge:ingots/electrum', to: 'create:precision_mechanism' },
    { why: 'IE 경공학 블록 ← Create 안산암 케이스 (가운데 구리 → 안산암 케이스)', needs: 'immersiveengineering:light_engineering',
      filter: { id: 'immersiveengineering:crafting/light_engineering' }, from: 'minecraft:copper_ingot', to: 'create:andesite_casing' },
    { why: 'Ender IO 빈 섀시 ← IE 철 금속판 (철창 → 철 금속판)', needs: 'enderio:void_chassis',
      filter: { id: 'enderio:void_chassis' }, from: 'minecraft:iron_bars', to: 'immersiveengineering:sheetmetal_iron' },
    { why: 'Extreme Reactors 기본 원자로 제어기 ← Mekanism 기본 회로 (다이아몬드 → 회로)', needs: 'bigreactors:basic_reactorcontroller',
      filter: { output: 'bigreactors:basic_reactorcontroller' }, from: 'minecraft:diamond', to: '#forge:circuits/basic' },
    { why: 'Extreme Reactors 기본 터빈 제어기 ← Mekanism 고급 회로 (다이아몬드 → 회로)', needs: 'bigreactors:basic_turbinecontroller',
      filter: { output: 'bigreactors:basic_turbinecontroller' }, from: 'minecraft:diamond', to: '#forge:circuits/advanced' },
    { why: 'Advanced Generators 조작 회로 ← IE 전자 부품 (석영 → 전자 부품)', needs: 'advgenerators:controller',
      filter: { output: 'advgenerators:controller' }, from: 'minecraft:quartz', to: 'immersiveengineering:component_electronic' },
    { why: 'Create 디젤 엔진 ← IE 강철 부품 (부싯돌과 부시 → 강철 부품)', needs: 'createdieselgenerators:diesel_engine',
      filter: { output: 'createdieselgenerators:diesel_engine' }, from: 'minecraft:flint_and_steel', to: 'immersiveengineering:component_steel' },
    { why: 'Sophisticated 저장소 제어기 ← AE2 논리 처리기 (비교기 → 논리 처리기)', needs: 'sophisticatedstorage:controller',
      filter: { output: 'sophisticatedstorage:controller' }, from: 'minecraft:comparator', to: 'ae2:logic_processor' },
    { why: 'Functional Storage 저장 컨트롤러 ← AE2 논리 처리기 (비교기 → 논리 처리기)', needs: 'functionalstorage:storage_controller',
      filter: { output: 'functionalstorage:storage_controller' }, from: 'minecraft:comparator', to: 'ae2:logic_processor' },

    // ---------- 관문 (보스 정수) ----------
    { why: '강화 원자로 제어기: 다이아몬드 블록 → 중급 정수', needs: 'bigreactors:reinforced_reactorcontroller',
      filter: { output: 'bigreactors:reinforced_reactorcontroller' }, from: 'minecraft:diamond_block', to: 'moreup:boss_essence_mid' },
    { why: '강화 터빈 제어기: 다이아몬드 블록 → 중급 정수', needs: 'bigreactors:reinforced_turbinecontroller',
      filter: { output: 'bigreactors:reinforced_turbinecontroller' }, from: 'minecraft:diamond_block', to: 'moreup:boss_essence_mid' },
    { why: 'Ender IO 영혼 결합기: 빈 영혼 병 → 하급 정수', needs: 'enderio:soul_binder',
      filter: { output: 'enderio:soul_binder' }, from: 'enderio:empty_soul_vial', to: 'moreup:boss_essence_low' },
    { why: 'Crazy AE2 크레이지 강화: 고급 카드 → 중급 정수', needs: 'crazyae2addons:crazy_upgrade',
      filter: { output: 'crazyae2addons:crazy_upgrade' }, from: 'ae2:advanced_card', to: 'moreup:boss_essence_mid' },

    // ---------- 저장 (Sophisticated Storage 큰 상자 등급, 중반 난이도) ----------
    { why: '철 등급: 철 주괴 → 철판 (Create 압착기·IE 망치)', needs: 'sophisticatedstorage:iron_chest',
      filter: { output: /^sophisticatedstorage:(iron_.*|.*_to_iron_tier_upgrade)$/ }, from: 'minecraft:iron_ingot', to: '#forge:plates/iron' },
    { why: '금 등급: 금 주괴 → 금판', needs: 'sophisticatedstorage:gold_chest',
      filter: { output: /^sophisticatedstorage:(gold_.*|.*_to_gold_tier_upgrade)$/ }, from: 'minecraft:gold_ingot', to: '#forge:plates/gold' },
    { why: '다이아 등급: 다이아몬드 → Create 정밀 기계 장치', needs: 'sophisticatedstorage:diamond_chest',
      filter: { output: /^sophisticatedstorage:(diamond_.*|.*_to_diamond_tier_upgrade)$/ }, from: 'minecraft:diamond', to: 'create:precision_mechanism' },
    { why: '네더라이트 등급 강화 키트: 레버 → 중급 정수', needs: 'sophisticatedstorage:diamond_to_netherite_tier_upgrade',
      filter: { output: 'sophisticatedstorage:diamond_to_netherite_tier_upgrade' }, from: 'minecraft:lever', to: 'moreup:boss_essence_mid' },
]

// Solar Flux 패널은 HammerLib 전용 레시피(hammerlib:shaped_hl_recipe)라 replaceInput 도 remove 도 안 먹는다
// → 원래 레시피는 config/hammerlib/recipes/modded/solarflux.json 에서 solar_panel_4·6·7 을 false 로 끄고, 같은 모양의 일반 레시피를 여기서 넣는다.
// 모양은 테스트 서버 덤프의 재료 순서(가로줄 순)에서 옮겼다. 결과 개수는 1.
const MOREUP_TP_SOLAR = [
    { id: 'solarflux:solar_panel_4', result: 'solarflux:sp_4', pattern: ['CCC', 'SKS', 'SIS'],
      key: { C: 'solarflux:photovoltaic_cell_2', S: 'solarflux:sp_3', K: 'thermal:rf_coil', I: 'minecraft:iron_block' }, why: '시계 → Thermal RF 코일' },
    { id: 'solarflux:solar_panel_6', result: 'solarflux:sp_6', pattern: ['CCC', 'SLS', 'SDS'],
      key: { C: 'solarflux:photovoltaic_cell_4', S: 'solarflux:sp_5', L: 'minecraft:redstone_lamp', D: 'moreup:boss_essence_mid' }, why: '다이아몬드 블록 → 중급 정수' },
    { id: 'solarflux:solar_panel_7', result: 'solarflux:sp_7', pattern: ['CCC', 'SBS', 'SBS'],
      key: { C: 'solarflux:photovoltaic_cell_5', S: ['solarflux:sp_6', 'solarflux:sp_tf.fiery'], B: 'moreup:boss_essence_high' }, why: '드래곤의 숨결 2 → 상급 정수 2' },
]
// Sophisticated Storage 의 "상자 + 재료 → 다음 등급 상자" 레시피는 전용 형식(storage_tier_upgrade)이라 재료를 못 바꾼다.
// 철 등급부터는 이 레시피를 지우고, 위에서 재료를 바꾼 "등급 강화 키트"(월드에서 상자에 우클릭)로만 올리게 한다. 구리 등급은 그대로.
const MOREUP_TP_SS_TIER = /^sophisticatedstorage:(limited_)?(iron|gold|diamond|netherite)_/

function moreupTpMissing(id) {
    return id.charAt(0) !== '#' && Item.of(id).isEmpty()
}

ServerEvents.recipes(event => {
    let done = 0, skipped = 0
    MOREUP_TP.forEach(r => {
        try {
            if (moreupTpMissing(r.needs)) { skipped++; return }   // 모드가 없음
            if (moreupTpMissing(r.to)) { console.error(`[MoreUp] 테크 패치 재료 없음: ${r.to} (${r.why})`); return }
            event.replaceInput(r.filter, r.from, r.to)
            done++
        } catch (e) {
            console.error(`[MoreUp] 테크 패치 조합법 실패 (${r.why}): ${e}`)
        }
    })
    MOREUP_TP_SOLAR.forEach(r => {
        try {
            if (moreupTpMissing(r.result)) { skipped++; return }
            for (let k in r.key) {
                let v = r.key[k]
                if (!Array.isArray(v) && moreupTpMissing(v)) { console.error(`[MoreUp] Solar Flux 재료 없음: ${v}`); return }
            }
            event.remove({ id: r.id })
            event.shaped(r.result, r.pattern, r.key).id(`moreup:tech_patch/${r.result.substring(r.result.indexOf(':') + 1)}`)
            done++
        } catch (e) { console.error(`[MoreUp] Solar Flux 레시피 실패 (${r.result}): ${e}`) }
    })
    try {
        if (!moreupTpMissing('sophisticatedstorage:iron_chest')) {
            ;['storage_tier_upgrade', 'storage_tier_upgrade_shapeless', 'double_chest_tier_upgrade', 'double_chest_tier_upgrade_shapeless'].forEach(t =>
                event.remove({ type: `sophisticatedstorage:${t}`, output: MOREUP_TP_SS_TIER }))
            done++
        }
    } catch (e) { console.error(`[MoreUp] Sophisticated Storage 등급 레시피 제거 실패: ${e}`) }
    console.info(`[MoreUp] 테크 패치 조합법 ${done}개 (모드 없어 건너뜀 ${skipped})`)
})
