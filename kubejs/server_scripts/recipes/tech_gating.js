// priority: 0
// ============================================================
// More Up: 테크 관문 (보스 정수를 핵심 기계·등급 설치기의 열쇠로)
// 경로: kubejs/server_scripts/recipes/tech_gating.js
// 설계: MoreUp/docs/tech_gating_proposal.md (안 A)
//
// 원칙: 회로·합금 같은 소모품은 막지 않는다. 한 번 만드는 핵심 기계와 등급 설치기만 막는다.
// 각 레시피는 원본(모드 jar에서 확인한 JSON)과 같은 모양에서 한 칸만 정수로 바꿨다.
// 원본은 결과물 기준으로 지워서, 다른 경로로 같은 물건을 만드는 레시피도 함께 막는다.
// 되돌리려면 MOREUP_TECH_GATING_ENABLED 를 false 로 바꾸고 /reload.
// ============================================================

const MOREUP_TECH_GATING_ENABLED = true

const MOREUP_E_LOW = { item: 'moreup:boss_essence_low' }
const MOREUP_E_MID = { item: 'moreup:boss_essence_mid' }
const MOREUP_E_HIGH = { item: 'moreup:boss_essence_high' }
const MOREUP_E_LEGENDARY = { item: 'moreup:boss_essence_legendary' }

