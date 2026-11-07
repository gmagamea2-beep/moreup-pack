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
    // AE2 컨트롤러(강철)·분자 조립기(Create 기계식 조합기) 연계는 2026-11-07 사용자 요청 "AE2 초반 쉽게"로 빼서 원래 레시피로 되돌렸다 (ae2_early.js)
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

    // ---------- 1.7 새 기계 모드 (Thermal·PneumaticCraft·Flux Networks·LaserIO·Applied Flux, 2026-11-02) ----------
    // soft: 아직 모드가 없는 서버에서는 오류 없이 건너뛴다. 원본 모양은 테스트 서버 덤프로 확인 (docs/tech_expansion.md)
    { id: 'thermal_machine_frame', remove: 'thermal:machine_frame', result: 'thermal:machine_frame', soft: true,
      pattern: ['IGI', 'GTG', 'IGI'], key: { I: '#forge:ingots/iron', G: '#forge:glass', T: 'create:andesite_casing' },
      note: 'Thermal 입구 ← Create (주석 톱니 → 안산암 케이스)' },
    { id: 'thermal_energy_cell_frame', remove: 'thermal:energy_cell_frame', result: 'thermal:energy_cell_frame', soft: true,
      pattern: ['IGI', 'GEG', 'IGI'], key: { I: '#forge:ingots/lead', G: '#forge:glass', E: '#forge:circuits/basic' },
      note: 'Thermal 전력 저장 ← Mekanism 기본 회로 (금은 톱니 → 회로)' },
    { id: 'pnc_air_compressor', remove: 'pneumaticcraft:air_compressor', result: 'pneumaticcraft:air_compressor', soft: true,
      pattern: ['III', 'I T', 'IFI'], key: { I: '#pneumaticcraft:reinforced_stone_bricks', T: 'pneumaticcraft:pressure_tube', F: 'create:fluid_tank' },
      note: 'PneumaticCraft 입구 ← Create 유체 탱크 (용광로 → 유체 탱크)' },
    { id: 'pnc_flux_compressor', remove: 'pneumaticcraft:flux_compressor', result: 'pneumaticcraft:flux_compressor', soft: true,
      pattern: ['GCP', 'FRT', 'GQP'], key: { G: '#forge:dusts/redstone', C: 'pneumaticcraft:compressed_iron_gear', P: 'pneumaticcraft:printed_circuit_board', F: '#forge:storage_blocks/redstone', R: 'pneumaticcraft:turbine_rotor', T: 'pneumaticcraft:advanced_pressure_tube', Q: 'thermal:machine_frame' },
      note: '전력 → 공기압 ← Thermal 기계 프레임 (용광로 → 기계 프레임)' },
    { id: 'pnc_pneumatic_dynamo', remove: 'pneumaticcraft:pneumatic_dynamo', result: 'pneumaticcraft:pneumatic_dynamo', soft: true,
      pattern: [' T ', 'GCG', 'IPI'], key: { T: 'pneumaticcraft:advanced_pressure_tube', G: 'pneumaticcraft:compressed_iron_gear', C: 'thermal:rf_coil', I: '#forge:ingots/compressed_iron', P: 'pneumaticcraft:printed_circuit_board' },
      note: '공기압 → 전력 ← Thermal RF 코일 (가운데 압축 철 → RF 코일)' },
    { id: 'flux_core', remove: 'fluxnetworks:fluxcore', result: '4x fluxnetworks:flux_core', soft: true,
      pattern: ['fof', 'oeo', 'fof'], key: { f: 'fluxnetworks:flux_dust', o: 'ae2:fluix_crystal', e: 'minecraft:ender_eye' },
      note: 'Flux Networks ← AE2 플루익스 수정 (흑요석 → 플루익스 수정)' },
    { id: 'laserio_logic_chip_raw', remove: 'laserio:logic_chip_raw', result: '4x laserio:logic_chip_raw', soft: true,
      pattern: ['rgr', 'cqc', 'rgr'], key: { r: '#forge:dusts/redstone', g: '#forge:nuggets/gold', c: 'minecraft:clay_ball', q: 'ae2:certus_quartz_crystal' },
      note: 'LaserIO ← AE2 규석 (석영 블록 → 규석 수정)' },
    { id: 'laserio_connector_advanced', remove: 'laserio:laser_connector_advanced', result: 'laserio:laser_connector_advanced', soft: true,
      pattern: ['ede', 'rbr', 'iii'], key: { e: '#forge:ender_pearls', d: '#forge:circuits/advanced', r: '#forge:dusts/redstone', b: 'laserio:laser_connector', i: '#forge:ingots/gold' },
      note: 'LaserIO 고급 커넥터 ← Mekanism 고급 회로 (다이아몬드 → 회로)' },
    { id: 'appflux_flux_accessor', remove: 'appflux:flux_accessor', result: 'appflux:flux_accessor', soft: true,
      pattern: ['DPD', 'IMI', 'DPD'], key: { D: '#forge:dusts/glowstone', P: 'appflux:energy_processor', I: 'thermal:rf_coil', M: 'ae2:energy_acceptor' },
      note: 'Applied Flux ← Thermal RF 코일 (구리 → RF 코일)' },

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
    let skipped = 0
    // 결과 개수는 원래 레시피와 같게 유지한다 (덤프로 확인: 동적 탱크·플럭스 코어·논리 칩 원판만 4개, 나머지 1개)
    MOREUP_CROSS_LINKS.forEach(r => {
        try {
            let missing = moreupLinkMissing(r)
            if (missing.length > 0) {
                if (r.soft) { skipped++; return }   // 아직 설치되지 않은 모드
                console.error(`[MoreUp] 연계 레시피 ${r.id} 재료 없음 (원래 레시피 유지): ${missing.join(', ')}`)
                return
            }
            event.remove({ id: r.remove })
            event.shaped(r.result, r.pattern, r.key).id(`moreup:link/${r.id}`)
            applied++
        } catch (e) { console.error(`[MoreUp] 연계 레시피 실패 (${r.id}): ${e}`) }
    })
    console.info(`[MoreUp] 모드 연계 레시피 ${applied}/${MOREUP_CROSS_LINKS.length}개 적용 (모드 없어 건너뜀 ${skipped})`)
})
