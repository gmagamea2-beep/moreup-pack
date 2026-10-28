// priority: 0
// ============================================================
// More Up: 모드 간 연계 레시피
// 경로: kubejs/server_scripts/recipes/cross_links.js
// 설계: MoreUp/docs/cross_links.md
//
// 각 모드의 입구·핵심 기계 레시피에서 재료 하나를 다른 모드 재료로 바꿔 모드끼리 이어지게 한다.
// - 원래 모양(패턴)은 그대로 두고 키 하나만 바꾼다. 원래 레시피는 ID로 지우고 moreup:link/* 로 다시 등록
// - 재료는 대상과 같은 시점이거나 더 이른 시점의 것만 쓴다 (Create 기초 → Mekanism·AE2·IF·Powah·비행기,
//   마법 모드끼리, 탐험 재료 → 후반 기계). 서로 물리는 순환이 생기지 않게 했다
// - 재료나 결과물이 레지스트리에 없으면 그 항목은 건너뛰고 원래 레시피를 남긴다
// ============================================================

const MOREUP_CROSS_LINKS = [
    // ---------- 기술: Create 기초가 다른 기계 모드의 입구가 된다 ----------
    { id: 'metallurgic_infuser', remove: 'mekanism:metallurgic_infuser', result: 'mekanism:metallurgic_infuser',
      pattern: ['I#I', 'ROR', 'I#I'], key: { '#': 'create:andesite_casing', I: '#forge:ingots/iron', O: '#forge:ingots/osmium', R: '#forge:dusts/redstone' },
      note: 'Mekanism 입구 ← Create (화로 → 안산암 케이스)' },
    { id: 'steel_casing', remove: 'mekanism:steel_casing', result: 'mekanism:steel_casing',
      pattern: ['SGS', 'GOG', 'SGS'], key: { S: '#forge:ingots/steel', G: '#forge:glass/silica', O: 'create:brass_ingot' },
      note: 'Mekanism 기계 외장 ← Create 황동 (오스뮴 → 황동)' },
    { id: 'dynamic_tank', remove: 'mekanism:dynamic_tank', result: '4x mekanism:dynamic_tank',   // 원래도 4개
      pattern: [' S ', 'SBS', ' S '], key: { S: '#forge:ingots/steel', B: 'create:fluid_tank' },
      note: 'Mekanism 동적 탱크 ← Create 유체 탱크' },
    { id: 'charger', remove: 'ae2:network/blocks/crystal_processing_charger', result: 'ae2:charger',
      pattern: ['aba', 'a  ', 'aba'], key: { a: '#forge:ingots/iron', b: 'create:electron_tube' },
      note: 'AE2 입구(충전기) ← Create 전자관 (구리 → 전자관)' },
    { id: 'me_controller', remove: 'ae2:network/blocks/controller', result: 'ae2:controller',
      pattern: ['aba', 'bcb', 'dbd'], key: { a: 'ae2:smooth_sky_stone_block', b: 'ae2:fluix_crystal', c: 'ae2:engineering_processor', d: '#forge:ingots/steel' },
      note: 'AE2 컨트롤러 ← Mekanism 강철 (아래 하늘돌 2 → 강철 2)' },
    { id: 'molecular_assembler', remove: 'ae2:network/crafting/molecular_assembler', result: 'ae2:molecular_assembler',
      pattern: ['aba', 'cde', 'aba'], key: { a: '#forge:ingots/iron', b: 'ae2:quartz_glass', c: 'ae2:annihilation_core', d: 'create:mechanical_crafter', e: 'ae2:formation_core' },
      note: 'AE2 자동 조합 ← Create 기계식 조합기 (작업대 → 기계식 조합기)' },
    { id: 'quantum_ring', remove: 'ae2:network/blocks/quantum_ring', result: 'ae2:quantum_ring',
      pattern: ['aba', 'cde', 'aba'], key: { a: 'twilightforest:knightmetal_ingot', b: 'ae2:logic_processor', c: 'ae2:engineering_processor', d: 'ae2:energy_cell', e: '#ae2:smart_dense_cable' },
      note: 'AE2 양자 고리 ← 황혼의 숲 기사 금속 (철 → 기사 금속)' },
    { id: 'pity_frame', remove: 'industrialforegoing:machine_frame_pity', result: 'industrialforegoing:machine_frame_pity',
      pattern: ['WIW', 'IRI', 'WIW'], key: { W: '#minecraft:logs', I: '#forge:ingots/iron', R: 'create:andesite_casing' },
      note: 'Industrial Foregoing 입구 ← Create (레드스톤 블록 → 안산암 케이스)' },
    { id: 'enchantment_extractor', remove: 'industrialforegoing:enchantment_extractor', result: 'industrialforegoing:enchantment_extractor',
      pattern: ['PSP', 'BMB', 'DGD'], key: { P: '#forge:plastic', S: 'ebwizardry:magic_crystal', B: 'minecraft:book', M: '#industrialforegoing:machine_frame/advanced', D: 'minecraft:diamond', G: '#forge:gears/gold' },
      note: 'IF 마법 부여 추출기 ← 마법사 마법 결정 (네더 벽돌 → 마법 결정)' },
    { id: 'energizing_orb', remove: 'powah:crafting/energizing_orb', result: 'powah:energizing_orb',
      pattern: ['ggg', 'gcg', 'rrr'], key: { g: 'ae2:quartz_glass', c: 'powah:dielectric_casing', r: 'powah:dielectric_rod_horizontal' },
      note: 'Powah 에너지 부여 오브 ← AE2 석영 유리 (유리 → 석영 유리)' },
    { id: 'quantum_entangloporter', remove: 'mekanism:quantum_entangloporter', result: 'mekanism:quantum_entangloporter',
      pattern: ['ICI', 'ATA', 'ICI'], key: { I: 'deeperdarker:reinforced_echo_shard', C: '#forge:circuits/ultimate', A: '#mekanism:alloys/atomic', T: 'mekanism:teleportation_core' },
      note: 'Mekanism 양자 얽힘 장치 ← Deeper Darker 강화된 메아리 조각 (정제 흑요석 → 메아리 조각)' },

    // ---------- 비행기: Create 동력 부품 ----------
    { id: 'aircraft_engine', remove: 'immersive_aircraft:engine', result: 'immersive_aircraft:engine',
      pattern: [' C ', 'PFP', 'CIC'], key: { C: 'minecraft:cobblestone', P: 'minecraft:piston', F: 'create:steam_engine', I: 'immersive_aircraft:boiler' },
      note: '비행기 엔진 ← Create 증기 엔진 (용광로 → 증기 엔진)' },
    { id: 'aircraft_propeller', remove: 'immersive_aircraft:propeller', result: 'immersive_aircraft:propeller',
      pattern: ['II ', ' P ', ' II'], key: { I: 'minecraft:iron_ingot', P: 'create:propeller' },
      note: '비행기 프로펠러 ← Create 프로펠러 (가운데 철 → Create 프로펠러)' },
    { id: 'aircraft_hull', remove: 'immersive_aircraft:hull', result: 'immersive_aircraft:hull',
      pattern: ['LLL', 'III', 'LLL'], key: { L: '#minecraft:logs', I: 'create:iron_sheet' },
      note: '비행기 선체 ← Create 철판 (철 주괴 → 철판)' },

    // ---------- 마법: 마법 모드끼리, 그리고 Create ----------
    { id: 'arcane_workbench', remove: 'ebwizardry:arcane_workbench', result: 'ebwizardry:arcane_workbench',
      pattern: ['vwv', 'xyx', 'zzz'], key: { v: 'minecraft:gold_nugget', w: '#minecraft:wool_carpets', x: '#ebwizardry:magic_crystal', y: 'minecraft:lapis_block', z: 'forbidden_arcanus:darkstone' },
      note: '마법사 비전 작업대 ← Forbidden & Arcanus 어둠돌 (돌 → 어둠돌)' },
    { id: 'clibano_core', remove: 'forbidden_arcanus:clibano_core', result: 'forbidden_arcanus:clibano_core',
      pattern: ['###', '#X#', '###'], key: { '#': 'forbidden_arcanus:darkstone', X: 'create:blaze_burner' },
      note: 'Forbidden & Arcanus 클리바노 ← Create 블레이즈 버너 (용광로 → 블레이즈 버너)' },
    { id: 'enchantment_transposer', remove: 'enigmaticlegacy:enchantment_transposer', result: 'enigmaticlegacy:enchantment_transposer',
      pattern: ['pnp', 'lXl', 'brb'], key: { p: 'ebwizardry:magic_crystal', n: 'minecraft:gold_nugget', l: 'minecraft:lapis_lazuli', X: 'minecraft:book', b: 'minecraft:blaze_powder', r: 'minecraft:redstone' },
      note: 'Enigmatic 마법 부여 전이기 ← 마법사 마법 결정 (프리즈머린 결정 → 마법 결정)' }
]

function moreupLinkMissing(r) {
    let missing = []
    for (let k in r.key) {
        let v = r.key[k]
        if (v.startsWith('#')) continue
        if (Item.of(v).isEmpty()) missing.push(v)
    }
    if (Item.of(r.result).isEmpty()) missing.push(r.result)
    return missing
}

ServerEvents.recipes(event => {
    let applied = 0
    // 결과 개수는 원래 레시피와 같게 유지한다 (덤프로 확인: 동적 탱크만 4개, 나머지 1개)
    MOREUP_CROSS_LINKS.forEach(r => {
        try {
            let missing = moreupLinkMissing(r)
            if (missing.length > 0) { console.error(`[MoreUp] 연계 레시피 ${r.id} 재료 없음 (원래 레시피 유지): ${missing.join(', ')}`); return }
            event.remove({ id: r.remove })
            event.shaped(r.result, r.pattern, r.key).id(`moreup:link/${r.id}`)
            applied++
        } catch (e) { console.error(`[MoreUp] 연계 레시피 실패 (${r.id}): ${e}`) }
    })
    console.info(`[MoreUp] 모드 연계 레시피 ${applied}/${MOREUP_CROSS_LINKS.length}개 적용`)
})
