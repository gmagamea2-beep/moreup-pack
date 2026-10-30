// priority: 0
// ============================================================
// More Up: 최종 아이템 확장 레시피 (1.6, 2026-10-30) — 세계의 유물 9종, 성룡의 핵, 성룡 장비 10종
// 경로: kubejs/server_scripts/recipes/endgame_relics.js
// 설계: MoreUp/docs/endgame_expansion.md
//
// 결과 아이템은 More Up Core 모드(0.6~)가 등록한다. 모드가 아직 없으면 결과가 레지스트리에 없으므로 조용히 건너뛰고,
// 결과는 있는데 재료가 없을 때만 오류를 남긴다 (영원히 못 만드는 레시피 방지 — endgame.js 와 같은 방식).
// 재료 ID 는 레지스트리 덤프(MoreUp/quests_src/registry/reg_items.txt)에서 확인했다.
//
// 성룡 장비는 대장장이 작업대에서 황혼 장비를 강화한다 (마법 부여·이름이 그대로 남도록 smithing_transform):
//   형판 = 성룡의 핵, 바탕 = 황혼 장비, 추가 = 성룡의 핵  →  핵 2개
// ============================================================

const MOREUP_RELIC_RECIPES = [
    // 특이점 핵 (기술): 정밀 기계 장치·특이점·반물질·니트로 반응로
    { id: 'relic_tech', result: 'moreup:relic_tech', pattern: ['ICI', 'PFP', 'IUI'], key: {
        I: 'create:precision_mechanism', C: 'ae2:singularity', P: 'mekanism:pellet_antimatter',
        F: 'moreup:fragment_tech', U: 'powah:reactor_nitro' } },
    // 대마법사의 서 (마법)
    { id: 'relic_magic', result: 'moreup:relic_magic', pattern: ['AGA', 'SFS', 'ALA'], key: {
        A: 'ebwizardry:astral_diamond', G: 'ebwizardry:magic_crystal_grand', S: 'forbidden_arcanus:eternal_stella',
        F: 'moreup:fragment_magic', L: 'moreup:boss_essence_legendary' } },
    // 전쟁군주의 인장 (전쟁)
    { id: 'relic_war', result: 'moreup:relic_war', pattern: ['IWI', 'CFC', 'ILI'], key: {
        I: 'cataclysm:ignitium_ingot', W: 'cataclysm:witherite_ingot', C: 'cataclysm:cursium_ingot',
        F: 'moreup:fragment_war', L: 'moreup:boss_essence_legendary' } },
    // 용심장 부적 (용)
    { id: 'relic_dragon', result: 'moreup:relic_dragon', pattern: ['FIL', 'HXH', 'LIF'], key: {
        F: 'iceandfire:dragonsteel_fire_ingot', I: 'iceandfire:dragonsteel_ice_ingot', L: 'iceandfire:dragonsteel_lightning_ingot',
        H: 'moreup:boss_essence_legendary', X: 'moreup:fragment_dragon' } },
    // 창공의 깃털 (하늘)
    { id: 'relic_sky', result: 'moreup:relic_sky', pattern: ['GAG', 'MXM', 'GPG'], key: {
        G: 'aether:enchanted_gravitite', A: 'aether:golden_amber', M: 'minecraft:phantom_membrane',
        X: 'moreup:fragment_sky', P: 'aether:victory_medal' } },
    // 황혼의 등불 (황혼)
    { id: 'relic_twilight', result: 'moreup:relic_twilight', pattern: ['KCK', 'TXT', 'KLK'], key: {
        K: 'twilightforest:knightmetal_ingot', C: 'twilightforest:carminite', T: 'twilightforest:fiery_ingot',
        X: 'moreup:fragment_twilight', L: 'twilightforest:lamp_of_cinders' } },
    // 심연의 눈 (심연)
    { id: 'relic_depths', result: 'moreup:relic_depths', pattern: ['WSW', 'HXH', 'WCW'], key: {
        W: 'deeperdarker:warden_carapace', S: 'deeperdarker:soul_crystal', H: 'minecraft:heart_of_the_sea',
        X: 'moreup:fragment_depths', C: 'minecraft:conduit' } },
    // 풍요의 뿔 (풍요)
    { id: 'relic_harvest', result: 'moreup:relic_harvest', pattern: ['GRG', 'AXA', 'GCG'], key: {
        G: 'minecraft:golden_carrot', R: 'farmersdelight:roast_chicken_block', A: 'minecraft:enchanted_golden_apple',
        X: 'moreup:fragment_harvest', C: 'minecraft:cake' } },
    // 종말의 모래시계 (종말)
    { id: 'relic_end', result: 'moreup:relic_end', pattern: ['SBS', 'TXT', 'SNS'], key: {
        S: 'minecraft:shulker_shell', B: 'minecraft:dragon_breath', T: 'minecraft:totem_of_undying',
        X: 'moreup:fragment_end', N: 'minecraft:nether_star' } },
    // 성룡의 핵: 성룡의 비늘 7 + 황혼의 파편 + 전설 보스 정수
    { id: 'star_core', result: 'moreup:star_core', pattern: ['SLS', 'SDS', 'SSS'], key: {
        S: 'moreup:star_scale', L: 'moreup:boss_essence_legendary', D: 'moreup:dusk_fragment' } },
    // 성룡의 날개: 겉날개 + 황혼의 망토 + 성룡의 핵 4
    { id: 'star_wings', result: 'moreup:star_wings', pattern: ['C C', 'EKE', 'C C'], key: {
        C: 'moreup:star_core', E: 'minecraft:elytra', K: 'moreup:dusk_cape' } }
]

