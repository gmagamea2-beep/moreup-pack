// priority: 0
// ============================================================
// More Up: 최종 목표 레시피 (세계의 파편 → 세계 → 모어 업)
// 경로: kubejs/server_scripts/recipes/endgame.js
// 설계: MoreUp/docs/endgame.md
// 재료 아이템 ID는 모두 모드 jar 언어 파일과 테스트 서버 레지스트리에서 확인했다.
// ============================================================

const MOREUP_ENDGAME_RECIPES = [
    // ---------- 세계의 파편: 기술 (Mekanism · AE2 · MEGA Cells · Create · Industrial Foregoing · Powah) ----------
    { id: 'fragment_tech', result: 'moreup:fragment_tech', pattern: ['ASA', 'UFU', 'NPM'], key: {
        A: 'mekanism:pellet_antimatter',             // 반물질 펠릿 (SPS, 전설 정수 관문)
        S: 'ae2:singularity',                        // AE2 특이점
        U: 'mekanism:ultimate_control_circuit',      // 울티밋 회로
        F: 'industrialforegoing:machine_frame_supreme', // IF 최상급 기계 프레임
        N: 'powah:nitro_crystal_block',              // 니트로 결정 블록
        P: 'create:precision_mechanism',             // Create 정밀 기계 장치
        M: 'megacells:cell_component_256m' } },      // 256M MEGA 저장 부품
    // ---------- 세계의 파편: 마법 (Electroblob's Wizardry · Forbidden & Arcanus · Enigmatic Legacy) ----------
    { id: 'fragment_magic', result: 'moreup:fragment_magic', pattern: ['AEA', 'TDT', 'WGW'], key: {
        A: 'ebwizardry:astral_diamond',              // 아스트랄 다이아몬드
        E: 'forbidden_arcanus:eternal_stella',       // 영원한 스텔라
        T: 'enigmaticlegacy:etherium_ingot',         // 에테리움 주괴
        D: 'forbidden_arcanus:dark_nether_star',     // 어둠의 네더의 별
        W: 'ebwizardry:wand_master',                 // 마스터 완드
        G: 'ebwizardry:magic_crystal_grand' } },     // 거대 마법 결정
    // ---------- 세계의 파편: 전쟁 (L_Ender's Cataclysm 대보스 증표) ----------
    { id: 'fragment_war', result: 'moreup:fragment_war', pattern: ['IHW', 'EXC', 'RSV'], key: {
        I: 'cataclysm:ignitium_ingot',               // 이그니스
        H: 'cataclysm:monstrous_horn',               // 네더라이트 몬스트로시티
        W: 'cataclysm:witherite_ingot',              // 하빈저
        E: 'cataclysm:abyssal_egg',                  // 레비아탄
        X: 'moreup:boss_essence_legendary',          // 전설 보스 정수
        C: 'cataclysm:cursium_ingot',                // 말레딕투스
        R: 'cataclysm:remnant_skull',                // 고대 잔해
        S: 'cataclysm:essence_of_the_storm',         // 스킬라
        V: 'cataclysm:void_core' } },                // 엔더 골렘 (엔더 성채)
    // ---------- 세계의 파편: 용 (Ice and Fire) ----------
    { id: 'fragment_dragon', result: 'moreup:fragment_dragon', pattern: ['FIL', 'fil', 'xyz'], key: {
        F: 'iceandfire:fire_dragon_heart', I: 'iceandfire:ice_dragon_heart', L: 'iceandfire:lightning_dragon_heart',
        f: 'iceandfire:dragonsteel_fire_ingot', i: 'iceandfire:dragonsteel_ice_ingot', l: 'iceandfire:dragonsteel_lightning_ingot',
        x: 'iceandfire:fire_dragon_blood', y: 'iceandfire:ice_dragon_blood', z: 'iceandfire:lightning_dragon_blood' } },
    // ---------- 세계의 파편: 하늘 (Aether · Lost Aether Content) ----------
    { id: 'fragment_sky', result: 'moreup:fragment_sky', pattern: ['GVG', 'APA', 'GZG'], key: {
        G: 'aether:enchanted_gravitite',             // 인챈트 그래비타이트
        V: 'aether:victory_medal',                   // 승리의 메달 (발키리)
        A: 'aether:golden_amber',                    // 황금 호박
        P: 'lost_aether_content:platinum_key',       // 플래티넘 열쇠 (에어웨일 킹)
        Z: 'aether:zanite_gemstone' } },             // 자나이트 원석
    // ---------- 세계의 파편: 황혼 (Twilight Forest 트로피 9종) ----------
    { id: 'fragment_twilight', result: 'moreup:fragment_twilight', pattern: ['NLM', 'HKU', 'YSQ'], key: {
        N: 'twilightforest:naga_trophy', L: 'twilightforest:lich_trophy', M: 'twilightforest:minoshroom_trophy',
        H: 'twilightforest:hydra_trophy', K: 'twilightforest:knight_phantom_trophy', U: 'twilightforest:ur_ghast_trophy',
        Y: 'twilightforest:alpha_yeti_trophy', S: 'twilightforest:snow_queen_trophy', Q: 'twilightforest:quest_ram_trophy' } },
    // ---------- 세계의 파편: 심연 (Undergarden · Deeper Darker · The Abyss) ----------
    { id: 'fragment_depths', result: 'moreup:fragment_depths', pattern: ['FHF', 'CWC', 'UAU'], key: {
        F: 'undergarden:forgotten_ingot',            // 잊혀진 주괴 (Forgotten Guardian)
        H: 'deeperdarker:heart_of_the_deep',         // 심연의 심장
        C: 'deeperdarker:soul_crystal',              // 영혼 결정
        W: 'deeperdarker:warden_carapace',           // 워든 갑각
        U: 'undergarden:utherium_crystal',           // 유테리움 결정
        A: 'theabyss:abyss_crystal_shard' } },       // 심연 결정 조각
    // ---------- 세계의 파편: 풍요 (Farmer's Delight 연회 요리 · Aquaculture) ----------
    { id: 'fragment_harvest', result: 'moreup:fragment_harvest', pattern: ['RHS', 'nBn', 'PMG'], key: {
        R: 'farmersdelight:roast_chicken_block', H: 'farmersdelight:honey_glazed_ham_block', S: 'farmersdelight:stuffed_pumpkin_block',
        n: 'aquaculture:neptunium_ingot',            // 넵투늄 주괴
        B: 'aquaculture:neptunes_bounty',            // 넵튠의 보물
        P: 'farmersdelight:shepherds_pie_block', M: 'farmersdelight:rice_roll_medley_block', G: 'farmersdelight:gleaming_salad_block' } },
    // ---------- 세계의 파편: 종말 (Bosses of Mass Destruction · 엔드 · 위더) ----------
    { id: 'fragment_end', result: 'moreup:fragment_end', pattern: ['OHV', 'SXS', 'BTA'], key: {
        O: 'bosses_of_mass_destruction:obsidian_heart', // 옵시딜리스
        H: 'minecraft:dragon_head',                  // 엔드 시티 배
        V: 'bosses_of_mass_destruction:void_thorn',  // 보이드 블로섬
        S: 'minecraft:shulker_shell',
        X: 'minecraft:nether_star',                  // 위더
        B: 'bosses_of_mass_destruction:blazing_eye', // 네더 건틀릿
        T: 'minecraft:dragon_breath',                // 엔더 드래곤
        A: 'bosses_of_mass_destruction:ancient_anima' } }, // 나이트 리치
    // ---------- 세계: 파편 9종 ----------
    { id: 'world', result: 'moreup:world', pattern: ['TMW', 'DSL', 'PHE'], key: {
        T: 'moreup:fragment_tech', M: 'moreup:fragment_magic', W: 'moreup:fragment_war',
        D: 'moreup:fragment_dragon', S: 'moreup:fragment_sky', L: 'moreup:fragment_twilight',
        P: 'moreup:fragment_depths', H: 'moreup:fragment_harvest', E: 'moreup:fragment_end' } },
    // ---------- 모어 업: 세계 + 좋은 아이템 8개 (성주의 왕관 = 최종 보스 보상) ----------
    { id: 'more_up', result: 'moreup:more_up', pattern: ['ECN', 'TWH', 'GLB'], key: {
        E: 'minecraft:elytra',
        C: 'moreup:keepers_crown',                   // 최종 보스 Castle Keeper 보상
        N: 'minecraft:nether_star',
        T: 'minecraft:totem_of_undying',
        W: 'moreup:world',
        H: 'minecraft:heart_of_the_sea',
        G: 'minecraft:enchanted_golden_apple',
        L: 'moreup:boss_essence_legendary',
        B: 'minecraft:beacon' } }
]

ServerEvents.recipes(event => {
    let applied = 0
    MOREUP_ENDGAME_RECIPES.forEach(r => {
        try {
            let missing = []
            for (let k in r.key) { if (Item.of(r.key[k]).isEmpty()) missing.push(r.key[k]) }
            if (missing.length > 0) {
                // 재료가 없으면 영원히 만들 수 없는 레시피가 되므로 등록하지 않고 크게 알린다
                console.error(`[MoreUp] 최종 레시피 ${r.id} 재료 없음: ${missing.join(', ')}`)
                return
            }
            event.shaped(r.result, r.pattern, r.key).id(`moreup:endgame/${r.id}`)
            applied++
        } catch (e) {
            console.error(`[MoreUp] 최종 레시피 등록 실패 (${r.id}): ${e}`)
        }
    })
    console.info(`[MoreUp] 최종 목표 레시피 ${applied}/${MOREUP_ENDGAME_RECIPES.length}개 등록`)
})