// removeOutput: 이 결과물을 만드는 기존 레시피를 모두 지운다 / removeId: 이 ID만 지운다
const MOREUP_GATED_RECIPES = [
    // ---------- Mekanism 등급 설치기 (가운데 나무판자 → 정수) ----------
    {
        id: 'tier_installer_elite', removeOutput: 'mekanism:elite_tier_installer',
        json: { type: 'minecraft:crafting_shaped', pattern: ['ACA', 'IPI', 'ACA'],
            key: { A: { tag: 'mekanism:alloys/reinforced' }, C: { tag: 'forge:circuits/elite' }, I: { tag: 'forge:ingots/gold' }, P: MOREUP_E_MID },
            result: { item: 'mekanism:elite_tier_installer' } }
    },
    {
        id: 'tier_installer_ultimate', removeOutput: 'mekanism:ultimate_tier_installer',
        json: { type: 'minecraft:crafting_shaped', pattern: ['ACA', 'IPI', 'ACA'],
            key: { A: { tag: 'mekanism:alloys/atomic' }, C: { tag: 'forge:circuits/ultimate' }, I: { tag: 'forge:gems/diamond' }, P: MOREUP_E_HIGH },
            result: { item: 'mekanism:ultimate_tier_installer' } }
    },
    // ---------- Mekanism Extras 등급 설치기 ----------
    {
        id: 'tier_installer_absolute', removeOutput: 'mekanism_extras:absolute_tier_installer',
        json: { type: 'minecraft:crafting_shaped', pattern: ['ACA', 'IPI', 'ACA'],
            key: { A: { tag: 'mekanism_extras:alloys/radiance' }, C: { tag: 'forge:circuits/absolute' }, I: { tag: 'forge:gems/emerald' }, P: MOREUP_E_LEGENDARY },
            result: { item: 'mekanism_extras:absolute_tier_installer' } }
    },
    {
        id: 'tier_installer_supreme', removeOutput: 'mekanism_extras:supreme_tier_installer',
        json: { type: 'minecraft:crafting_shaped', pattern: ['ACA', 'IPI', 'ACA'],
            key: { A: { tag: 'mekanism_extras:alloys/thermonuclear' }, C: { tag: 'forge:circuits/supreme' }, I: { tag: 'forge:ingots/netherite' }, P: MOREUP_E_LEGENDARY },
            result: { item: 'mekanism_extras:supreme_tier_installer' } }
    },
    {
        id: 'tier_installer_cosmic', removeOutput: 'mekanism_extras:cosmic_tier_installer',
        json: { type: 'minecraft:crafting_shaped', pattern: ['ACA', 'IPI', 'ACA'],
            key: { A: { tag: 'mekanism_extras:alloys/shining' }, C: { tag: 'forge:circuits/cosmic' }, I: { tag: 'forge:ingots/refined_obsidian' }, P: MOREUP_E_LEGENDARY },
            result: { item: 'mekanism_extras:cosmic_tier_installer' } }
    },
    {
        id: 'tier_installer_infinite', removeOutput: 'mekanism_extras:infinite_tier_installer',
        json: { type: 'minecraft:crafting_shaped', pattern: ['ACA', 'IPJ', 'ACA'],
            key: { A: { tag: 'mekanism_extras:alloys/spectrum' }, C: { tag: 'forge:circuits/infinite' }, I: { tag: 'forge:pellets/plutonium' }, J: { tag: 'forge:pellets/polonium' }, P: MOREUP_E_LEGENDARY },
            result: { item: 'mekanism_extras:infinite_tier_installer' } }
    },
    // ---------- Mekanism 핵심 기계 ----------
    {
        // 기본 회로 자리 → 중급 정수 (mek_data: 재료의 보안·업그레이드 정보를 이어받는 Mekanism 전용 조합)
        id: 'digital_miner', removeOutput: 'mekanism:digital_miner',
        json: { type: 'mekanism:mek_data', pattern: ['ACA', 'SRS', 'TXT'],
            key: { A: { tag: 'mekanism:alloys/atomic' }, C: MOREUP_E_MID, R: { item: 'mekanism:robit' }, S: { item: 'mekanism:logistical_sorter' }, T: { item: 'mekanism:teleportation_core' }, X: { item: 'mekanism:steel_casing' } },
            result: { item: 'mekanism:digital_miner' } }
    },
    {
        // 유리판 자리 → 상급 정수
        id: 'qio_drive_array', removeOutput: 'mekanism:qio_drive_array',
        json: { type: 'mekanism:mek_data', pattern: ['IGI', 'C#C', 'ITI'],
            key: { '#': { tag: 'mekanism:personal_storage' }, C: { tag: 'forge:circuits/ultimate' }, G: MOREUP_E_HIGH, I: { tag: 'forge:pellets/polonium' }, T: { item: 'mekanism:teleportation_core' } },
            result: { item: 'mekanism:qio_drive_array' } }
    },
    {
        // 핵분열로: 케이싱은 수십 개가 필요해서 막지 않고, 1~4개면 되는 포트를 막는다
        id: 'fission_reactor_port', removeOutput: 'mekanismgenerators:fission_reactor_port',
        json: { type: 'minecraft:crafting_shaped', pattern: ['EF ', 'FCF', ' F '],
            key: { C: { tag: 'forge:circuits/elite' }, F: { item: 'mekanismgenerators:fission_reactor_casing' }, E: MOREUP_E_HIGH },
            result: { item: 'mekanismgenerators:fission_reactor_port', count: 2 } }
    },
    {
        // 유리판 자리 → 전설 정수
        id: 'fusion_reactor_controller', removeOutput: 'mekanismgenerators:fusion_reactor_controller',
        json: { type: 'minecraft:crafting_shaped', pattern: ['CGC', 'FTF', 'FFF'],
            key: { C: { tag: 'forge:circuits/ultimate' }, F: { item: 'mekanismgenerators:fusion_reactor_frame' }, G: MOREUP_E_LEGENDARY, T: { item: 'mekanism:basic_chemical_tank' } },
            result: { item: 'mekanismgenerators:fusion_reactor_controller' } }
    },
    {
        // SPS: 케이싱은 수십 개가 필요해서 막지 않고 포트를 막는다
        id: 'sps_port', removeOutput: 'mekanism:sps_port',
        json: { type: 'minecraft:crafting_shaped', pattern: ['E# ', '#C#', ' # '],
            key: { '#': { item: 'mekanism:sps_casing' }, C: { tag: 'forge:circuits/ultimate' }, E: MOREUP_E_LEGENDARY },
            result: { item: 'mekanism:sps_port' } }
    },
    {
        // 강철 케이싱 자리 → 전설 정수
        id: 'antiprotonic_nucleosynthesizer', removeOutput: 'mekanism:antiprotonic_nucleosynthesizer',
        json: { type: 'minecraft:crafting_shaped', pattern: ['#C#', 'AXA', '#C#'],
            key: { '#': { item: 'mekanism:alloy_atomic' }, A: { tag: 'forge:pellets/antimatter' }, C: { tag: 'forge:circuits/ultimate' }, X: MOREUP_E_LEGENDARY },
            result: { item: 'mekanism:antiprotonic_nucleosynthesizer' } }
    },
    // ---------- 1.7 새 기계 모드 (needs: 그 모드가 없으면 건너뛴다, 원본은 테스트 서버 덤프로 확인) ----------
    {
        // Thermal 3단계 강화재: 석영 1자리 → 중급 정수
        id: 'thermal_upgrade_augment_2', needs: 'thermal:upgrade_augment_2', removeOutput: 'thermal:upgrade_augment_2',
        json: { type: 'minecraft:crafting_shaped', pattern: ['IEI', 'RXR', 'IGI'],
            key: { E: MOREUP_E_MID, G: { tag: 'forge:gems/quartz' }, I: { tag: 'forge:ingots/electrum' }, R: { tag: 'forge:gears/signalum' }, X: { item: 'thermal:upgrade_augment_1' } },
            result: { item: 'thermal:upgrade_augment_2' } }
    },
    {
        // Thermal 최고 강화재: 강화 유리 1자리 → 상급 정수
        id: 'thermal_upgrade_augment_3', needs: 'thermal:upgrade_augment_3', removeOutput: 'thermal:upgrade_augment_3',
        json: { type: 'minecraft:crafting_shaped', pattern: ['IEI', 'RXR', 'IGI'],
            key: { E: MOREUP_E_HIGH, G: { tag: 'thermal:glass/hardened' }, I: { tag: 'forge:ingots/enderium' }, R: { tag: 'forge:gears/lumium' }, X: { item: 'thermal:upgrade_augment_2' } },
            result: { item: 'thermal:upgrade_augment_3' } }
    },
    {
        // 조립 라인 제어기: 압축 철 1자리 → 하급 정수
        id: 'pnc_assembly_controller', needs: 'pneumaticcraft:assembly_controller', removeOutput: 'pneumaticcraft:assembly_controller',
        json: { type: 'minecraft:crafting_shaped', pattern: [' B ', 'TBB', 'IEI'],
            key: { B: { item: 'pneumaticcraft:printed_circuit_board' }, E: MOREUP_E_LOW, I: { tag: 'forge:ingots/compressed_iron' }, T: { item: 'pneumaticcraft:pressure_tube' } },
            result: { item: 'pneumaticcraft:assembly_controller' } }
    },
    {
        // 고급 공기 압축기: 아래 가운데 재료는 유지하고 압축 철 1자리 → 중급 정수 (압축기 강화 전용 조합)
        id: 'pnc_advanced_air_compressor', needs: 'pneumaticcraft:advanced_air_compressor', removeOutput: 'pneumaticcraft:advanced_air_compressor',
        json: { type: 'pneumaticcraft:compressor_upgrade_crafting', pattern: ['IEI', 'I T', 'ICI'],
            key: { C: { item: 'pneumaticcraft:air_compressor' }, E: MOREUP_E_MID, I: { tag: 'forge:ingots/compressed_iron' }, T: { item: 'pneumaticcraft:advanced_pressure_tube' } },
            result: { item: 'pneumaticcraft:advanced_air_compressor' } }
    },
    {
        // 프로그래밍 제어기: 압축 철 1자리 → 상급 정수 (드론 자동화의 끝)
        id: 'pnc_programmable_controller', needs: 'pneumaticcraft:programmable_controller', removeOutput: 'pneumaticcraft:programmable_controller',
        json: { type: 'minecraft:crafting_shaped', pattern: ['ERI', 'CDP', 'INI'],
            key: { C: { item: 'pneumaticcraft:printed_circuit_board' }, D: { item: 'pneumaticcraft:drone' }, E: MOREUP_E_HIGH, I: { tag: 'forge:ingots/compressed_iron' }, N: { item: 'pneumaticcraft:network_registry' }, P: { item: 'pneumaticcraft:advanced_pressure_tube' }, R: { item: 'pneumaticcraft:remote' } },
            result: { item: 'pneumaticcraft:programmable_controller' } }
    },
    {
        // 플럭스 컨트롤러: 네트워크마다 1개만 있으면 된다. 아래 가운데 플럭스 블록 → 중급 정수
        id: 'flux_controller', needs: 'fluxnetworks:flux_controller', removeOutput: 'fluxnetworks:flux_controller',
        json: { type: 'minecraft:crafting_shaped', pattern: ['bcb', 'f f', 'bEb'],
            key: { b: { item: 'fluxnetworks:flux_block' }, c: { item: 'fluxnetworks:flux_core' }, E: MOREUP_E_MID, f: { item: 'fluxnetworks:flux_dust' } },
            result: { item: 'fluxnetworks:flux_controller' } }
    },
    // ---------- Powah 결정 (에너자이징): 정수 1개 + 원재료 4개 → 결정 4개 (원재료 대비 비율과 전력은 원본과 같음) ----------
    {
        id: 'powah_niotic_crystal', removeId: 'powah:energizing/niotic_crystal',
        json: { type: 'powah:energizing',
            ingredients: [{ item: 'minecraft:diamond' }, { item: 'minecraft:diamond' }, { item: 'minecraft:diamond' }, { item: 'minecraft:diamond' }, MOREUP_E_LOW],
            energy: 1200000, result: { item: 'powah:crystal_niotic', count: 4 } }
    },
    {
        id: 'powah_spirited_crystal', removeId: 'powah:energizing/spirited_crystal',
        json: { type: 'powah:energizing',
            ingredients: [{ item: 'minecraft:emerald' }, { item: 'minecraft:emerald' }, { item: 'minecraft:emerald' }, { item: 'minecraft:emerald' }, MOREUP_E_MID],
            energy: 4000000, result: { item: 'powah:crystal_spirited', count: 4 } }
    },
    {
        // 원본(네더의 별 + 레드스톤 블록 2 + 블레이징 결정 블록 → 16개)에 상급 정수 추가
        id: 'powah_nitro_crystal', removeId: 'powah:energizing/nitro_crystal',
        json: { type: 'powah:energizing',
            ingredients: [{ item: 'minecraft:nether_star' }, { item: 'minecraft:redstone_block' }, { item: 'minecraft:redstone_block' }, { item: 'powah:blazing_crystal_block' }, MOREUP_E_HIGH],
            energy: 20000000, result: { item: 'powah:crystal_nitro', count: 16 } }
    },
    // ---------- Powah 원자로 (가운데 우라니나이트 → 정수, 4개씩 나옴) ----------
    {
        id: 'powah_reactor_spirited', removeOutput: 'powah:reactor_spirited',
        json: { type: 'minecraft:crafting_shaped', pattern: ['rlr', 'lul', 'rlr'],
            key: { u: MOREUP_E_HIGH, l: { item: 'powah:capacitor_spirited' }, r: { item: 'powah:reactor_niotic' } },
            result: { item: 'powah:reactor_spirited', count: 4 } }
    },
    {
        id: 'powah_reactor_nitro', removeOutput: 'powah:reactor_nitro',
        json: { type: 'minecraft:crafting_shaped', pattern: ['rlr', 'lul', 'rlr'],
            key: { u: MOREUP_E_LEGENDARY, l: { item: 'powah:capacitor_nitro' }, r: { item: 'powah:reactor_spirited' } },
            result: { item: 'powah:reactor_nitro', count: 4 } }
    },
    // ---------- 1.14 채굴 차원 (Advanced Mining Dimension 1.20.1-1.1.0, 사용자 결정 "정수 관문" 2026-11-12) ----------
    {
        // 채굴 차원 텔레포터: 원본(원목 4 + 판자 4 + 가운데 돌 곡괭이, jar 의 recipes/teleporter.json)에서 위 가운데 판자 → 하급 정수
        id: 'mining_dimension_teleporter', needs: 'mining_dimension:teleporter', removeOutput: 'mining_dimension:teleporter',
        json: { type: 'minecraft:crafting_shaped', pattern: ['LEL', 'PIP', 'LPL'],
            key: { L: { tag: 'minecraft:logs' }, P: { tag: 'minecraft:planks' }, I: { item: 'minecraft:stone_pickaxe' }, E: MOREUP_E_LOW },
            result: { item: 'mining_dimension:teleporter' } }
    }
]

ServerEvents.recipes(event => {
    if (!MOREUP_TECH_GATING_ENABLED) return
    let applied = 0
    MOREUP_GATED_RECIPES.forEach(r => {
        try {
            if (r.needs && Item.of(r.needs).isEmpty()) return   // 아직 설치되지 않은 모드
            if (r.removeOutput) event.remove({ output: r.removeOutput })
            if (r.removeId) event.remove({ id: r.removeId })
            event.custom(r.json).id(`moreup:gating/${r.id}`)
            applied++
        } catch (e) {
            console.error(`[MoreUp] 테크 관문 레시피 적용 실패 (${r.id}): ${e}`)
        }
    })
    console.info(`[MoreUp] 테크 관문 레시피 ${applied}/${MOREUP_GATED_RECIPES.length}개 적용`)
})