// 황혼 장비 → 성룡 장비 (대장장이 작업대)
const MOREUP_STAR_UPGRADES = [
    ['moreup:dusk_sword', 'moreup:star_sword'],
    ['moreup:dusk_greatsword', 'moreup:star_greatsword'],
    ['moreup:dusk_claw', 'moreup:star_claw'],
    ['moreup:dusk_spear', 'moreup:star_spear'],
    ['moreup:dusk_bow', 'moreup:star_bow'],
    ['moreup:dusk_crown', 'moreup:star_helm'],
    ['moreup:dusk_cuirass', 'moreup:star_chestplate'],
    ['moreup:dusk_greaves', 'moreup:star_leggings'],
    ['moreup:dusk_boots', 'moreup:star_boots']
]

function moreupItemMissing(id) {
    return Item.of(id).isEmpty()
}

ServerEvents.recipes(event => {
    let applied = 0
    let skipped = 0
    let total = MOREUP_RELIC_RECIPES.length + MOREUP_STAR_UPGRADES.length
    MOREUP_RELIC_RECIPES.forEach(r => {
        try {
            if (moreupItemMissing(r.result)) { skipped++; return }   // 모드가 아직 없음
            let missing = []
            for (let k in r.key) { if (moreupItemMissing(r.key[k])) missing.push(r.key[k]) }
            if (missing.length > 0) {
                console.error(`[MoreUp] 최종 확장 레시피 ${r.id} 재료 없음: ${missing.join(', ')}`)
                return
            }
            event.shaped(r.result, r.pattern, r.key).id(`moreup:endgame/${r.id}`)
            applied++
        } catch (e) {
            console.error(`[MoreUp] 최종 확장 레시피 등록 실패 (${r.id}): ${e}`)
        }
    })
    MOREUP_STAR_UPGRADES.forEach(u => {
        try {
            if (moreupItemMissing(u[1]) || moreupItemMissing('moreup:star_core')) { skipped++; return }
            if (moreupItemMissing(u[0])) {
                console.error(`[MoreUp] 성룡 강화 레시피 재료 없음: ${u[0]}`)
                return
            }
            event.custom({
                type: 'minecraft:smithing_transform',
                template: { item: 'moreup:star_core' },
                base: { item: u[0] },
                addition: { item: 'moreup:star_core' },
                result: { item: u[1] }
            }).id(`moreup:endgame/upgrade_${u[1].substring(u[1].indexOf(':') + 1)}`)
            applied++
        } catch (e) {
            console.error(`[MoreUp] 성룡 강화 레시피 등록 실패 (${u[1]}): ${e}`)
        }
    })
    console.info(`[MoreUp] 최종 확장 레시피 ${applied}/${total}개 등록 (모드 아이템이 없어 건너뜀 ${skipped})`)
})
